<?php

namespace App\Support;

/**
 * Catálogo do que o editor sabe desenhar: fundos, estilos de mapa, cores do tema e skins de cada tipo de local.
 * Os nomes exibidos ficam no JS (public/js/worldbuilder.js); aqui ficam as chaves válidas e o tema padrão.
 */
final class Aparencia
{
    public const TIPOS = ['mountain', 'lake', 'river', 'city', 'village', 'forest'];

    public const FUNDOS = ['pergaminho', 'oceano', 'noite', 'nevoa', 'cor'];

    public const ESTILOS = ['pergaminho', 'natural', 'ilustrado'];

    public const CORES = ['fundo', 'terra', 'montanha', 'agua', 'tinta'];

    private const AGUA = ['calma', 'cristalina', 'congelada', 'pantano', 'lava'];
    private const POVOADO = ['medieval', 'elfica', 'deserto', 'nordica', 'fortaleza', 'oriental', 'ruinas'];

    public const SKINS = [
        'mountain' => ['classica', 'picos', 'vulcao', 'colinas', 'rochosa', 'cristal'],
        'lake' => self::AGUA,
        'river' => self::AGUA,
        'city' => self::POVOADO,
        'village' => self::POVOADO,
        'forest' => ['carvalhos', 'pinheiros', 'outono', 'morta', 'magica'],
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

    public static function skinValida(string $tipo, ?string $skin): bool
    {
        return $skin === null || in_array($skin, self::SKINS[$tipo] ?? [], true);
    }
}
