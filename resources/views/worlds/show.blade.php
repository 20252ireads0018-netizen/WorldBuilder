<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="robots" content="noindex">
    <title>{{ $world->name }} · Worldbuilder</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="{{ asset('css/worldbuilder.css') }}?v={{ @filemtime(public_path('css/worldbuilder.css')) ?: 1 }}">
</head>
<body class="wb wb-editor">
<div id="app" data-world="{{ $world->id }}" data-api="{{ url('/api') }}">
    <nav id="tools" aria-label="Ferramentas do mapa">
        <a class="back" href="{{ route('worldbuilder.index') }}">Mundos</a>
        <button type="button" class="tool active" data-tool="select">
            <svg viewBox="0 0 24 24"><path d="M5 3l14 8-6 2-2 6z"/></svg>Selecionar
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
        <button type="button" class="tool" data-tool="city">
            <svg viewBox="0 0 24 24"><path d="M3 21V9l3-2 3 2v12M9 21V5l3-2 3 2v16M15 21v-9l3-2 3 2v9M2 21h20"/></svg>Cidade
        </button>
        <button type="button" class="tool" data-tool="village">
            <svg viewBox="0 0 24 24"><path d="M4 20v-8l8-7 8 7v8zM10 20v-5h4v5"/></svg>Vila
        </button>
    </nav>

    <main id="stage">
        <canvas id="gl"></canvas>
        <div id="labels"></div>
        <h1 id="title">{{ $world->name }}</h1>
        <div id="hint">
            <span id="hint-text"></span>
            <button type="button" id="finish-river" class="primary" hidden>Concluir rio</button>
        </div>
        <div id="toast" role="status"></div>
    </main>

    <aside id="panel" aria-live="polite"></aside>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
<script src="{{ asset('js/worldbuilder.js') }}?v={{ @filemtime(public_path('js/worldbuilder.js')) ?: 1 }}"></script>
</body>
</html>
