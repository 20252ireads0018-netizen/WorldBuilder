@extends('layouts.app')

@section('title', 'Seus mundos · Worldbuilder')

@section('conteudo')

<div class="wb wb-pagina">
<div class="shelf shelf--larga">
    <header class="shelf-head">
        <p class="sobretitulo">Seu atlas</p>
        <h1 class="titulo-ouro">Seus mundos</h1>
        <p>Desenhe o mapa do seu mundo em 3D, escolha fundo, cores e estilo de cada lugar, e convide jogadores para ver.</p>
    </header>

    @if (session('status'))
        <p class="aviso" role="status">{{ session('status') }}</p>
    @endif

    <div class="card new-world">
        <div class="new-world-intro">
            @include('partials.bussola', ['classe' => 'selo-bussola'])
            <h2>Começar um novo mundo</h2>
            <p class="mut">Dê um nome, descreva em poucas linhas e abra o mapa para desenhar. Tudo pode ser mudado depois.</p>
        </div>
        <div class="new-world-form">
            <form method="POST" action="{{ route('worldbuilder.store') }}" id="wb-novo">
                @csrf
                <label>Nome do mundo
                    <input name="name" value="{{ old('name') }}" maxlength="80" required placeholder="Ex.: Eldoria, As Ilhas de Cinza">
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
    </div>

    <div class="secao-topo">
        <h2 class="secao">Meus mapas</h2>
        @if($worlds->isNotEmpty())<span class="contagem">{{ $worlds->count() }} {{ $worlds->count() === 1 ? 'mundo' : 'mundos' }}</span>@endif
    </div>
    <section class="worlds" aria-label="Meus mundos">
        @forelse($worlds as $world)
            <article class="card world">
                <a class="capa" href="{{ route('worldbuilder.show', $world) }}" tabindex="-1" aria-hidden="true">
                    @if($world->urlCapa())
                        <img src="{{ $world->urlCapa() }}" alt="" loading="lazy">
                    @else
                        <span class="capa-vazia">{{ mb_strtoupper(mb_substr($world->name, 0, 1)) }}</span>
                    @endif
                    <span class="selo {{ $world->ehPublico() ? 'publico' : '' }}">{{ $world->ehPublico() ? 'Público' : 'Privado' }}</span>
                </a>
                <div class="world-txt">
                    <h2><a href="{{ route('worldbuilder.show', $world) }}">{{ $world->name }}</a></h2>
                    <p class="meta">
                        {{ $world->features_count }} {{ $world->features_count === 1 ? 'lugar' : 'lugares' }}
                        @if($world->players_count) · {{ $world->players_count }} {{ $world->players_count === 1 ? 'jogador' : 'jogadores' }} @endif
                        @if($world->updated_at) · editado em {{ $world->updated_at->format('d/m/Y') }} @endif
                    </p>
                    @if($world->description)<p class="resumo">{{ Str::limit($world->description, 140) }}</p>@endif
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
            <div class="empty vazio">
                @include('partials.bussola', ['classe' => 'grande'])
                <p><strong>Nenhum mundo ainda.</strong></p>
                <p>Crie o primeiro acima ou abra o mundo de exemplo para ver como fica.</p>
            </div>
        @endforelse
    </section>

    @if($compartilhados->isNotEmpty())
        <div class="secao-topo">
            <h2 class="secao">Compartilhados com você</h2>
        </div>
        <section class="worlds" aria-label="Mundos compartilhados com você">
            @foreach($compartilhados as $world)
                <article class="card world">
                    <a class="capa" href="{{ route('worldbuilder.ver', $world) }}" tabindex="-1" aria-hidden="true">
                        @if($world->urlCapa())
                            <img src="{{ $world->urlCapa() }}" alt="" loading="lazy">
                        @else
                            <span class="capa-vazia">{{ mb_strtoupper(mb_substr($world->name, 0, 1)) }}</span>
                        @endif
                    </a>
                    <div class="world-txt">
                        <h2><a href="{{ route('worldbuilder.ver', $world) }}">{{ $world->name }}</a></h2>
                        <p class="meta">de {{ $world->owner?->name }} · {{ $world->features_count }} {{ $world->features_count === 1 ? 'lugar' : 'lugares' }}</p>
                    </div>
                    <div class="actions">
                        <a class="btn primary" href="{{ route('worldbuilder.ver', $world) }}">Ver mapa</a>
                    </div>
                </article>
            @endforeach
        </section>
    @endif

    <a class="faixa-explorar" href="{{ route('worldbuilder.explorar') }}">
        <span>
            <strong>Explorar mundos públicos</strong>
            <span>Veja os mapas que outras pessoas criaram e copie um para começar a partir dele.</span>
        </span>
        <span class="seta" aria-hidden="true">→</span>
    </a>
</div>
</div>
@endsection
