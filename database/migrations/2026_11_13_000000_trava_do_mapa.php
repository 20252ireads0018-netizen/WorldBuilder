<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Mapa trancado: fica só para visualização até alguém que edita destrancar. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wb_worlds', function (Blueprint $t) {
            $t->boolean('trancado')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('wb_worlds', function (Blueprint $t) {
            $t->dropColumn('trancado');
        });
    }
};
