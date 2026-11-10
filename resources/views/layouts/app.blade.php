<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="description" content="Worldbuilder: desenhe o mapa do seu mundo de fantasia em 3D e povoe cada lugar com NPCs, lojas e itens. Ferramenta gratuita da Websight.">
    <title>@yield('title', 'Worldbuilder')</title>
    <link rel="icon" href="{{ asset('favicon.svg') }}" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="{{ asset('css/worldbuilder.css') }}?v={{ @filemtime(public_path('css/worldbuilder.css')) ?: 1 }}">
</head>
<body class="wb">
    <div class="wb-topo">
        <a class="wb-marca" href="{{ url('/') }}">Worldbuilder</a>
        <nav class="wb-menu" aria-label="Conta">
            @auth
                <a href="{{ route('worldbuilder.index') }}">Meus mundos</a>
                <span class="wb-nome">{{ auth()->user()->name }}</span>
                <form method="POST" action="{{ route('logout') }}">
                    @csrf
                    <button type="submit" class="wb-link">Sair</button>
                </form>
            @else
                <a href="{{ route('login') }}">Entrar</a>
                <a href="{{ route('register') }}" class="btn primary">Criar conta</a>
            @endauth
        </nav>
    </div>

    <main>
        @yield('conteudo')
    </main>

    <footer class="wb-rodape">
        <a href="https://websight.com.br/">Websight</a>
        <span aria-hidden="true">·</span>
        <a href="https://praga-vermelha.websight.com.br/">Praga Vermelha RPG</a>
    </footer>
</body>
</html>
