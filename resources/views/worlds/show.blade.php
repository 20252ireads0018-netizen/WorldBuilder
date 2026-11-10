<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    @if($editar || ! $world->ehPublico())<meta name="robots" content="noindex">@endif
    <title>{{ $world->name }} · Worldbuilder</title>
    @if(! $editar && $world->ehPublico())
        <meta name="description" content="{{ Str::limit($world->description ?: 'Mapa 3D de um mundo de fantasia criado no Worldbuilder.', 155) }}">
        <meta property="og:title" content="{{ $world->name }} · Worldbuilder">
        @if($world->urlCapa())<meta property="og:image" content="{{ $world->urlCapa() }}">@endif
    @endif
    <link rel="icon" href="{{ asset('favicon.svg') }}" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=IM+Fell+English:ital@0;1&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="{{ asset('css/worldbuilder.css') }}?v={{ @filemtime(public_path('css/worldbuilder.css')) ?: 1 }}">
</head>
<body class="wb wb-editor {{ $editar ? '' : 'wb-leitura' }}">
<div id="app"
     data-world="{{ $world->id }}"
     data-api="{{ url('/api') }}"
     data-mode="{{ $editar ? 'edit' : 'view' }}"
     data-url-ver="{{ route('worldbuilder.ver', $world) }}"
     @if($editar)
     data-url-exportar="{{ route('worldbuilder.exportar', $world) }}"
     data-url-copiar="{{ route('worldbuilder.copiar', $world) }}"
     @endif>
    <nav id="tools" aria-label="Ferramentas do mapa">
        @auth
            <a class="back" href="{{ route('worldbuilder.index') }}">Mundos</a>
        @else
            <a class="back" href="{{ route('worldbuilder.explorar') }}">Explorar</a>
        @endauth
        @if($editar)
        <button type="button" class="tool active" data-tool="select">
            <svg viewBox="0 0 24 24"><path d="M5 3l14 8-6 2-2 6z"/></svg>Selecionar
        </button>
        <button type="button" class="tool" data-tool="ocean">
            <svg viewBox="0 0 24 24"><path d="M2 9c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 14c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 19c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0"/></svg>Oceano
        </button>
        <button type="button" class="tool" data-tool="island">
            <svg viewBox="0 0 24 24"><path d="M3 17c3-1 5-1 9-1s6 0 9 1M6 16c1-4 4-6 6-6s5 2 6 6M12 10V4l4 2-4 2"/></svg>Ilha
        </button>
        <button type="button" class="tool" data-tool="mountain">
            <svg viewBox="0 0 24 24"><path d="M2 20l7-13 4 7 3-4 6 10z"/></svg>Montanha
        </button>
        <button type="button" class="tool" data-tool="lake">
            <svg viewBox="0 0 24 24"><ellipse cx="12" cy="13" rx="9" ry="5"/><path d="M8 13q2-1.5 4 0t4 0"/></svg>Lago
        </button>
        <button type="button" class="tool" data-tool="river">
            <svg viewBox="0 0 24 24"><path d="M6 2c5 3-3 6 2 9s-3 5 1 11M15 2c4 4-2 6 1 10s-1 6 3 10"/></svg>Rio
        </button>
        <button type="button" class="tool" data-tool="road">
            <svg viewBox="0 0 24 24"><path d="M8 22L11 2M16 22L13 2M12 20v-2M12 14v-2M12 8V6"/></svg>Estrada
        </button>
        <button type="button" class="tool" data-tool="forest">
            <svg viewBox="0 0 24 24"><path d="M7 21v-4M7 17l-4 0 4-7-3 0 3-6 3 6-3 0 4 7zM17 21v-3M17 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>Floresta
        </button>
        <button type="button" class="tool" data-tool="city">
            <svg viewBox="0 0 24 24"><path d="M3 21V9l3-2 3 2v12M9 21V5l3-2 3 2v16M15 21v-9l3-2 3 2v9M2 21h20"/></svg>Cidade
        </button>
        <button type="button" class="tool" data-tool="village">
            <svg viewBox="0 0 24 24"><path d="M4 20v-8l8-7 8 7v8zM10 20v-5h4v5"/></svg>Vila
        </button>
        <button type="button" class="tool" data-tool="tower">
            <svg viewBox="0 0 24 24"><path d="M8 21V9h8v12M7 9V5h2v2h2V5h2v2h2V5h2v4M6 21h12M11 21v-4h2v4M11 12h2"/></svg>Torre
        </button>
        <button type="button" class="tool" data-tool="ruins">
            <svg viewBox="0 0 24 24"><path d="M3 21h18M5 21V9M5 9h4M9 21v-8M14 21v-5M18 21V8l-2 2M14 16l2-1M3 9l3-4 3 4"/></svg>Ruínas
        </button>
        <button type="button" class="tool" data-tool="phenomenon">
            <svg viewBox="0 0 24 24"><path d="M7 15a4 4 0 1 1 1-7.9A5 5 0 0 1 18 8a3.5 3.5 0 0 1 0 7zM8 18l-1 3M12 18l-1 3M16 18l-1 3M13 10l-2 3h3l-2 3"/></svg>Fenômeno
        </button>
        <button type="button" class="tool" data-tool="fog">
            <svg viewBox="0 0 24 24"><path d="M4 10h13a3 3 0 1 0-3-3M3 14h17M6 18h11a3 3 0 1 1-3 3"/></svg>Névoa
        </button>
        @endif
    </nav>

    <main id="stage">
        <canvas id="gl"></canvas>
        <div id="labels"></div>
        <div id="topo">
            <h1 id="title">{{ $world->name }}</h1>
            @if($editar)<span id="status" class="status" aria-live="polite"></span>@endif
        </div>
        <div id="acoes">
            @if($editar)
                <button type="button" id="btn-desfazer" class="icone" title="Desfazer (Ctrl+Z)" aria-label="Desfazer" disabled>↶</button>
                <button type="button" id="btn-refazer" class="icone" title="Refazer (Ctrl+Y)" aria-label="Refazer" disabled>↷</button>
                <button type="button" id="btn-salvar" class="primary">Salvar</button>
            @endif
            <button type="button" id="btn-imagem">Mapa ilustrado</button>
            @if(! $editar)
                @if($world->podeEditar(auth()->user()))
                    <a class="btn primary" href="{{ route('worldbuilder.show', $world) }}">Editar</a>
                @elseif($world->ehPublico())
                    @auth
                        <form method="POST" action="{{ route('worldbuilder.copiar', $world) }}">
                            @csrf
                            <button type="submit" class="primary">Copiar para meus mundos</button>
                        </form>
                    @else
                        <a class="btn primary" href="{{ route('register') }}">Criar o meu mundo</a>
                    @endauth
                @endif
            @endif
        </div>
        <div id="hint">
            <span id="hint-text"></span>
            <button type="button" id="finish-river" class="primary" hidden>Concluir rio</button>
        </div>
        <div id="toast" role="status"></div>
        @if (session('status'))
            <script>document.addEventListener('DOMContentLoaded', () => { const t = document.getElementById('toast'); t.textContent = @json(session('status')); t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3500); });</script>
        @endif
    </main>

    <aside id="panel" aria-live="polite"></aside>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
<script src="{{ asset('js/atlas.js') }}?v={{ @filemtime(public_path('js/atlas.js')) ?: 1 }}"></script>
<script src="{{ asset('js/worldbuilder.js') }}?v={{ @filemtime(public_path('js/worldbuilder.js')) ?: 1 }}"></script>
</body>
</html>
