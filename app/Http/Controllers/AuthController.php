<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\View\View;

/** Contas próprias do Worldbuilder: cadastro, entrar e sair. */
class AuthController extends Controller
{
    public function home(): View|RedirectResponse
    {
        return Auth::check() ? redirect()->route('worldbuilder.index') : view('home');
    }

    public function showLogin(): View
    {
        return view('auth.entrar');
    }

    public function login(Request $request): RedirectResponse
    {
        $dados = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt(['email' => mb_strtolower(trim($dados['email'])), 'password' => $dados['password']], $request->boolean('remember'))) {
            return back()->withErrors(['email' => 'E-mail ou senha incorretos.'])->onlyInput('email');
        }

        $request->session()->regenerate();

        return redirect()->intended(route('worldbuilder.index'));
    }

    public function showRegister(): View
    {
        return view('auth.cadastro');
    }

    public function register(Request $request): RedirectResponse
    {
        $request->merge(['email' => mb_strtolower(trim((string) $request->input('email')))]);

        $dados = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'email' => ['required', 'email', 'max:120', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ], [
            'email.unique' => 'Já existe uma conta com esse e-mail.',
            'password.confirmed' => 'As senhas não conferem.',
        ]);

        $user = User::create([
            'name' => trim($dados['name']),
            'email' => $dados['email'],
            'password' => Hash::make($dados['password']),
        ]);

        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->route('worldbuilder.index');
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
