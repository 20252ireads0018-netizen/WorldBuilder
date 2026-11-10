<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="description" content="Worldbuilder: desenhe o mapa do seu mundo de fantasia em 3D e povoe cada lugar com NPCs, lojas e itens. Ferramenta gratuita da Websight.">
    <meta name="theme-color" content="#140d07">
    <title>@yield('title', 'Worldbuilder')</title>
    <link rel="icon" href="{{ asset('favicon.svg') }}" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=IM+Fell+English:ital@0;1&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="{{ asset('css/worldbuilder.css') }}?v={{ @filemtime(public_path('css/worldbuilder.css')) ?: 1 }}">
</head>
<body class="wb">
    <header class="wb-topo">
        <a class="wb-marca" href="{{ url('/') }}">
            @include('partials.bussola')
            <span>Worldbuilder</span>
        </a>
        <nav class="wb-menu" aria-label="Conta">
            <a href="{{ route('worldbuilder.explorar') }}" @class(['on' => request()->routeIs('worldbuilder.explorar')])>Explorar</a>
            <a href="{{ route('planos') }}" @class(['on' => request()->routeIs('planos')])>Planos</a>
            @auth
                <a href="{{ route('worldbuilder.index') }}" @class(['on' => request()->routeIs('worldbuilder.index')])>Meus mundos</a>
                @if (auth()->user()->is_admin)
                    @php($informados = \App\Models\Pagamento::where('status', 'informado')->count())
                    <a href="{{ route('admin.pagamentos') }}" @class(['on' => request()->routeIs('admin.*')])>Pagamentos @if($informados)<span class="contador">{{ $informados }}</span>@endif</a>
                @endif
                <span class="wb-nome" title="{{ auth()->user()->name }}">
                    <span class="wb-avatar" aria-hidden="true">{{ mb_strtoupper(mb_substr(auth()->user()->name, 0, 1)) }}</span>
                    <span class="wb-nome-txt">{{ auth()->user()->name }}</span>
                    @if (auth()->user()->temPlanoPago())<span class="selo publico selo-plano">Cartógrafo</span>@endif
                </span>
                <form method="POST" action="{{ route('logout') }}">
                    @csrf
                    <button type="submit" class="wb-link">Sair</button>
                </form>
            @else
                <a href="{{ route('login') }}" @class(['on' => request()->routeIs('login')])>Entrar</a>
                <a href="{{ route('register') }}" class="btn primary">Criar conta</a>
            @endauth
        </nav>
    </header>

    <main>
        @yield('conteudo')
    </main>

    <footer class="wb-rodape">
        @include('partials.bussola', ['classe' => 'pequena'])
        <span>Worldbuilder, uma ferramenta da <a href="https://websight.com.br/">Websight</a></span>
        <span aria-hidden="true">·</span>
        <a href="https://praga-vermelha.websight.com.br/">Praga Vermelha RPG</a>
    </footer>
</body>
</html>
