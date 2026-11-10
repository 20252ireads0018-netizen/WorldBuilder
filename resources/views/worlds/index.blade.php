@extends('layouts.app')

@section('title', 'Seus mundos · Worldbuilder')

@section('conteudo')

<div class="wb wb-pagina">
<div class="shelf">
    <header class="shelf-head">
        <h1>Worldbuilder</h1>
        <p>Desenhe o mapa do seu mundo em 3D e povoe cada lugar com NPCs, lojas e itens.</p>
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
    </div>

    <section class="worlds">
        @forelse($worlds as $world)
            <article class="card world">
                <div>
                    <h2>{{ $world->name }}</h2>
                    @if($world->description)<p>{{ $world->description }}</p>@endif
                    <p class="mut">{{ $world->features_count }} {{ $world->features_count === 1 ? 'lugar' : 'lugares' }} no mapa</p>
                </div>
                <div class="actions">
                    <a class="btn primary" href="{{ route('worldbuilder.show', $world) }}">Abrir mapa</a>
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
</div>
</div>
@endsection
