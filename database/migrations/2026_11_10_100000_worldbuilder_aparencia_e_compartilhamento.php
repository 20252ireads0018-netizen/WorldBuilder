<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Aparência (tema do mundo, cor e skin de cada local), mundos públicos, capa e jogadores convidados.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wb_worlds', function (Blueprint $t) {
            $t->string('visibility', 10)->default('private'); // private | public
            $t->json('theme')->nullable();                    // fundo, estilo, cores e skins padrão
            $t->unsignedInteger('cover_version')->nullable(); // capa salva em storage/app/private/capas
            $t->index(['visibility', 'updated_at']);
        });

        Schema::table('wb_features', function (Blueprint $t) {
            $t->string('skin', 20)->nullable();  // null = skin padrão do mundo
            $t->string('color', 7)->nullable();  // null = cor do tema
            $t->boolean('secret')->default(false); // escondido dos jogadores e do público
        });

        Schema::create('wb_world_players', function (Blueprint $t) {
            $t->id();
            $t->foreignId('world_id')->constrained('wb_worlds')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $t->timestamps();
            $t->unique(['world_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wb_world_players');
        Schema::table('wb_features', function (Blueprint $t) {
            $t->dropColumn(['skin', 'color', 'secret']);
        });
        Schema::table('wb_worlds', function (Blueprint $t) {
            $t->dropIndex(['visibility', 'updated_at']);
            $t->dropColumn(['visibility', 'theme', 'cover_version']);
        });
    }
};
