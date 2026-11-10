<?php

namespace App\Http\Controllers;

use App\Models\World;
use App\Support\MundoArquivo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\Response;

/**
 * Telas do Worldbuilder: meus mundos, compartilhados comigo, Explorar (mundos públicos),
 * editor 3D (só o dono) e visualizador (dono, jogadores convidados e público).
 */
class WorldbuilderController extends Controller
{
    public function index(): View
    {
        $worlds = World::where('user_id', Auth::id())
            ->withCount(['features', 'players'])
            ->orderByDesc('updated_at')
            ->get();

        $compartilhados = World::whereHas('players', fn ($q) => $q->whereKey(Auth::id()))
            ->with(['owner:id,name', 'players' => fn ($q) => $q->whereKey(Auth::id())])
            ->withCount('features')
            ->orderByDesc('updated_at')
            ->get();

        return view('worlds.index', compact('worlds', 'compartilhados'));
    }

    /** Galeria de mundos públicos, aberta a qualquer visitante. */
    public function explorar(Request $request): View
    {
        $busca = Str::limit(trim((string) $request->query('q', '')), 80, '');

        $worlds = World::where('visibility', 'public')
            ->when($busca !== '', fn ($q) => $q->where('name', 'like', '%' . addcslashes($busca, '%_\\') . '%'))
            ->with('owner:id,name')
            ->withCount(['features' => fn ($q) => $q->where('secret', false)])
            ->orderByDesc('updated_at')
            ->paginate(18)
            ->withQueryString();

        return view('worlds.explorar', compact('worlds', 'busca'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:1000'],
            'dimension' => ['nullable', 'integer', 'between:' . config('planos.dimensao_min') . ',' . config('planos.dimensao_max')],
        ]);

        if ($this->limiteAtingido()) {
            return $this->erroLimite();
        }
        $dimensao = MundoArquivo::dimensaoValida((int) ($data['dimension'] ?? 200));
        if ($r = $this->checarDimensao($dimensao)) {
            return $r;
        }

        $world = new World(['name' => $data['name'], 'description' => $data['description'] ?? null]);
        $world->dimension = $dimensao;
        $world->user_id = Auth::id();
        $world->save();

        return redirect()->route('worldbuilder.show', $world);
    }

    /** Cria o mundo de exemplo (Eldoria) para quem quer ver a ferramenta funcionando antes de desenhar o seu. */
    public function exemplo(): RedirectResponse
    {
        if ($this->limiteAtingido()) {
            return $this->erroLimite();
        }

        $world = DB::transaction(fn () => self::criarExemplo((int) Auth::id()));

        return redirect()->route('worldbuilder.show', $world);
    }

    /** Editor: só o dono. Quem pode apenas ver vai para o visualizador. */
    public function show(World $world): View|RedirectResponse
    {
        if (! $world->podeEditar(Auth::user())) {
            abort_unless($world->podeVer(Auth::user()), 404);

            return redirect()->route('worldbuilder.ver', $world);
        }

        return view('worlds.show', ['world' => $world, 'editar' => true]);
    }

    /** Visualizador somente leitura (dono, jogadores convidados ou qualquer pessoa se for público). */
    public function ver(World $world): View|RedirectResponse
    {
        if (! $world->podeVer(Auth::user())) {
            if (! Auth::check()) {
                return redirect()->guest(route('login'));
            }
            abort(404);
        }

        return view('worlds.show', ['world' => $world, 'editar' => false]);
    }

    public function capa(World $world): Response
    {
        abort_unless($world->cover_version && $world->podeVer(Auth::user()), 404);
        $disco = Storage::disk('local');
        abort_unless($disco->exists($world->caminhoCapa()), 404);

        return response($disco->get($world->caminhoCapa()), 200, [
            'Content-Type' => 'image/jpeg',
            'Cache-Control' => ($world->ehPublico() ? 'public' : 'private') . ', max-age=604800',
        ]);
    }

    public function destroy(World $world): RedirectResponse
    {
        $this->exigirDono($world);
        $world->delete();

        return redirect()->route('worldbuilder.index')->with('status', 'Mundo excluído.');
    }

    /** Baixa o mundo inteiro (com locais secretos) num arquivo .json. */
    public function exportar(World $world): Response
    {
        $this->exigirDono($world);
        $json = json_encode(MundoArquivo::exportar($world), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $nome = (Str::slug($world->name) ?: 'mundo') . '.worldbuilder.json';

        return response($json, 200, [
            'Content-Type' => 'application/json; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="' . $nome . '"',
        ]);
    }

    public function importar(Request $request): RedirectResponse
    {
        $request->validate(['arquivo' => 'required|file|max:3072'], [
            'arquivo.required' => 'Escolha o arquivo .json do mundo.',
            'arquivo.max' => 'O arquivo passa de 3 MB.',
        ]);
        if ($this->limiteAtingido()) {
            return $this->erroLimite('arquivo');
        }

        $dados = json_decode((string) file_get_contents($request->file('arquivo')->getRealPath()), true);
        if (! is_array($dados)) {
            return back()->withErrors(['arquivo' => 'Esse arquivo não é um JSON válido.']);
        }
        if ($r = $this->checarDimensao((int) ($dados['dimension'] ?? 200))) {
            return $r;
        }

        try {
            $world = MundoArquivo::importar($dados, (int) Auth::id());
        } catch (ValidationException $e) {
            return back()->withErrors(['arquivo' => 'Não deu para importar: ' . collect($e->errors())->flatten()->first()]);
        }

        return redirect()->route('worldbuilder.show', $world)->with('status', 'Mundo importado.');
    }

    /** Duplicar o próprio mundo (cópia completa) ou copiar um mundo público de outra pessoa (sem locais secretos). */
    public function copiar(World $world): RedirectResponse
    {
        $dono = $world->ehDono(Auth::user());
        abort_unless($dono || $world->ehPublico(), 404);
        if ($this->limiteAtingido()) {
            return $this->erroLimite();
        }
        if ($r = $this->checarDimensao((int) $world->dimension)) {
            return $r;
        }

        $dados = MundoArquivo::exportar($world, $dono);
        $nome = Str::limit(($dono ? 'Cópia de ' : '') . $world->name, 80, '');
        $nova = MundoArquivo::importar($dados, (int) Auth::id(), $nome);

        return redirect()->route('worldbuilder.show', $nova)->with('status', $dono ? 'Mundo duplicado.' : 'Mundo copiado para a sua conta.');
    }

    private function exigirDono(World $world): void
    {
        abort_unless($world->ehDono(Auth::user()), 404);
    }

    private function limiteAtingido(): bool
    {
        return ! Auth::user()->podeCriarMundo();
    }

    /** No plano grátis, quem passa do limite vai para a página de planos; no pago, recebe o aviso de sempre. */
    private function erroLimite(string $campo = 'name'): RedirectResponse
    {
        $user = Auth::user();
        $max = $user->limites()['mundos'];
        if (! $user->temPlanoPago()) {
            return redirect()->route('planos', ['motivo' => 'mundos'])
                ->with('status', "O plano grátis permite $max mundos. Assine o plano Cartógrafo para criar mais.");
        }

        return back()->withErrors([$campo => "Você chegou ao limite de $max mundos. Exclua um para criar outro."]);
    }

    /** Mapa maior que o plano permite: manda para a página de planos. */
    private function checarDimensao(int $dimensao): ?RedirectResponse
    {
        $max = Auth::user()->limites()['dimensao'];
        if ($dimensao <= $max) {
            return null;
        }

        return redirect()->route('planos', ['motivo' => 'dimensao'])
            ->with('status', "Esse mundo tem mapa de tamanho $dimensao, e o plano grátis vai até $max. Assine o plano Cartógrafo para abrir mapas maiores.");
    }

    /** Eldoria: montanhas, lagos, rios, florestas, cidades e vilas com uma loja, NPCs e itens de exemplo. */
    public static function criarExemplo(int $userId): World
    {
        $world = new World([
            'name' => 'Eldoria',
            'description' => 'Um reino de vales antigos, montanhas ariscas e rios que nunca foram totalmente cartografados.',
        ]);
        $world->user_id = $userId;
        $world->save();

        $f = fn (string $type, string $name, float $x, float $z, float $size, array $extra = []) =>
            $world->features()->create(array_merge(compact('type', 'name', 'x', 'z', 'size'), $extra));

        $f('mountain', 'Cordilheira do Dragão Adormecido', -45, -30, 24, ['description' => 'Dizem que o dragão ronca nas noites de inverno.', 'skin' => 'picos']);
        $f('mountain', 'Pico Cinzento', -62, 8, 16, ['skin' => 'rochosa']);
        $f('mountain', 'Montes Vermelhos', 52, -45, 18, ['skin' => 'vulcao', 'description' => 'A terra ainda é quente ao redor da cratera.']);

        $f('lake', 'Lago Espelho', 20, 10, 14, ['description' => 'Águas tão calmas que refletem as estrelas inteiras.', 'skin' => 'cristalina']);
        $f('lake', 'Lagoa das Garças', -20, 58, 9, ['skin' => 'pantano']);

        $f('river', 'Rio Prata', -52, -18, 2.5, ['points' => [[-52, -18], [-40, -4], [-28, 6], [-10, 18], [6, 14]]]);
        $f('river', 'Rio Sinuoso', 33, 16, 3, ['points' => [[33, 16], [45, 30], [55, 46], [70, 60], [90, 68]]]);

        $f('forest', 'Bosque dos Sussurros', 5, -15, 14, ['description' => 'Quem entra à noite ouve o próprio nome entre as folhas.']);
        $f('forest', 'Pinhal do Norte', -25, -60, 12, ['skin' => 'pinheiros']);
        $f('forest', 'Mata Encantada', 60, 10, 9, ['skin' => 'magica', 'secret' => true, 'description' => 'Só o mestre sabe que ela existe.']);

        $valdrin = $f('city', 'Valdrin', -12, 32, 8, ['description' => 'Capital comercial do reino, cercada por muralhas de pedra clara.', 'skin' => 'fortaleza']);
        $porto = $f('city', 'Porto Corvo', 66, 56, 7);
        $f('village', 'Vale Verde', -40, 30, 3.5);
        $f('village', 'Olmo Alto', 38, -12, 3.5, ['skin' => 'nordica']);
        $f('village', 'Brasa', 8, -42, 3, ['skin' => 'deserto']);

        $loja = $valdrin->shops()->create(['name' => 'Empório da Gaivota']);
        $valdrin->items()->create(['shop_id' => $loja->id, 'name' => 'Poção de cura', 'price' => 25, 'quantity' => 8]);
        $valdrin->items()->create(['shop_id' => $loja->id, 'name' => 'Corda de cânhamo (15 m)', 'price' => 2, 'quantity' => 30]);
        $valdrin->npcs()->create(['name' => 'Marta Vell', 'role' => 'Mercadora', 'shop_id' => $loja->id]);
        $valdrin->npcs()->create(['name' => 'Capitão Orin', 'role' => 'Guarda da muralha']);
        $valdrin->items()->create(['name' => 'Mapa rasgado', 'description' => 'Aponta para algum ponto da cordilheira.', 'price' => 0]);

        $porto->npcs()->create(['name' => 'Velha Ísis', 'role' => 'Contadora de histórias do cais']);

        return $world;
    }
}
