@extends('layouts.app')

@section('title', 'Explorar mundos · Worldbuilder')

@section('conteudo')
<div class="wb wb-pagina">
<div class="shelf shelf--larga">
    <header class="shelf-head">
        <p class="sobretitulo">Biblioteca pública</p>
        <h1 class="titulo-ouro">Explorar mundos</h1>
        <p>Mapas que outras pessoas deixaram públicos. Abra para passear pelo mundo{{ auth()->check() ? ' ou copie para a sua conta e continue a partir dele' : '' }}.</p>
    </header>

    <form method="GET" action="{{ route('worldbuilder.explorar') }}" class="busca" role="search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
        <input name="q" value="{{ $busca }}" maxlength="80" placeholder="Procurar pelo nome do mundo" aria-label="Procurar pelo nome do mundo">
        <button type="submit" class="primary">Procurar</button>
    </form>

    <section class="galeria">
        @forelse($worlds as $world)
            <a class="card mundo-pub" href="{{ route('worldbuilder.ver', $world) }}">
                <span class="capa">
                    @if($world->urlCapa())
                        <img src="{{ $world->urlCapa() }}" alt="" loading="lazy">
                    @else
                        <span class="capa-vazia">{{ mb_strtoupper(mb_substr($world->name, 0, 1)) }}</span>
                    @endif
                </span>
                <span class="mundo-pub-txt">
                    <strong>{{ $world->name }}</strong>
                    <span class="meta">de {{ $world->owner?->name }} · {{ $world->features_count }} {{ $world->features_count === 1 ? 'lugar' : 'lugares' }}</span>
                    @if($world->description)<span class="desc">{{ Str::limit($world->description, 110) }}</span>@endif
                </span>
            </a>
        @empty
            <div class="empty vazio">
                @include('partials.bussola', ['classe' => 'grande'])
                <p>
                    @if($busca !== '') Nenhum mundo público com esse nome. @else Ainda não há mundos públicos. Deixe o seu público na aba Compartilhar do editor. @endif
                </p>
            </div>
        @endforelse
    </section>

    {{ $worlds->links('paginacao') }}
</div>
</div>
@endsection
