@extends('layouts.app')

@section('title', 'Explorar mundos · Worldbuilder')

@section('conteudo')
<div class="wb wb-pagina">
<div class="shelf shelf--larga">
    <header class="shelf-head">
        <h1>Explorar mundos</h1>
        <p>Mapas que outras pessoas deixaram públicos. Abra para passear pelo mundo{{ auth()->check() ? ' ou copie para a sua conta e continue a partir dele' : '' }}.</p>
    </header>

    <form method="GET" action="{{ route('worldbuilder.explorar') }}" class="busca" role="search">
        <input name="q" value="{{ $busca }}" maxlength="80" placeholder="Procurar pelo nome do mundo" aria-label="Procurar pelo nome do mundo">
        <button type="submit">Procurar</button>
    </form>

    <section class="galeria">
        @forelse($worlds as $world)
            <a class="card mundo-pub" href="{{ route('worldbuilder.ver', $world) }}">
                <span class="capa">@if($world->urlCapa())<img src="{{ $world->urlCapa() }}" alt="" loading="lazy">@endif</span>
                <span class="mundo-pub-txt">
                    <strong>{{ $world->name }}</strong>
                    <span class="mut">de {{ $world->owner?->name }} · {{ $world->features_count }} {{ $world->features_count === 1 ? 'lugar' : 'lugares' }}</span>
                    @if($world->description)<span class="desc">{{ Str::limit($world->description, 110) }}</span>@endif
                </span>
            </a>
        @empty
            <p class="empty">
                @if($busca !== '') Nenhum mundo público com esse nome. @else Ainda não há mundos públicos. Deixe o seu público na aba Compartilhar do editor. @endif
            </p>
        @endforelse
    </section>

    {{ $worlds->links('paginacao') }}
</div>
</div>
@endsection
