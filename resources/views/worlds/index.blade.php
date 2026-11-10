@extends('layouts.app')

@section('title', 'Seus mundos · Worldbuilder')

@section('conteudo')

<div class="wb wb-pagina">
<div class="shelf">
    <header class="shelf-head">
        <h1>Seus mundos</h1>
        <p>Desenhe o mapa do seu mundo em 3D, escolha fundo, cores e estilo de cada lugar, e convide jogadores para ver.</p>
    </header>

    @if (session('status'))
        <p class="aviso" role="status">{{ session('status') }}</p>
    @endif

    <div class="card new-world">
        <form method="POST" action="{{ route('worldbuilder.store') }}" id="wb-novo">
            @csrf
            <h2>Começar um novo mundo</h2>
            <label>Nome do mundo
                <input name="name" value="{{ old('name') }}" maxlength="80" required>
            </label>
            <label>Descrição
                <textarea name="description" rows="2" maxlength="1000" placeholder="Em poucas linhas, como é esse mundo?">{{ old('description') }}</textarea>
            </label>
            @error('name') <p class="error">{{ $message }}</p> @enderror
        </form>
        <div class="linha">
            <button class="primary" form="wb-novo">Criar mundo</button>
            <form method="POST" action="{{ route('worldbuilder.exemplo') }}">
                @csrf
                <button type="submit">Ver um mundo de exemplo</button>
            </form>
        </div>
        <details class="importar" @error('arquivo') open @enderror>
            <summary>Importar um mundo salvo em arquivo</summary>
            <form method="POST" action="{{ route('worldbuilder.importar') }}" enctype="multipart/form-data" class="linha">
                @csrf
                <input type="file" name="arquivo" accept=".json,application/json" required aria-label="Arquivo .json do mundo">
                <button type="submit">Importar</button>
            </form>
            @error('arquivo') <p class="error">{{ $message }}</p> @enderror
        </details>
    </div>

    <section class="worlds" aria-label="Meus mundos">
        @forelse($worlds as $world)
            <article class="card world">
                <a class="capa" href="{{ route('worldbuilder.show', $world) }}" tabindex="-1" aria-hidden="true">
                    @if($world->urlCapa())<img src="{{ $world->urlCapa() }}" alt="" loading="lazy">@endif
                </a>
                <div class="world-txt">
                    <h2>{{ $world->name }}</h2>
                    @if($world->description)<p>{{ Str::limit($world->description, 160) }}</p>@endif
                    <p class="mut">
                        {{ $world->features_count }} {{ $world->features_count === 1 ? 'lugar' : 'lugares' }}
                        · <span class="selo {{ $world->ehPublico() ? 'publico' : '' }}">{{ $world->ehPublico() ? 'Público' : 'Privado' }}</span>
                        @if($world->players_count) · {{ $world->players_count }} {{ $world->players_count === 1 ? 'jogador' : 'jogadores' }} @endif
                    </p>
                </div>
                <div class="actions">
                    <a class="btn primary" href="{{ route('worldbuilder.show', $world) }}">Abrir mapa</a>
                    <form method="POST" action="{{ route('worldbuilder.copiar', $world) }}">
                        @csrf
                        <button type="submit">Duplicar</button>
                    </form>
                    <form method="POST" action="{{ route('worldbuilder.destroy', $world) }}"
                          data-confirma="Excluir {{ $world->name }} e tudo o que existe nele?"
                          onsubmit="return confirm(this.dataset.confirma)">
                        @csrf @method('DELETE')
                        <button class="danger">Excluir</button>
                    </form>
                </div>
            </article>
        @empty
            <p class="empty">Nenhum mundo ainda. Crie o primeiro acima ou abra o mundo de exemplo.</p>
        @endforelse
    </section>

    @if($compartilhados->isNotEmpty())
        <h2 class="secao">Compartilhados com você</h2>
        <section class="worlds" aria-label="Mundos compartilhados com você">
            @foreach($compartilhados as $world)
                <article class="card world">
                    <a class="capa" href="{{ route('worldbuilder.ver', $world) }}" tabindex="-1" aria-hidden="true">
                        @if($world->urlCapa())<img src="{{ $world->urlCapa() }}" alt="" loading="lazy">@endif
                    </a>
                    <div class="world-txt">
                        <h2>{{ $world->name }}</h2>
                        <p class="mut">de {{ $world->owner?->name }} · {{ $world->features_count }} {{ $world->features_count === 1 ? 'lugar' : 'lugares' }}</p>
                    </div>
                    <div class="actions">
                        <a class="btn primary" href="{{ route('worldbuilder.ver', $world) }}">Ver mapa</a>
                    </div>
                </article>
            @endforeach
        </section>
    @endif

    <p class="rodape-lista"><a href="{{ route('worldbuilder.explorar') }}">Explorar mundos públicos de outras pessoas</a></p>
</div>
</div>
@endsection
