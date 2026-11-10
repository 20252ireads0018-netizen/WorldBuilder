<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'plano_ate' => 'datetime',
            'plano_vitalicio' => 'boolean',
            'is_admin' => 'boolean',
        ];
    }

    /** Plano Cartógrafo ativo: vitalício ou com data de fim no futuro. */
    public function temPlanoPago(): bool
    {
        return $this->plano === 'pago' && ($this->plano_vitalicio || ($this->plano_ate && $this->plano_ate->isFuture()));
    }

    /** ['mundos' => n, 'dimensao' => lado máximo do mapa] */
    public function limites(): array
    {
        return config('planos.limites.' . ($this->temPlanoPago() ? 'pago' : 'gratis'));
    }

    public function podeCriarMundo(): bool
    {
        return World::where('user_id', $this->id)->count() < $this->limites()['mundos'];
    }
}
