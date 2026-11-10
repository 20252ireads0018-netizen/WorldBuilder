<?php

namespace App\Support;

use App\Http\Controllers\WorldbuilderApiController as Api;
use App\Models\Feature;
use App\Models\World;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Exporta um mundo para um arquivo JSON e cria mundos a partir dele.
 * Serve para o botão Exportar/Importar e também para Duplicar e Copiar mundo público.
 */
final class MundoArquivo
{
    public const FORMATO = 'worldbuilder';

    /** @param bool $comSegredos false = deixa de fora os locais secretos (cópia de mundo alheio). */
    public static function exportar(World $world, bool $comSegredos = true): array
    {
        $q = $world->features()->with(['npcs', 'shops', 'items'])->orderBy('id');
        if (! $comSegredos) {
            $q->where('secret', false);
        }

        $features = $q->get()->map(function (Feature $f) {
            $idx = $f->shops->pluck('id')->flip();
            $loja = fn ($id) => $id !== null && isset($idx[$id]) ? $idx[$id] : null;

            return [
                'type' => $f->type,
                'name' => $f->name,
                'description' => $f->description,
                'x' => $f->x,
                'z' => $f->z,
                'size' => $f->size,
                'points' => $f->points,
                'skin' => $f->skin,
                'color' => $f->color,
                'secret' => $f->secret,
                'shops' => $f->shops->map(fn ($s) => ['name' => $s->name, 'description' => $s->description])->values()->all(),
                'npcs' => $f->npcs->map(fn ($n) => [
                    'name' => $n->name, 'role' => $n->role, 'description' => $n->description, 'shop' => $loja($n->shop_id),
                ])->values()->all(),
                'items' => $f->items->map(fn ($i) => [
                    'name' => $i->name, 'description' => $i->description, 'price' => $i->price,
                    'quantity' => $i->quantity, 'shop' => $loja($i->shop_id),
                ])->values()->all(),
            ];
        })->values()->all();

        return [
            'formato' => self::FORMATO,
            'versao' => 1,
            'name' => $world->name,
            'description' => $world->description,
            'theme' => $world->tema(),
            'features' => $features,
        ];
    }

    /**
     * Valida o arquivo e cria o mundo para o usuário. Lança ValidationException se o arquivo for inválido.
     */
    public static function importar(array $dados, int $userId, ?string $nome = null): World
    {
        $max = Api::MAX_FILHOS;
        $v = Validator::make($dados, [
            'formato' => 'required|in:' . self::FORMATO,
            'name' => 'required|string|max:80',
            'description' => 'nullable|string|max:1000',
            'theme' => 'nullable|array',
            'features' => 'present|array|max:' . Api::MAX_LOCAIS,
            'features.*.type' => 'required|in:' . implode(',', Aparencia::TIPOS),
            'features.*.name' => 'required|string|max:80',
            'features.*.description' => 'nullable|string|max:2000',
            'features.*.x' => 'required|numeric|between:-100,100',
            'features.*.z' => 'required|numeric|between:-100,100',
            'features.*.size' => 'required|numeric|between:1,60',
            'features.*.points' => 'nullable|array|max:200',
            'features.*.points.*' => 'array|size:2',
            'features.*.points.*.*' => 'numeric|between:-100,100',
            'features.*.skin' => 'nullable|string|max:20',
            'features.*.color' => ['nullable', 'regex:' . Aparencia::COR],
            'features.*.secret' => 'nullable|boolean',
            'features.*.shops' => "nullable|array|max:$max",
            'features.*.shops.*.name' => 'required|string|max:80',
            'features.*.shops.*.description' => 'nullable|string|max:2000',
            'features.*.npcs' => "nullable|array|max:$max",
            'features.*.npcs.*.name' => 'required|string|max:80',
            'features.*.npcs.*.role' => 'nullable|string|max:80',
            'features.*.npcs.*.description' => 'nullable|string|max:2000',
            'features.*.npcs.*.shop' => 'nullable|integer|min:0',
            'features.*.items' => "nullable|array|max:$max",
            'features.*.items.*.name' => 'required|string|max:80',
            'features.*.items.*.description' => 'nullable|string|max:2000',
            'features.*.items.*.price' => 'nullable|integer|min:0|max:100000000',
            'features.*.items.*.quantity' => 'nullable|integer|min:1|max:100000',
            'features.*.items.*.shop' => 'nullable|integer|min:0',
        ], [
            'formato.*' => 'Esse arquivo não é um mundo exportado do Worldbuilder.',
        ]);
        $d = $v->validate();

        return DB::transaction(function () use ($d, $userId, $nome) {
            $world = new World(['name' => $nome ?? $d['name'], 'description' => $d['description'] ?? null]);
            $world->user_id = $userId;
            $world->theme = Aparencia::normalizar($d['theme'] ?? null);
            $world->save();

            foreach ($d['features'] as $f) {
                $rio = $f['type'] === 'river';
                if ($rio && count($f['points'] ?? []) < 2) {
                    continue;
                }
                $skin = $f['skin'] ?? null;
                $feature = $world->features()->create([
                    'type' => $f['type'],
                    'name' => $f['name'],
                    'description' => $f['description'] ?? null,
                    'x' => $f['x'],
                    'z' => $f['z'],
                    'size' => $f['size'],
                    'points' => $rio ? $f['points'] : null,
                    'skin' => Aparencia::skinValida($f['type'], $skin) ? $skin : null,
                    'color' => isset($f['color']) ? strtolower($f['color']) : null,
                    'secret' => (bool) ($f['secret'] ?? false),
                ]);

                $lojas = [];
                if (in_array($f['type'], ['city', 'village'], true)) {
                    foreach ($f['shops'] ?? [] as $s) {
                        $lojas[] = $feature->shops()->create(['name' => $s['name'], 'description' => $s['description'] ?? null])->id;
                    }
                }
                $loja = fn ($i) => $i !== null && isset($lojas[$i]) ? $lojas[$i] : null;

                foreach ($f['npcs'] ?? [] as $n) {
                    $feature->npcs()->create([
                        'name' => $n['name'], 'role' => $n['role'] ?? null,
                        'description' => $n['description'] ?? null, 'shop_id' => $loja($n['shop'] ?? null),
                    ]);
                }
                foreach ($f['items'] ?? [] as $i) {
                    $feature->items()->create([
                        'name' => $i['name'], 'description' => $i['description'] ?? null,
                        'price' => $i['price'] ?? 0, 'quantity' => $i['quantity'] ?? 1, 'shop_id' => $loja($i['shop'] ?? null),
                    ]);
                }
            }

            return $world;
        });
    }
}
