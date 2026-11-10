@extends('layouts.app')

@section('title', 'Worldbuilder · mapas de mundos de fantasia em 3D')

@section('conteudo')
<div class="wb-pagina">
<div class="shelf shelf--larga">
    <section class="heroi">
        <div class="heroi-txt">
            <p class="sobretitulo">Atlas de mundos imaginários</p>
            <h1 class="titulo-ouro">Dê forma ao mundo que só existe na sua cabeça</h1>
            <p class="heroi-sub">Desenhe o mapa em 3D, no estilo de pergaminho antigo, e povoe cada lugar com NPCs, lojas e itens. Depois mostre aos seus jogadores, ou ao mundo inteiro.</p>
            <div class="linha">
                <a class="btn primary grande" href="{{ route('register') }}">Criar conta grátis</a>
                <a class="btn claro grande" href="{{ route('worldbuilder.explorar') }}">Explorar mundos públicos</a>
            </div>
            <p class="heroi-nota">Já tem conta? <a href="{{ route('login') }}">Entrar</a></p>
        </div>
        <div class="heroi-arte" aria-hidden="true">
            <svg viewBox="0 0 400 300">
                <defs>
                    <radialGradient id="h-pap" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#f4e6c2"/><stop offset=".75" stop-color="#e3c98f"/><stop offset="1" stop-color="#c9a764"/></radialGradient>
                    <linearGradient id="h-agua" x1="0" x2="1"><stop offset="0" stop-color="#3f6d66"/><stop offset="1" stop-color="#2c524c"/></linearGradient>
                </defs>
                <rect x="10" y="10" width="380" height="280" rx="6" fill="url(#h-pap)" stroke="#8a6b3a" stroke-width="2"/>
                <rect x="20" y="20" width="360" height="260" rx="3" fill="none" stroke="#8a6b3a" stroke-width=".8" stroke-dasharray="2 3"/>
                <path d="M40 220c40-30 60 10 100-20s50-60 90-40 40 50 80 30 40-10 50 0" fill="none" stroke="#a88a55" stroke-width="1" opacity=".6"/>
                <path d="M40 240c40-30 60 10 100-20s50-60 90-40 40 50 80 30 40-10 50 0" fill="none" stroke="#a88a55" stroke-width="1" opacity=".35"/>
                <ellipse cx="270" cy="205" rx="48" ry="22" fill="url(#h-agua)" opacity=".9"/>
                <path d="M120 290c10-30-20-50 0-80s40-40 30-70" fill="none" stroke="#3f6d66" stroke-width="5" stroke-linecap="round"/>
                <g fill="#7a5a32" stroke="#3b2711" stroke-width="1.4" stroke-linejoin="round">
                    <path d="M150 140l40-70 22 36 14-20 38 54z"/>
                    <path d="M230 140l30-48 30 48z"/>
                </g>
                <path d="M190 70l-10 18 8-4 6 8 4-10zM260 92l-8 13 8-3 6 5z" fill="#f5efe0"/>
                <g fill="#3e5a2e"><circle cx="80" cy="120" r="10"/><circle cx="95" cy="110" r="12"/><circle cx="72" cy="104" r="9"/><circle cx="110" cy="124" r="9"/><circle cx="90" cy="130" r="8"/></g>
                <g fill="#9b2f1d" stroke="#3b2711" stroke-width="1.2"><path d="M300 110v-18l8-7 8 7v18zM318 110v-26l7-6 7 6v26z"/></g>
                <g font-family="IM Fell English, serif" fill="#3b2711" text-anchor="middle">
                    <text x="200" y="168" font-size="15" font-style="italic" letter-spacing="2">Montes do Dragão</text>
                    <text x="270" y="240" font-size="12" font-style="italic" fill="#2c524c" letter-spacing="3">Lago Sereno</text>
                    <text x="318" y="128" font-size="14">Valdrin</text>
                    <text x="92" y="150" font-size="12" font-style="italic">Mata Velha</text>
                </g>
                <g transform="translate(345 245)" fill="#3b2711" opacity=".85"><circle r="16" fill="none" stroke="#3b2711"/><path d="M0-20l3 17-3 3-3-3zM0 20l-3-17 3-3 3 3z"/><text y="-23" font-size="9" text-anchor="middle" font-family="Cinzel, serif">N</text></g>
            </svg>
        </div>
    </section>

    <h2 class="secao">O que dá para fazer</h2>
    <div class="recursos">
        <div class="recurso">
            <svg viewBox="0 0 24 24"><path d="M2 20l7-13 4 7 3-4 6 10z"/></svg>
            <h3>Moldar o terreno</h3>
            <p>Erga montanhas, abra lagos, trace rios, plante florestas e funde cidades e vilas direto no mapa.</p>
        </div>
        <div class="recurso">
            <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
            <h3>Povoar cada lugar</h3>
            <p>Dê nome e história a cada lugar, aloque NPCs e abra lojas com itens, preços e estoque.</p>
        </div>
        <div class="recurso">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18M3 12h18"/></svg>
            <h3>Escolher a aparência</h3>
            <p>Pergaminho, ilha no oceano, céu noturno ou névoa; cores próprias de terra, lagos e montanhas.</p>
        </div>
        <div class="recurso">
            <svg viewBox="0 0 24 24"><path d="M3 21V9l3-2 3 2v12M9 21V5l3-2 3 2v16M15 21v-9l3-2 3 2v9M2 21h20"/></svg>
            <h3>Estilos para cada lugar</h3>
            <p>Vulcões, picos nevados, lagos congelados ou de lava, cidades élficas, nórdicas, do deserto e mais.</p>
        </div>
        <div class="recurso">
            <svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
            <h3>Mostrar aos jogadores</h3>
            <p>Deixe o mundo público ou convide jogadores pelo e-mail, com lugares secretos que só você enxerga.</p>
        </div>
        <div class="recurso">
            <svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M4 19h16"/></svg>
            <h3>Guardar e duplicar</h3>
            <p>Salve o mundo em arquivo, importe de volta, duplique e baixe imagens do mapa.</p>
        </div>
    </div>

    <section class="faixa-cta">
        <div>
            <h2>Seu primeiro mapa leva cinco minutos</h2>
            <p>Comece com o mundo de exemplo e mude o que quiser.</p>
        </div>
        <a class="btn primary grande" href="{{ route('register') }}">Começar agora</a>
    </section>
</div>
</div>
@endsection
