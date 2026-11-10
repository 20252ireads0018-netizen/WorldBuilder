<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Worldbuilder: mundos desenhados em 3D (montanhas, lagos, rios, cidades e vilas) com lojas, NPCs e itens.
 *  Tabelas com prefixo wb_.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wb_worlds', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $t->string('name', 80);
            $t->text('description')->nullable();
            $t->timestamps();
        });

        // Locais do mapa: mountain, lake, river, city, village
        Schema::create('wb_features', function (Blueprint $t) {
            $t->id();
            $t->foreignId('world_id')->constrained('wb_worlds')->cascadeOnDelete();
            $t->string('type', 20);
            $t->string('name', 80);
            $t->text('description')->nullable();
            $t->float('x');
            $t->float('z');
            $t->float('size')->default(10);
            $t->json('points')->nullable(); // rios: [[x,z],[x,z],...]
            $t->timestamps();
        });

        Schema::create('wb_shops', function (Blueprint $t) {
            $t->id();
            $t->foreignId('feature_id')->constrained('wb_features')->cascadeOnDelete();
            $t->string('name', 80);
            $t->text('description')->nullable();
            $t->timestamps();
        });

        Schema::create('wb_npcs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('feature_id')->constrained('wb_features')->cascadeOnDelete();
            $t->foreignId('shop_id')->nullable()->constrained('wb_shops')->nullOnDelete();
            $t->string('name', 80);
            $t->string('role', 80)->nullable();
            $t->text('description')->nullable();
            $t->timestamps();
        });

        Schema::create('wb_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('feature_id')->constrained('wb_features')->cascadeOnDelete();
            $t->foreignId('shop_id')->nullable()->constrained('wb_shops')->cascadeOnDelete();
            $t->string('name', 80);
            $t->text('description')->nullable();
            $t->unsignedInteger('price')->default(0);
            $t->unsignedInteger('quantity')->default(1);
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wb_items');
        Schema::dropIfExists('wb_npcs');
        Schema::dropIfExists('wb_shops');
        Schema::dropIfExists('wb_features');
        Schema::dropIfExists('wb_worlds');
    }
};
