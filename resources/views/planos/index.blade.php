@extends('layouts.app')

@section('title', 'Planos · Worldbuilder')

@section('conteudo')
<div class="wb wb-pagina">
<div class="shelf shelf--larga">
    <header class="shelf-head">
        <p class="sobretitulo">Planos</p>
        <h1 class="titulo-ouro">Mapas maiores, mundos sem fim</h1>
        <p>O plano grátis serve para começar. O plano Cartógrafo libera mapas de até {{ $limites['pago']['dimensao'] }} de lado e até {{ $limites['pago']['mundos'] }} mundos.</p>
    </header>

    @if (session('status'))
        <p class="aviso" role="status">{{ session('status') }}</p>
    @elseif ($motivo === 'mundos')
        <p class="aviso" role="status">O plano grátis permite {{ $limites['gratis']['mundos'] }} mundos. Assine para criar mais.</p>
    @elseif ($motivo === 'dimensao')
        <p class="aviso" role="status">No plano grátis o mapa vai até o tamanho {{ $dimensoes[$limites['gratis']['dimensao']] ?? $limites['gratis']['dimensao'] }}. Assine para aumentar.</p>
    @endif

    @if ($user?->temPlanoPago())
        <div class="card plano-atual">
            @include('partials.bussola', ['classe' => 'selo-bussola'])
            <div>
                <h2>Você é Cartógrafo</h2>
                <p class="mut">
                    @if ($user->plano_vitalicio) Plano para sempre: nada a pagar.
                    @else Plano ativo até {{ $user->plano_ate->format('d/m/Y') }}. Dá para renovar abaixo; o tempo novo é somado ao que falta.
                    @endif
                </p>
            </div>
        </div>
    @endif

    @if ($pendente)
        <a class="faixa-explorar" href="{{ route('pagamentos.show', $pendente) }}">
            <span>
                <strong>Você tem um pagamento em aberto</strong>
                <span>{{ $pendente->oferta()['nome'] }} · R$ {{ number_format($pendente->valor, 2, ',', '.') }} · {{ $pendente->status === 'informado' ? 'aguardando conferência' : 'esperando o Pix' }}</span>
            </span>
            <span class="seta" aria-hidden="true">→</span>
        </a>
    @endif

    <div class="planos">
        <section class="plano">
            <h2>Grátis</h2>
            <p class="preco">R$ 0</p>
            <ul class="beneficios">
                <li>Até {{ $limites['gratis']['mundos'] }} mundos</li>
                <li>Mapas até o tamanho {{ $dimensoes[$limites['gratis']['dimensao']] ?? '' }} ({{ $limites['gratis']['dimensao'] }} de lado)</li>
                <li>Todos os tipos de lugar, oceanos, temas e modelos</li>
                <li>Mapa ilustrado para baixar</li>
                <li>Jogadores convidados e mundos públicos</li>
            </ul>
            @guest
                <a class="btn largo-btn" href="{{ route('register') }}">Criar conta grátis</a>
            @else
                <span class="btn largo-btn desligado">{{ $user->temPlanoPago() ? 'Incluído no seu plano' : 'Seu plano atual' }}</span>
            @endguest
        </section>

        @foreach ($ofertas as $chave => $o)
            <section @class(['plano', 'pago', 'destaque' => $chave === 'anual'])>
                @if ($chave === 'anual')<span class="fita">Mais escolhido</span>@endif
                <h2>Cartógrafo <small>{{ $o['nome'] }}</small></h2>
                <p class="preco">R$ {{ number_format($o['valor'], 2, ',', '.') }}<small>{{ $o['dias'] === null ? ' uma vez' : ($o['dias'] > 40 ? ' por ano' : ' por mês') }}</small></p>
                <p class="mut">{{ $o['descricao'] }}</p>
                <ul class="beneficios">
                    <li>Até {{ $limites['pago']['mundos'] }} mundos</li>
                    <li>Mapas até o tamanho {{ $dimensoes[$limites['pago']['dimensao']] ?? '' }} ({{ $limites['pago']['dimensao'] }} de lado)</li>
                    <li>Tudo do plano grátis</li>
                </ul>
                @auth
                    @if ($user->plano_vitalicio)
                        <span class="btn largo-btn desligado">Você já tem para sempre</span>
                    @else
                        <form method="POST" action="{{ route('planos.comprar', $chave) }}">
                            @csrf
                            <button class="primary largo">Pagar com Pix</button>
                        </form>
                    @endif
                @else
                    <a class="btn primary largo-btn" href="{{ route('register') }}">Criar conta para assinar</a>
                @endauth
            </section>
        @endforeach
    </div>

    <p class="nota-planos">O pagamento é por Pix, direto para o criador do Worldbuilder. Depois de pagar, aperte "Já paguei"; o plano é liberado assim que o Pix for conferido (normalmente no mesmo dia). Nada é renovado sozinho.</p>
</div>
</div>
@endsection
