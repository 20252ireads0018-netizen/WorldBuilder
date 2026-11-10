<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Névoa de guerra por mundo (áreas reveladas para os jogadores) e papel de cada convidado:
 * jogador (vê só o que foi revelado, sem segredos) ou mestre (vê tudo e edita o mapa).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wb_worlds', function (Blueprint $t) {
            $t->json('fog')->nullable(); // {ativo: bool, areas: [[x, z, raio, revela 1|0], ...]}
        });
        Schema::table('wb_world_players', function (Blueprint $t) {
            $t->string('papel', 10)->default('jogador');
        });
    }

    public function down(): void
    {
        Schema::table('wb_world_players', fn (Blueprint $t) => $t->dropColumn('papel'));
        Schema::table('wb_worlds', fn (Blueprint $t) => $t->dropColumn('fog'));
    }
};
