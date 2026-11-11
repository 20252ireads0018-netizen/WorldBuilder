<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Local do mapa: montanha, lago, rio, cidade, vila ou floresta (skin e cor próprias são opcionais). */
class Feature extends Model
{
    protected $table = 'wb_features';

    protected $fillable = ['type', 'name', 'description', 'x', 'z', 'size', 'points', 'skin', 'color', 'secret', 'shape', 'era_id'];

    protected static function booted(): void
    {
        // lugar criado sem era vai para a primeira era do mundo
        static::creating(function (Feature $f) {
            if (! $f->era_id && $f->world_id) {
                $f->era_id = World::find($f->world_id)?->eraPrincipal()->id;
            }
        });
    }

    protected $casts = [
        'points' => 'array',
        'shape' => 'array',
        'x' => 'float',
        'z' => 'float',
        'size' => 'float',
        'secret' => 'boolean',
    ];

    public function world(): BelongsTo
    {
        return $this->belongsTo(World::class, 'world_id');
    }

    public function era(): BelongsTo
    {
        return $this->belongsTo(Era::class);
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
