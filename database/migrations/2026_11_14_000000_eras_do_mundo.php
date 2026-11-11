<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Eras: versões do mesmo mundo (ex.: "Antes da guerra", "Hoje", "Daqui a 100 anos").
 * Cada lugar pertence a uma era; os mundos que já existem ganham a era "Era atual" com todos os lugares.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wb_eras', function (Blueprint $t) {
            $t->id();
            $t->foreignId('world_id')->constrained('wb_worlds')->cascadeOnDelete();
            $t->string('name', 80);
            $t->string('periodo', 80)->nullable(); // ex.: "Ano 312 a 540", "Antes da Queda"
            $t->text('description')->nullable();
            $t->integer('ordem')->default(0);
            $t->timestamps();
        });
        Schema::table('wb_features', function (Blueprint $t) {
            $t->unsignedBigInteger('era_id')->nullable()->index();
        });

        $agora = now();
        foreach (DB::table('wb_worlds')->pluck('id') as $mundo) {
            $era = DB::table('wb_eras')->insertGetId(['world_id' => $mundo, 'name' => 'Era atual', 'ordem' => 0, 'created_at' => $agora, 'updated_at' => $agora]);
            DB::table('wb_features')->where('world_id', $mundo)->update(['era_id' => $era]);
        }
    }

    public function down(): void
    {
        Schema::table('wb_features', function (Blueprint $t) {
            $t->dropIndex(['era_id']);
            $t->dropColumn('era_id');
        });
        Schema::dropIfExists('wb_eras');
    }
};
