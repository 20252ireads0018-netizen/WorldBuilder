@extends('layouts.app')

@section('title', 'Pagamento por Pix · Worldbuilder')

@section('conteudo')
<div class="wb wb-pagina">
<div class="shelf">
    <header class="shelf-head">
        <p class="sobretitulo">Pagamento</p>
        <h1 class="titulo-ouro">Cartógrafo {{ $oferta['nome'] }}</h1>
    </header>

    @if (session('status'))
        <p class="aviso" role="status">{{ session('status') }}</p>
    @endif

    <div class="card pagamento">
        @if ($p->status === 'confirmado')
            <h2>Pagamento confirmado</h2>
            <p>O plano Cartógrafo já está liberado na sua conta. Bons mapas!</p>
            <div class="linha"><a class="btn primary" href="{{ route('worldbuilder.index') }}">Ir para meus mundos</a></div>
        @elseif ($p->status === 'cancelado')
            <h2>Pedido cancelado</h2>
            <p>Se você pagou e o pedido foi cancelado por engano, responda pelo contato do site.</p>
            <div class="linha"><a class="btn primary" href="{{ route('planos') }}">Ver planos</a></div>
        @else
            <div class="pix-grade">
                <div class="pix-qr">
                    <div id="qr" data-codigo="{{ $codigo }}" aria-label="QR Code do Pix"></div>
                    <p class="mut">Aponte a câmera do app do banco</p>
                </div>
                <div class="pix-info">
                    <p class="valor">R$ {{ number_format($p->valor, 2, ',', '.') }}</p>
                    <p class="mut">Para {{ $pix['nome'] }} · pedido {{ $p->txid }}</p>
                    <label>Pix copia e cola
                        <span class="copiar"><input readonly value="{{ $codigo }}" id="pix-codigo"><button type="button" id="pix-copiar">Copiar</button></span>
                    </label>
                    <ol class="passos">
                        <li>Abra o app do seu banco e pague pelo QR Code ou pelo copia e cola.</li>
                        <li>Volte aqui e aperte <strong>Já paguei</strong>.</li>
                        <li>Assim que o Pix for conferido, o plano é liberado na sua conta.</li>
                    </ol>
                    @if ($p->status === 'informado')
                        <p class="aviso-claro">Recebemos o seu aviso em {{ $p->informado_em->format('d/m/Y H:i') }}. Agora é só aguardar a conferência.</p>
                    @else
                        <form method="POST" action="{{ route('pagamentos.paguei', $p) }}">
                            @csrf
                            <button class="primary largo">Já paguei</button>
                        </form>
                    @endif
                </div>
            </div>
        @endif
    </div>
    <p class="nota-planos"><a href="{{ route('planos') }}">← Voltar aos planos</a></p>
</div>
</div>
<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
<script>
(() => {
    const el = document.getElementById('qr');
    if (el && window.qrcode) {
        const q = qrcode(0, 'M');
        q.addData(el.dataset.codigo);
        q.make();
        el.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    }
    document.getElementById('pix-copiar')?.addEventListener('click', async (e) => {
        const inp = document.getElementById('pix-codigo');
        inp.select();
        try { await navigator.clipboard.writeText(inp.value); } catch { document.execCommand('copy'); }
        e.target.textContent = 'Copiado';
    });
})();
</script>
@endsection
