<?php

/*
 * Planos do Worldbuilder. Pagamento por Pix direto na chave da administração (config/pix.php),
 * confirmado à mão em /admin/pagamentos.
 */
return [
    // Limites de cada nível. "dimensao" = lado do mapa em unidades (o padrão antigo era 200).
    'limites' => [
        'gratis' => ['mundos' => 2, 'dimensao' => 200],
        'pago' => ['mundos' => 100, 'dimensao' => 600],
    ],

    // Tamanhos de mapa que o editor oferece
    'dimensoes' => [
        160 => 'Pequeno',
        200 => 'Médio',
        300 => 'Grande',
        400 => 'Vasto',
        600 => 'Continente',
    ],

    // O que dá para comprar: dias = null é para sempre
    'ofertas' => [
        'mensal' => ['nome' => 'Mensal', 'valor' => 9.90, 'dias' => 31, 'descricao' => 'Um mês de plano Cartógrafo.'],
        'anual' => ['nome' => 'Anual', 'valor' => 79.90, 'dias' => 366, 'descricao' => 'Um ano inteiro, sai por menos de R$ 7 por mês.'],
        'vitalicio' => ['nome' => 'Vitalício', 'valor' => 149.90, 'dias' => null, 'descricao' => 'Pague uma vez e use para sempre.'],
    ],
];
