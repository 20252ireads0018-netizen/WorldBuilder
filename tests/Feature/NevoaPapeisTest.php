<?php

namespace Tests\Feature;

use App\Http\Controllers\WorldbuilderController;
use App\Models\User;
use App\Models\World;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Névoa de guerra, mestre x jogador convidado, tamanho livre, estradas, ilhas, troca de tipo e desfazer exclusão. */
class NevoaPapeisTest extends TestCase
{
    use RefreshDatabase;

    private User $dono;
    private User $mestre;
    private User $jogador;
    private World $mundo;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dono = User::factory()->create(['email' => 'dono@ex.com']);
        $this->dono->forceFill(['plano' => 'pago', 'plano_vitalicio' => true])->save();
        $this->mestre = User::factory()->create(['email' => 'mestre@ex.com', 'name' => 'Co-mestre']);
        $this->jogador = User::factory()->create(['email' => 'jogador@ex.com', 'name' => 'Jogador']);
        $this->mundo = WorldbuilderController::criarExemplo($this->dono->id);

        $this->actingAs($this->dono);
        $id = $this->mundo->id;
        $this->postJson("/api/worlds/$id/players", ['email' => 'mestre@ex.com', 'papel' => 'mestre'])->assertCreated();
        $this->postJson("/api/worlds/$id/players", ['email' => 'jogador@ex.com'])->assertCreated()
            ->assertJsonPath('world.players.1.papel', 'jogador');
    }

    public function test_nevoa_esconde_o_que_nao_foi_revelado_do_jogador(): void
    {
        $id = $this->mundo->id;
        // Revela só um círculo em volta de Valdrin (-12, 32), depois cobre de novo um pedaço
        $this->putJson("/api/worlds/$id/fog", ['ativo' => true, 'areas' => [[-12, 32, 15, 1], [100, 100, 5, 0]]])
            ->assertOk()->assertJsonPath('fog.ativo', true);

        $dados = $this->actingAs($this->jogador)->getJson("/api/worlds/$id/data")->assertOk()->json();
        $nomes = array_column($dados['features'], 'name');
        $this->assertContains('Valdrin', $nomes);
        $this->assertNotContains('Porto Corvo', $nomes);
        $this->assertNotContains('Cordilheira do Dragão Adormecido', $nomes);
        $this->assertFalse($dados['can_edit']);
        $this->assertSame('jogador', $dados['papel']);
        $this->putJson("/api/worlds/$id/fog", ['ativo' => false, 'areas' => []])->assertNotFound();

        // Cobrir de novo esconde
        $this->actingAs($this->dono)->putJson("/api/worlds/$id/fog", ['ativo' => true, 'areas' => [[-12, 32, 15, 1], [-12, 32, 3, 0]]])->assertOk();
        $nomes = array_column($this->actingAs($this->jogador)->getJson("/api/worlds/$id/data")->json('features'), 'name');
        $this->assertNotContains('Valdrin', $nomes);

        // Mestre convidado vê tudo, inclusive segredos, e edita
        $dados = $this->actingAs($this->mestre)->getJson("/api/worlds/$id/data")->assertOk()->json();
        $this->assertCount(15, $dados['features']);
        $this->assertTrue($dados['can_edit']);
        $this->get("/mundos/$id")->assertOk()->assertSee('data-mode="edit"', false);
        $local = $this->mundo->features()->first();
        $this->putJson("/api/features/{$local->id}", ['name' => 'Renomeado'])->assertOk();
        $this->putJson("/api/worlds/$id/fog", ['ativo' => false, 'areas' => []])->assertOk();
        // ...mas não muda visibilidade, tamanho nem jogadores
        $this->putJson("/api/worlds/$id", ['visibility' => 'public'])->assertForbidden();
        $this->putJson("/api/worlds/$id", ['dimension' => 300])->assertForbidden();
        $this->postJson("/api/worlds/$id/players", ['email' => 'dono@ex.com'])->assertNotFound();

        // Dono rebaixa o mestre a jogador
        $this->actingAs($this->dono)->putJson("/api/worlds/$id/players/{$this->mestre->id}", ['papel' => 'jogador'])->assertOk();
        $this->actingAs($this->mestre)->get("/mundos/$id")->assertRedirect("/mundos/$id/ver");
    }

    public function test_tamanho_livre_estradas_ilhas_troca_de_tipo_e_desfazer(): void
    {
        $id = $this->mundo->id;
        $this->putJson("/api/worlds/$id", ['dimension' => 731])->assertOk()->assertJsonPath('world.dimension', 730);
        $this->putJson("/api/worlds/$id", ['dimension' => 1200])->assertStatus(422);

        // Grátis: tamanho livre também respeita o limite
        $g = User::factory()->create();
        $this->actingAs($g)->post('/mundos', ['name' => 'G', 'dimension' => 180])->assertRedirect();
        $this->assertSame(180, World::where('user_id', $g->id)->first()->dimension);
        $this->post('/mundos', ['name' => 'G2', 'dimension' => 250])->assertRedirect('/planos?motivo=dimensao');

        $this->actingAs($this->dono);
        $this->postJson("/api/worlds/$id/features", ['type' => 'road', 'name' => 'Estrada Real', 'x' => 0, 'z' => 0, 'size' => 1.5, 'skin' => 'pedra'])->assertStatus(422);
        $estrada = $this->postJson("/api/worlds/$id/features", ['type' => 'road', 'name' => 'Estrada Real', 'x' => 0, 'z' => 0, 'size' => 1.5, 'skin' => 'pedra', 'points' => [[0, 0], [30, 10], [60, -5]]])
            ->assertCreated()->assertJsonCount(3, 'points')->json();
        $this->postJson("/api/worlds/$id/features", ['type' => 'island', 'name' => 'Ilha do Farol', 'x' => 200, 'z' => 200, 'size' => 20, 'skin' => 'areia', 'shape' => ['altura' => 1.5, 'semNome' => true]])
            ->assertCreated()->assertJsonPath('shape.semNome', 1);

        // Estrada vira rio e volta; vila vira cidade; lago não vira montanha
        $this->putJson("/api/features/{$estrada['id']}", ['type' => 'river'])->assertOk()->assertJsonPath('type', 'river')->assertJsonPath('skin', null);
        $vila = $this->mundo->features()->where('name', 'Olmo Alto')->first();
        $this->putJson("/api/features/{$vila->id}", ['type' => 'city'])->assertOk()->assertJsonPath('skin', 'nordica');
        $lago = $this->mundo->features()->where('type', 'lake')->first();
        $this->putJson("/api/features/{$lago->id}", ['type' => 'mountain'])->assertStatus(422);
        $this->putJson("/api/features/{$lago->id}", ['type' => 'ocean'])->assertOk();
        $valdrin = $this->mundo->features()->where('name', 'Valdrin')->first();
        $this->putJson("/api/features/{$valdrin->id}", ['type' => 'village'])->assertOk();

        // Excluir devolve o lugar inteiro, e restaurar recria NPCs, lojas e itens
        $copia = $this->deleteJson("/api/features/{$valdrin->id}")->assertOk()->json('restaurar');
        $this->assertSame('Empório da Gaivota', $copia['shops'][0]['name']);
        $volta = $this->postJson("/api/worlds/$id/features/restaurar", ['feature' => $copia])->assertCreated()->json();
        $this->assertSame('Valdrin', $volta['name']);
        $this->assertCount(2, $volta['npcs']);
        $this->assertSame('Empório da Gaivota', $volta['shops'][0]['name']);
        $this->assertCount(2, $volta['shops'][0]['items']);

        // Jogador não restaura nem mexe na névoa
        $this->actingAs($this->jogador)->postJson("/api/worlds/$id/features/restaurar", ['feature' => $copia])->assertNotFound();
    }

    public function test_lugar_sem_nome_e_formato_esticado(): void
    {
        $id = $this->mundo->id;
        $f = $this->postJson("/api/worlds/$id/features", ['type' => 'mountain', 'name' => '', 'x' => 0, 'z' => 0, 'size' => 10])
            ->assertCreated()->assertJsonPath('name', '')->json();
        $this->postJson("/api/worlds/$id/features", ['type' => 'lake', 'x' => 5, 'z' => 5, 'size' => 6])->assertCreated();
        $this->putJson("/api/features/{$f['id']}", ['name' => 'Pico'])->assertOk()->assertJsonPath('name', 'Pico');
        $this->putJson("/api/features/{$f['id']}", ['name' => ''])->assertOk()->assertJsonPath('name', '');
        $this->putJson("/api/features/{$f['id']}", ['x' => 8, 'size' => 20, 'shape' => ['esticar' => 6.5, 'giro' => 90]])
            ->assertOk()->assertJsonPath('shape.esticar', 6.5)->assertJsonPath('size', 20);
        $this->putJson("/api/features/{$f['id']}", ['shape' => ['esticar' => 12]])->assertStatus(422);
    }

    public function test_torres_ruinas_e_fenomenos(): void
    {
        $id = $this->mundo->id;
        foreach (['tower' => 'farol', 'ruins' => 'templo', 'phenomenon' => 'tempestade'] as $tipo => $skin) {
            $f = $this->postJson("/api/worlds/$id/features", ['type' => $tipo, 'name' => '', 'x' => 10, 'z' => 10, 'size' => 4, 'skin' => $skin, 'shape' => ['altura' => 1.5, 'densidade' => 2]])
                ->assertCreated()->assertJsonPath('skin', $skin)->json();
            $this->putJson("/api/features/{$f['id']}", ['skin' => 'vulcao'])->assertStatus(422);
        }
        $this->postJson("/api/worlds/$id/features", ['type' => 'phenomenon', 'x' => 0, 'z' => 0, 'size' => 20, 'skin' => 'nevoa', 'color' => '#9a6fd0'])->assertCreated();
        $this->putJson("/api/worlds/$id", ['theme' => ['fundo' => 'pergaminho', 'estilo' => 'pergaminho', 'skins' => ['phenomenon' => 'chuva', 'tower' => 'mago']]])
            ->assertOk();
    }

    public function test_regioes_trava_e_cor_das_ilhas(): void
    {
        $id = $this->mundo->id;
        $this->putJson("/api/worlds/$id/fog", ['ativo' => false, 'areas' => []])->assertOk();
        $this->postJson("/api/worlds/$id/features", ['type' => 'region', 'name' => 'Reino', 'x' => 0, 'z' => 0, 'size' => 1, 'points' => [[0, 0], [10, 0]]])->assertStatus(422);
        $r = $this->postJson("/api/worlds/$id/features", ['type' => 'region', 'name' => 'Reino', 'x' => 3, 'z' => 3, 'size' => 1, 'points' => [[0, 0], [10, 0], [5, 9]], 'skin' => 'hachurada'])
            ->assertCreated()->json();
        $this->putJson("/api/features/{$r['id']}", ['shape' => ['oculta' => true, 'trancado' => true]])->assertOk()
            ->assertJsonPath('shape.oculta', 1)->assertJsonPath('shape.trancado', 1);
        $nomes = array_column($this->actingAs($this->jogador)->getJson("/api/worlds/$id/data")->json('features'), 'name');
        $this->assertNotContains('Reino', $nomes);
        $nomes = array_column($this->actingAs($this->mestre)->getJson("/api/worlds/$id/data")->json('features'), 'name');
        $this->assertContains('Reino', $nomes);
        $this->actingAs($this->dono)->putJson("/api/worlds/$id", ['theme' => ['fundo' => 'pergaminho', 'estilo' => 'pergaminho', 'cores' => ['ilha' => '#123456']]])
            ->assertOk()->assertJsonPath('world.theme.cores.ilha', '#123456');
    }

    public function test_biomas(): void
    {
        $id = $this->mundo->id;
        $this->postJson("/api/worlds/$id/features", ['type' => 'biome', 'x' => 0, 'z' => 0, 'size' => 6, 'points' => [[0, 0], [10, 0]]])->assertStatus(422);
        $b = $this->postJson("/api/worlds/$id/features", ['type' => 'biome', 'x' => 3, 'z' => 3, 'size' => 6, 'skin' => 'deserto', 'color' => '#e0b070',
            'points' => [[0, 0], [20, 0], [10, 18]], 'shape' => ['elevacao' => 4, 'ondulacao' => 2, 'densidade' => 0]])
            ->assertCreated()->assertJsonPath('shape.elevacao', 4)->assertJsonPath('shape.densidade', 0)->json();
        $this->putJson("/api/features/{$b['id']}", ['skin' => 'pantano', 'shape' => ['elevacao' => -3]])->assertOk()->assertJsonPath('skin', 'pantano');
        $this->putJson("/api/features/{$b['id']}", ['shape' => ['elevacao' => 40]])->assertStatus(422);
    }

    public function test_trancar_o_mapa(): void
    {
        $id = $this->mundo->id;
        $f = $this->mundo->features()->first();
        $this->putJson("/api/worlds/$id", ['trancado' => true])->assertOk()->assertJsonPath('world.trancado', true);
        $this->putJson("/api/features/{$f->id}", ['name' => 'Outro'])->assertStatus(423);
        $this->postJson("/api/worlds/$id/features", ['type' => 'lake', 'x' => 0, 'z' => 0, 'size' => 5])->assertStatus(423);
        $this->putJson("/api/worlds/$id", ['name' => 'Novo nome'])->assertStatus(423);
        $this->putJson("/api/worlds/$id/fog", ['ativo' => true, 'areas' => []])->assertStatus(423);
        $this->actingAs($this->jogador)->putJson("/api/worlds/$id", ['trancado' => false])->assertNotFound();
        $this->actingAs($this->mestre)->putJson("/api/worlds/$id", ['trancado' => false])->assertOk()->assertJsonPath('world.trancado', false);
        $this->actingAs($this->dono)->putJson("/api/features/{$f->id}", ['name' => 'Outro'])->assertOk();
    }
}
