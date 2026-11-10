<?php

namespace App\Http\Controllers;

use App\Models\Feature;
use App\Models\Item;
use App\Models\Npc;
use App\Models\Shop;
use App\Models\User;
use App\Models\World;
use App\Support\Aparencia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * API JSON do editor 3D (public/js/worldbuilder.js). Editar exige ser o dono do mundo;
 * ler (data) vale para o dono, jogadores convidados e qualquer pessoa se o mundo for público.
 */
class WorldbuilderApiController extends Controller
{
    public const MAX_LOCAIS = 400;
    public const MAX_FILHOS = 200; // NPCs, lojas ou itens por local
    public const MAX_JOGADORES = 50;
    public const MAX_CAPA = 400_000; // bytes do JPEG da capa

    private const RELACOES = ['npcs', 'shops.items', 'looseItems'];

    private function full(Feature $feature): Feature
    {
        return $feature->load(self::RELACOES);
    }

    private function exigirDono(World $world): void
    {
        abort_unless((int) $world->user_id === (int) Auth::id(), 404);
    }

    private function exigirDonoDoLocal(Feature $feature): void
    {
        $this->exigirDono($feature->world);
    }

    /** Garante que a loja informada pertence ao local. */
    private function checkShop(Feature $feature, $shopId): void
    {
        if ($shopId && ! $feature->shops()->whereKey((int) $shopId)->exists()) {
            abort(422, 'Loja inválida para este local.');
        }
    }

    private function limiteFilhos(Feature $feature, string $relacao): void
    {
        if ($feature->{$relacao}()->count() >= self::MAX_FILHOS) {
            abort(422, 'Este local já tem itens demais.');
        }
    }

    public function data(World $world): JsonResponse
    {
        $user = Auth::user();
        abort_unless($world->podeVer($user), 404);
        $dono = $world->ehDono($user);

        $q = $world->features()->with(self::RELACOES);
        if (! $dono) {
            $q->where('secret', false);
        }

        return response()->json([
            'world' => $this->mundoJson($world, $dono),
            'features' => $q->get(),
            'can_edit' => $dono,
        ]);
    }

    private function mundoJson(World $world, bool $dono): array
    {
        $out = $world->only('id', 'name', 'description', 'visibility');
        $out['dimension'] = (int) ($world->dimension ?: 200);
        $out['theme'] = $world->tema();
        $out['owner'] = $world->owner?->name;
        $out['cover'] = $world->urlCapa();
        if ($dono) {
            $lim = $world->owner?->limites() ?? config('planos.limites.gratis');
            $out['plano'] = [
                'pago' => (bool) $world->owner?->temPlanoPago(),
                'dimensao_max' => $lim['dimensao'],
                'dimensoes' => config('planos.dimensoes'),
                'url' => route('planos'),
            ];
            $out['players'] = $world->players()->orderBy('name')->get(['users.id', 'name', 'email'])
                ->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email])->values();
        }

        return $out;
    }

    // ---- Mundo (nome, aparência, visibilidade) ------------------------

    public function updateWorld(Request $request, World $world): JsonResponse
    {
        $this->exigirDono($world);

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:80',
            'description' => 'sometimes|nullable|string|max:1000',
            'visibility' => 'sometimes|required|in:private,public',
            'dimension' => ['sometimes', 'required', 'integer', Rule::in(array_keys(config('planos.dimensoes')))],
        ] + Aparencia::regras());

        if (isset($data['dimension']) && (int) $data['dimension'] !== (int) $world->dimension) {
            $user = $request->user();
            if ($data['dimension'] > $user->limites()['dimensao']) {
                return response()->json([
                    'message' => 'Mapas maiores que ' . $user->limites()['dimensao'] . ' fazem parte do plano Cartógrafo.',
                    'redirect' => route('planos', ['motivo' => 'dimensao']),
                ], 402);
            }
            // Encolher não pode deixar lugares fora do mapa
            $meia = intdiv((int) $data['dimension'], 2);
            $fora = $world->features()->where(fn ($q) => $q->where('x', '<', -$meia)->orWhere('x', '>', $meia)
                ->orWhere('z', '<', -$meia)->orWhere('z', '>', $meia))->count();
            if ($fora) {
                abort(422, "$fora " . ($fora === 1 ? 'lugar ficaria' : 'lugares ficariam') . ' fora do mapa nesse tamanho. Mova ou exclua antes de encolher.');
            }
            $world->dimension = (int) $data['dimension'];
        }

        $world->fill(array_intersect_key($data, array_flip(['name', 'description'])));
        if (isset($data['visibility'])) {
            $world->visibility = $data['visibility'];
        }
        if (isset($data['theme'])) {
            $world->theme = Aparencia::normalizar($data['theme']);
        }
        $world->save();

        return response()->json(['world' => $this->mundoJson($world, true)]);
    }

    /** Capa do mundo (miniatura JPEG tirada do próprio canvas), usada na lista e em Explorar. */
    public function storeCover(Request $request, World $world): JsonResponse
    {
        $this->exigirDono($world);
        $request->validate(['image' => 'required|string|max:' . (int) ceil(self::MAX_CAPA * 1.4)]);

        $img = (string) $request->input('image');
        abort_unless(str_starts_with($img, 'data:image/jpeg;base64,'), 422, 'A capa precisa ser JPEG.');
        $bin = base64_decode(substr($img, 23), true);
        abort_unless($bin !== false && strlen($bin) <= self::MAX_CAPA && str_starts_with($bin, "\xFF\xD8\xFF"), 422, 'Imagem inválida.');

        Storage::disk('local')->put($world->caminhoCapa(), $bin);
        $world->cover_version = (int) ($world->cover_version ?? 0) + 1;
        $world->timestamps = false; // capa não conta como edição do mapa
        $world->save();

        return response()->json(['cover' => $world->urlCapa()]);
    }

    // ---- Jogadores convidados (só veem o mapa) ------------------------

    public function storePlayer(Request $request, World $world): JsonResponse
    {
        $this->exigirDono($world);
        $data = $request->validate(['email' => 'required|email|max:255']);

        $user = User::where('email', mb_strtolower(trim($data['email'])))->first();
        if (! $user) {
            abort(422, 'Ninguém com esse e-mail tem conta no Worldbuilder. Peça para a pessoa se cadastrar primeiro.');
        }
        if ($world->ehDono($user)) {
            abort(422, 'Você já é o dono deste mundo.');
        }
        if ($world->players()->count() >= self::MAX_JOGADORES) {
            abort(422, 'Este mundo chegou ao limite de ' . self::MAX_JOGADORES . ' jogadores.');
        }
        $world->players()->syncWithoutDetaching([$user->id]);

        return response()->json(['world' => $this->mundoJson($world, true)], 201);
    }

    public function destroyPlayer(World $world, User $user): JsonResponse
    {
        $this->exigirDono($world);
        $world->players()->detach($user->id);

        return response()->json(['world' => $this->mundoJson($world, true)]);
    }

    // ---- Locais -------------------------------------------------------

    public function storeFeature(Request $request, World $world): JsonResponse
    {
        $this->exigirDono($world);

        $data = $request->validate([
            'type' => 'required|in:' . implode(',', Aparencia::TIPOS),
            'name' => 'required|string|max:80',
            'description' => 'nullable|string|max:2000',
            'skin' => ['nullable', Rule::in(Aparencia::SKINS[$request->input('type')] ?? [])],
            'color' => ['nullable', 'regex:' . Aparencia::COR],
            'secret' => 'nullable|boolean',
        ] + Aparencia::regrasLugar((int) $world->dimension));
        $data['shape'] = Aparencia::formato($data['shape'] ?? null);

        if ($data['type'] === 'river' && count($data['points'] ?? []) < 2) {
            abort(422, 'Um rio precisa de pelo menos dois pontos.');
        }
        if ($data['type'] !== 'river') {
            $data['points'] = null;
        }
        if ($world->features()->count() >= self::MAX_LOCAIS) {
            abort(422, 'Este mapa chegou ao limite de ' . self::MAX_LOCAIS . ' lugares.');
        }

        $feature = $world->features()->create($data);
        $world->touch();

        return response()->json($this->full($feature), 201);
    }

    public function updateFeature(Request $request, Feature $feature): JsonResponse
    {
        $this->exigirDonoDoLocal($feature);

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:80',
            'description' => 'sometimes|nullable|string|max:2000',
            'skin' => ['sometimes', 'nullable', Rule::in(Aparencia::SKINS[$feature->type] ?? [])],
            'color' => ['sometimes', 'nullable', 'regex:' . Aparencia::COR],
            'secret' => 'sometimes|boolean',
        ] + Aparencia::regrasLugar((int) $feature->world->dimension, true));
        if (isset($data['points']) && $feature->type !== 'river') {
            unset($data['points']);
        }
        if (array_key_exists('shape', $data)) {
            $data['shape'] = Aparencia::formato($data['shape']);
        }
        if (isset($data['color'])) {
            $data['color'] = strtolower($data['color']);
        }

        $feature->update($data);
        $feature->world->touch();

        return response()->json($this->full($feature));
    }

    public function destroyFeature(Feature $feature): JsonResponse
    {
        $this->exigirDonoDoLocal($feature);
        $feature->delete();

        return response()->json(['ok' => true]);
    }

    // ---- NPCs ---------------------------------------------------------

    public function storeNpc(Request $request, Feature $feature): JsonResponse
    {
        $this->exigirDonoDoLocal($feature);

        $data = $request->validate([
            'name' => 'required|string|max:80',
            'role' => 'nullable|string|max:80',
            'description' => 'nullable|string|max:2000',
            'shop_id' => 'nullable|integer',
        ]);
        $this->checkShop($feature, $data['shop_id'] ?? null);
        $this->limiteFilhos($feature, 'npcs');

        $feature->npcs()->create($data);

        return response()->json($this->full($feature), 201);
    }

    public function destroyNpc(Npc $npc): JsonResponse
    {
        $feature = $npc->feature;
        $this->exigirDonoDoLocal($feature);
        $npc->delete();

        return response()->json($this->full($feature));
    }

    // ---- Lojas --------------------------------------------------------

    public function storeShop(Request $request, Feature $feature): JsonResponse
    {
        $this->exigirDonoDoLocal($feature);

        if (! in_array($feature->type, ['city', 'village'], true)) {
            abort(422, 'Lojas só existem em cidades e vilas.');
        }

        $data = $request->validate([
            'name' => 'required|string|max:80',
            'description' => 'nullable|string|max:2000',
        ]);
        $this->limiteFilhos($feature, 'shops');

        $feature->shops()->create($data);

        return response()->json($this->full($feature), 201);
    }

    public function destroyShop(Shop $shop): JsonResponse
    {
        $feature = $shop->feature;
        $this->exigirDonoDoLocal($feature);
        $shop->delete();

        return response()->json($this->full($feature));
    }

    // ---- Itens --------------------------------------------------------

    public function storeItem(Request $request, Feature $feature): JsonResponse
    {
        $this->exigirDonoDoLocal($feature);

        $data = $request->validate([
            'name' => 'required|string|max:80',
            'description' => 'nullable|string|max:2000',
            'price' => 'nullable|integer|min:0|max:100000000',
            'quantity' => 'nullable|integer|min:1|max:100000',
            'shop_id' => 'nullable|integer',
        ]);
        $this->checkShop($feature, $data['shop_id'] ?? null);
        $this->limiteFilhos($feature, 'items');

        $data['price'] ??= 0;
        $data['quantity'] ??= 1;
        $feature->items()->create($data);

        return response()->json($this->full($feature), 201);
    }

    public function destroyItem(Item $item): JsonResponse
    {
        $feature = $item->feature;
        $this->exigirDonoDoLocal($feature);
        $item->delete();

        return response()->json($this->full($feature));
    }
}
