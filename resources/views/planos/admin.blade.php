@extends('layouts.app')

@section('title', 'Pagamentos · Worldbuilder')

@section('conteudo')
<div class="wb wb-pagina">
<div class="shelf shelf--larga">
    <header class="shelf-head">
        <p class="sobretitulo">Administração</p>
        <h1 class="titulo-ouro">Pagamentos por Pix</h1>
        <p>Confira no extrato do banco se o Pix chegou (valor e nome) e confirme para liberar o plano. Chave que recebe: {{ $pix['chave'] }} ({{ $pix['nome'] }}).</p>
    </header>

    @if (session('status'))
        <p class="aviso" role="status">{{ session('status') }}</p>
    @endif

    <div class="card">
        <h2>Em aberto</h2>
        <table class="tabela">
            <thead><tr><th>Quando</th><th>Pessoa</th><th>Plano</th><th>Valor</th><th>Situação</th><th></th></tr></thead>
            <tbody>
            @forelse ($abertos as $p)
                <tr>
                    <td>{{ $p->created_at->format('d/m H:i') }}</td>
                    <td>{{ $p->user?->name }}<div class="mut">{{ $p->user?->email }}</div></td>
                    <td>{{ $p->oferta()['nome'] }}<div class="mut">{{ $p->txid }}</div></td>
                    <td>R$ {{ number_format($p->valor, 2, ',', '.') }}</td>
                    <td>@if ($p->status === 'informado')<span class="selo publico">Disse que pagou</span>@else<span class="selo">Aguardando Pix</span>@endif</td>
                    <td class="acoes-tabela">
                        <form method="POST" action="{{ route('admin.pagamentos.confirmar', $p) }}" onsubmit="return confirm('Confirmar que o Pix de R$ {{ number_format($p->valor, 2, ',', '.') }} chegou?')">
                            @csrf <button class="primary">Confirmar</button>
                        </form>
                        <form method="POST" action="{{ route('admin.pagamentos.cancelar', $p) }}">
                            @csrf <button class="danger">Cancelar</button>
                        </form>
                    </td>
                </tr>
            @empty
                <tr><td colspan="6" class="mut">Nenhum pagamento em aberto.</td></tr>
            @endforelse
            </tbody>
        </table>
    </div>

    <div class="card">
        <h2>Contas com plano pago</h2>
        <table class="tabela">
            <thead><tr><th>Pessoa</th><th>Até</th></tr></thead>
            <tbody>
            @foreach ($pagos as $u)
                <tr><td>{{ $u->name }}<div class="mut">{{ $u->email }}</div></td><td>{{ $u->plano_vitalicio ? 'Para sempre' : $u->plano_ate?->format('d/m/Y') }}</td></tr>
            @endforeach
            </tbody>
        </table>
    </div>

    @if ($fechados->isNotEmpty())
        <div class="card">
            <h2>Últimos fechados</h2>
            <table class="tabela">
                <tbody>
                @foreach ($fechados as $p)
                    <tr><td>{{ $p->updated_at->format('d/m/Y') }}</td><td>{{ $p->user?->name }}</td><td>{{ $p->oferta()['nome'] }}</td><td>R$ {{ number_format($p->valor, 2, ',', '.') }}</td><td>{{ $p->status === 'confirmado' ? 'Confirmado' : 'Cancelado' }}</td></tr>
                @endforeach
                </tbody>
            </table>
        </div>
    @endif
</div>
</div>
@endsection
