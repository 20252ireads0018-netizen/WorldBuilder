<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Loja de uma cidade ou vila. */
class Shop extends Model
{
    protected $table = 'wb_shops';

    protected $fillable = ['name', 'description'];

    public function feature(): BelongsTo
    {
        return $this->belongsTo(Feature::class, 'feature_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(Item::class, 'shop_id');
    }

    public function npcs(): HasMany
    {
        return $this->hasMany(Npc::class, 'shop_id');
    }
}
