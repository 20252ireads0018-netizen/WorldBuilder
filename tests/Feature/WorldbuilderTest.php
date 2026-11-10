<?php

namespace Tests\Feature;

use App\Models\Feature;
use App\Models\User;
use App\Models\World;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorldbuilderTest extends TestCase
{
    use RefreshDatabase;

    private User $ana;
    private User $beto;

    protected function setUp(): void
    {
        parent::setUp();
        $this->ana = User::factory()->create(['name' => 'Ana']);
        $this->beto = User::factory()->create(['name' => 'Beto']);
    }

    public function test_visitante_ve_a_apresentacao_e_vai_para_o_login(): void
    {
        $this->get('/')->assertOk()->assertSee('Criar conta grátis');
        $this->get('/mundos')->assertRedirect('/entrar');
    }

    public function test_cadastro_entra_e_sai(): void
    {
        $this->post('/cadastro', [
            'name' => 'Caio', 'email' => 'Caio@Exemplo.com', 'password' => 'segredo123', 'password_confirmation' => 'segredo123',
        ])->assertRedirect(route('worldbuilder.index'));
        $this->assertAuthenticated();
        $this->assertDatabaseHas('users', ['email' => 'caio@exemplo.com']);

        $this->post('/sair')->assertRedirect('/');
        $this->assertGuest();

        $this->post('/entrar', ['email' => 'caio@exemplo.com', 'password' => 'errada'])->assertSessionHasErrors('email');
        $this->post('/entrar', ['email' => 'caio@exemplo.com', 'password' => 'segredo123'])->assertRedirect(route('worldbuilder.index'));
        $this->assertAuthenticated();
    }

    public function test_cria_mundo_e_abre_o_editor(): void
    {
        $this->actingAs($this->ana)->get('/mundos')->assertOk()->assertSee('Começar um novo mundo');

        $r = $this->actingAs($this->ana)->post('/mundos', ['name' => 'Terra Rubra']);
        $world = World::firstOrFail();
        $r->assertRedirect(route('worldbuilder.show', $world));
        $this->assertSame($this->ana->id, (int) $world->user_id);

        $this->actingAs($this->ana)->get(route('worldbuilder.show', $world))
            ->assertOk()->assertSee('Terra Rubra')->assertSee('js/worldbuilder.js', false);
    }

    public function test_mundo_de_exemplo_vem_povoado(): void
    {
        $this->actingAs($this->ana)->post('/mundos/exemplo')->assertRedirect();
        $world = World::firstOrFail();

        $dados = $this->actingAs($this->ana)->getJson("/api/worlds/{$world->id}/data")->assertOk()->json();
        $this->assertCount(15, $dados['features']);
        $valdrin = collect($dados['features'])->firstWhere('name', 'Valdrin');
        $this->assertCount(2, $valdrin['npcs']);
        $this->assertCount(2, $valdrin['shops'][0]['items']);
        $this->assertCount(1, $valdrin['loose_items']);
    }

    public function test_editor_cria_local_npc_loja_e_item(): void
    {
        $world = $this->mundo($this->ana);

        $cidade = $this->actingAs($this->ana)->postJson("/api/worlds/{$world->id}/features",
            ['type' => 'city', 'name' => 'Vexa', 'x' => 10, 'z' => -5, 'size' => 7])->assertCreated()->json();

        $f = $this->postJson("/api/features/{$cidade['id']}/shops", ['name' => 'Forja'])->assertCreated()->json();
        $loja = $f['shops'][0]['id'];
        $this->postJson("/api/features/{$cidade['id']}/npcs", ['name' => 'Ferreiro', 'shop_id' => $loja])->assertCreated();
        $f = $this->postJson("/api/features/{$cidade['id']}/items", ['name' => 'Espada', 'price' => 40, 'shop_id' => $loja])->assertCreated()->json();
        $this->assertSame('Espada', $f['shops'][0]['items'][0]['name']);

        $this->putJson("/api/features/{$cidade['id']}", ['name' => 'Vexa Nova'])->assertOk()->assertJsonPath('name', 'Vexa Nova');

        // Loja só em cidade/vila; rio precisa de dois pontos
        $lago = $this->postJson("/api/worlds/{$world->id}/features", ['type' => 'lake', 'name' => 'L', 'x' => 0, 'z' => 0, 'size' => 5])->json();
        $this->postJson("/api/features/{$lago['id']}/shops", ['name' => 'X'])->assertStatus(422);
        $this->postJson("/api/worlds/{$world->id}/features", ['type' => 'river', 'name' => 'R', 'x' => 0, 'z' => 0, 'size' => 2, 'points' => [[0, 0]]])->assertStatus(422);
        $this->postJson("/api/worlds/{$world->id}/features", ['type' => 'river', 'name' => 'R', 'x' => 0, 'z' => 0, 'size' => 2, 'points' => [[0, 0], [5, 5]]])->assertCreated();

        // Loja de outro local não vale
        $this->postJson("/api/features/{$lago['id']}/items", ['name' => 'Y', 'shop_id' => $loja])->assertStatus(422);

        $this->deleteJson("/api/features/{$cidade['id']}")->assertOk();
        $this->assertSame(2, Feature::count());
    }

    public function test_mundo_de_outra_pessoa_nao_abre(): void
    {
        $world = $this->mundo($this->ana);
        $local = $world->features()->create(['type' => 'city', 'name' => 'C', 'x' => 0, 'z' => 0, 'size' => 5]);

        $this->actingAs($this->beto);
        $this->get(route('worldbuilder.show', $world))->assertNotFound();
        $this->getJson("/api/worlds/{$world->id}/data")->assertNotFound();
        $this->postJson("/api/worlds/{$world->id}/features", ['type' => 'lake', 'name' => 'L', 'x' => 0, 'z' => 0, 'size' => 5])->assertNotFound();
        $this->putJson("/api/features/{$local->id}", ['name' => 'Roubado'])->assertNotFound();
        $this->deleteJson("/api/features/{$local->id}")->assertNotFound();
        $this->delete(route('worldbuilder.destroy', $world))->assertNotFound();
        $this->get('/mundos')->assertOk()->assertDontSee('Abrir mapa');

        $this->assertSame('C', $local->fresh()->name);
    }

    public function test_excluir_mundo_apaga_tudo(): void
    {
        $world = $this->mundo($this->ana);
        $world->features()->create(['type' => 'city', 'name' => 'C', 'x' => 0, 'z' => 0, 'size' => 5]);
        $this->actingAs($this->ana)->delete(route('worldbuilder.destroy', $world))->assertRedirect(route('worldbuilder.index'));
        $this->assertSame(0, World::count());
        $this->assertSame(0, Feature::count());
    }

    private function mundo(User $dono): World
    {
        $w = new World(['name' => 'Mundo']);
        $w->user_id = $dono->id;
        $w->save();

        return $w;
    }
}
