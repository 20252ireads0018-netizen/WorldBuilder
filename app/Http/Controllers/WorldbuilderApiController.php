<?php

namespace App\Http\Controllers;

use App\Models\Feature;
use App\Models\Item;
use App\Models\Npc;
use App\Models\Shop;
use App\Models\World;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * API JSON do editor 3D (public/js/worldbuilder.js). Tudo passa pela checagem de dono do mundo.
 */
class WorldbuilderApiController extends Controller
{
    public const MAX_LOCAIS = 400;
    public const MAX_FILHOS = 200; // NPCs, lojas ou itens por local

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
        $this->exigirDono($world);

        return response()->json([
            'world' => $world->only('id', 'name'),
            'features' => $world->features()->with(self::RELACOES)->get(),
        ]);
    }

    // ---- Locais -------------------------------------------------------

    public function storeFeature(Request $request, World $world): JsonResponse
    {
        $this->exigirDono($world);

        $data = $request->validate([
            'type' => 'required|in:mountain,lake,river,city,village',
            'name' => 'required|string|max:80',
            'description' => 'nullable|string|max:2000',
            'x' => 'required|numeric|between:-100,100',
            'z' => 'required|numeric|between:-100,100',
            'size' => 'required|numeric|between:1,60',
            'points' => 'nullable|array|max:200',
            'points.*' => 'array|size:2',
            'points.*.*' => 'numeric|between:-100,100',
        ]);

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
            'size' => 'sometimes|required|numeric|between:1,60',
            'x' => 'sometimes|required|numeric|between:-100,100',
            'z' => 'sometimes|required|numeric|between:-100,100',
        ]);

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
