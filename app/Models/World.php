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
        'fog' => 'array',
        'trancado' => 'boolean',
    ];

    protected $attributes = ['visibility' => 'private', 'dimension' => 200, 'trancado' => false];

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
        return $this->belongsToMany(User::class, 'wb_world_players', 'world_id', 'user_id')->withPivot('papel')->withTimestamps();
    }

    public function ehDono(?User $u): bool
    {
        return $u !== null && (int) $this->user_id === (int) $u->id;
    }

    public function ehPublico(): bool
    {
        return $this->visibility === 'public';
    }

    /** 'dono', 'mestre' (convidado que edita e vê tudo), 'jogador' ou null. */
    public function papel(?User $u): ?string
    {
        if ($u === null) {
            return null;
        }
        if ($this->ehDono($u)) {
            return 'dono';
        }
        $p = $this->players()->whereKey($u->id)->first();

        return $p ? ($p->pivot->papel === 'mestre' ? 'mestre' : 'jogador') : null;
    }

    /** Dono ou mestre convidado: edita o mapa e vê segredos e névoa. */
    public function podeEditar(?User $u): bool
    {
        return in_array($this->papel($u), ['dono', 'mestre'], true);
    }

    /** Névoa normalizada: ['ativo' => bool, 'areas' => [[x, z, r, 1|0], ...]] */
    public function nevoa(): array
    {
        $n = is_array($this->fog) ? $this->fog : [];

        return ['ativo' => (bool) ($n['ativo'] ?? false), 'areas' => array_values($n['areas'] ?? [])];
    }

    /** Um ponto está visível para os jogadores? (a última pincelada que cobre o ponto vence) */
    public static function pontoVisivel(array $nevoa, float $x, float $z): bool
    {
        if (! $nevoa['ativo']) {
            return true;
        }
        $vis = false;
        foreach ($nevoa['areas'] as [$ax, $az, $r, $v]) {
            if (($x - $ax) ** 2 + ($z - $az) ** 2 <= $r * $r) {
                $vis = (bool) $v;
            }
        }

        return $vis;
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
