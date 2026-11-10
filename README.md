# Worldbuilder (Websight)

Site em https://websight.com.br/worldbuilder para desenhar mapas de mundos de fantasia em 3D, no estilo de pergaminho antigo,
e povoar cada lugar com NPCs, lojas e itens. Cada pessoa tem a própria conta e os mundos ficam só dela.

## Rodar localmente

    composer install
    cp .env.example .env && php artisan key:generate
    php artisan migrate
    php artisan serve

O editor carrega Three.js r128 por CDN (cdnjs e jsdelivr).

## Estrutura

- Contas: `AuthController` (/entrar, /cadastro, /sair)
- Mundos: `WorldbuilderController` (/mundos, /mundos/{id}; /mundos/exemplo cria o mundo de exemplo Eldoria)
- API do editor: `WorldbuilderApiController` (/api/...), sempre conferindo o dono do mundo
- Tabelas: `wb_worlds` (com user_id), `wb_features`, `wb_shops`, `wb_npcs`, `wb_items`
- Front: `resources/views/worlds/show.blade.php`, `public/js/worldbuilder.js`, `public/css/worldbuilder.css` (tudo dentro de `.wb`)

## Produção (HostGator)

- Código: `/home2/joaov012/worldbuilder`; docroot: `/home2/joaov012/public_html/worldbuilder` (index.php próprio apontando para o código).
- Banco SQLite em `database/database.sqlite` no servidor (fora do docroot).
