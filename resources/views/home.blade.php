@extends('layouts.app')

@section('title', 'Worldbuilder · mapas de mundos de fantasia em 3D')

@section('conteudo')
<div class="wb-pagina">
<div class="shelf">
    <header class="shelf-head">
        <h1>Worldbuilder</h1>
        <p>Desenhe o mapa do seu mundo em 3D, no estilo de pergaminho antigo, e povoe cada lugar com NPCs, lojas e itens.</p>
    </header>

    <div class="card">
        <h2>O que dá para fazer</h2>
        <ul class="wb-lista">
            <li>Erguer montanhas, abrir lagos, traçar rios e fundar cidades e vilas direto no mapa.</li>
            <li>Dar nome e história a cada lugar, mudar o tamanho ou apagar.</li>
            <li>Alocar NPCs em qualquer lugar e abrir lojas nas cidades e vilas, com itens, preços e estoque.</li>
            <li>Ligar cada NPC à loja onde trabalha.</li>
            <li>Escolher o fundo (pergaminho, ilha no oceano, céu noturno, névoa), as cores de terra, lagos e montanhas e o estilo de cada lugar: vulcões, picos nevados, lagos congelados ou de lava, cidades élficas, nórdicas, do deserto e mais.</li>
            <li>Deixar o mundo público ou convidar jogadores para ver o mapa, com lugares secretos que só você enxerga.</li>
            <li>Salvar o mundo em arquivo, importar de volta e duplicar.</li>
        </ul>
        <div class="linha">
            <a class="btn primary" href="{{ route('register') }}">Criar conta grátis</a>
            <a class="btn" href="{{ route('login') }}">Já tenho conta</a>
            <a href="{{ route('worldbuilder.explorar') }}">Explorar mundos públicos</a>
        </div>
    </div>
</div>
</div>
@endsection
