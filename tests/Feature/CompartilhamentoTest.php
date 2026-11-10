<?php

namespace Tests\Feature;

use App\Http\Controllers\WorldbuilderController;
use App\Models\User;
use App\Models\World;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Aparência, mundos públicos, jogadores convidados, capa, exportar/importar e cópias. */
class CompartilhamentoTest extends TestCase
{
    use RefreshDatabase;

    private User $mestre;
    private User $jogador;
    private User $estranho;
    private World $mundo;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mestre = User::factory()->create(['name' => 'Mestre', 'email' => 'mestre@ex.com']);
        $this->mestre->forceFill(['plano' => 'pago', 'plano_vitalicio' => true])->save();
        $this->jogador = User::factory()->create(['name' => 'Jogadora', 'email' => 'jogadora@ex.com']);
        $this->estranho = User::factory()->create(['name' => 'Estranho']);
        $this->mundo = WorldbuilderController::criarExemplo($this->mestre->id);
    }

    public function test_tema_e_skins_sao_salvos_e_validados(): void
    {
        $id = $this->mundo->id;
        $this->actingAs($this->mestre);

        $tema = ['fundo' => 'oceano', 'estilo' => 'natural', 'cores' => ['agua' => '#123ABC', 'terra' => '#00ff00'], 'skins' => ['city' => 'elfica']];
        $r = $this->putJson("/api/worlds/$id", ['theme' => $tema])->assertOk();
        $r->assertJsonPath('world.theme.fundo', 'oceano')
            ->assertJsonPath('world.theme.cores.agua', '#123abc')
            ->assertJsonPath('world.theme.cores.tinta', '#4d3017') // completou com o padrão
            ->assertJsonPath('world.theme.skins.city', 'elfica')
            ->assertJsonPath('world.theme.skins.forest', 'carvalhos');

        $this->putJson("/api/worlds/$id", ['theme' => ['fundo' => 'espaco', 'estilo' => 'natural']])->assertStatus(422);
        $this->putJson("/api/worlds/$id", ['theme' => ['fundo' => 'noite', 'estilo' => 'natural', 'cores' => ['agua' => 'azul']]])->assertStatus(422);

        $lago = $this->mundo->features()->where('type', 'lake')->first();
        $this->putJson("/api/features/{$lago->id}", ['skin' => 'lava', 'color' => '#FF5500'])
            ->assertOk()->assertJsonPath('skin', 'lava')->assertJsonPath('color', '#ff5500');
        $this->putJson("/api/features/{$lago->id}", ['skin' => 'elfica'])->assertStatus(422); // skin de cidade num lago
        $this->putJson("/api/features/{$lago->id}", ['color' => null, 'skin' => null])->assertOk()->assertJsonPath('color', null);

        $this->postJson("/api/worlds/$id/features", ['type' => 'forest', 'name' => 'Bosque', 'x' => 1, 'z' => 2, 'size' => 10, 'skin' => 'pinheiros'])
            ->assertCreated()->assertJsonPath('skin', 'pinheiros');
    }

    public function test_mundo_privado_so_para_dono_e_jogadores(): void
    {
        $id = $this->mundo->id;

        // Visitante sem conta vai para o login; estranho logado recebe 404
        $this->get("/mundos/$id/ver")->assertRedirect('/entrar');
        $this->getJson("/api/worlds/$id/data")->assertNotFound();
        $this->actingAs($this->estranho)->get("/mundos/$id/ver")->assertNotFound();

        // Dono convida a jogadora pelo e-mail
        $this->actingAs($this->mestre)->postJson("/api/worlds/$id/players", ['email' => 'JOGADORA@ex.com'])
            ->assertCreated()->assertJsonPath('world.players.0.name', 'Jogadora');
        $this->postJson("/api/worlds/$id/players", ['email' => 'ninguem@ex.com'])->assertStatus(422);
        $this->postJson("/api/worlds/$id/players", ['email' => 'mestre@ex.com'])->assertStatus(422);

        // Jogadora vê, sem o lugar secreto e sem a lista de jogadores, e não edita
        $this->actingAs($this->jogador);
        $this->get('/mundos')->assertOk()->assertSee('Compartilhados com você')->assertSee('Eldoria');
        $this->get("/mundos/$id")->assertRedirect("/mundos/$id/ver");
        $this->get("/mundos/$id/ver")->assertOk()->assertSee('data-mode="view"', false);
        $dados = $this->getJson("/api/worlds/$id/data")->assertOk()->json();
        $this->assertFalse($dados['can_edit']);
        $this->assertCount(14, $dados['features']);
        $this->assertNotContains('Mata Encantada', array_column($dados['features'], 'name'));
        $this->assertArrayNotHasKey('players', $dados['world']);
        $this->putJson("/api/worlds/$id", ['name' => 'Roubado'])->assertNotFound();
        $local = $this->mundo->features()->first();
        $this->putJson("/api/features/{$local->id}", ['name' => 'X'])->assertNotFound();
        $this->post("/mundos/$id/copiar")->assertNotFound(); // jogador não copia mundo privado

        // Dono remove a jogadora
        $this->actingAs($this->mestre)->deleteJson("/api/worlds/$id/players/{$this->jogador->id}")
            ->assertOk()->assertJsonCount(0, 'world.players');
        $this->actingAs($this->jogador)->getJson("/api/worlds/$id/data")->assertNotFound();
    }

    public function test_mundo_publico_aparece_em_explorar_e_pode_ser_copiado(): void
    {
        $id = $this->mundo->id;
        $this->get('/explorar')->assertOk()->assertDontSee('Eldoria');

        $this->actingAs($this->mestre)->putJson("/api/worlds/$id", ['visibility' => 'public'])->assertOk();
        auth()->logout();

        $this->get('/explorar')->assertOk()->assertSee('Eldoria')->assertSee('Mestre');
        $this->get('/explorar?q=nada')->assertOk()->assertDontSee('Eldoria');
        $this->get("/mundos/$id/ver")->assertOk()->assertSee('Criar o meu mundo');
        $dados = $this->getJson("/api/worlds/$id/data")->assertOk()->json();
        $this->assertCount(14, $dados['features']);

        // Outra pessoa copia: vem sem o lugar secreto e fica privada
        $this->actingAs($this->estranho)->post("/mundos/$id/copiar")->assertRedirect();
        $copia = World::where('user_id', $this->estranho->id)->firstOrFail();
        $this->assertSame('Eldoria', $copia->name);
        $this->assertSame('private', $copia->visibility);
        $this->assertSame(14, $copia->features()->count());
        $valdrin = $copia->features()->where('name', 'Valdrin')->firstOrFail();
        $this->assertSame('Empório da Gaivota', $valdrin->npcs()->where('name', 'Marta Vell')->first()->shop->name);
    }

    public function test_duplicar_exportar_e_importar(): void
    {
        $this->actingAs($this->mestre);
        $id = $this->mundo->id;

        $this->post("/mundos/$id/copiar")->assertRedirect();
        $this->assertSame(15, World::where('name', 'Cópia de Eldoria')->firstOrFail()->features()->count());

        $json = $this->get("/mundos/$id/exportar")->assertOk()->assertHeader('Content-Disposition', 'attachment; filename="eldoria.worldbuilder.json"')->getContent();
        $dados = json_decode($json, true);
        $this->assertSame('worldbuilder', $dados['formato']);
        $this->assertCount(15, $dados['features']);

        $arquivo = UploadedFile::fake()->createWithContent('eldoria.json', $json);
        $this->post('/mundos/importar', ['arquivo' => $arquivo])->assertRedirect();
        $importado = World::where('user_id', $this->mestre->id)->latest('id')->firstOrFail();
        $this->assertSame(15, $importado->features()->count());
        $this->assertSame('picos', $importado->features()->where('name', 'Cordilheira do Dragão Adormecido')->value('skin'));
        $this->assertTrue((bool) $importado->features()->where('name', 'Mata Encantada')->value('secret'));

        $ruim = UploadedFile::fake()->createWithContent('x.json', json_encode(['name' => 'X', 'features' => []]));
        $this->post('/mundos/importar', ['arquivo' => $ruim])->assertSessionHasErrors('arquivo');

        // Estranho não exporta nem duplica mundo privado
        $this->actingAs($this->estranho)->get("/mundos/$id/exportar")->assertNotFound();
    }

    public function test_capa_salva_e_respeita_permissao(): void
    {
        Storage::fake('local');
        $id = $this->mundo->id;
        $jpeg = 'data:image/jpeg;base64,' . base64_encode("\xFF\xD8\xFF\xE0" . str_repeat('a', 200));

        $this->actingAs($this->mestre)->postJson("/api/worlds/$id/cover", ['image' => $jpeg])->assertOk();
        $this->postJson("/api/worlds/$id/cover", ['image' => 'data:image/png;base64,AAAA'])->assertStatus(422);
        Storage::disk('local')->assertExists("capas/$id.jpg");
        $this->get("/mundos/$id/capa?v=1")->assertOk()->assertHeader('Content-Type', 'image/jpeg');

        $this->actingAs($this->estranho)->get("/mundos/$id/capa")->assertNotFound();

        $this->actingAs($this->mestre)->delete("/mundos/$id")->assertRedirect();
        Storage::disk('local')->assertMissing("capas/$id.jpg");
    }
}
