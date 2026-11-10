<?php

namespace Tests\Feature;

use App\Http\Controllers\WorldbuilderController;
use App\Models\Pagamento;
use App\Models\User;
use App\Models\World;
use App\Support\MundoArquivo;
use App\Support\Pix;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

/** Plano grátis (2 mundos, mapa até 200), Pix, confirmação pelo admin, tamanho do mapa, oceano e formato dos lugares. */
class PlanosTest extends TestCase
{
    use RefreshDatabase;

    public function test_gratis_vai_para_planos_ao_passar_dos_limites(): void
    {
        $u = User::factory()->create();
        $this->actingAs($u);

        $this->post('/mundos', ['name' => 'Um'])->assertRedirect();
        $this->post('/mundos', ['name' => 'Dois'])->assertRedirect();
        $this->post('/mundos', ['name' => 'Três'])->assertRedirect('/planos?motivo=mundos');
        $this->post('/mundos/exemplo')->assertRedirect('/planos?motivo=mundos');
        $this->assertSame(2, World::where('user_id', $u->id)->count());

        $w = World::where('user_id', $u->id)->first();
        $this->post("/mundos/{$w->id}/copiar")->assertRedirect('/planos?motivo=mundos');

        // Mapa grande: no mundo existente e na criação
        $this->putJson("/api/worlds/{$w->id}", ['dimension' => 400])->assertStatus(402)->assertJsonPath('redirect', url('/planos?motivo=dimensao'));
        $this->putJson("/api/worlds/{$w->id}", ['dimension' => 160])->assertOk()->assertJsonPath('world.dimension', 160);
        World::where('user_id', $u->id)->latest('id')->first()->delete();
        $this->post('/mundos', ['name' => 'Grande', 'dimension' => 600])->assertRedirect('/planos?motivo=dimensao');

        // Importar arquivo de mapa grande
        $mestre = User::factory()->create();
        $grande = WorldbuilderController::criarExemplo($mestre->id);
        $grande->dimension = 400;
        $grande->save();
        $json = json_encode(MundoArquivo::exportar($grande));
        $this->post('/mundos/importar', ['arquivo' => UploadedFile::fake()->createWithContent('g.json', $json)])
            ->assertRedirect('/planos?motivo=dimensao');

        $this->get('/planos?motivo=mundos')->assertOk()->assertSee('Assine o plano Cartógrafo');
    }

    public function test_pix_pagamento_e_confirmacao_liberam_o_plano(): void
    {
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();
        $u = User::factory()->create(['name' => 'Cliente']);

        $this->actingAs($u)->post('/planos/mensal')->assertRedirect();
        $p = Pagamento::firstOrFail();
        $this->assertSame('pendente', $p->status);
        $this->assertEquals(9.90, $p->valor);
        $this->post('/planos/mensal'); // mesmo pedido reaproveitado
        $this->assertSame(1, Pagamento::count());

        $codigo = Pix::copiaECola(9.90, $p->txid);
        $this->assertStringContainsString('br.gov.bcb.pix', $codigo);
        $this->assertSame(Pix::crc16(substr($codigo, 0, -4)), substr($codigo, -4));
        $this->get("/pagamentos/{$p->txid}")->assertOk()->assertSee($codigo, false);

        $this->post("/pagamentos/{$p->txid}/paguei")->assertRedirect();
        $this->assertSame('informado', $p->fresh()->status);

        // Só admin confirma; outra pessoa nem vê o pedido
        $this->post("/admin/pagamentos/{$p->txid}/confirmar")->assertNotFound();
        $this->actingAs($admin)->get("/pagamentos/{$p->txid}")->assertNotFound();
        $this->get('/admin/pagamentos')->assertOk()->assertSee('Cliente');
        $this->post("/admin/pagamentos/{$p->txid}/confirmar")->assertRedirect();
        $this->post("/admin/pagamentos/{$p->txid}/confirmar"); // segundo clique não soma

        $u->refresh();
        $this->assertTrue($u->temPlanoPago());
        $this->assertTrue($u->plano_ate->between(now()->addDays(30), now()->addDays(32)));

        $this->actingAs($u);
        foreach (['A', 'B', 'C'] as $n) {
            $this->post('/mundos', ['name' => $n, 'dimension' => 600])->assertRedirect();
        }
        $this->assertSame(3, World::where('user_id', $u->id)->count());

        // Plano vencido volta ao limite grátis
        $u->forceFill(['plano_ate' => now()->subDay()])->save();
        $this->post('/mundos', ['name' => 'D'])->assertRedirect('/planos?motivo=mundos');
    }

    public function test_mapa_grande_oceano_e_formato(): void
    {
        $u = User::factory()->create();
        $u->forceFill(['plano' => 'pago', 'plano_vitalicio' => true])->save();
        $this->actingAs($u);
        $this->post('/mundos', ['name' => 'Vasto', 'dimension' => 400]);
        $w = World::firstOrFail();
        $this->assertSame(400, $w->dimension);

        $r = $this->postJson("/api/worlds/{$w->id}/features", [
            'type' => 'ocean', 'name' => 'Mar Sem Fim', 'x' => 180, 'z' => -150, 'size' => 120, 'skin' => 'tempestuoso',
            'shape' => ['esticar' => 1.8, 'giro' => 30, 'irregular' => 0.6, 'lixo' => 9],
        ])->assertCreated()->assertJsonPath('shape.esticar', 1.8)->assertJsonPath('skin', 'tempestuoso');
        $this->assertArrayNotHasKey('lixo', $r->json('shape'));

        $this->postJson("/api/worlds/{$w->id}/features", ['type' => 'lake', 'name' => 'X', 'x' => 250, 'z' => 0, 'size' => 5])->assertStatus(422);

        $cidade = $this->postJson("/api/worlds/{$w->id}/features", ['type' => 'city', 'name' => 'C', 'x' => 150, 'z' => 150, 'size' => 8])->json();
        $this->putJson("/api/features/{$cidade['id']}", ['shape' => ['esticar' => 2.5, 'giro' => 90]])->assertOk()->assertJsonPath('shape.giro', 90);
        $this->putJson("/api/features/{$cidade['id']}", ['shape' => ['esticar' => 5]])->assertStatus(422);
        $this->putJson("/api/features/{$cidade['id']}", ['shape' => null])->assertOk()->assertJsonPath('shape', null);

        // Encolher com lugares fora do novo tamanho é recusado
        $this->putJson("/api/worlds/{$w->id}", ['dimension' => 200])->assertStatus(422);

        $dados = $this->getJson("/api/worlds/{$w->id}/data")->assertOk()->json();
        $this->assertSame(400, $dados['world']['dimension']);
        $this->assertSame(600, $dados['world']['plano']['dimensao_max']);

        // Exportar e importar levam o tamanho e o formato
        $copia = MundoArquivo::importar(MundoArquivo::exportar($w), $u->id);
        $this->assertSame(400, $copia->dimension);
        $this->assertEquals(1.8, $copia->features()->where('type', 'ocean')->first()->shape['esticar']);
    }

    public function test_contas_antigas_ganham_plano_vitalicio_na_migracao(): void
    {
        // A migração roda antes dos usuários de teste existirem: conta nova nasce grátis e sem admin
        $u = User::factory()->create();
        $this->assertFalse($u->fresh()->temPlanoPago());
        $this->assertFalse((bool) $u->fresh()->is_admin);
        $this->actingAs($u)->get('/admin/pagamentos')->assertNotFound();
    }
}
