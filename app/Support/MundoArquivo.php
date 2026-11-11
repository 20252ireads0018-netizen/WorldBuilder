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
        $eras = $world->eras()->get()->map(fn ($e) => [
            'name' => $e->name, 'periodo' => $e->periodo, 'description' => $e->description,
            'features' => self::lugaresDaEra($e->features(), $comSegredos),
        ])->values()->all();

        return [
            'formato' => self::FORMATO,
            'versao' => 2,
            'name' => $world->name,
            'description' => $world->description,
            'dimension' => (int) ($world->dimension ?: 200),
            'theme' => $world->tema(),
            'features' => $eras[0]['features'] ?? [], // arquivos antigos (sem eras) leem só isto
            'eras' => $eras,
        ];
    }

    private static function lugaresDaEra($relacao, bool $comSegredos): array
    {
        $q = $relacao->with(['npcs', 'shops', 'items'])->orderBy('id');
        if (! $comSegredos) {
            $q->where('secret', false);
        }

        return $q->get()->map(function (Feature $f) {
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
                'shape' => $f->shape,
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
    }

    /**
     * Valida o arquivo e cria o mundo para o usuário. Lança ValidationException se o arquivo for inválido.
     */
    public static function importar(array $dados, int $userId, ?string $nome = null): World
    {
        $max = Api::MAX_FILHOS;
        $dimensao = self::dimensaoValida((int) ($dados['dimension'] ?? 200));
        $lugar = [];
        foreach (Aparencia::regrasLugar($dimensao) as $k => $r) {
            $lugar['features.*.' . $k] = $r;
        }
        $v = Validator::make($dados, [
            'formato' => 'required|in:' . self::FORMATO,
            'name' => 'required|string|max:80',
            'description' => 'nullable|string|max:1000',
            'dimension' => 'nullable|integer|between:' . config('planos.dimensao_min') . ',' . config('planos.dimensao_max'),
            'theme' => 'nullable|array',
            'features' => 'present|array|max:' . Api::MAX_LOCAIS,
            'features.*.type' => 'required|in:' . implode(',', Aparencia::TIPOS),
            'features.*.name' => 'nullable|string|max:80',
            'features.*.description' => 'nullable|string|max:2000',
            'eras' => 'nullable|array|max:' . Api::MAX_ERAS,
            'eras.*.name' => 'required|string|max:80',
            'eras.*.periodo' => 'nullable|string|max:80',
            'eras.*.description' => 'nullable|string|max:2000',
            'eras.*.features' => 'present|array|max:' . Api::MAX_LOCAIS,
        ] + $lugar + [
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
        // os lugares de cada era passam pelas mesmas regras dos lugares do arquivo
        foreach ($d['eras'] ?? [] as $i => $era) {
            $regras = array_intersect_key($v->getRules(), array_flip(array_filter(array_keys($v->getRules()), fn ($k) => str_starts_with($k, 'features.'))));
            Validator::make(['features' => $dados['eras'][$i]['features'] ?? []], $regras)->validate();
            $d['eras'][$i]['features'] = $dados['eras'][$i]['features'] ?? [];
        }

        return DB::transaction(function () use ($d, $userId, $nome, $dimensao) {
            $world = new World(['name' => $nome ?? $d['name'], 'description' => $d['description'] ?? null]);
            $world->dimension = $dimensao;
            $world->user_id = $userId;
            $world->theme = Aparencia::normalizar($d['theme'] ?? null);
            $world->save();

            if (! empty($d['eras'])) {
                foreach ($d['eras'] as $i => $e) {
                    $dadosEra = ['name' => $e['name'], 'periodo' => $e['periodo'] ?? null, 'description' => $e['description'] ?? null, 'ordem' => $i];
                    $era = $i === 0 ? tap($world->eraPrincipal())->update($dadosEra) : $world->eras()->create($dadosEra);
                    foreach ($e['features'] as $f) {
                        self::criarLugar($world, $f, $era->id);
                    }
                }
            } else {
                foreach ($d['features'] as $f) {
                    self::criarLugar($world, $f);
                }
            }

            return $world;
        });
    }
    public static function dimensaoValida(int $d): int
    {
        $d = max((int) config('planos.dimensao_min'), min((int) config('planos.dimensao_max'), $d ?: 200));

        return $d - ($d % 2);
    }

    /** Lugar no formato do arquivo (com NPCs, lojas e itens): usado na importação e no Desfazer de uma exclusão. */
    public static function criarLugar(World $world, array $f, ?int $eraId = null): ?Feature
    {
        $linha = in_array($f['type'], Aparencia::COM_PONTOS, true);
        if ($linha && count($f['points'] ?? []) < Aparencia::minPontos($f['type'])) {
            return null;
        }
        $skin = $f['skin'] ?? null;
        $feature = $world->features()->create([
            'type' => $f['type'],
            'name' => trim((string) ($f['name'] ?? '')),
            'description' => $f['description'] ?? null,
            'x' => $f['x'],
            'z' => $f['z'],
            'size' => $f['size'],
            'points' => $linha ? $f['points'] : null,
            'shape' => Aparencia::formato($f['shape'] ?? null),
            'skin' => Aparencia::skinValida($f['type'], $skin) ? $skin : null,
            'color' => isset($f['color']) ? strtolower($f['color']) : null,
            'secret' => (bool) ($f['secret'] ?? false),
            'era_id' => $eraId,
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

        return $feature;
    }

    /** Regras de um lugar no formato do arquivo, com prefixo ('features.*.' na importação, 'feature.' no Desfazer). */
    public static function regrasLugarArquivo(string $p, int $dimensao): array
    {
        $max = Api::MAX_FILHOS;
        $r = [
            $p . 'type' => 'required|in:' . implode(',', Aparencia::TIPOS),
            $p . 'name' => 'nullable|string|max:80',
            $p . 'description' => 'nullable|string|max:2000',
            $p . 'skin' => 'nullable|string|max:20',
            $p . 'color' => ['nullable', 'regex:' . Aparencia::COR],
            $p . 'secret' => 'nullable|boolean',
            $p . 'shops' => "nullable|array|max:$max",
            $p . 'shops.*.name' => 'required|string|max:80',
            $p . 'shops.*.description' => 'nullable|string|max:2000',
            $p . 'npcs' => "nullable|array|max:$max",
            $p . 'npcs.*.name' => 'required|string|max:80',
            $p . 'npcs.*.role' => 'nullable|string|max:80',
            $p . 'npcs.*.description' => 'nullable|string|max:2000',
            $p . 'npcs.*.shop' => 'nullable|integer|min:0',
            $p . 'items' => "nullable|array|max:$max",
            $p . 'items.*.name' => 'required|string|max:80',
            $p . 'items.*.description' => 'nullable|string|max:2000',
            $p . 'items.*.price' => 'nullable|integer|min:0|max:100000000',
            $p . 'items.*.quantity' => 'nullable|integer|min:1|max:100000',
            $p . 'items.*.shop' => 'nullable|integer|min:0',
        ];
        foreach (Aparencia::regrasLugar($dimensao) as $k => $regra) {
            $r[$p . $k] = $regra;
        }

        return $r;
    }

    /** Um lugar já carregado no formato do arquivo (para o Desfazer da exclusão). */
    public static function lugarParaArquivo(Feature $f): array
    {
        $f->loadMissing(['npcs', 'shops', 'items']);
        $idx = $f->shops->pluck('id')->flip();
        $loja = fn ($id) => $id !== null && isset($idx[$id]) ? $idx[$id] : null;

        return [
            'type' => $f->type, 'name' => $f->name, 'description' => $f->description,
            'x' => $f->x, 'z' => $f->z, 'size' => $f->size, 'points' => $f->points, 'shape' => $f->shape,
            'skin' => $f->skin, 'color' => $f->color, 'secret' => $f->secret,
            'shops' => $f->shops->map(fn ($s) => ['name' => $s->name, 'description' => $s->description])->values()->all(),
            'npcs' => $f->npcs->map(fn ($n) => ['name' => $n->name, 'role' => $n->role, 'description' => $n->description, 'shop' => $loja($n->shop_id)])->values()->all(),
            'items' => $f->items->map(fn ($i) => ['name' => $i->name, 'description' => $i->description, 'price' => $i->price, 'quantity' => $i->quantity, 'shop' => $loja($i->shop_id)])->values()->all(),
        ];
    }
}
