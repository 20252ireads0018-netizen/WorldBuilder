<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Mundo do Worldbuilder (cada um pertence a um usuário). */
class World extends Model
{
    protected $table = 'wb_worlds';

    protected $fillable = ['name', 'description'];

    public function features(): HasMany
    {
        return $this->hasMany(Feature::class, 'world_id');
    }
}
