<?php

namespace App\Http\Controllers;

use App\Models\Feature;
use App\Models\Item;
use App\Models\Npc;
use App\Models\Shop;
use App\Models\User;
use App\Models\World;
use App\Support\Aparencia;
use App\Support\MundoArquivo;
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
    public const MAX_NEVOA = 1500; // pinceladas de névoa guardadas por mundo

    private const RELACOES = ['npcs', 'shops.items', 'looseItems'];

    private function full(Feature $feature): Feature
    {
        return $feature->load(self::RELACOES);
    }

    private function exigirDono(World $world): void
    {
        abort_unless((int) $world->user_id === (int) Auth::id(), 404);
    }

    /** Dono ou mestre convidado. */
    private function exigirEditor(World $world): void
    {
        abort_unless($world->podeEditar(Auth::user()), 404);
    }

    private function exigirEditorDoLocal(Feature $feature): void
    {
        $this->exigirEditor($feature->world);
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
        $papel = $world->papel($user);
        $editor = in_array($papel, ['dono', 'mestre'], true);

        $q = $world->features()->with(self::RELACOES);
        if (! $editor) {
            $q->where('secret', false);
        }
        $features = $q->get();

        // Névoa de guerra: quem não é mestre só recebe o que já foi revelado
        $nevoa = $world->nevoa();
        if (! $editor && $nevoa['ativo']) {
            $features = $features->filter(function (Feature $f) use ($nevoa) {
                if (in_array($f->type, Aparencia::LINHAS, true)) {
                    $pts = array_values(array_filter($f->points ?? [], fn ($p) => World::pontoVisivel($nevoa, $p[0], $p[1])));
                    if (count($pts) < 2) {
                        return false;
                    }
                    $f->points = $pts;

                    return true;
                }

                return World::pontoVisivel($nevoa, $f->x, $f->z);
            })->values();
        }

        return response()->json([
            'world' => $this->mundoJson($world, $papel),
            'features' => $features,
            'can_edit' => $editor,
            'papel' => $papel ?? 'visitante',
        ]);
    }

    private function mundoJson(World $world, bool|string|null $papel): array
    {
        $dono = $papel === true || $papel === 'dono';
        $editor = $dono || $papel === 'mestre';
        $out = $world->only('id', 'name', 'description', 'visibility');
        $out['dimension'] = (int) ($world->dimension ?: 200);
        $out['theme'] = $world->tema();
        $out['fog'] = $world->nevoa();
        $out['papel'] = $dono ? 'dono' : ($editor ? 'mestre' : (is_string($papel) ? $papel : 'visitante'));
        $out['owner'] = $world->owner?->name;
        $out['cover'] = $world->urlCapa();
        if ($dono) {
            $lim = $world->owner?->limites() ?? config('planos.limites.gratis');
            $out['plano'] = [
                'pago' => (bool) $world->owner?->temPlanoPago(),
                'dimensao_max' => $lim['dimensao'],
                'dimensao_min' => (int) config('planos.dimensao_min'),
                'dimensoes' => config('planos.dimensoes'),
                'url' => route('planos'),
            ];
            $out['players'] = $world->players()->orderBy('name')->get(['users.id', 'name', 'email'])
                ->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'papel' => $u->pivot->papel ?: 'jogador'])->values();
        }

        return $out;
    }

    // ---- Mundo (nome, aparência, visibilidade) ------------------------

    public function updateWorld(Request $request, World $world): JsonResponse
    {
        $this->exigirEditor($world);
        if (($request->has('visibility') || $request->has('dimension')) && ! $world->ehDono($request->user())) {
            abort(403, 'Só o dono do mundo muda a visibilidade e o tamanho do mapa.');
        }

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:80',
            'description' => 'sometimes|nullable|string|max:1000',
            'visibility' => 'sometimes|required|in:private,public',
            'dimension' => 'sometimes|required|integer|between:' . config('planos.dimensao_min') . ',' . config('planos.dimensao_max'),
        ] + Aparencia::regras());
        if (isset($data['dimension'])) {
            $data['dimension'] -= $data['dimension'] % 2;
        }

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

        return response()->json(['world' => $this->mundoJson($world, $world->papel($request->user()))]);
    }

    /** Névoa de guerra: áreas reveladas (1) ou cobertas de novo (0), aplicadas em ordem. */
    public function updateFog(Request $request, World $world): JsonResponse
    {
        $this->exigirEditor($world);
        $meia = $world->meia() + 50;
        $data = $request->validate([
            'ativo' => 'required|boolean',
            'areas' => 'present|array|max:' . self::MAX_NEVOA,
            'areas.*' => 'array|size:4',
            'areas.*.0' => "numeric|between:-$meia,$meia",
            'areas.*.1' => "numeric|between:-$meia,$meia",
            'areas.*.2' => 'numeric|between:0.5,600',
            'areas.*.3' => 'integer|in:0,1',
        ]);
        $world->fog = [
            'ativo' => (bool) $data['ativo'],
            'areas' => array_map(fn ($a) => [round((float) $a[0], 2), round((float) $a[1], 2), round((float) $a[2], 2), (int) $a[3]], $data['areas']),
        ];
        $world->timestamps = false;
        $world->save();

        return response()->json(['fog' => $world->nevoa()]);
    }

    /** Capa do mundo (miniatura JPEG tirada do próprio canvas), usada na lista e em Explorar. */
    public function storeCover(Request $request, World $world): JsonResponse
    {
        $this->exigirEditor($world);
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
        $data = $request->validate(['email' => 'required|email|max:255', 'papel' => 'nullable|in:jogador,mestre']);
        $papel = $data['papel'] ?? 'jogador';

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
        if ($world->players()->whereKey($user->id)->exists()) {
            $world->players()->updateExistingPivot($user->id, ['papel' => $papel]);
        } else {
            $world->players()->attach($user->id, ['papel' => $papel]);
        }

        return response()->json(['world' => $this->mundoJson($world, true)], 201);
    }

    public function updatePlayer(Request $request, World $world, User $user): JsonResponse
    {
        $this->exigirDono($world);
        $data = $request->validate(['papel' => 'required|in:jogador,mestre']);
        abort_unless($world->players()->whereKey($user->id)->exists(), 404);
        $world->players()->updateExistingPivot($user->id, ['papel' => $data['papel']]);

        return response()->json(['world' => $this->mundoJson($world, true)]);
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
        $this->exigirEditor($world);

        $data = $request->validate([
            'type' => 'required|in:' . implode(',', Aparencia::TIPOS),
            'name' => 'required|string|max:80',
            'description' => 'nullable|string|max:2000',
            'skin' => ['nullable', Rule::in(Aparencia::SKINS[$request->input('type')] ?? [])],
            'color' => ['nullable', 'regex:' . Aparencia::COR],
            'secret' => 'nullable|boolean',
        ] + Aparencia::regrasLugar((int) $world->dimension));
        $data['shape'] = Aparencia::formato($data['shape'] ?? null);

        $linha = in_array($data['type'], Aparencia::LINHAS, true);
        if ($linha && count($data['points'] ?? []) < 2) {
            abort(422, ($data['type'] === 'road' ? 'Uma estrada' : 'Um rio') . ' precisa de pelo menos dois pontos.');
        }
        if (! $linha) {
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
        $this->exigirEditorDoLocal($feature);

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:80',
            'description' => 'sometimes|nullable|string|max:2000',
            'skin' => ['sometimes', 'nullable', Rule::in(Aparencia::SKINS[$feature->type] ?? [])],
            'color' => ['sometimes', 'nullable', 'regex:' . Aparencia::COR],
            'secret' => 'sometimes|boolean',
            'type' => ['sometimes', 'required', Rule::in(Aparencia::trocasDe($feature->type))],
        ] + Aparencia::regrasLugar((int) $feature->world->dimension, true));
        $tipo = $data['type'] ?? $feature->type;
        if (isset($data['points']) && ! in_array($tipo, Aparencia::LINHAS, true)) {
            unset($data['points']);
        }
        // Trocou o tipo: o modelo antigo pode não existir no novo
        if ($tipo !== $feature->type) {
            $skin = array_key_exists('skin', $data) ? $data['skin'] : $feature->skin;
            $data['skin'] = Aparencia::skinValida($tipo, $skin) ? $skin : null;
            if (! in_array($tipo, ['city', 'village'], true) && $feature->shops()->exists()) {
                abort(422, 'Só cidades e vilas têm lojas.');
            }
        } elseif (array_key_exists('skin', $data) && ! Aparencia::skinValida($tipo, $data['skin'])) {
            abort(422, 'Modelo inválido para este lugar.');
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
        $this->exigirEditorDoLocal($feature);
        $copia = MundoArquivo::lugarParaArquivo($feature);
        $feature->delete();

        return response()->json(['ok' => true, 'restaurar' => $copia]);
    }

    /** Desfazer uma exclusão: recria o lugar com NPCs, lojas e itens. */
    public function restoreFeature(Request $request, World $world): JsonResponse
    {
        $this->exigirEditor($world);
        $d = $request->validate(MundoArquivo::regrasLugarArquivo('feature.', (int) $world->dimension));
        if ($world->features()->count() >= self::MAX_LOCAIS) {
            abort(422, 'Este mapa chegou ao limite de ' . self::MAX_LOCAIS . ' lugares.');
        }
        $f = MundoArquivo::criarLugar($world, $d['feature']);
        abort_unless($f, 422, 'Lugar inválido.');
        $world->touch();

        return response()->json($this->full($f), 201);
    }

    // ---- NPCs ---------------------------------------------------------

    public function storeNpc(Request $request, Feature $feature): JsonResponse
    {
        $this->exigirEditorDoLocal($feature);

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
        $this->exigirEditorDoLocal($feature);
        $npc->delete();

        return response()->json($this->full($feature));
    }

    // ---- Lojas --------------------------------------------------------

    public function storeShop(Request $request, Feature $feature): JsonResponse
    {
        $this->exigirEditorDoLocal($feature);

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
        $this->exigirEditorDoLocal($feature);
        $shop->delete();

        return response()->json($this->full($feature));
    }

    // ---- Itens --------------------------------------------------------

    public function storeItem(Request $request, Feature $feature): JsonResponse
    {
        $this->exigirEditorDoLocal($feature);

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
        $this->exigirEditorDoLocal($feature);
        $item->delete();

        return response()->json($this->full($feature));
    }
}
