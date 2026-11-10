<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Local do mapa: montanha, lago, rio, cidade ou vila. */
class Feature extends Model
{
    protected $table = 'wb_features';

    protected $fillable = ['type', 'name', 'description', 'x', 'z', 'size', 'points'];

    protected $casts = [
        'points' => 'array',
        'x' => 'float',
        'z' => 'float',
        'size' => 'float',
    ];

    public function world(): BelongsTo
    {
        return $this->belongsTo(World::class, 'world_id');
    }

    public function npcs(): HasMany
    {
        return $this->hasMany(Npc::class, 'feature_id');
    }

    public function shops(): HasMany
    {
        return $this->hasMany(Shop::class, 'feature_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(Item::class, 'feature_id');
    }

    /** Itens deixados no local, fora de qualquer loja. */
    public function looseItems(): HasMany
    {
        return $this->hasMany(Item::class, 'feature_id')->whereNull('shop_id');
    }
}
