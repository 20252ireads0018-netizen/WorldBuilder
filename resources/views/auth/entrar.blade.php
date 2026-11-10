@extends('layouts.app')

@section('title', 'Entrar · Worldbuilder')

@section('conteudo')
<div class="wb-pagina">
<div class="shelf shelf--estreita">
    <form method="POST" action="{{ route('login.attempt') }}" class="card">
        @csrf
        <h2>Entrar</h2>
        <label>E-mail
            <input type="email" name="email" value="{{ old('email') }}" required autofocus autocomplete="email">
        </label>
        <label>Senha
            <input type="password" name="password" required autocomplete="current-password">
        </label>
        <label class="wb-check"><input type="checkbox" name="remember" value="1"> Manter conectado</label>
        @error('email') <p class="error">{{ $message }}</p> @enderror
        <div class="linha">
            <button class="primary">Entrar</button>
            <a href="{{ route('register') }}">Criar uma conta</a>
        </div>
    </form>
</div>
</div>
@endsection
