<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

/** Pedido de plano pago por Pix: pendente -> informado (a pessoa disse que pagou) -> confirmado ou cancelado. */
class Pagamento extends Model
{
    protected $table = 'wb_pagamentos';

    protected $casts = [
        'valor' => 'float',
        'informado_em' => 'datetime',
        'confirmado_em' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function oferta(): array
    {
        return config('planos.ofertas.' . $this->oferta) ?? ['nome' => $this->oferta, 'dias' => 31];
    }

    public function getRouteKeyName(): string
    {
        return 'txid';
    }

    /**
     * Confirma o pagamento e libera o plano. Renovação antes do fim soma ao período atual;
     * vitalício não tem fim. Dois cliques em Confirmar não somam duas vezes.
     */
    public function confirmar(): bool
    {
        return DB::transaction(function () {
            $p = self::whereKey($this->id)->lockForUpdate()->first();
            if (! $p || in_array($p->status, ['confirmado', 'cancelado'], true)) {
                return false;
            }
            $user = User::whereKey($p->user_id)->lockForUpdate()->firstOrFail();
            $dias = $p->oferta()['dias'];

            $user->plano = 'pago';
            if ($dias === null) {
                $user->plano_vitalicio = true;
            } elseif (! $user->plano_vitalicio) {
                $base = $user->plano_ate && $user->plano_ate->isFuture() ? $user->plano_ate : now();
                $user->plano_ate = $base->copy()->addDays($dias)->endOfDay();
            }
            $user->save();

            $p->status = 'confirmado';
            $p->confirmado_em = now();
            $p->save();
            $this->refresh();

            return true;
        });
    }
}
