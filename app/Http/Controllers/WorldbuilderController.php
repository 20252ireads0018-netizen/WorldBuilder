<?php

namespace App\Http\Controllers;

use App\Models\World;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

/**
 * Telas do Worldbuilder: lista de mundos do usuário, criar/excluir e o editor 3D.
 * Cada mundo pertence a quem o criou; mundo de outra pessoa responde 404.
 */
class WorldbuilderController extends Controller
{
    public const MAX_MUNDOS = 30;

    public function index(): View
    {
        $worlds = World::where('user_id', Auth::id())
            ->withCount('features')
            ->orderByDesc('updated_at')
            ->get();

        return view('worlds.index', compact('worlds'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        if ($this->limiteAtingido()) {
            return back()->withErrors(['name' => 'Você chegou ao limite de ' . self::MAX_MUNDOS . ' mundos. Exclua um para criar outro.']);
        }

        $world = new World($data);
        $world->user_id = Auth::id();
        $world->save();

        return redirect()->route('worldbuilder.show', $world);
    }

    /** Cria o mundo de exemplo (Eldoria) para quem quer ver a ferramenta funcionando antes de desenhar o seu. */
    public function exemplo(): RedirectResponse
    {
        if ($this->limiteAtingido()) {
            return back()->withErrors(['name' => 'Você chegou ao limite de ' . self::MAX_MUNDOS . ' mundos. Exclua um para criar outro.']);
        }

        $world = DB::transaction(fn () => self::criarExemplo((int) Auth::id()));

        return redirect()->route('worldbuilder.show', $world);
    }

    public function show(World $world): View
    {
        $this->exigirDono($world);

        return view('worlds.show', compact('world'));
    }

    public function destroy(World $world): RedirectResponse
    {
        $this->exigirDono($world);
        $world->delete();

        return redirect()->route('worldbuilder.index')->with('status', 'Mundo excluído.');
    }

    private function exigirDono(World $world): void
    {
        abort_unless((int) $world->user_id === (int) Auth::id(), 404);
    }

    private function limiteAtingido(): bool
    {
        return World::where('user_id', Auth::id())->count() >= self::MAX_MUNDOS;
    }

    /** Eldoria: montanhas, lagos, rios, cidades e vilas com uma loja, NPCs e itens de exemplo. */
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

        $f('mountain', 'Cordilheira do Dragão Adormecido', -45, -30, 24, ['description' => 'Dizem que o dragão ronca nas noites de inverno.']);
        $f('mountain', 'Pico Cinzento', -62, 8, 16);
        $f('mountain', 'Montes Vermelhos', 52, -45, 18);

        $f('lake', 'Lago Espelho', 20, 10, 14, ['description' => 'Águas tão calmas que refletem as estrelas inteiras.']);
        $f('lake', 'Lagoa das Garças', -20, 58, 9);

        $f('river', 'Rio Prata', -52, -18, 2.5, ['points' => [[-52, -18], [-40, -4], [-28, 6], [-10, 18], [6, 14]]]);
        $f('river', 'Rio Sinuoso', 33, 16, 3, ['points' => [[33, 16], [45, 30], [55, 46], [70, 60], [90, 68]]]);

        $valdrin = $f('city', 'Valdrin', -12, 32, 8, ['description' => 'Capital comercial do reino, cercada por muralhas de pedra clara.']);
        $porto = $f('city', 'Porto Corvo', 66, 56, 7);
        $f('village', 'Vale Verde', -40, 30, 3.5);
        $f('village', 'Olmo Alto', 38, -12, 3.5);
        $f('village', 'Brasa', 8, -42, 3);

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
