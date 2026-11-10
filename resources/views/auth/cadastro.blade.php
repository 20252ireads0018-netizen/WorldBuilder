@extends('layouts.app')

@section('title', 'Criar conta · Worldbuilder')

@section('conteudo')
<div class="wb-pagina">
<div class="shelf shelf--estreita">
    <form method="POST" action="{{ route('register.store') }}" class="card">
        @csrf
        <h2>Criar conta</h2>
        <label>Nome
            <input name="name" value="{{ old('name') }}" maxlength="60" required autofocus autocomplete="name">
        </label>
        @error('name') <p class="error">{{ $message }}</p> @enderror
        <label>E-mail
            <input type="email" name="email" value="{{ old('email') }}" maxlength="120" required autocomplete="email">
        </label>
        @error('email') <p class="error">{{ $message }}</p> @enderror
        <label>Senha (mínimo 8 caracteres)
            <input type="password" name="password" minlength="8" required autocomplete="new-password">
        </label>
        <label>Repita a senha
            <input type="password" name="password_confirmation" minlength="8" required autocomplete="new-password">
        </label>
        @error('password') <p class="error">{{ $message }}</p> @enderror
        <div class="linha">
            <button class="primary">Criar conta</button>
            <a href="{{ route('login') }}">Já tenho conta</a>
        </div>
    </form>
</div>
</div>
@endsection
