<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Uma versão do mundo no tempo: tem os seus próprios lugares (com NPCs, lojas e itens). */
class Era extends Model
{
    protected $table = 'wb_eras';

    protected $fillable = ['name', 'periodo', 'description', 'ordem'];

    protected $casts = ['ordem' => 'integer'];

    protected static function booted(): void
    {
        // lugares da era vão junto (NPCs, lojas e itens caem em cascata no banco)
        static::deleting(fn (Era $e) => Feature::where('era_id', $e->id)->get()->each->delete());
    }

    public function world(): BelongsTo
    {
        return $this->belongsTo(World::class);
    }

    public function features(): HasMany
    {
        return $this->hasMany(Feature::class);
    }

    public function paraJson(): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'periodo' => $this->periodo, 'description' => $this->description, 'ordem' => $this->ordem];
    }
}
