@extends('layouts.app')

@section('title', 'Entrar · Worldbuilder')

@section('conteudo')
<div class="wb-pagina">
<div class="shelf shelf--estreita">
    <form method="POST" action="{{ route('login.attempt') }}" class="card conta">
        @csrf
        @include('partials.bussola', ['classe' => 'selo-bussola'])
        <h2>Entrar</h2>
        <p class="mut">Volte para os seus mapas.</p>
        <label>E-mail
            <input type="email" name="email" value="{{ old('email') }}" required autofocus autocomplete="email">
        </label>
        <label>Senha
            <input type="password" name="password" required autocomplete="current-password">
        </label>
        <label class="wb-check"><input type="checkbox" name="remember" value="1"> Manter conectado</label>
        @error('email') <p class="error">{{ $message }}</p> @enderror
        <button class="primary largo">Entrar</button>
        <p class="conta-rodape">Ainda não tem conta? <a href="{{ route('register') }}">Criar uma conta</a></p>
    </form>
</div>
</div>
@endsection
