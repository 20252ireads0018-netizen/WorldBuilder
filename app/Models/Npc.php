<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** NPC alocado num local (opcionalmente ligado a uma loja do mesmo local). */
class Npc extends Model
{
    protected $table = 'wb_npcs';

    protected $fillable = ['name', 'role', 'description', 'shop_id'];

    public function feature(): BelongsTo
    {
        return $this->belongsTo(Feature::class, 'feature_id');
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class, 'shop_id');
    }
}
