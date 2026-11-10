<?php

namespace App\Models;

use App\Support\Aparencia;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

/**
 * Mundo do Worldbuilder. Pertence a quem criou; pode ser público (aparece em Explorar)
 * e ter jogadores convidados, que veem o mapa sem editar.
 */
class World extends Model
{
    protected $table = 'wb_worlds';

    protected $fillable = ['name', 'description'];

    protected $casts = [
        'theme' => 'array',
        'cover_version' => 'integer',
        'dimension' => 'integer',
    ];

    protected $attributes = ['visibility' => 'private', 'dimension' => 200];

    protected static function booted(): void
    {
        static::deleting(fn (World $w) => Storage::disk('local')->delete($w->caminhoCapa()));
    }

    public function features(): HasMany
    {
        return $this->hasMany(Feature::class, 'world_id');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function players(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'wb_world_players', 'world_id', 'user_id')->withTimestamps();
    }

    public function ehDono(?User $u): bool
    {
        return $u !== null && (int) $this->user_id === (int) $u->id;
    }

    public function ehPublico(): bool
    {
        return $this->visibility === 'public';
    }

    /** Dono, jogador convidado ou qualquer pessoa se o mundo for público. */
    public function podeVer(?User $u): bool
    {
        if ($this->ehPublico() || $this->ehDono($u)) {
            return true;
        }

        return $u !== null && $this->players()->whereKey($u->id)->exists();
    }

    /** Metade do lado do mapa: as coordenadas vão de -meia a +meia. */
    public function meia(): int
    {
        return intdiv((int) ($this->dimension ?: 200), 2);
    }

    public function tema(): array
    {
        return Aparencia::normalizar($this->theme);
    }

    public function caminhoCapa(): string
    {
        return 'capas/' . $this->id . '.jpg';
    }

    public function urlCapa(): ?string
    {
        return $this->cover_version ? route('worldbuilder.capa', ['world' => $this->id, 'v' => $this->cover_version]) : null;
    }
}
