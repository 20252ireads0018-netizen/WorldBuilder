<?php

namespace App\Http\Controllers;

use App\Models\Pagamento;
use App\Models\User;
use App\Models\World;
use App\Support\Pix;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

/**
 * Planos: página de venda, pedido por Pix (QR Code na chave da administração),
 * "Já paguei" e confirmação manual em /admin/pagamentos.
 */
class PlanosController extends Controller
{
    public function index(Request $request): View
    {
        $user = Auth::user();

        return view('planos.index', [
            'user' => $user,
            'motivo' => $request->query('motivo'),
            'ofertas' => config('planos.ofertas'),
            'limites' => config('planos.limites'),
            'dimensoes' => config('planos.dimensoes'),
            'mundos' => $user ? World::where('user_id', $user->id)->count() : 0,
            'pendente' => $user ? Pagamento::where('user_id', $user->id)->whereIn('status', ['pendente', 'informado'])->latest()->first() : null,
        ]);
    }

    public function comprar(string $oferta): RedirectResponse
    {
        $cfg = config("planos.ofertas.$oferta");
        abort_unless($cfg, 404);
        $user = Auth::user();
        if ($user->plano_vitalicio) {
            return redirect()->route('planos')->with('status', 'Sua conta já tem o plano Cartógrafo para sempre.');
        }

        // Reaproveita o pedido em aberto da mesma oferta (evita vários QR Codes)
        $p = Pagamento::where('user_id', $user->id)->where('oferta', $oferta)->where('status', 'pendente')->latest()->first();
        if (! $p) {
            $p = new Pagamento();
            $p->user_id = $user->id;
            $p->oferta = $oferta;
            $p->valor = $cfg['valor'];
            $p->txid = Pix::novoTxid();
            $p->save();
        }

        return redirect()->route('pagamentos.show', $p);
    }

    public function show(Pagamento $pagamento): View
    {
        abort_unless((int) $pagamento->user_id === (int) Auth::id(), 404);

        return view('planos.pagamento', [
            'p' => $pagamento,
            'oferta' => $pagamento->oferta(),
            'codigo' => Pix::copiaECola($pagamento->valor, $pagamento->txid),
            'pix' => config('pix'),
        ]);
    }

    public function paguei(Pagamento $pagamento): RedirectResponse
    {
        abort_unless((int) $pagamento->user_id === (int) Auth::id(), 404);
        if ($pagamento->status === 'pendente') {
            $pagamento->status = 'informado';
            $pagamento->informado_em = now();
            $pagamento->save();
        }

        return redirect()->route('pagamentos.show', $pagamento)
            ->with('status', 'Obrigado! Assim que o Pix for conferido, o plano é liberado na sua conta.');
    }

    // ---- Administração --------------------------------------------------

    private function exigirAdmin(): void
    {
        abort_unless(Auth::user()?->is_admin, 404);
    }

    public function admin(): View
    {
        $this->exigirAdmin();

        return view('planos.admin', [
            'abertos' => Pagamento::with('user:id,name,email')->whereIn('status', ['informado', 'pendente'])
                ->orderByRaw("case status when 'informado' then 0 else 1 end")->latest()->limit(100)->get(),
            'fechados' => Pagamento::with('user:id,name,email')->whereIn('status', ['confirmado', 'cancelado'])->latest('updated_at')->limit(50)->get(),
            'pagos' => User::where('plano', 'pago')->orderBy('name')->get(['id', 'name', 'email', 'plano_ate', 'plano_vitalicio']),
            'pix' => config('pix'),
        ]);
    }

    public function confirmar(Pagamento $pagamento): RedirectResponse
    {
        $this->exigirAdmin();
        $ok = $pagamento->confirmar();

        return back()->with('status', $ok ? "Pagamento de {$pagamento->user->name} confirmado e plano liberado." : 'Esse pagamento já estava fechado.');
    }

    public function cancelar(Pagamento $pagamento): RedirectResponse
    {
        $this->exigirAdmin();
        if ($pagamento->status !== 'confirmado') {
            $pagamento->status = 'cancelado';
            $pagamento->save();
        }

        return back()->with('status', 'Pedido cancelado.');
    }
}
