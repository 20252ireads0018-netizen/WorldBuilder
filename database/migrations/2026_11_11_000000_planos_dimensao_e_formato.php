<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Planos (grátis/pago) com cobrança por Pix, tamanho do mapa por mundo e formato de cada lugar.
 * Quem já tinha conta antes dos planos (só o dono do site) fica com plano pago vitalício e acesso de administração.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->string('plano', 20)->default('gratis');
            $t->timestamp('plano_ate')->nullable();
            $t->boolean('plano_vitalicio')->default(false);
            $t->boolean('is_admin')->default(false);
        });
        DB::table('users')->update(['plano' => 'pago', 'plano_vitalicio' => true, 'is_admin' => true]);

        Schema::table('wb_worlds', function (Blueprint $t) {
            $t->unsignedSmallInteger('dimension')->default(200);
        });

        Schema::table('wb_features', function (Blueprint $t) {
            $t->json('shape')->nullable(); // {esticar, giro, irregular}
        });

        Schema::create('wb_pagamentos', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $t->string('oferta', 20);
            $t->decimal('valor', 8, 2);
            $t->string('txid', 25)->unique();
            $t->string('status', 12)->default('pendente'); // pendente, informado, confirmado, cancelado
            $t->timestamp('informado_em')->nullable();
            $t->timestamp('confirmado_em')->nullable();
            $t->timestamps();
            $t->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wb_pagamentos');
        Schema::table('wb_features', fn (Blueprint $t) => $t->dropColumn('shape'));
        Schema::table('wb_worlds', fn (Blueprint $t) => $t->dropColumn('dimension'));
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn(['plano', 'plano_ate', 'plano_vitalicio', 'is_admin']));
    }
};
