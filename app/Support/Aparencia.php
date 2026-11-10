<?php

namespace App\Support;

/**
 * Catálogo do que o editor sabe desenhar: fundos, estilos de mapa, cores do tema e skins de cada tipo de local.
 * Os nomes exibidos ficam no JS (public/js/worldbuilder.js); aqui ficam as chaves válidas e o tema padrão.
 */
final class Aparencia
{
    public const TIPOS = ['mountain', 'lake', 'river', 'city', 'village', 'forest', 'ocean', 'island', 'road', 'tower', 'ruins', 'phenomenon'];

    /** Tipos desenhados como linha (pontos): rios e estradas. */
    public const LINHAS = ['river', 'road'];

    /** Trocas de tipo permitidas sem refazer o lugar. */
    public const GRUPOS = [['city', 'village'], ['lake', 'ocean'], ['river', 'road'], ['mountain', 'island']];

    public const FUNDOS = ['pergaminho', 'oceano', 'noite', 'nevoa', 'cor'];

    public const ESTILOS = ['pergaminho', 'natural', 'ilustrado'];

    public const CORES = ['fundo', 'terra', 'montanha', 'agua', 'tinta', 'floresta', 'telhado', 'estrada'];

    private const AGUA = ['calma', 'cristalina', 'congelada', 'pantano', 'lava'];
    private const POVOADO = ['medieval', 'elfica', 'deserto', 'nordica', 'fortaleza', 'oriental', 'ruinas'];

    public const SKINS = [
        'mountain' => ['classica', 'picos', 'vulcao', 'colinas', 'rochosa', 'cristal'],
        'lake' => self::AGUA,
        'river' => self::AGUA,
        'city' => self::POVOADO,
        'village' => self::POVOADO,
        'forest' => ['carvalhos', 'pinheiros', 'outono', 'morta', 'magica'],
        'ocean' => ['mar', 'tropical', 'tempestuoso', 'gelado', 'abissal'],
        'island' => ['verde', 'areia', 'tropical', 'vulcanica', 'gelo'],
        'road' => ['terra', 'pedra', 'trilha', 'real'],
        'tower' => ['vigia', 'mago', 'farol', 'sombria', 'elfica'],
        'ruins' => ['castelo', 'templo', 'pedras', 'cidade', 'arcana'],
        'phenomenon' => ['nevoa', 'chuva', 'tempestade', 'terremoto', 'nevasca', 'magia'],
    ];

    public const COR = '/^#[0-9a-fA-F]{6}$/';

    public static function padrao(): array
    {
        return [
            'fundo' => 'pergaminho',
            'estilo' => 'pergaminho',
            'cores' => [
                'fundo' => '#2a1c10',
                'terra' => '#e3c47e',
                'montanha' => '#9a7b52',
                'agua' => '#7f9f93',
                'tinta' => '#4d3017',
                'floresta' => '#4f7a3a',
                'telhado' => '#9a4a2c',
                'estrada' => '#8a6a44',
            ],
            'skins' => array_map(fn (array $s) => $s[0], self::SKINS),
        ];
    }

    /** Junta o tema salvo com o padrão, descartando chaves desconhecidas. */
    public static function normalizar(?array $tema): array
    {
        $p = self::padrao();
        $tema ??= [];

        $out = [
            'fundo' => in_array($tema['fundo'] ?? null, self::FUNDOS, true) ? $tema['fundo'] : $p['fundo'],
            'estilo' => in_array($tema['estilo'] ?? null, self::ESTILOS, true) ? $tema['estilo'] : $p['estilo'],
            'cores' => [],
            'skins' => [],
        ];
        foreach (self::CORES as $c) {
            $v = $tema['cores'][$c] ?? null;
            $out['cores'][$c] = is_string($v) && preg_match(self::COR, $v) ? strtolower($v) : $p['cores'][$c];
        }
        foreach (self::SKINS as $tipo => $lista) {
            $v = $tema['skins'][$tipo] ?? null;
            $out['skins'][$tipo] = in_array($v, $lista, true) ? $v : $p['skins'][$tipo];
        }

        return $out;
    }

    /** Regras de validação do tema enviado pelo editor. */
    public static function regras(string $prefixo = 'theme'): array
    {
        $r = [
            $prefixo => 'array',
            "$prefixo.fundo" => 'required_with:' . $prefixo . '|in:' . implode(',', self::FUNDOS),
            "$prefixo.estilo" => 'required_with:' . $prefixo . '|in:' . implode(',', self::ESTILOS),
            "$prefixo.cores" => 'array',
            "$prefixo.skins" => 'array',
        ];
        foreach (self::CORES as $c) {
            $r["$prefixo.cores.$c"] = ['nullable', 'regex:' . self::COR];
        }
        foreach (self::SKINS as $tipo => $lista) {
            $r["$prefixo.skins.$tipo"] = 'nullable|in:' . implode(',', $lista);
        }

        return $r;
    }

    /** Tipos para os quais um lugar pode virar sem perder nada. */
    public static function trocasDe(string $tipo): array
    {
        foreach (self::GRUPOS as $g) {
            if (in_array($tipo, $g, true)) {
                return $g;
            }
        }

        return [$tipo];
    }

    public static function skinValida(string $tipo, ?string $skin): bool
    {
        return $skin === null || in_array($skin, self::SKINS[$tipo] ?? [], true);
    }

    /**
     * Regras de posição, tamanho e formato de um lugar num mundo de lado $dimensao.
     * $parcial = true para edição (PUT), em que cada campo é opcional.
     */
    public static function regrasLugar(int $dimensao, bool $parcial = false): array
    {
        $meia = intdiv($dimensao, 2);
        $obrig = $parcial ? 'sometimes|required|' : 'required|';

        return [
            'x' => $obrig . "numeric|between:-$meia,$meia",
            'z' => $obrig . "numeric|between:-$meia,$meia",
            'size' => $obrig . 'numeric|between:1,' . max(60, $meia),
            'points' => ($parcial ? 'sometimes|array|min:2' : 'nullable|array') . '|max:200',
            'points.*' => 'array|size:2',
            'points.*.*' => "numeric|between:-$meia,$meia",
            'shape' => ($parcial ? 'sometimes|' : '') . 'nullable|array',
            'shape.esticar' => 'nullable|numeric|between:0.1,10',
            'shape.giro' => 'nullable|numeric|between:0,360',
            'shape.irregular' => 'nullable|numeric|between:0,1',
            'shape.curvas' => 'nullable|numeric|between:0,1',
            'shape.altura' => 'nullable|numeric|between:0.2,3',
            'shape.densidade' => 'nullable|numeric|between:0.2,3',
            'shape.semNome' => 'nullable|boolean',
        ];
    }

    /** Guarda só as chaves conhecidas do formato (null quando tudo está no padrão). */
    public static function formato(?array $shape): ?array
    {
        if (! $shape) {
            return null;
        }
        $out = [];
        if (! empty($shape['semNome'])) {
            $shape['semNome'] = 1;
        }
        foreach (['esticar' => 1.0, 'giro' => 0.0, 'irregular' => -1.0, 'curvas' => 0.0, 'altura' => 1.0, 'densidade' => 1.0, 'semNome' => 0.0] as $k => $padrao) {
            if (isset($shape[$k]) && is_numeric($shape[$k]) && (float) $shape[$k] !== $padrao) {
                $out[$k] = round((float) $shape[$k], 3);
            }
        }

        return $out ?: null;
    }
}
