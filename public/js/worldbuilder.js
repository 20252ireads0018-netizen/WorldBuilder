/* Worldbuilder – editor e visualizador de mapas 3D (Three.js r128) */
(() => {
'use strict';

const root = document.getElementById('app');
const API = root.dataset.api;
const WORLD = root.dataset.world;
const PODE = root.dataset.mode === 'edit'; // quem pode editar este mundo (dono ou mestre)
let EDIT = PODE; // falso enquanto o mapa estiver trancado (só visualização)
const URLS = { ver: root.dataset.urlVer, exportar: root.dataset.urlExportar, copiar: root.dataset.urlCopiar };
const CSRF = document.querySelector('meta[name="csrf-token"]').content;

let SIZE = 200, HALF = 100, SEG = 220, K = 1; // lado do mapa (muda por mundo); K = escala em relação ao mapa padrão de 200
function setDimensao(d) {
    SIZE = d || 200; HALF = SIZE / 2; K = SIZE / 200;
    SEG = Math.round(Math.min(420, SIZE * 1.1));
    uniforms.uHalf.value = HALF;
    controls.maxDistance = 330 * K;
    camera.far = 1500 * K;
    camera.updateProjectionMatrix();
    stars.scale.setScalar(K);
}

/* ---------- Catálogo ---------- */
const TYPES = {
    mountain: { label: 'Montanha', fresh: 'Montanha sem nome', size: [6, 45, 18, 1],     sizeLabel: 'Extensão', corLabel: 'Cor da rocha' },
    lake:     { label: 'Lago',     fresh: 'Lago sem nome',     size: [4, 40, 12, 1],     sizeLabel: 'Raio',     corLabel: 'Cor da água' },
    river:    { label: 'Rio',      fresh: 'Rio sem nome',      size: [1.5, 6, 2.5, 0.1], sizeLabel: 'Largura',  corLabel: 'Cor da água' },
    forest:   { label: 'Floresta', fresh: 'Floresta sem nome', size: [4, 35, 12, 1],     sizeLabel: 'Extensão', corLabel: 'Cor das copas' },
    city:     { label: 'Cidade',   fresh: 'Cidade sem nome',   size: [3, 24, 7, 0.5],    sizeLabel: 'Extensão', corLabel: 'Cor dos telhados' },
    village:  { label: 'Vila',     fresh: 'Vila sem nome',     size: [2, 10, 3.5, 0.5],  sizeLabel: 'Extensão', corLabel: 'Cor dos telhados' },
    ocean:    { label: 'Oceano',   fresh: 'Mar sem nome',      size: [20, 100, 55, 1],   sizeLabel: 'Extensão', corLabel: 'Cor do mar' },
    island:   { label: 'Ilha',     fresh: 'Ilha sem nome',     size: [4, 60, 14, 1],     sizeLabel: 'Extensão', corLabel: 'Cor do chão' },
    road:     { label: 'Estrada',  fresh: 'Estrada sem nome',  size: [0.6, 5, 1.4, 0.1], sizeLabel: 'Largura',  corLabel: 'Cor da estrada' },
    tower:    { label: 'Torre',    fresh: 'Torre sem nome',    size: [1.5, 10, 3.5, 0.5],     sizeLabel: 'Tamanho',  corLabel: 'Cor do telhado e detalhes' },
    ruins:    { label: 'Ruínas',   fresh: 'Ruínas sem nome',   size: [2, 25, 9, 0.5],    sizeLabel: 'Extensão', corLabel: 'Cor da pedra' },
    phenomenon: { label: 'Fenômeno', fresh: 'Fenômeno sem nome', size: [4, 80, 16, 1],   sizeLabel: 'Alcance',  corLabel: 'Cor do fenômeno' },
    biome:    { label: 'Bioma',    fresh: 'Bioma sem nome',    size: [1, 30, 6, 1],      sizeLabel: 'Suavidade da borda', corLabel: 'Cor do chão' },
    region:   { label: 'Região',   fresh: 'Região sem nome',   size: [0.4, 4, 1.4, 0.1], sizeLabel: 'Espessura da borda', corLabel: 'Cor da região' },
};
const LINHA = new Set(['river', 'road']);
const PONTOS = new Set(['river', 'road', 'region', 'biome']);
const POLIGONO = new Set(['region', 'biome']); // áreas desenhadas por cantos // guardados como lista de pontos (linhas e polígonos)
const DESENHO = new Set(['river', 'road', 'region', 'biome', 'redraw']); // ferramentas que marcam pontos e terminam com Enter
// Trocas de tipo que não perdem nada (as mesmas do servidor)
const GRUPOS = [['city', 'village'], ['lake', 'ocean'], ['river', 'road'], ['mountain', 'island']];
const trocasDe = (t) => GRUPOS.find((g) => g.includes(t)) || [t];
// Tamanho máximo cresce com o mapa
function tamanhoMax(type) {
    const base = TYPES[type].size[1];
    const k = { ocean: 1, lake: 0.4, mountain: 0.35, forest: 0.4, city: 0.12, village: 0.05, river: 0.03, island: 0.5, road: 0.02, tower: 0.02, ruins: 0.12, phenomenon: 0.7, region: 0.01, biome: 0.1 }[type];
    return Math.max(base, Math.round(Math.max(60, HALF) * k));
}
const PLURAL = { ocean: 'Oceanos e mares', island: 'Ilhas', mountain: 'Montanhas', lake: 'Lagos', river: 'Rios', road: 'Estradas', forest: 'Florestas', city: 'Cidades', village: 'Vilas', tower: 'Torres', ruins: 'Ruínas', phenomenon: 'Fenômenos', region: 'Regiões', biome: 'Biomas' };
const HINTS = {
    select:   'Clique num lugar para abri-lo e arraste-o para mover. As bolinhas na borda esticam só para aquele lado e a vermelha gira (Shift: giro livre). Botão direito abre o menu rápido.',
    mountain: 'Clique no mapa para erguer uma montanha. Clique de novo dentro dela para aumentar.',
    lake:     'Clique no mapa para abrir um lago. Clique de novo dentro dele para aumentar.',
    river:    'Clique para marcar o curso do rio e aperte Enter para concluir.',
    forest:   'Clique no mapa para plantar uma floresta. Clique de novo dentro dela para aumentar.',
    city:     'Clique no mapa para fundar uma cidade. Clique de novo dentro dela para aumentar.',
    village:  'Clique no mapa para fundar uma vila. Clique de novo dentro dela para aumentar.',
    ocean:    'Clique no mapa para abrir um oceano. Clique de novo dentro dele para aumentar; montanhas dentro dele viram ilhas.',
    redraw:   'Clique para marcar o novo traçado e aperte Enter (ou Concluir) para trocar. Esc cancela.',
    island:   'Clique no mapa (ou no meio do mar) para erguer uma ilha. Clique de novo dentro dela para aumentar.',
    road:     'Clique para marcar o caminho da estrada e aperte Enter para concluir.',
    tower:    'Clique no mapa para erguer uma torre (de vigia, do mago, farol...). Clique de novo nela para aumentar.',
    ruins:    'Clique no mapa para marcar ruínas (castelo, templo, círculo de pedras...). Clique de novo dentro delas para aumentar.',
    phenomenon: 'Clique no mapa para criar um fenômeno: névoa colorida, chuva, tempestade, terremoto, nevasca ou aura mágica. O tipo e a cor ficam no painel.',
    biome:    'Clique para marcar os cantos do bioma (deserto, tundra, pântano...) e aperte Enter para fechar. Cor, altura e ondulação do chão ficam no painel.',
    region:   'Clique para marcar os cantos da região e aperte Enter (ou Concluir) para fechar. Ela fica translúcida, e você pode ocultá-la no painel.',
    fog:      'Pinte o mapa: clique e arraste para revelar (ou cobrir) áreas para os jogadores.',
    move:     'Clique no novo ponto do mapa para levar o lugar até lá. Esc cancela.',
};
const VIEW_HINT = 'Clique num lugar para ver a história dele. Arraste para girar, role para aproximar.';

const AGUA = { calma: 'Águas calmas', cristalina: 'Cristalina', congelada: 'Congelada', pantano: 'Pântano', lava: 'Lava' };
const POVOADO = { medieval: 'Medieval', elfica: 'Élfica', deserto: 'Do deserto', nordica: 'Nórdica', fortaleza: 'Fortaleza', oriental: 'Oriental', ruinas: 'Ruínas' };
const SKINS = {
    mountain: { classica: 'Clássica', picos: 'Picos nevados', vulcao: 'Vulcão', colinas: 'Colinas', rochosa: 'Rochedos', cristal: 'Cristais' },
    lake: AGUA, river: AGUA,
    forest: { carvalhos: 'Carvalhos', pinheiros: 'Pinheiros', outono: 'Outono', morta: 'Mata morta', magica: 'Mágica' },
    city: POVOADO, village: POVOADO,
    ocean: { mar: 'Mar aberto', tropical: 'Tropical', tempestuoso: 'Tempestuoso', gelado: 'Gelado', abissal: 'Abissal' },
    island: { verde: 'Verdejante', areia: 'Praia de areia', tropical: 'Tropical', vulcanica: 'Vulcânica', gelo: 'Gelada' },
    road: { terra: 'Estrada de terra', pedra: 'Calçada de pedra', trilha: 'Trilha', real: 'Estrada real' },
    tower: { vigia: 'Torre de vigia', mago: 'Torre do mago', farol: 'Farol', sombria: 'Torre sombria', elfica: 'Torre élfica' },
    ruins: { castelo: 'Castelo em ruínas', templo: 'Templo antigo', pedras: 'Círculo de pedras', cidade: 'Cidade perdida', arcana: 'Ruínas arcanas' },
    phenomenon: { nevoa: 'Névoa colorida', chuva: 'Chuva', tempestade: 'Tempestade', terremoto: 'Terremoto', nevasca: 'Nevasca', magia: 'Aura mágica' },
    region: { preenchida: 'Preenchida', hachurada: 'Hachurada', borda: 'Só o contorno' },
    biome: { deserto: 'Deserto', savana: 'Savana', planicie: 'Planície', tundra: 'Tundra', neve: 'Campos de neve', pantano: 'Pântano', cinzas: 'Terras vulcânicas', mortas: 'Terras mortas', cristal: 'Planície de cristal' },
};
// Cor própria de cada skin (null = cor do tema: montanha ou água)
const SKIN_COR = {
    mountain: { classica: null, picos: null, vulcao: '#4b3b36', colinas: '#7f9a56', rochosa: '#7c7468', cristal: '#6d5a8a' },
    lake: { calma: null, cristalina: null, congelada: '#cfe6ef', pantano: '#5d6b3a', lava: '#e2561c' },
    forest: { carvalhos: null, pinheiros: '#2f5a3a', outono: '#c86a28', morta: '#6a5a48', magica: '#3fc6b0' },
    island: { verde: null, areia: '#e3cf92', tropical: '#9cc95a', vulcanica: '#4d4240', gelo: '#e6edf2' },
    road: { terra: null, pedra: '#a39a8a', trilha: '#93744c', real: '#c7ad78' },
    city: { medieval: null, elfica: '#4d7a4a', deserto: '#3f6f9a', nordica: '#4a4136', fortaleza: '#7a3a2a', oriental: '#a8322a', ruinas: '#9a958a' },
    ocean: { mar: null, tropical: '#2aa6b8', tempestuoso: '#3d5260', gelado: '#a8cfdf', abissal: '#163452' },
    tower: { vigia: null, mago: '#5b4a9a', farol: '#b8322a', sombria: '#d0302a', elfica: '#4d7a4a' },
    ruins: { castelo: null, templo: '#d8d0bc', pedras: '#8c8a84', cidade: '#b0a48a', arcana: '#4fd1c5' },
    biome: { deserto: '#e2c27c', savana: '#c9b25a', planicie: '#8fbf5a', tundra: '#b9c4b4', neve: '#f2f5f7', pantano: '#5d6b3a', cinzas: '#4a4240', mortas: '#7a6a58', cristal: '#9fd6e8' },
    region: { preenchida: null, hachurada: '#7a3a8a', borda: '#2f4a7a' },
    phenomenon: { nevoa: null, chuva: '#9cc0e0', tempestade: '#454c5a', terremoto: '#3a2618', nevasca: '#ffffff', magia: '#4fd1c5' },
};
SKIN_COR.river = SKIN_COR.lake;
SKIN_COR.village = SKIN_COR.city;
// Cores sugeridas no painel de cada tipo
const PALETAS = {
    mountain: ['#9a7b52', '#7c7468', '#4b3b36', '#8c9aa8', '#7f9a56', '#a0603a', '#6d5a8a', '#d8d2c4'],
    lake: ['#7f9f93', '#3f86a8', '#2aa6b8', '#58b4c9', '#163452', '#5d6b3a', '#cfe6ef', '#e2561c'],
    forest: ['#4f7a3a', '#2f5a3a', '#6f8f2f', '#9cbf4a', '#c86a28', '#a33a2a', '#6a5a48', '#3fc6b0'],
    city: ['#9a4a2c', '#4d7a4a', '#3f6f9a', '#4a4136', '#7a3a2a', '#a8322a', '#c9a23a', '#6b5a8a'],
    island: ['#7fa65a', '#e3cf92', '#9cc95a', '#c2b280', '#4d4240', '#e6edf2'],
    road: ['#8a6a44', '#a39a8a', '#93744c', '#c7ad78', '#5a4a3a', '#d8c8a8'],
    tower: ['#a8322a', '#5b4a9a', '#2f5a8a', '#4d7a4a', '#c9a23a', '#d0302a', '#3a3530', '#e8e2d2'],
    ruins: ['#a39c8c', '#d8d0bc', '#8c8a84', '#b0a48a', '#6f7f4a', '#7a6a8a', '#4fd1c5', '#c9a96e'],
    biome: ['#e2c27c', '#c9b25a', '#8fbf5a', '#b9c4b4', '#f2f5f7', '#5d6b3a', '#4a4240', '#7a6a58', '#9fd6e8', '#c86a3a'],
    region: ['#b03a2e', '#2f4a7a', '#3f7a3a', '#c9a23a', '#7a3a8a', '#d0702a', '#1f6a6a', '#4a4136'],
    phenomenon: ['#9a6fd0', '#4fd1c5', '#e05a8a', '#6fd06f', '#e0b04a', '#9cc0e0', '#454c5a', '#ffffff'],
};
PALETAS.river = PALETAS.ocean = PALETAS.lake;
PALETAS.village = PALETAS.city;
const corDaSkin = (f, k) => corOf({ ...f, skin: k, color: null });
const WS = { calma: 0, cristalina: 1, congelada: 2, pantano: 3, lava: 4, mar: 5, tropical: 1, tempestuoso: 5, gelado: 2, abissal: 5 };

const FUNDOS = { pergaminho: 'Pergaminho', oceano: 'Ilha no oceano', noite: 'Céu noturno', nevoa: 'Névoa', cor: 'Cor sólida' };
const ESTILOS = { pergaminho: 'Pergaminho', natural: 'Natural', ilustrado: 'Ilustrado' };
const CORES = { fundo: 'Fundo', terra: 'Terra', montanha: 'Montanhas', agua: 'Lagos e rios', mar: 'Mares e oceanos', ilha: 'Ilhas', floresta: 'Florestas',
    telhado: 'Cidades e vilas', estrada: 'Estradas', torre: 'Torres', ruinas: 'Ruínas', fenomeno: 'Fenômenos', regiao: 'Regiões', tinta: 'Tinta e contornos' };
const COR_PADRAO = { floresta: '#4f7a3a', telhado: '#9a4a2c', estrada: '#8a6a44', ilha: '#7fa65a', torre: '#a8322a', ruinas: '#a39c8c', fenomeno: '#9a6fd0', regiao: '#b03a2e' };
// Cor do tema de cada tipo (o modelo padrão de cada tipo usa esta cor)
const corDoTema = (k) => theme.cores[k] || (k === 'mar' ? '#' + new THREE.Color(theme.cores.agua).multiplyScalar(0.72).getHexString() : COR_PADRAO[k]);
const TEMAS = {
    pergaminho: { label: 'Pergaminho antigo', fundo: 'pergaminho', estilo: 'pergaminho', cores: { fundo: '#2a1c10', terra: '#e3c47e', montanha: '#9a7b52', agua: '#7f9f93', tinta: '#4d3017' } },
    verde:      { label: 'Terras verdes',     fundo: 'oceano',     estilo: 'natural',    cores: { fundo: '#1d4e6e', terra: '#7fa65a', montanha: '#7d6a58', agua: '#3f86a8', tinta: '#2c3a24' } },
    arquipelago:{ label: 'Arquipélago',       fundo: 'oceano',     estilo: 'ilustrado',  cores: { fundo: '#2b7a9b', terra: '#e8d9a8', montanha: '#a08560', agua: '#58b4c9', tinta: '#3a2f25' } },
    gelo:       { label: 'Terra gelada',      fundo: 'nevoa',      estilo: 'natural',    cores: { fundo: '#c9d6e0', terra: '#e4eaee', montanha: '#8c9aa8', agua: '#9cc7dc', tinta: '#3d4b59' } },
    deserto:    { label: 'Deserto',           fundo: 'cor',        estilo: 'ilustrado',  cores: { fundo: '#6b3f1f', terra: '#e0b673', montanha: '#b0703f', agua: '#4fa3a5', tinta: '#5a3416' } },
    sombrio:    { label: 'Reino sombrio',     fundo: 'noite',      estilo: 'natural',    cores: { fundo: '#0d0f1c', terra: '#545246', montanha: '#3d3644', agua: '#2c4a5e', tinta: '#15131c' } },
};

let world = null;
let theme = null;
let features = [];
let selectedId = null;
let tool = 'select';
let tab = 'mundo';
let riverDraft = [];

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sel = () => features.find((f) => f.id === selectedId) || null;
const skinOf = (f) => f.skin || theme.skins[f.type] || Object.keys(SKINS[f.type])[0];
function corOf(f) {
    if (f.color) return f.color;
    const c = SKIN_COR[f.type]?.[skinOf(f)];
    if (c) return c;
    if (f.type === 'mountain') return theme.cores.montanha;
    if (f.type === 'lake' || f.type === 'river') return theme.cores.agua;
    const k = { ocean: 'mar', forest: 'floresta', city: 'telhado', village: 'telhado', road: 'estrada', island: 'ilha', tower: 'torre', ruins: 'ruinas', phenomenon: 'fenomeno', region: 'regiao' }[f.type];
    if (k) return corDoTema(k);
    return '#888888';
}
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const lum = (h) => { const [r, g, b] = rgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

/* ---------- API e estado de salvamento ---------- */
const statusEl = $('#status');
let pendentes = 0, falhou = false;
function setStatus() {
    if (!statusEl) return;
    statusEl.textContent = pendentes ? 'Salvando…' : falhou ? 'Algo não foi salvo' : 'Tudo salvo';
    statusEl.classList.toggle('erro', falhou && !pendentes);
}
async function api(method, url, body) {
    pendentes++; setStatus();
    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': CSRF },
            body: body ? JSON.stringify(body) : undefined,
        });
        const json = await res.json().catch(() => ({}));
        if (res.status === 402 && json.redirect) {
            toast(json.message || 'Isso faz parte do plano Cartógrafo.');
            setTimeout(() => { location.href = json.redirect; }, 1400);
            throw new Error('HTTP 402');
        }
        if (!res.ok) {
            const msg = json.errors ? Object.values(json.errors)[0][0] : json.message;
            toast(msg && (res.status === 422 || res.status === 423) ? msg : 'Não foi possível salvar. Confira os campos e tente de novo.');
            if (res.status !== 422 && res.status !== 423) falhou = true;
            throw new Error('HTTP ' + res.status);
        }
        falhou = false;
        if (method !== 'GET') agendarCapa();
        return json;
    } finally {
        pendentes--; setStatus();
    }
}
let toastTimer;
function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3800);
}

/* ---------- Terreno (altura e cores calculadas a partir dos locais) ---------- */
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function baseNoise(x, z) {
    return 1.2 + Math.sin(x * 0.045) * Math.cos(z * 0.05) * 0.8
        + Math.sin(x * 0.13 + z * 0.09) * 0.25 + Math.cos(z * 0.21 - x * 0.17) * 0.12;
}
function distSeg(px, pz, a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    let t = l2 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a[0] + t * dx), pz - (a[1] + t * dz));
}
// Nome para mostrar em listas e menus (lugares podem ficar sem nome)
function nomeDe(f) { return f?.name || (TYPES[f?.type]?.label || 'Lugar') + ' sem nome'; }
/* ---------- Formato dos lugares: proporção, giro, contorno irregular e curvas dos rios ---------- */
const IRREG_PADRAO = { ocean: 0.45, lake: 0.12, forest: 0.25, mountain: 0.1, city: 0, village: 0, ruins: 0.15, phenomenon: 0.35, tower: 0 };
function forma(f) {
    const s = f.shape || {}, e = s.esticar ?? 1, g = ((s.giro ?? 0) * Math.PI) / 180;
    return { sx: Math.sqrt(e), sz: 1 / Math.sqrt(e), c: Math.cos(g), s: Math.sin(g), irr: s.irregular ?? IRREG_PADRAO[f.type] ?? 0, seed: (f.id || 1) * 0.6180339 };
}
// Coordenadas locais do lugar: sem esticar nem girar, igual a dx/dz
function local(f, x, z, F = forma(f)) {
    const dx = x - f.x, dz = z - f.z;
    return [(dx * F.c + dz * F.s) / F.sx, (-dx * F.s + dz * F.c) / F.sz];
}
function paraMundo(f, u, v, F = forma(f)) {
    const U = u * F.sx, V = v * F.sz;
    return [f.x + U * F.c - V * F.s, f.z + U * F.s + V * F.c];
}
// Raio relativo da borda num ângulo (1 = círculo perfeito)
function borda(F, ang) {
    if (!F.irr) return 1;
    const k = F.seed * 10;
    const n = Math.sin(ang * 2 + k) * 0.5 + Math.sin(ang * 3 + k * 1.7) * 0.3 + Math.sin(ang * 5 + k * 2.3) * 0.2 + Math.sin(ang * 9 + k * 3.1) * 0.12;
    return Math.max(0.35, 1 + F.irr * 0.45 * n);
}
// Distância normalizada: < 1 dentro do lugar, 1 na borda
function distN(f, x, z, F = forma(f)) {
    const [u, v] = local(f, x, z, F);
    return Math.hypot(u, v) / (f.size * borda(F, Math.atan2(v, u)));
}
// Ponto aleatório dentro da área do lugar (entre d0 e d1 da borda)
function pontoDentro(f, r, F, d0 = 0, d1 = 1) {
    const a = r() * Math.PI * 2, d = (d0 + Math.sqrt(r()) * (d1 - d0)) * f.size * borda(F, a);
    return paraMundo(f, Math.cos(a) * d, Math.sin(a) * d, F);
}

// Curso do rio suavizado (Catmull-Rom) e com meandros conforme "curvas"
const rioCache = new WeakMap();
function rioPath(f) {
    const key = JSON.stringify([f.points, f.shape?.curvas, f.size]);
    const c = rioCache.get(f);
    if (c && c.key === key) return c.pts;
    const p = f.points || [], out = [];
    for (let i = 0; i < p.length - 1; i++) {
        const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
        const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 1.5));
        for (let j = 0; j < n; j++) {
            const t = j / n, t2 = t * t, t3 = t2 * t;
            const cr = (a0, a1, a2, a3) => 0.5 * (2 * a1 + (-a0 + a2) * t + (2 * a0 - 5 * a1 + 4 * a2 - a3) * t2 + (-a0 + 3 * a1 - 3 * a2 + a3) * t3);
            out.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
        }
    }
    if (p.length) out.push([...p[p.length - 1]]);
    const amp = (f.shape?.curvas ?? 0) * Math.max(2, f.size * 2.2);
    if (amp > 0 && out.length > 2) {
        const orig = out.map((q) => [...q]);
        let total = 0, acc = 0;
        for (let i = 1; i < orig.length; i++) total += Math.hypot(orig[i][0] - orig[i - 1][0], orig[i][1] - orig[i - 1][1]);
        for (let i = 1; i < out.length - 1; i++) {
            acc += Math.hypot(orig[i][0] - orig[i - 1][0], orig[i][1] - orig[i - 1][1]);
            const dx = orig[i + 1][0] - orig[i - 1][0], dz = orig[i + 1][1] - orig[i - 1][1], l = Math.hypot(dx, dz) || 1;
            const fade = Math.max(0, Math.min(1, acc / 6, (total - acc) / 6));
            const off = Math.sin(acc * 0.32 + (f.id || 0)) * amp * fade;
            out[i][0] += (-dz / l) * off; out[i][1] += (dx / l) * off;
        }
    }
    rioCache.set(f, { key, pts: out });
    return out;
}
function riverDist(f, x, z) {
    const p = rioPath(f);
    let m = 1e9;
    for (let i = 0; i < p.length - 1; i++) m = Math.min(m, distSeg(x, z, p[i], p[i + 1]));
    return m;
}

// Locais pré-processados (skin e cor resolvidas) para o laço por vértice
let prep = { mountains: [], islands: [], waters: [], biomas: [], agua: [0.5, 0.6, 0.6], oceano: false };
// Caixa (x0, x1, z0, z1) fora da qual o lugar não mexe no terreno: o laço por vértice pula lugares longe
function caixa(o, alcance) {
    const F = o.F, f = o.f;
    if (f.points) {
        const pts = rioPath(f), m = f.size * 2.3;
        o.x0 = Math.min(...pts.map((p) => p[0])) - m; o.x1 = Math.max(...pts.map((p) => p[0])) + m;
        o.z0 = Math.min(...pts.map((p) => p[1])) - m; o.z1 = Math.max(...pts.map((p) => p[1])) + m;
        // trechos de 12 segmentos com caixa própria (distância ao rio só nos trechos próximos)
        o.trechos = [];
        for (let i = 0; i < pts.length - 1; i += 12) {
            const seg = pts.slice(i, Math.min(pts.length, i + 13));
            o.trechos.push({ seg, x0: Math.min(...seg.map((p) => p[0])) - m, x1: Math.max(...seg.map((p) => p[0])) + m, z0: Math.min(...seg.map((p) => p[1])) - m, z1: Math.max(...seg.map((p) => p[1])) + m });
        }
        return o;
    }
    const r = alcance * f.size * (1 + F.irr * 0.45 * 1.15) * Math.max(F.sx, F.sz) + 0.5;
    o.x0 = f.x - r; o.x1 = f.x + r; o.z0 = f.z - r; o.z1 = f.z + r;
    return o;
}
const fora = (o, x, z) => x < o.x0 || x > o.x1 || z < o.z0 || z > o.z1;
function distRio(o, x, z) {
    let m = 1e9;
    for (const t of o.trechos) {
        if (x < t.x0 || x > t.x1 || z < t.z0 || z > t.z1) continue;
        for (let i = 0; i < t.seg.length - 1; i++) m = Math.min(m, distSeg(x, z, t.seg[i], t.seg[i + 1]));
    }
    return m;
}
function prepare() {
    prep = {
        mountains: features.filter((f) => f.type === 'mountain').map((f) => caixa({ f, F: forma(f), skin: skinOf(f), c: rgb(corOf(f)), alt: f.shape?.altura ?? 1 }, 3.05)),
        islands: features.filter((f) => f.type === 'island').map((f) => caixa({ f, F: forma(f), skin: skinOf(f), c: rgb(corOf(f)), alt: f.shape?.altura ?? 1 }, 1.2)),
        // oceanos primeiro: lagos e rios desenhados por cima continuam visíveis
        waters: features.filter((f) => f.type === 'ocean').concat(features.filter((f) => f.type === 'lake' || (f.type === 'river' && (f.points || []).length > 1)))
            .map((f) => caixa({ f, F: forma(f), ws: WS[skinOf(f)] ?? 0, c: rgb(corOf(f)) }, f.type === 'ocean' ? 1.35 : 1.3)),
        agua: rgb(theme.cores.agua),
        oceano: theme.fundo === 'oceano',
        biomas: features.filter((f) => f.type === 'biome' && (f.points || []).length > 2).map((f) => {
            const xs = f.points.map((p) => p[0]), zs = f.points.map((p) => p[1]), m = f.size * 0.75 + 1;
            return { f, pts: f.points, skin: skinOf(f), c: rgb(corOf(f)), suave: Math.max(1, f.size), elev: f.shape?.elevacao ?? 0, ond: f.shape?.ondulacao ?? 1, seed: (f.id || 1) * 1.7,
                x0: Math.min(...xs) - m, x1: Math.max(...xs) + m, z0: Math.min(...zs) - m, z1: Math.max(...zs) + m };
        }),
    };
}
// Relevo próprio de cada bioma (somado ao chão, multiplicado pela ondulação)
function relevoBioma(skin, x, z, seed) {
    switch (skin) {
        case 'deserto': { const d = 0.5 + 0.5 * Math.sin(x * 0.32 + Math.sin(z * 0.11 + seed) * 2.2); return d * d * 1.6; }
        case 'savana': case 'planicie': return (Math.sin(x * 0.09 + seed) * Math.cos(z * 0.08)) * 0.7;
        case 'tundra': return (Math.sin(x * 0.4) * Math.cos(z * 0.37 + seed)) * 0.35;
        case 'neve': { const d = 0.5 + 0.5 * Math.sin(x * 0.18 + z * 0.12 + seed); return d * 1.1; }
        case 'pantano': return -0.35 + Math.sin(x * 0.5) * Math.cos(z * 0.45) * 0.1;
        case 'cinzas': case 'mortas': return Math.abs(Math.sin(x * 0.23 + seed) * Math.cos(z * 0.21)) * 1.2;
        case 'cristal': return Math.max(0, Math.sin(x * 0.6 + seed) * Math.sin(z * 0.55)) * 0.8;
        default: return 0;
    }
}

function mountainHeight(m, x, z, out) {
    const f = m.f, size = f.size;
    // Coordenadas locais (esticadas/giradas) e contorno irregular encolhendo/esticando a distância
    const [dx0, dz0] = local(f, x, z, m.F);
    const b = borda(m.F, Math.atan2(dz0, dx0)), dx = dx0 / b, dz = dz0 / b, d2 = dx * dx + dz * dz;
    if (d2 > size * size * 9) return 0;
    switch (m.skin) {
        case 'picos': {
            const s = size * 0.5, ridge = 1 + 0.2 * Math.sin(dx * 0.55) * Math.cos(dz * 0.5);
            const c = size * 0.9 * Math.exp(-d2 / (2 * s * s)) * ridge;
            out.snow = Math.max(out.snow, sm(size * 0.55, size * 0.72, c));
            return c;
        }
        case 'vulcao': {
            const d = Math.sqrt(d2), R = size * 0.95;
            if (d >= R) return 0;
            let c = size * 0.7 * Math.pow(1 - d / R, 1.4);
            const cr = size * 0.17;
            if (d < cr * 1.5) c -= size * 0.24 * sm(cr * 1.5, cr * 0.4, d);
            out.lava = Math.max(out.lava, sm(cr, cr * 0.5, d));
            return c;
        }
        case 'colinas': {
            const s = size * 0.75, ridge = 1 + 0.35 * Math.sin(dx * 0.35 + 1) * Math.cos(dz * 0.3);
            return size * 0.28 * Math.exp(-d2 / (2 * s * s)) * ridge;
        }
        default: {
            const s = size * 0.6, ridge = 1 + 0.18 * Math.sin(dx * 0.7) * Math.cos(dz * 0.6);
            return size * 0.7 * Math.exp(-d2 / (2 * s * s)) * ridge * (m.skin === 'cristal' ? 0.8 : 1);
        }
    }
}

function sample(x, z) {
    const o = { h: baseNoise(x, z), w: 0, wc: prep.agua, ws: 0, m: 0, mc: [0, 0, 0], snow: 0, lava: 0, sea: 0 };
    let hm = 0, mr = 0, mg = 0, mb = 0;
    for (const m of prep.mountains) {
        if (fora(m, x, z)) continue;
        const c = mountainHeight(m, x, z, o) * m.alt;
        if (c > 0.01) { hm += c; mr += m.c[0] * c; mg += m.c[1] * c; mb += m.c[2] * c; }
    }
    o.h += hm;
    if (hm > 0.01) { o.m = sm(0.4, 3, hm); o.mc = [mr / hm, mg / hm, mb / hm]; }
    else { o.snow = 0; }

    // Biomas: chão com outra cor, outra altura e relevo próprio, com borda suave
    let bT = 0, bC = null;
    for (const b of prep.biomas) {
        if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
        let d = 1e9;
        for (let i = 0; i < b.pts.length; i++) d = Math.min(d, distSeg(x, z, b.pts[i], b.pts[(i + 1) % b.pts.length]));
        const s = (dentroPoligono(b.pts, x, z) ? d : -d) + Math.sin(x * 0.31 + b.seed) * Math.cos(z * 0.27 - b.seed) * b.suave * 0.3;
        if (s <= -b.suave * 0.5) continue;
        const t = sm(-b.suave * 0.5, b.suave * 0.5, s);
        o.h += t * (b.elev + b.ond * relevoBioma(b.skin, x, z, b.seed));
        if (b.skin === 'neve') o.snow = Math.max(o.snow, t * 0.95);
        else if (b.skin === 'tundra') o.snow = Math.max(o.snow, t * 0.4 * sm(0.3, 0.8, 0.5 + 0.5 * Math.sin(x * 0.21) * Math.cos(z * 0.19)));
        if (b.skin === 'cinzas') o.lava = Math.max(o.lava, t * sm(0.93, 0.985, Math.abs(Math.sin(x * 0.17 + Math.sin(z * 0.13) * 3 + b.seed))));
        if (b.skin === 'pantano') o.charco = Math.max(o.charco || 0, t * sm(0.45, 0.62, 0.5 + 0.5 * Math.sin(x * 0.27 + b.seed) * Math.cos(z * 0.31)));
        if (t > bT) { bT = t; bC = b.c; }
    }
    if (bT > 0) {
        const mm = o.m;
        o.mc = mm > 0.01 ? o.mc.map((v, i) => bC[i] + (v - bC[i]) * Math.min(1, mm * 1.3)) : bC;
        o.m = Math.max(mm, bT * 0.92);
    }

    let melhor = 0;
    for (const wt of prep.waters) {
        if (fora(wt, x, z)) continue;
        const f = wt.f;
        let amt = 0, t = 0;
        if (f.type === 'ocean') {
            const dn = distN(f, x, z, wt.F);
            if (dn >= 1.3) continue;
            const ilha = sm(1.2, 3.5, hm); // montanhas dentro do mar viram ilhas
            t = sm(1.3, 0.82, dn) * (1 - ilha);
            o.h = o.h * (1 - t) + (-2.4) * t;
            amt = sm(1, 0.9, dn) * (1 - sm(0.8, 2.2, hm));
            o.sea = Math.max(o.sea, amt);
        } else if (f.type === 'lake') {
            const dn = distN(f, x, z, wt.F);
            if (dn >= 1.25) continue;
            t = sm(1.25, 0.7, dn);
            o.h = o.h * (1 - t) + (-0.6) * t;
            if (dn < 1) amt = sm(1, 0.88, dn);
        } else {
            const d = distRio(wt, x, z), w = f.size;
            if (d >= w * 2.2) continue;
            t = sm(w * 2.2, w * 0.6, d);
            o.h = o.h * (1 - t) + (-0.5) * t;
            amt = sm(w, w * 0.7, d);
        }
        const peso = amt + t * 0.01; // perto da margem também herda a cor, para não misturar estilos na borda
        if (peso > melhor) { melhor = peso; o.wc = wt.c; o.ws = wt.ws; }
        o.w = Math.max(o.w, amt);
    }

    // poças do pântano (água rasa e escura)
    if (o.charco > 0.05 && o.charco * 0.8 > o.w) { o.w = o.charco * 0.8; o.wc = [0.32, 0.38, 0.22]; o.ws = 3; }

    if (prep.oceano) {
        const r = Math.hypot(x, z) / HALF + (Math.sin(x * 0.07 + z * 0.03) + Math.cos(z * 0.06 - x * 0.045)) * 0.05;
        const t = sm(0.72, 0.92, r);
        o.h = o.h * (1 - t) + (-1.4) * t;
        o.sea = sm(0.78, 0.88, r);
        if (o.sea > o.w) { o.w = o.sea; o.wc = prep.agua; o.ws = 0; }
    }

    // Ilhas: terra firme por cima de qualquer água, com praia em volta
    let ilha = 0, ic = null, ih = 0;
    for (const il of prep.islands) {
        if (fora(il, x, z)) continue;
        const dn = distN(il.f, x, z, il.F);
        if (dn >= 1.15) continue;
        const a = sm(1.15, 0.8, dn);
        if (a > ilha) {
            ilha = a; ic = il.c;
            ih = 0.6 + il.alt * (il.f.size * 0.09) * sm(1, 0.15, dn) * (0.85 + 0.15 * Math.sin(x * 0.4) * Math.cos(z * 0.35));
            if (il.skin === 'vulcanica') ih += il.alt * il.f.size * 0.12 * sm(0.6, 0.1, dn);
        }
    }
    if (ilha > 0) {
        o.h = o.h * (1 - ilha) + Math.max(o.h, ih) * ilha;
        const seco = sm(0.25, 0.75, ilha);
        o.w *= 1 - seco; o.sea *= 1 - seco;
        if (ic && hm < 1) { o.m = Math.max(o.m, seco * 0.85); o.mc = ic; }
    }
    return o;
}
// Grade do terreno (mesmos vértices da malha): altura e água por interpolação, sem refazer o cálculo
let grade = null;
function naGrade(arr, x, z) {
    if (!grade) return null;
    const n = grade.n, k = n / SIZE;
    const gx = Math.max(0, Math.min(n - 1e-6, (x + HALF) * k)), gz = Math.max(0, Math.min(n - 1e-6, (z + HALF) * k));
    const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, w = n + 1;
    const a = arr[j * w + i], b = arr[j * w + i + 1], c = arr[(j + 1) * w + i], d = arr[(j + 1) * w + i + 1];
    return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
}
const heightAt = (x, z) => naGrade(grade?.h, x, z) ?? sample(x, z).h;
const aguaAt = (x, z) => naGrade(grade?.w, x, z) ?? sample(x, z).w;

/* ---------- Cena ---------- */
const stage = $('#stage');
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 1500);
camera.position.set(0, 120, 150);
const controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minDistance = 6;
controls.maxDistance = 330;

const ambient = new THREE.AmbientLight(0xfff0d0, 0.85);
const sun = new THREE.DirectionalLight(0xfff2d8, 0.6);
sun.position.set(-60, 90, 40);
scene.add(ambient, sun);

// Estrelas do fundo "Céu noturno"
const stars = (() => {
    const n = 900, pos = new Float32Array(n * 3), r = rng(7);
    for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, y = 0.08 + r() * 0.92, k = Math.sqrt(1 - y * y), R = 700;
        pos[i * 3] = Math.cos(a) * k * R; pos[i * 3 + 1] = y * R; pos[i * 3 + 2] = Math.sin(a) * k * R;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff6e0, size: 1.6, sizeAttenuation: false }));
    p.visible = false;
    scene.add(p);
    return p;
})();

const uniforms = {
    uTime: { value: 0 }, uEstilo: { value: 0 }, uFundo: { value: 0 }, uHalf: { value: 100 },
    uTerra: { value: new THREE.Color() }, uTinta: { value: new THREE.Color() },
    uFundoCor: { value: new THREE.Color() }, uAgua: { value: new THREE.Color() },
    uFog: { value: null }, uFogOn: { value: 0 }, uFogAlpha: { value: 1 },
};
const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
        attribute float aWater; attribute float aH; attribute float aM;
        attribute vec3 aWCol; attribute vec3 aMCol; attribute vec4 aFx;
        varying float vW; varying float vH; varying float vM; varying vec3 vWCol; varying vec3 vMCol; varying vec4 vFx;
        varying vec3 vN; varying vec3 vP;
        void main(){ vW=aWater; vH=aH; vM=aM; vWCol=aWCol; vMCol=aMCol; vFx=aFx; vN=normal; vP=position;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
        precision highp float;
        uniform float uTime; uniform float uEstilo; uniform float uFundo;
        uniform vec3 uTerra; uniform vec3 uTinta; uniform vec3 uFundoCor; uniform vec3 uAgua;
        uniform sampler2D uFog; uniform float uFogOn; uniform float uFogAlpha;
        varying float vW; varying float vH; varying float vM; varying vec3 vWCol; varying vec3 vMCol; varying vec4 vFx;
        varying vec3 vN; varying vec3 vP;
        uniform float uHalf;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }

        vec3 agua(vec3 base, float ws, float grain, float sh){
            float t = uTime;
            if (ws < 0.5) {
                if (uEstilo < 0.5) {
                    float hatch = 0.5 + 0.5*sin((vP.x+vP.z)*3.2 + noise(vP.xz*0.8)*3.0);
                    return mix(base, base*0.8, hatch*0.6) * (0.85+0.2*grain);
                }
                float rip = noise(vP.xz*0.6 + vec2(t*0.15, t*0.1));
                return base*(0.86+0.22*rip);
            } else if (ws < 1.5) {
                float rip = noise(vP.xz*0.9 + vec2(t*0.25, -t*0.2));
                float spark = smoothstep(0.86, 0.95, noise(vP.xz*3.5 + vec2(t*0.5, t*0.3)));
                return mix(base*1.18, vec3(1.0), spark*0.65) * (0.9+0.18*rip);
            } else if (ws < 2.5) {
                float n = noise(vP.xz*1.3) + noise(vP.xz*3.1)*0.4;
                float crack = 1.0 - smoothstep(0.0, 0.05, abs(fract(n*2.0)-0.5));
                return mix(base*(1.0+0.08*grain), base*0.62, crack*0.6);
            } else if (ws < 3.5) {
                float b = noise(vP.xz*0.7) * 0.7 + noise(vP.xz*2.4)*0.3;
                return mix(base, base*0.55 + vec3(0.04,0.07,0.0), smoothstep(0.45,0.7,b));
            }
            if (ws > 4.5) { // mar: ondas que passam e cristas de espuma
                float fase = vP.x*0.22 + vP.z*0.14 + noise(vP.xz*0.08)*5.0;
                float onda = sin(fase*2.2 - t*1.1);
                float rip = noise(vP.xz*0.4 + vec2(t*0.12, -t*0.08));
                vec3 c = base*(0.8 + 0.22*rip) + vec3(1.0)*smoothstep(0.86, 1.0, onda)*0.14*(0.5+rip);
                if (uEstilo < 0.5) {
                    float hatch = 0.5 + 0.5*sin((vP.x-vP.z)*2.0 + noise(vP.xz*0.5)*3.0);
                    c = mix(c, base*0.78, hatch*0.35);
                }
                return c;
            }
            float n = noise(vP.xz*0.5 + vec2(t*0.2, t*0.13))*0.6 + noise(vP.xz*2.0 - t*0.3)*0.4;
            vec3 hot = mix(base, vec3(1.0,0.86,0.32), smoothstep(0.5,0.82,n));
            return mix(hot, vec3(0.16,0.07,0.04), smoothstep(0.36,0.2,n));
        }

        void main(){
            vec3 N = normalize(vN);
            vec3 L = normalize(vec3(-0.6, 0.7, 0.4));
            float sh = clamp(dot(N, L), 0.0, 1.0);
            float grain = noise(vP.xz*0.35)*0.5 + noise(vP.xz*2.2)*0.3 + noise(vP.xz*9.0)*0.2;
            float slope = 1.0 - N.y;

            vec3 ground;
            vec3 mcol;
            if (uEstilo < 0.5) {
                ground = mix(uTerra*1.03, uTerra*0.86, grain);
                mcol = mix(vMCol*1.05, vMCol*0.86, grain);
            } else if (uEstilo < 1.5) {
                ground = uTerra*(0.88 + 0.22*grain);
                ground = mix(ground, ground*0.78, smoothstep(0.25, 0.6, slope));
                mcol = vMCol*(0.86 + 0.2*grain);
            } else {
                ground = uTerra*(0.97 + 0.06*step(0.5, grain));
                mcol = vMCol;
            }
            ground = mix(ground, mcol, vM);
            ground = mix(ground, vec3(0.95,0.96,0.98), vFx.y);

            float light;
            if (uEstilo > 1.5) light = 0.62 + 0.2*floor(sh*3.0 + 0.5);
            else if (uEstilo > 0.5) light = 0.55 + 0.6*sh;
            else light = 0.62 + 0.55*sh;
            vec3 col = ground * light;

            // curvas de nível
            if (uEstilo < 0.5) {
                float f = fract(vH*0.8);
                float cl = 1.0 - smoothstep(0.0, 0.07, min(f, 1.0-f));
                col = mix(col, uTinta, cl*0.32*(1.0-vW)*step(0.9, vH));
            } else if (uEstilo > 1.5) {
                float f = fract(vH*0.33);
                float cl = 1.0 - smoothstep(0.0, 0.05, min(f, 1.0-f));
                col = mix(col, uTinta, cl*0.22*(1.0-vW)*step(1.4, vH));
            }

            // água
            col = mix(col, agua(vWCol, vFx.x, grain, sh), vW);
            float edge = smoothstep(0.0,0.5,vW) * (1.0 - smoothstep(0.5,1.0,vW));
            if (uEstilo > 0.5 && uEstilo < 1.5) col = mix(col, mix(uTerra, vec3(0.93,0.87,0.7), 0.6), edge*0.45);
            else col = mix(col, uTinta, edge*0.7);

            // lava na cratera do vulcão
            float ln = noise(vP.xz*0.8 + uTime*0.25);
            col = mix(col, mix(vec3(0.95,0.32,0.08), vec3(1.0,0.82,0.3), ln), vFx.z);

            // bordas do mapa conforme o fundo
            float r = length(vP.xz)/uHalf + (noise(vP.xz*0.12)-0.5)*0.25;
            if (uFundo < 0.5) {
                col *= 1.0 - smoothstep(0.62,0.8,noise(vP.xz*0.05+7.0))*0.12;
                col = mix(col, uFundoCor, smoothstep(0.62,1.12,r)*0.85);
            } else if (uFundo < 1.5) {
                col = mix(col, uFundoCor, smoothstep(0.88,1.02,length(vP.xz)/uHalf));
            } else {
                col = mix(col, uFundoCor, smoothstep(0.8,1.06,r));
            }
            // névoa de guerra (branco na máscara = revelado)
            if (uFogOn > 0.5) {
                vec2 fuv = vP.xz / (2.0*uHalf) + 0.5;
                float vis = texture2D(uFog, fuv).r;
                float nv = noise(vP.xz*0.045 + vec2(uTime*0.015, uTime*0.01))*0.6 + noise(vP.xz*0.15 - uTime*0.02)*0.4;
                vec3 fogc = mix(vec3(0.70,0.68,0.64), vec3(0.93,0.92,0.89), nv);
                col = mix(col, fogc, (1.0 - vis) * uFogAlpha);
            }
            gl_FragColor = vec4(col, 1.0);
        }`,
});

let terrain = null;
function buildTerrain() {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    uniforms.uHalf.value = HALF;
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, n = pos.count;
    const water = new Float32Array(n), hs = new Float32Array(n), ms = new Float32Array(n);
    const wc = new Float32Array(n * 3), mc = new Float32Array(n * 3), fx = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
        const s = sample(pos.getX(i), pos.getZ(i));
        pos.setY(i, s.h);
        hs[i] = s.h; water[i] = s.w; ms[i] = s.m;
        wc.set(s.wc, i * 3); mc.set(s.mc, i * 3);
        fx[i * 4] = s.ws; fx[i * 4 + 1] = s.snow; fx[i * 4 + 2] = s.lava; fx[i * 4 + 3] = s.sea;
    }
    g.setAttribute('aWater', new THREE.BufferAttribute(water, 1));
    g.setAttribute('aH', new THREE.BufferAttribute(hs, 1));
    g.setAttribute('aM', new THREE.BufferAttribute(ms, 1));
    g.setAttribute('aWCol', new THREE.BufferAttribute(wc, 3));
    g.setAttribute('aMCol', new THREE.BufferAttribute(mc, 3));
    g.setAttribute('aFx', new THREE.BufferAttribute(fx, 4));
    g.computeVertexNormals();
    grade = { n: SEG, h: hs, w: water };
    if (terrain) { scene.remove(terrain); terrain.geometry.dispose(); }
    terrain = new THREE.Mesh(g, material);
    scene.add(terrain);
}

/* ---------- Tema (fundo, estilo e cores) ---------- */
function applyTheme() {
    const c = theme.cores;
    uniforms.uEstilo.value = Object.keys(ESTILOS).indexOf(theme.estilo);
    uniforms.uFundo.value = Object.keys(FUNDOS).indexOf(theme.fundo);
    uniforms.uTerra.value.set(c.terra);
    uniforms.uTinta.value.set(c.tinta);
    uniforms.uFundoCor.value.set(c.fundo);
    uniforms.uAgua.value.set(c.agua);

    const noite = theme.fundo === 'noite';
    stars.visible = noite;
    if (noite) {
        const cv = document.createElement('canvas');
        cv.width = 2; cv.height = 256;
        const ctx = cv.getContext('2d'), gr = ctx.createLinearGradient(0, 0, 0, 256);
        const base = new THREE.Color(c.fundo);
        gr.addColorStop(0, '#' + base.clone().multiplyScalar(0.45).getHexString());
        gr.addColorStop(1, '#' + base.clone().lerp(new THREE.Color('#3a3f6a'), 0.35).getHexString());
        ctx.fillStyle = gr; ctx.fillRect(0, 0, 2, 256);
        scene.background = new THREE.CanvasTexture(cv);
    } else {
        scene.background = new THREE.Color(c.fundo);
    }
    scene.fog = theme.fundo === 'nevoa' ? new THREE.Fog(c.fundo, 170 * K, 430 * K) : null;
    ambient.color.set(noite ? 0xb8c4ff : 0xfff0d0);
    ambient.intensity = noite ? 0.6 : 0.85;
    sun.intensity = noite ? 0.45 : 0.6;
    stage.style.background = c.fundo;

    // Rótulos legíveis sobre terra clara ou escura
    const escura = lum(c.terra) < 0.42;
    stage.style.setProperty('--rot-tinta', escura ? '#f3ead2' : c.tinta);
    stage.style.setProperty('--rot-halo', escura ? 'rgba(10,10,16,.85)' : c.terra);
    stage.style.setProperty('--rot-sel', escura ? '#ff9a80' : '#8a2d1c');
    stage.style.setProperty('--rot-agua', escura ? '#bfe1ef' : '#' + new THREE.Color(c.agua).multiplyScalar(0.5).getHexString());
}

/* ---------- Modelos 3D (casas, árvores, rochas, cristais, juncos) ---------- */
const props = new THREE.Group();
let destino = props; // grupo do lugar sendo montado (cada lugar tem o seu, guardado entre reconstruções)
scene.add(props);

function rng(seed) {
    let a = (seed * 2654435761) >>> 0;
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const G = {
    box: new THREE.BoxGeometry(1, 1, 1),
    pyr: new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4),
    cone: new THREE.ConeGeometry(1, 1, 8),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
    prism: new THREE.CylinderGeometry(1, 1, 1, 3).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), // telhado de duas águas, ponta para cima
    dome: new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    ball: new THREE.IcosahedronGeometry(1, 0),
    rock: new THREE.DodecahedronGeometry(1, 0),
    gem: new THREE.OctahedronGeometry(1, 0),
    nuvem: new THREE.SphereGeometry(1, 14, 10),
};
// Base das peças em y=0 (exceto domo e bola, que já nascem do centro)
['box', 'pyr', 'cone', 'cyl'].forEach((k) => G[k].translate(0, 0.5, 0));
const EDGES = {};
const edgesOf = (k) => (EDGES[k] ??= new THREE.EdgesGeometry(G[k]));
const inkMat = new THREE.LineBasicMaterial({ color: 0x2e1d0e });
const matCache = new Map();
function mat(hex, glow = 0) {
    const key = hex + ':' + glow;
    if (!matCache.has(key)) {
        const m = new THREE.MeshLambertMaterial({ color: hex, flatShading: true });
        if (glow) m.emissive = new THREE.Color(hex).multiplyScalar(glow);
        matCache.set(key, m);
    }
    return matCache.get(key);
}
let contorno = true;
function peca(grupo, k, hex, x, y, z, sx, sy, sz, ry = 0, glow = 0) {
    const m = new THREE.Mesh(G[k], mat(hex, glow));
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry;
    grupo.add(m);
    if (contorno && !glow) {
        const l = new THREE.LineSegments(edgesOf(k), inkMat);
        l.position.copy(m.position); l.scale.copy(m.scale); l.rotation.copy(m.rotation);
        grupo.add(l);
    }
    return m;
}

const PAREDE = { medieval: '#dcc48e', elfica: '#ece6d2', deserto: '#d9b47c', nordica: '#6b4a2e', fortaleza: '#d4c39a', oriental: '#e9dcc0', ruinas: '#9a958a' };

function casa(skin, roof, w, h, d, r) {
    const g = new THREE.Group(), wall = PAREDE[skin];
    switch (skin) {
        case 'elfica':
            peca(g, 'cyl', wall, 0, 0, 0, w * 0.42, h * 1.35, w * 0.42);
            peca(g, 'cone', roof, 0, h * 1.35, 0, w * 0.55, h * 1.2, w * 0.55);
            break;
        case 'deserto':
            peca(g, 'box', wall, 0, 0, 0, w, h * 0.8, d);
            if (r() < 0.45) peca(g, 'dome', roof, 0, h * 0.8, 0, w * 0.38, w * 0.38, w * 0.38);
            else peca(g, 'box', wall, 0, h * 0.8, 0, w * 1.04, h * 0.08, d * 1.04);
            break;
        case 'nordica':
            peca(g, 'box', wall, 0, 0, 0, w * 1.7, h * 0.6, d * 0.85);
            peca(g, 'prism', roof, 0, h * 0.6 + d * 0.32, 0, w * 1.85, d * 0.6, d * 0.62);
            break;
        case 'oriental':
            peca(g, 'box', wall, 0, 0, 0, w, h * 0.75, d);
            peca(g, 'pyr', roof, 0, h * 0.75, 0, w * 1.05, h * 0.3, d * 1.05);
            if (r() < 0.35) {
                peca(g, 'box', wall, 0, h * 1.0, 0, w * 0.6, h * 0.4, d * 0.6);
                peca(g, 'pyr', roof, 0, h * 1.4, 0, w * 0.7, h * 0.25, d * 0.7);
            }
            break;
        case 'ruinas': {
            const parts = 2 + Math.floor(r() * 3);
            for (let i = 0; i < parts; i++) {
                peca(g, 'box', roof, (r() - 0.5) * w, 0, (r() - 0.5) * d, w * (0.15 + r() * 0.5), h * (0.2 + r() * 0.9), d * (0.15 + r() * 0.3), r() * 3);
            }
            break;
        }
        default: // medieval e fortaleza
            peca(g, 'box', wall, 0, 0, 0, w, h, d);
            peca(g, 'pyr', roof, 0, h, 0, Math.max(w, d) * 0.78, h * 0.6, Math.max(w, d) * 0.78);
    }
    return g;
}

function marco(skin, roof) {
    const g = new THREE.Group(), wall = PAREDE[skin];
    switch (skin) {
        case 'elfica':
            peca(g, 'cyl', wall, 0, 0, 0, 0.9, 8, 0.9);
            peca(g, 'cone', roof, 0, 8, 0, 1.3, 4, 1.3);
            peca(g, 'cyl', wall, 1.6, 0, 0.8, 0.5, 5, 0.5);
            peca(g, 'cone', roof, 1.6, 5, 0.8, 0.8, 2.4, 0.8);
            break;
        case 'deserto':
            peca(g, 'box', wall, 0, 0, 0, 4.2, 2.6, 4.2);
            peca(g, 'dome', roof, 0, 2.6, 0, 1.9, 2.1, 1.9);
            peca(g, 'cyl', wall, 2.4, 0, 2.4, 0.35, 6, 0.35);
            peca(g, 'dome', roof, 2.4, 6, 2.4, 0.5, 0.6, 0.5);
            break;
        case 'nordica':
            peca(g, 'box', wall, 0, 0, 0, 6.5, 2.2, 3);
            peca(g, 'prism', roof, 0, 3.3, 0, 7, 2.2, 2.2);
            break;
        case 'fortaleza':
            peca(g, 'box', '#bdb39a', 0, 0, 0, 3.6, 5, 3.6);
            for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) {
                peca(g, 'cyl', '#bdb39a', x, 0, z, 0.8, 6.2, 0.8);
                peca(g, 'cone', roof, x, 6.2, z, 1.05, 1.6, 1.05);
            }
            break;
        case 'oriental':
            for (let i = 0; i < 4; i++) {
                const s = 2.6 - i * 0.45, y = i * 1.8;
                peca(g, 'box', wall, 0, y, 0, s, 1.3, s);
                peca(g, 'pyr', roof, 0, y + 1.3, 0, s * 1.05, 0.6, s * 1.05);
            }
            break;
        case 'ruinas':
            peca(g, 'cyl', roof, 0, 0, 0, 1.4, 3.4, 1.4);
            peca(g, 'box', roof, 1.6, 0, 0.4, 0.8, 1.6, 0.6, 0.6);
            peca(g, 'box', roof, -1.2, 0, 1.2, 1.1, 0.5, 0.8, 1.2);
            break;
        default:
            peca(g, 'box', wall, 0, 0, 0, 2.2, 5.5, 2.2);
            peca(g, 'pyr', roof, 0, 5.5, 0, 1.7, 5, 1.7);
    }
    return g;
}

function muralha(f, grupo) {
    const F = forma(f), R = f.size * 0.95, n = Math.max(10, Math.round(R * 2.2 * Math.max(F.sx, F.sz))), pedra = '#bdb39a';
    const ponto = (a) => paraMundo(f, Math.cos(a) * R * borda(F, a), Math.sin(a) * R * borda(F, a), F);
    for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
        const [x0, z0] = ponto(a0), [x1, z1] = ponto(a1);
        const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, len = Math.hypot(x1 - x0, z1 - z0);
        peca(grupo, 'box', pedra, mx, Math.max(heightAt(mx, mz), 0.2) - 0.1, mz, len * 1.04, 1.2, 0.45, -Math.atan2(z1 - z0, x1 - x0));
        if (i % 3 === 0) peca(grupo, 'cyl', pedra, x0, Math.max(heightAt(x0, z0), 0.2) - 0.1, z0, 0.6, 2, 0.6);
    }
}

function povoado(f) {
    const g = new THREE.Group(), r = rng(f.id + 11), city = f.type === 'city';
    const skin = skinOf(f), roof = corOf(f);
    const F = forma(f);
    const dens = f.shape?.densidade ?? 1;
    const n = Math.min(400, Math.round((city ? 8 + f.size * 1.6 * (1 + f.size / 20) : 3 + f.size * (1 + f.size / 12)) * dens));
    for (let i = 0; i < n; i++) {
        const [x, z] = city ? pontoDentro(f, r, F, 0.18, 0.78) : pontoDentro(f, r, F, 0, 0.75);
        if (aguaAt(x, z) > 0.3 || !visivelAgora(x, z)) continue;
        const w = city ? 1.4 + r() * 1.4 : 1.1 + r() * 0.8;
        const h = city ? 1.6 + r() * 2.2 : 1.0 + r() * 0.9;
        const m = casa(skin, roof, w, h, w * (0.8 + r() * 0.5), r);
        m.position.set(x, Math.max(heightAt(x, z), 0.2) - 0.05, z);
        m.rotation.y = r() * Math.PI;
        g.add(m);
    }
    if (city && visivelAgora(f.x, f.z)) {
        const t = marco(skin, roof);
        t.position.set(f.x, Math.max(heightAt(f.x, f.z), 0.2) - 0.05, f.z);
        g.add(t);
    }
    if (skin === 'fortaleza' && visivelAgora(f.x, f.z)) muralha(f, g);
    destino.add(g);
}

// Árvores em InstancedMesh: um tronco e uma copa por árvore
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpE = new THREE.Euler();
const tmpC = new THREE.Color();
function instancias(geo, material, lista) {
    const im = new THREE.InstancedMesh(geo, material, lista.length);
    lista.forEach((it, i) => {
        tmpE.set(it.rx || 0, it.ry || 0, it.rz || 0);
        tmpQ.setFromEuler(tmpE);
        tmpM.compose(tmpP.set(it.x, it.y, it.z), tmpQ, tmpS.set(it.sx, it.sy, it.sz));
        im.setMatrixAt(i, tmpM);
        if (it.c) im.setColorAt(i, tmpC.set(it.c));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    destino.add(im);
}
const corVar = (hex, r, k = 0.18) => '#' + new THREE.Color(hex).offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * k, (r() - 0.5) * k).getHexString();

function floresta(f) {
    const r = rng(f.id * 7 + 3), skin = skinOf(f), cor = corOf(f), F = forma(f);
    const n = Math.min(1600, Math.round((f.size * f.size * 0.38 + 6) * (f.shape?.densidade ?? 1)));
    const troncos = [], copas = [], galhos = [];
    for (let i = 0; i < n; i++) {
        const [x, z] = pontoDentro(f, r, F);
        if (Math.abs(x) > HALF - 2 || Math.abs(z) > HALF - 2 || !visivelAgora(x, z)) continue;
        if (aguaAt(x, z) > 0.15) continue;
        const y = heightAt(x, z) - 0.1, k = 0.75 + r() * 0.6;
        switch (skin) {
            case 'pinheiros':
                troncos.push({ x, y, z, sx: 0.12 * k, sy: 0.7 * k, sz: 0.12 * k });
                copas.push({ x, y: y + 0.5 * k, z, sx: 0.75 * k, sy: 2.4 * k, sz: 0.75 * k, c: corVar(cor, r, 0.1) });
                break;
            case 'morta':
                troncos.push({ x, y, z, sx: 0.12 * k, sy: 2.2 * k, sz: 0.12 * k, c: corVar(cor, r, 0.1) });
                galhos.push({ x, y: y + 1.2 * k, z, sx: 0.05, sy: 0.9 * k, sz: 0.05, rz: 0.8, ry: r() * 6, c: cor });
                galhos.push({ x, y: y + 1.6 * k, z, sx: 0.05, sy: 0.7 * k, sz: 0.05, rz: -0.9, ry: r() * 6, c: cor });
                break;
            case 'magica':
                troncos.push({ x, y, z, sx: 0.12 * k, sy: 0.9 * k, sz: 0.12 * k });
                copas.push({ x, y: y + 1.4 * k, z, sx: 0.55 * k, sy: 1.1 * k, sz: 0.55 * k, ry: r() * 3, c: corVar(cor, r, 0.3) });
                break;
            case 'outono': {
                const tons = [cor, '#d9a03a', '#b8442a', '#e0c068'];
                troncos.push({ x, y, z, sx: 0.13 * k, sy: 0.8 * k, sz: 0.13 * k });
                copas.push({ x, y: y + 1.3 * k, z, sx: 0.85 * k, sy: 0.8 * k, sz: 0.85 * k, ry: r() * 3, c: corVar(tons[Math.floor(r() * tons.length)], r) });
                break;
            }
            default:
                troncos.push({ x, y, z, sx: 0.13 * k, sy: 0.8 * k, sz: 0.13 * k });
                copas.push({ x, y: y + 1.3 * k, z, sx: 0.85 * k, sy: 0.8 * k, sz: 0.85 * k, ry: r() * 3, c: corVar(cor, r) });
        }
    }
    const madeira = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    troncos.forEach((t) => { t.c ??= '#5a3d24'; });
    if (troncos.length) instancias(G.cyl, madeira, troncos);
    if (galhos.length) instancias(G.cyl, madeira, galhos);
    if (copas.length) {
        const m = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
        if (skin === 'magica') m.emissive = new THREE.Color(cor).multiplyScalar(0.55);
        instancias(skin === 'pinheiros' ? G.cone : skin === 'magica' ? G.gem : G.ball, m, copas);
    }
}

function enfeitesMontanha(f) {
    const skin = skinOf(f);
    if (skin !== 'rochosa' && skin !== 'cristal') return;
    const r = rng(f.id * 13 + 5), cor = corOf(f), lista = [], F = forma(f);
    const n = Math.round(f.size * (skin === 'rochosa' ? 1.3 : 0.9));
    for (let i = 0; i < n; i++) {
        const [x, z] = pontoDentro(f, r, F, 0, skin === 'rochosa' ? 0.65 : 0.45), y = heightAt(x, z);
        if (!visivelAgora(x, z)) continue;
        if (skin === 'rochosa') {
            const s = 0.6 + r() * 1.8;
            lista.push({ x, y: y - s * 0.3, z, sx: s, sy: s * (0.6 + r() * 0.6), sz: s, ry: r() * 6, rx: r(), c: corVar(cor, r, 0.12) });
        } else {
            const s = 0.4 + r() * 0.8;
            lista.push({ x, y: y + s * 1.2, z, sx: s * 0.6, sy: s * 2.4, sz: s * 0.6, ry: r() * 6, rz: (r() - 0.5) * 0.7, c: corVar(cor, r, 0.3) });
        }
    }
    const m = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    if (skin === 'cristal') m.emissive = new THREE.Color(cor).multiplyScalar(0.45);
    instancias(skin === 'rochosa' ? G.rock : G.gem, m, lista);
}

function juncos(f) {
    if (f.type !== 'lake' || skinOf(f) !== 'pantano') return;
    const r = rng(f.id * 17 + 1), lista = [], F = forma(f);
    const n = Math.round(f.size * 6 * Math.max(F.sx, F.sz));
    for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = f.size * (0.85 + r() * 0.3) * borda(F, a);
        const [x, z] = paraMundo(f, Math.cos(a) * d, Math.sin(a) * d, F);
        if (!visivelAgora(x, z)) continue;
        lista.push({ x, y: heightAt(x, z) - 0.1, z, sx: 0.05, sy: 0.8 + r() * 0.9, sz: 0.05, rz: (r() - 0.5) * 0.4, c: corVar('#7a8a3a', r, 0.2) });
    }
    instancias(G.cyl, new THREE.MeshLambertMaterial({ color: 0xffffff }), lista);
}

// Estrada: faixa que acompanha o relevo (trilha = tracejada; real = com margens)
function estrada(f) {
    const pts = rioPath(f);
    if (pts.length < 2) return;
    const skin = skinOf(f), cor = corOf(f), w = f.size;
    const faixa = (largura, hex, dy, tracejada) => {
        const pos = [], idx = [];
        let k = 0;
        for (let i = 0; i < pts.length; i++) {
            if (tracejada && Math.floor(i / 2) % 2) continue;
            if (!visivelAgora(pts[i][0], pts[i][1])) continue;
            const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
            const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
            for (const s of [-1, 1]) {
                const x = pts[i][0] + nx * largura / 2 * s, z = pts[i][1] + nz * largura / 2 * s;
                pos.push(x, Math.max(heightAt(x, z), -0.1) + dy, z);
            }
            if (k > 0 && (!tracejada || Math.floor((i - 1) / 2) % 2 === 0)) idx.push(k * 2 - 2, k * 2 - 1, k * 2, k * 2 - 1, k * 2 + 1, k * 2);
            k++;
        }
        if (k < 2) return;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const m = new THREE.MeshLambertMaterial({ color: hex, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
        proprio(new THREE.Mesh(g, m));
    };
    if (skin === 'real') faixa(w * 1.5, '#' + new THREE.Color(cor).multiplyScalar(0.6).getHexString(), 0.1, false);
    faixa(w, cor, 0.16, skin === 'trilha');
}

/* ---------- Torres, ruínas e fenômenos (névoa, chuva, tempestade, terremoto, nevasca, magia) ---------- */
const chaoEm = (x, z) => Math.max(heightAt(x, z), 0.2) - 0.1;
// Peças criadas aqui (geometria própria) são descartadas a cada reconstrução
function proprio(o) { o.userData.proprio = true; destino.add(o); return o; }
function giroDe(F) { return -Math.atan2(F.s, F.c); }

function torre(f) {
    if (!visivelAgora(f.x, f.z)) return;
    const g = new THREE.Group(), skin = skinOf(f), cor = corOf(f), F = forma(f);
    const s = f.size, H = s * 4.2 * (f.shape?.altura ?? 1), pedra = '#b9ae98';
    switch (skin) {
        case 'mago':
            peca(g, 'cyl', '#8f8aa0', 0, 0, 0, s * 0.6, H * 0.6, s * 0.6);
            peca(g, 'cyl', '#a29cb5', 0, H * 0.6, 0, s * 0.45, H * 0.3, s * 0.45);
            peca(g, 'cyl', '#8f8aa0', 0, H * 0.82, 0, s * 0.62, s * 0.14, s * 0.62);
            peca(g, 'cone', cor, 0, H * 0.9, 0, s * 0.7, H * 0.38, s * 0.7);
            peca(g, 'gem', cor, 0, H * 1.42, 0, s * 0.22, s * 0.38, s * 0.22, 0, 1);
            break;
        case 'farol':
            for (let i = 0; i < 4; i++) peca(g, 'cyl', i % 2 ? '#f2ece0' : cor, 0, i * H * 0.2, 0, s * (0.62 - i * 0.05), H * 0.2, s * (0.62 - i * 0.05));
            peca(g, 'cyl', '#3a3530', 0, H * 0.8, 0, s * 0.55, s * 0.14, s * 0.55);
            peca(g, 'ball', '#ffe48a', 0, H * 0.8 + s * 0.45, 0, s * 0.3, s * 0.3, s * 0.3, 0, 1);
            peca(g, 'cone', '#3a3530', 0, H * 0.8 + s * 0.72, 0, s * 0.45, s * 0.5, s * 0.45);
            break;
        case 'sombria':
            peca(g, 'cyl', '#2e2a33', 0, 0, 0, s * 0.65, H * 0.85, s * 0.65);
            for (let i = 0; i < 5; i++) {
                const a = (i / 5) * Math.PI * 2;
                peca(g, 'cone', '#2e2a33', Math.cos(a) * s * 0.55, H * 0.85, Math.sin(a) * s * 0.55, s * 0.16, s * 0.9, s * 0.16);
            }
            peca(g, 'cone', '#1f1c24', 0, H * 0.85, 0, s * 0.42, H * 0.38, s * 0.42);
            peca(g, 'gem', cor, 0, H * 0.72, s * 0.64, s * 0.14, s * 0.24, s * 0.08, 0, 1.2);
            break;
        case 'elfica':
            peca(g, 'cyl', '#efe9da', 0, 0, 0, s * 0.38, H * 1.1, s * 0.38);
            peca(g, 'cyl', '#efe9da', 0, H * 0.72, 0, s * 0.62, s * 0.16, s * 0.62);
            peca(g, 'cone', cor, 0, H * 1.1, 0, s * 0.44, H * 0.42, s * 0.44);
            break;
        default: // torre de vigia
            peca(g, 'cyl', pedra, 0, 0, 0, s * 0.6, H, s * 0.6);
            peca(g, 'cyl', pedra, 0, H, 0, s * 0.8, s * 0.35, s * 0.8);
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                peca(g, 'box', pedra, Math.cos(a) * s * 0.68, H + s * 0.35, Math.sin(a) * s * 0.68, s * 0.22, s * 0.28, s * 0.22, -a);
            }
            peca(g, 'cyl', '#5a3d24', 0, H + s * 0.35, 0, 0.05 * s, s * 1.4, 0.05 * s);
            peca(g, 'box', cor, s * 0.27, H + s * 1.32, 0, s * 0.5, s * 0.3, 0.04 * s);
    }
    g.scale.set(F.sx, 1, F.sz);
    g.rotation.y = giroDe(F);
    g.position.set(f.x, chaoEm(f.x, f.z), f.z);
    destino.add(g);
}

function ruina(f) {
    const g = new THREE.Group(), r = rng(f.id * 19 + 7), skin = skinOf(f), cor = corOf(f), F = forma(f);
    const dens = f.shape?.densidade ?? 1, k = Math.max(0.6, Math.min(2.5, f.size / 6)), ry = giroDe(F);
    const ok = (x, z) => visivelAgora(x, z) && aguaAt(x, z) < 0.3;
    const musgo = '#6f7f4a';
    const naBorda = (a, d) => paraMundo(f, Math.cos(a) * f.size * d * borda(F, a), Math.sin(a) * f.size * d * borda(F, a), F);
    switch (skin) {
        case 'templo': {
            if (ok(f.x, f.z)) peca(g, 'box', cor, f.x, chaoEm(f.x, f.z) - 0.3, f.z, f.size * 1.5 * F.sx, 0.7 * k, f.size * 1.5 * F.sz, ry);
            const m = Math.max(6, Math.round(f.size * 1.6 * dens));
            for (let i = 0; i < m; i++) {
                const a = (i / m) * Math.PI * 2, [x, z] = naBorda(a, 0.62);
                if (!ok(x, z)) continue;
                const y = chaoEm(x, z) + 0.3 * k;
                if (r() < 0.2) { peca(g, 'box', cor, x, y, z, 2.6 * k, 0.5 * k, 0.5 * k, r() * 6); continue; } // coluna caída
                const h = (0.35 + r() * 0.65) * 3.4 * k;
                peca(g, 'cyl', cor, x, y, z, 0.3 * k, h, 0.3 * k);
                if (h > 2.6 * k) peca(g, 'box', cor, x, y + h, z, 0.8 * k, 0.25 * k, 0.8 * k, ry);
            }
            break;
        }
        case 'pedras': {
            const m = Math.max(5, Math.round(f.size * 1.3 * dens));
            for (let i = 0; i < m; i++) {
                const a = (i / m) * Math.PI * 2, [x, z] = naBorda(a, 0.7);
                if (!ok(x, z)) continue;
                const h = (1.6 + r() * 1.2) * k;
                peca(g, 'box', cor, x, chaoEm(x, z), z, 0.55 * k, h, 0.3 * k, -a);
                if (i % 2 === 0 && r() < 0.5) {
                    const [x2, z2] = naBorda(((i + 1) / m) * Math.PI * 2, 0.7);
                    peca(g, 'box', cor, (x + x2) / 2, chaoEm(x, z) + h, (z + z2) / 2, Math.hypot(x2 - x, z2 - z) + 0.5 * k, 0.3 * k, 0.4 * k, -Math.atan2(z2 - z, x2 - x));
                }
            }
            if (ok(f.x, f.z)) peca(g, 'box', cor, f.x, chaoEm(f.x, f.z), f.z, 1.2 * k, 0.6 * k, 0.8 * k, ry);
            break;
        }
        case 'cidade': {
            const n = Math.min(160, Math.round((5 + f.size * 2.4) * dens));
            for (let i = 0; i < n; i++) {
                const [x, z] = pontoDentro(f, r, F, 0, 0.85);
                if (!ok(x, z)) continue;
                const w = (0.9 + r() * 1.8) * k;
                peca(g, 'box', r() < 0.3 ? musgo : corVar(cor, r, 0.1), x, chaoEm(x, z), z, w, (0.3 + r() * 1.3) * k, 0.3 * k, r() * Math.PI);
                if (r() < 0.25) peca(g, 'rock', '#8a8478', x + r() - 0.5, chaoEm(x, z) + 0.15, z + r() - 0.5, 0.35 * k, 0.25 * k, 0.35 * k, r() * 6);
            }
            break;
        }
        case 'arcana': {
            const n = Math.min(80, Math.round((4 + f.size * 1.2) * dens));
            for (let i = 0; i < n; i++) {
                const [x, z] = pontoDentro(f, r, F, 0.15, 0.9);
                if (!ok(x, z)) continue;
                const y = chaoEm(x, z);
                peca(g, 'rock', '#6f6a78', x, y + 0.2 * k, z, (0.5 + r() * 0.6) * k, (0.4 + r() * 0.5) * k, (0.5 + r() * 0.6) * k, r() * 6);
                if (r() < 0.55) peca(g, 'gem', cor, x, y + (1.4 + r() * 1.6) * k, z, 0.18 * k, 0.32 * k, 0.18 * k, r() * 6, 1.1);
            }
            if (ok(f.x, f.z)) {
                const y = chaoEm(f.x, f.z);
                peca(g, 'box', '#4a4552', f.x, y, f.z, 0.9 * k, 4.2 * k, 0.9 * k, ry);
                peca(g, 'pyr', '#4a4552', f.x, y + 4.2 * k, f.z, 0.66 * k, 0.9 * k, 0.66 * k, ry);
                peca(g, 'box', cor, f.x, y + 0.6 * k, f.z, 0.95 * k, 2.6 * k, 0.12 * k, ry, 1);
            }
            break;
        }
        default: { // castelo em ruínas: muralha com brechas, torres quebradas e entulho
            const m = Math.max(10, Math.round(f.size * 2.2 * Math.max(F.sx, F.sz)));
            for (let i = 0; i < m; i++) {
                if (r() < 0.32) continue;
                const [x0, z0] = naBorda((i / m) * Math.PI * 2, 0.85), [x1, z1] = naBorda(((i + 1) / m) * Math.PI * 2, 0.85);
                const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
                if (!ok(mx, mz)) continue;
                peca(g, 'box', corVar(cor, r, 0.08), mx, chaoEm(mx, mz), mz, Math.hypot(x1 - x0, z1 - z0) * 1.04, (0.6 + r() * 1.8) * k, 0.5 * k, -Math.atan2(z1 - z0, x1 - x0));
            }
            for (let i = 0; i < 3; i++) {
                const [x, z] = naBorda(r() * Math.PI * 2, 0.85);
                if (ok(x, z)) peca(g, 'cyl', cor, x, chaoEm(x, z), z, 0.9 * k, (1.5 + r() * 2.6) * k, 0.9 * k);
            }
            if (ok(f.x, f.z)) peca(g, 'box', cor, f.x, chaoEm(f.x, f.z), f.z, 2.6 * k, 2.4 * k, 2 * k, ry);
            const n = Math.round(f.size * 1.2 * dens);
            for (let i = 0; i < n; i++) {
                const [x, z] = pontoDentro(f, r, F, 0, 0.75);
                if (ok(x, z)) peca(g, 'rock', '#8a8478', x, chaoEm(x, z) + 0.1, z, (0.3 + r() * 0.5) * k, 0.3 * k, (0.3 + r() * 0.5) * k, r() * 6);
            }
        }
    }
    destino.add(g);
}

// Manto translúcido que acompanha o relevo, mais forte no centro e sumindo na borda
let texAura = null;
function auraTex() {
    if (texAura) return texAura;
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d'), gr = x.createRadialGradient(64, 64, 6, 64, 64, 64);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#bbb'); gr.addColorStop(1, '#000');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return (texAura = new THREE.CanvasTexture(cv));
}
function manto(f, F, dy, hex, op, aditivo = false, alcance = 1) {
    const AN = 56, RN = 8, pos = [], uv = [], idx = [], vis = [];
    const add = (x, z, t, a) => {
        pos.push(x, Math.max(heightAt(x, z), 0) + dy, z);
        uv.push(0.5 + Math.cos(a) * t * 0.5, 0.5 + Math.sin(a) * t * 0.5);
        vis.push(visivelAgora(x, z));
    };
    add(f.x, f.z, 0, 0);
    for (let j = 1; j <= RN; j++) {
        const t = j / RN;
        for (let i = 0; i < AN; i++) {
            const a = (i / AN) * Math.PI * 2, b = f.size * alcance * t * borda(F, a);
            const [x, z] = paraMundo(f, Math.cos(a) * b, Math.sin(a) * b, F);
            add(x, z, t, a);
        }
    }
    const v = (j, i) => (j === 0 ? 0 : 1 + (j - 1) * AN + (i % AN));
    const tri = (a, b, c) => { if (vis[a] && vis[b] && vis[c]) idx.push(a, b, c); };
    for (let i = 0; i < AN; i++) tri(0, v(1, i), v(1, i + 1));
    for (let j = 1; j < RN; j++) for (let i = 0; i < AN; i++) { tri(v(j, i), v(j + 1, i), v(j + 1, i + 1)); tri(v(j, i), v(j + 1, i + 1), v(j, i + 1)); }
    if (!idx.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const m = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op, alphaMap: auraTex(), depthWrite: false, side: THREE.DoubleSide,
        blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending });
    const me = new THREE.Mesh(g, m);
    me.renderOrder = 4;
    proprio(me);
}
// Faixa fina sobre o chão (rachaduras do terremoto)
function fita(pts, largura, hex) {
    const pos = [], idx = [];
    pts.forEach(([x, z], i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, w = largura * (1 - (i / pts.length) * 0.85) / 2;
        for (const s of [-1, 1]) { const px = x - (dz / l) * w * s, pz = z + (dx / l) * w * s; pos.push(px, Math.max(heightAt(px, pz), 0) + 0.12, pz); }
        if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    proprio(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })));
}
function raio3d(pts, esp) {
    const g = new THREE.Group(), cima = new THREE.Vector3(0, 1, 0);
    const m = new THREE.MeshBasicMaterial({ color: '#fffbe0', depthTest: false });
    const halo = new THREE.MeshBasicMaterial({ color: '#ffe680', transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
    for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], d = new THREE.Vector3().subVectors(b, a), len = d.length();
        for (const [raio, mt] of [[esp, m], [esp * 3, halo]]) {
            const c = new THREE.Mesh(new THREE.CylinderGeometry(raio, raio, len + raio, 6), mt);
            c.position.copy(a).addScaledVector(d, 0.5);
            c.quaternion.setFromUnitVectors(cima, d.clone().normalize());
            c.renderOrder = 8;
            g.add(c);
        }
    }
    proprio(g);
}

function fenomeno(f) {
    const skin = skinOf(f), cor = corOf(f), F = forma(f), r = rng(f.id * 23 + 3);
    const dens = f.shape?.densidade ?? 1, alt = f.shape?.altura ?? 1, esc2 = Math.min(3, 0.6 + f.size / 20);
    const H = (8 + f.size * 0.22) * alt;
    const topo = (x, z) => Math.max(heightAt(x, z), 0);
    const nuvens = (hex, op, qtd) => {
        const lista = [];
        // cada nuvem é um cacho de bolas lisas: uma maior no meio e outras menores em volta
        for (let i = 0; i < qtd; i++) {
            const [x, z] = pontoDentro(f, r, F, 0, 0.8);
            if (!visivelAgora(x, z)) continue;
            const s = (0.7 + r() * 0.8) * esc2, y = topo(x, z) * 0.6 + H + r() * 1.5;
            lista.push({ x, y, z, sx: s * 1.5, sy: s * 0.85, sz: s * 1.3, ry: r() * 6, c: corVar(hex, r, 0.06) });
            for (let j = 0, n = 3 + Math.floor(r() * 3); j < n; j++) {
                const a = r() * Math.PI * 2, d = s * (0.9 + r() * 0.8), k = s * (0.45 + r() * 0.4);
                lista.push({ x: x + Math.cos(a) * d, y: y - s * 0.15 + r() * s * 0.3, z: z + Math.sin(a) * d, sx: k * 1.3, sy: k * 0.8, sz: k * 1.2, ry: r() * 6, c: corVar(hex, r, 0.06) });
            }
        }
        if (lista.length) {
            const m = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: op < 1, opacity: op, depthWrite: op >= 1 });
            m.emissive = new THREE.Color(hex).multiplyScalar(0.3);
            instancias(G.nuvem, m, lista);
        }
        return lista;
    };
    const gotas = (hex, op, qtd, tam, inclina) => {
        const pos = [];
        for (let i = 0; i < qtd; i++) {
            const [x, z] = pontoDentro(f, r, F, 0, 0.82);
            if (!visivelAgora(x, z)) continue;
            const y0 = topo(x, z), y1 = y0 * 0.6 + H - 0.5, y = y0 + r() * (y1 - y0);
            pos.push(x, y, z, x + inclina, Math.max(y0, y - tam), z + inclina * 0.5);
        }
        if (!pos.length) return;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        proprio(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: op })));
    };
    const pontos = (hex, qtd, tam, aditivo, yMin = 0) => {
        const pos = [];
        for (let i = 0; i < qtd; i++) {
            const [x, z] = pontoDentro(f, r, F, 0, 0.9);
            if (!visivelAgora(x, z)) continue;
            const y0 = topo(x, z);
            pos.push(x, y0 + yMin + r() * (H - yMin), z);
        }
        if (!pos.length) return;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        proprio(new THREE.Points(g, new THREE.PointsMaterial({ color: hex, size: tam, transparent: true, opacity: 0.9, depthWrite: false,
            blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending })));
    };
    const area = f.size * f.size * F.sx * F.sz;
    switch (skin) {
        case 'chuva':
            nuvens('#d9dde2', 0.95, Math.round((6 + f.size * 0.8) * dens));
            gotas(cor, 0.55, Math.min(2500, Math.round(area * 0.7 * dens)), 1.6, 0.25);
            manto(f, F, 0.25, '#40607e', 0.2);
            break;
        case 'tempestade': {
            const nv = nuvens(cor, 0.97, Math.round((9 + f.size * 1.1) * dens));
            gotas('#9db4c8', 0.6, Math.min(3500, Math.round(area * 1.1 * dens)), 2.2, 0.6);
            manto(f, F, 0.25, '#1e2a36', 0.3);
            const nb = Math.min(8, 2 + Math.round(f.size / 10 * dens));
            for (let b = 0; b < nb && nv.length; b++) {
                const c = nv[Math.floor(r() * nv.length)], y0 = c.y - c.sy * 0.5, y1 = topo(c.x, c.z);
                const pts = [], passos = 7;
                for (let i = 0; i <= passos; i++) {
                    const t = i / passos, j = i && i < passos ? (r() - 0.5) * 2.4 * esc2 : 0;
                    pts.push(new THREE.Vector3(c.x + j + t * (r() - 0.5), y0 + (y1 - y0) * t, c.z + (r() - 0.5) * 1.6 * (i && i < passos)));
                }
                raio3d(pts, 0.08 * esc2);
            }
            break;
        }
        case 'terremoto': {
            manto(f, F, 0.6, '#b08a5a', 0.22);
            const nr = Math.max(3, Math.round((3 + f.size / 6) * dens)), pedras = [];
            for (let q = 0; q < nr; q++) {
                const a0 = (q / nr) * Math.PI * 2 + r() * 0.5, pts = [];
                let a = a0;
                for (let i = 0; i <= 12; i++) {
                    const t = i / 12, b = f.size * 0.95 * t * borda(F, a);
                    pts.push(paraMundo(f, Math.cos(a) * b, Math.sin(a) * b, F));
                    a = a0 + (r() - 0.5) * 0.5;
                }
                if (pts.every(([x, z]) => visivelAgora(x, z))) fita(pts, (0.6 + r() * 0.6) * esc2, cor);
                for (let i = 2; i < pts.length; i += 2) {
                    const [x, z] = pts[i];
                    if (visivelAgora(x, z) && r() < 0.7) pedras.push({ x: x + (r() - 0.5) * 1.5, y: topo(x, z), z: z + (r() - 0.5) * 1.5, sx: 0.4 * esc2, sy: 0.3 * esc2, sz: 0.5 * esc2, rx: r(), ry: r() * 6, rz: r(), c: corVar('#7a6a58', r) });
                }
            }
            if (pedras.length) instancias(G.rock, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), pedras);
            break;
        }
        case 'nevasca':
            nuvens('#eef2f6', 0.96, Math.round((6 + f.size * 0.8) * dens));
            pontos(cor, Math.min(4000, Math.round(area * 1.3 * dens)), 0.75, false);
            manto(f, F, 0.3, '#ffffff', 0.5);
            break;
        case 'magia': {
            manto(f, F, 0.6, cor, 0.4, true);
            manto(f, F, 3.5 * alt, cor, 0.16, true, 0.8);
            const gemas = [];
            for (let i = 0, n = Math.round((3 + f.size * 0.7) * dens); i < n; i++) {
                const [x, z] = pontoDentro(f, r, F, 0, 0.8);
                if (!visivelAgora(x, z)) continue;
                const s = (0.25 + r() * 0.35) * esc2;
                gemas.push({ x, y: topo(x, z) + (1.5 + r() * 4) * alt, z, sx: s, sy: s * 1.8, sz: s, ry: r() * 6, c: corVar(cor, r, 0.3) });
            }
            if (gemas.length) {
                const m = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
                m.emissive = new THREE.Color(cor).multiplyScalar(0.7);
                instancias(G.gem, m, gemas);
            }
            pontos(cor, Math.min(1500, Math.round(area * 0.5 * dens)), 0.45, true, 0.5);
            break;
        }
        default: { // névoa colorida
            manto(f, F, 1.2 * alt, cor, 0.5);
            manto(f, F, 3 * alt, cor, 0.32, false, 0.92);
            manto(f, F, 5.5 * alt, cor, 0.18, false, 0.8);
            const lista = [];
            for (let i = 0, n = Math.round((4 + f.size * 1.2) * dens); i < n; i++) {
                const [x, z] = pontoDentro(f, r, F, 0, 0.8);
                if (!visivelAgora(x, z)) continue;
                const s = (1.2 + r() * 2) * esc2;
                lista.push({ x, y: topo(x, z) + (0.8 + r() * 3) * alt, z, sx: s * 1.8, sy: s * 0.6, sz: s * 1.5, ry: r() * 6, c: corVar(cor, r, 0.1) });
            }
            if (lista.length) instancias(G.ball, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false }), lista);
        }
    }
}

/* ---------- Regiões: polígonos marcados pelo usuário, translúcidos, que podem ficar ocultos ---------- */
function dentroPoligono(pts, x, z) {
    let d = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, zi] = pts[i], [xj, zj] = pts[j];
        if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) d = !d;
    }
    return d;
}
function distPoligono(f, x, z) {
    const p = f.points || [];
    let m = Infinity;
    for (let i = 0; i < p.length; i++) m = Math.min(m, distSeg(x, z, p[i], p[(i + 1) % p.length]));
    return m;
}
// Contorno fechado com pontos a cada ~1 unidade (para acompanhar o relevo)
function contornoDenso(pts, passo = 1) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / passo));
        for (let j = 0; j < n; j++) out.push([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]);
    }
    return out;
}
const centroDe = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
let texListras = null;
function listrasTex() {
    if (texListras) return texListras;
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const x = cv.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 32, 32);
    x.strokeStyle = '#fff'; x.lineWidth = 7;
    for (let d = -32; d <= 64; d += 16) { x.beginPath(); x.moveTo(d, 0); x.lineTo(d + 32, 32); x.stroke(); }
    texListras = new THREE.CanvasTexture(cv);
    texListras.wrapS = texListras.wrapT = THREE.RepeatWrapping;
    return texListras;
}
function regiao(f) {
    const pts = f.points || [];
    if (pts.length < 3 || f.shape?.oculta) return;
    const skin = skinOf(f), cor = corOf(f);
    if (skin !== 'borda') {
        // preenchimento: células da grade que caem dentro do polígono, acompanhando o relevo
        const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
        const passo = Math.max(1, SIZE / 170), nx = Math.ceil((x1 - x0) / passo) + 1, nz = Math.ceil((z1 - z0) / passo) + 1;
        const pos = [], uv = [], idx = [], id = new Int32Array(nx * nz).fill(-1);
        const vert = (i, j) => {
            const k = j * nx + i;
            if (id[k] < 0) {
                const x = Math.min(x1, x0 + i * passo), z = Math.min(z1, z0 + j * passo);
                id[k] = pos.length / 3;
                pos.push(x, Math.max(heightAt(x, z), 0) + 0.35, z);
                uv.push(x / (6 * K), z / (6 * K));
            }
            return id[k];
        };
        for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
            const cx = x0 + (i + 0.5) * passo, cz = z0 + (j + 0.5) * passo;
            if (!dentroPoligono(pts, cx, cz) || !visivelAgora(cx, cz)) continue;
            const a = vert(i, j), b = vert(i + 1, j), c = vert(i + 1, j + 1), d = vert(i, j + 1);
            idx.push(a, c, b, a, d, c);
        }
        if (idx.length) {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
            g.setIndex(idx);
            const m = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: skin === 'hachurada' ? 0.5 : 0.3, depthWrite: false, side: THREE.DoubleSide,
                polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
            if (skin === 'hachurada') m.alphaMap = listrasTex();
            const me = new THREE.Mesh(g, m);
            me.renderOrder = 3;
            proprio(me);
        }
    }
    // borda: faixa em volta (tracejada no modelo "só o contorno")
    const borda = contornoDenso(pts, 1), w = Math.max(0.25, f.size * 0.45), pos = [], idx = [];
    for (let i = 0; i < borda.length; i++) {
        if (skin === 'borda' && Math.floor(i / 3) % 2) continue;
        const a = borda[i], b = borda[(i + 1) % borda.length];
        if (!visivelAgora(a[0], a[1])) continue;
        const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * w / 2, nz = (dx / l) * w / 2, k = pos.length / 3;
        for (const [x, z] of [[a[0] + nx, a[1] + nz], [a[0] - nx, a[1] - nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz]]) pos.push(x, Math.max(heightAt(x, z), 0) + 0.45, z);
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
    if (idx.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        const me = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#' + new THREE.Color(cor).multiplyScalar(0.75).getHexString(), transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide,
            polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }));
        me.renderOrder = 4;
        proprio(me);
    }
}

const cacheProps = new Map(); // id do lugar -> { chave, grupo }
function descartar(grupo) {
    grupo.traverse((c) => {
        if (c.isInstancedMesh) { c.material.dispose(); c.dispose?.(); }
        if (c.userData.proprio) c.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    });
}
let chaveTerreno = '';
function chaveNevoa() {
    if (PODE && !previaJogador) return 'livre';
    const a = world?.fog?.areas || [];
    return JSON.stringify([!!world?.fog?.ativo, a.length, a[a.length - 1] || null, a[0] || null]);
}
// Enfeites espalhados dentro do bioma (cactos, acácias, pedras, juncos, árvores mortas, cristais...)
function bioma(f) {
    const pts = f.points || [];
    if (pts.length < 3) return;
    const skin = skinOf(f), cor = corOf(f), r = rng(f.id * 29 + 11), dens = f.shape?.densidade ?? 1;
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    let area = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
    area = Math.abs(area) / 2;
    const taxa = { deserto: 0.012, savana: 0.02, planicie: 0.03, tundra: 0.015, neve: 0.008, pantano: 0.05, cinzas: 0.02, mortas: 0.02, cristal: 0.012 }[skin] ?? 0.02;
    const n = Math.min(900, Math.round(area * taxa * dens));
    const dentro = [];
    for (let t = 0; t < n * 6 && dentro.length < n; t++) {
        const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
        if (!dentroPoligono(pts, x, z) || distPoligono(f, x, z) < 1.5 || !visivelAgora(x, z) || aguaAt(x, z) > 0.25) continue;
        dentro.push([x, z, heightAt(x, z)]);
    }
    if (!dentro.length) return;
    const lambert = (glow) => { const m = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }); if (glow) m.emissive = new THREE.Color(glow).multiplyScalar(0.6); return m; };
    const A = [], B = [], C = [];
    for (const [x, z, y] of dentro) {
        const k = 0.7 + r() * 0.6;
        switch (skin) {
            case 'deserto':
                if (r() < 0.65) {
                    A.push({ x, y, z, sx: 0.14 * k, sy: 1.1 * k, sz: 0.14 * k, c: corVar('#5f8a3a', r, 0.1) });
                    if (r() < 0.7) A.push({ x: x + 0.12 * k, y: y + 0.45 * k, z, sx: 0.09 * k, sy: 0.45 * k, sz: 0.09 * k, rz: -0.9, c: '#5f8a3a' });
                } else B.push({ x, y: y - 0.1, z, sx: 0.4 * k, sy: 0.25 * k, sz: 0.4 * k, ry: r() * 6, c: corVar('#b08a5a', r) });
                break;
            case 'savana':
                A.push({ x, y, z, sx: 0.1 * k, sy: 1.1 * k, sz: 0.1 * k, c: '#5a3d24' });
                B.push({ x, y: y + 1.15 * k, z, sx: 1.1 * k, sy: 0.22 * k, sz: 1.1 * k, ry: r() * 6, c: corVar('#6f8a3a', r) });
                break;
            case 'planicie':
                B.push({ x, y: y + 0.15, z, sx: 0.45 * k, sy: 0.32 * k, sz: 0.45 * k, ry: r() * 6, c: corVar('#5f8f3a', r, 0.15) });
                break;
            case 'tundra': case 'neve':
                if (skin === 'tundra' && r() < 0.35) {
                    A.push({ x, y, z, sx: 0.1 * k, sy: 0.5 * k, sz: 0.1 * k, c: '#4a3a2a' });
                    C.push({ x, y: y + 0.35 * k, z, sx: 0.5 * k, sy: 1.5 * k, sz: 0.5 * k, c: corVar('#3f5a48', r, 0.1) });
                } else B.push({ x, y: y - 0.1, z, sx: 0.45 * k, sy: 0.3 * k, sz: 0.45 * k, ry: r() * 6, c: skin === 'neve' ? '#e8eef2' : corVar('#8a8c88', r) });
                break;
            case 'pantano':
                A.push({ x, y: y - 0.1, z, sx: 0.04, sy: 0.7 + r() * 0.7, sz: 0.04, rz: (r() - 0.5) * 0.4, c: corVar('#7a8a3a', r, 0.2) });
                if (r() < 0.08) A.push({ x, y, z, sx: 0.1, sy: 1.6 * k, sz: 0.1, c: '#4a3e30' });
                break;
            case 'mortas':
                A.push({ x, y, z, sx: 0.09 * k, sy: 1.5 * k, sz: 0.09 * k, c: corVar('#5a4a3a', r, 0.1) });
                A.push({ x, y: y + 0.9 * k, z, sx: 0.04, sy: 0.6 * k, sz: 0.04, rz: 0.8, ry: r() * 6, c: '#5a4a3a' });
                break;
            case 'cinzas':
                B.push({ x, y: y - 0.1, z, sx: 0.5 * k, sy: 0.35 * k, sz: 0.5 * k, ry: r() * 6, c: corVar('#2e2a28', r, 0.1) });
                if (r() < 0.25) C.push({ x, y: y + 0.1, z, sx: 0.12, sy: 0.12, sz: 0.12, ry: r() * 6, c: '#ff6a2a' });
                break;
            case 'cristal':
                C.push({ x, y: y + 0.5 * k, z, sx: 0.3 * k, sy: 1.2 * k, sz: 0.3 * k, ry: r() * 6, rz: (r() - 0.5) * 0.5, c: corVar(cor, r, 0.25) });
                break;
        }
    }
    if (A.length) instancias(G.cyl, lambert(), A);
    if (B.length) instancias(skin === 'planicie' || skin === 'savana' ? G.ball : G.rock, lambert(), B);
    if (C.length) instancias(skin === 'tundra' ? G.cone : G.gem, lambert(skin === 'cristal' ? cor : skin === 'cinzas' ? '#ff6a2a' : null), C);
}

function buildProps() {
    contorno = theme.estilo !== 'natural';
    inkMat.color.set(theme.cores.tinta);
    const base = JSON.stringify([chaveTerreno, contorno, chaveNevoa(), SIZE]), vivos = new Set();
    for (const f of features) {
        const chave = base + JSON.stringify([f.type, f.x, f.z, f.size, f.skin, f.color, f.shape, f.points, corOf(f), skinOf(f)]);
        vivos.add(f.id);
        const c = cacheProps.get(f.id);
        if (c && c.chave === chave) continue;
        if (c) { props.remove(c.grupo); descartar(c.grupo); }
        const grupo = new THREE.Group();
        destino = grupo;
        try { construirModelo(f); } catch (e) { console.error(e); } finally { destino = props; }
        props.add(grupo);
        cacheProps.set(f.id, { chave, grupo });
    }
    for (const [id, c] of cacheProps) if (!vivos.has(id)) { props.remove(c.grupo); descartar(c.grupo); cacheProps.delete(id); }
}
function construirModelo(f) {
    {
        if (f.type === 'city' || f.type === 'village') povoado(f);
        else if (f.type === 'forest') floresta(f);
        else if (f.type === 'mountain') enfeitesMontanha(f);
        else if (f.type === 'lake') juncos(f);
        else if (f.type === 'road') estrada(f);
        else if (f.type === 'tower') torre(f);
        else if (f.type === 'ruins') ruina(f);
        else if (f.type === 'phenomenon') fenomeno(f);
        else if (f.type === 'region') regiao(f);
        else if (f.type === 'biome') bioma(f);
    }
}

/* ---------- Rótulos (HTML sobre o canvas) ---------- */
const labelsEl = $('#labels');
const labels = new Map();
function anchor(f) {
    let x = f.x, z = f.z;
    if (LINHA.has(f.type) && f.points?.length) {
        const pts = rioPath(f), p = pts[Math.floor(pts.length / 2)];
        x = p[0]; z = p[1];
    } else if (POLIGONO.has(f.type) && f.points?.length) [x, z] = centroDe(f.points);
    const up = f.type === 'tower' ? f.size * 4.6 * (f.shape?.altura ?? 1) + 2.5
        : f.type === 'phenomenon' ? ((8 + f.size * 0.22) * (f.shape?.altura ?? 1) + 4) * (['nevoa', 'magia', 'terremoto'].includes(skinOf(f)) ? 0.45 : 1)
        : { mountain: 1.5, lake: 1, river: 1, forest: 3.5, city: 7, village: 3.5, ocean: 1, island: 2, road: 1, ruins: 4, region: 1.5, biome: 2 }[f.type];
    return new THREE.Vector3(x, heightAt(x, z) + up, z);
}
function labelHtml(f) {
    const n = f.npcs.length, s = f.shops.length;
    const i = f.loose_items.length + f.shops.reduce((a, x) => a + x.items.length, 0);
    const bits = [];
    if (n) bits.push(n + (n > 1 ? ' NPCs' : ' NPC'));
    if (s) bits.push(s + (s > 1 ? ' lojas' : ' loja'));
    if (i) bits.push(i + (i > 1 ? ' itens' : ' item'));
    if (f.secret) bits.push('secreto');
    return (f.name ? esc(f.name) : `<i>${esc(nomeDe(f))}</i>`) + (bits.length ? `<small>${bits.join(', ')}</small>` : '');
}
function syncLabels() {
    labelsEl.innerHTML = '';
    labels.clear();
    for (const f of features) {
        if ((f.shape?.semNome || !f.name || f.shape?.oculta) && f.id !== selectedId) continue;
        const a = anchor(f);
        if (!visivelAgora(a.x, a.z)) continue;
        const el = document.createElement('div');
        el.className = 'label ' + f.type + (f.id === selectedId ? ' sel' : '') + (f.secret ? ' secreto' : '');
        el.innerHTML = labelHtml(f);
        labelsEl.appendChild(el);
        labels.set(f.id, { el, pos: a, f, w: 0, h: 0 });
    }
    // tamanho de cada nome medido uma vez (para afastar os que se encostam)
    labels.forEach((l) => { l.w = l.el.offsetWidth; l.h = l.el.offsetHeight; });
    ordemRotulos = [...labels.values()];
}
// Quem escolhe lugar primeiro quando dois nomes se encostam
const PRIORIDADE_ROTULO = { city: 0, region: 1, biome: 2, ocean: 2, island: 3, mountain: 4, lake: 5, tower: 6, forest: 7, ruins: 8, village: 9, phenomenon: 10, river: 11, road: 12 };
let ordemRotulos = [];
function markSelectedLabel() {
    // Lugares sem nome (ou com o nome escondido) só mostram rótulo enquanto estão selecionados
    if (features.some((f) => f.shape?.semNome || !f.name || f.shape?.oculta)) { syncLabels(); return; }
    labels.forEach(({ el, f }) => el.classList.toggle('sel', f.id === selectedId));
}
const tmp = new THREE.Vector3();
function updateLabels() {
    const w = stage.clientWidth, h = stage.clientHeight;
    // selecionado primeiro, depois por importância e pelo que está mais perto da câmera
    const lista = [];
    for (const l of ordemRotulos) {
        tmp.copy(l.pos).project(camera);
        const far = l.f.type === 'village' && camera.position.distanceTo(l.pos) > 200 * Math.max(1, K * 0.8);
        if (tmp.z > 1 || Math.abs(tmp.x) > 1.1 || Math.abs(tmp.y) > 1.1 || far) { if (l.vis !== false) { l.el.style.display = 'none'; l.vis = false; } continue; }
        lista.push({ l, x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h, z: tmp.z });
    }
    lista.sort((a, b) => (b.l.f.id === selectedId) - (a.l.f.id === selectedId) || (PRIORIDADE_ROTULO[a.l.f.type] ?? 9) - (PRIORIDADE_ROTULO[b.l.f.type] ?? 9) || a.z - b.z);
    const ocupados = [];
    const livre = (x0, y0, x1, y1) => ocupados.every((o) => x1 <= o[0] || x0 >= o[2] || y1 <= o[1] || y0 >= o[3]);
    for (const it of lista) {
        const { l } = it, lw = l.w + 4, lh = l.h + 2;
        let pos = null;
        for (const [dx, dy] of [[0, 0], [0, lh * 0.9], [0, -lh * 0.9], [lw * 0.55, 0], [-lw * 0.55, 0], [0, lh * 1.8], [0, -lh * 1.8]]) {
            const x = it.x + dx, y = it.y + dy;
            if (livre(x - lw / 2, y - lh / 2, x + lw / 2, y + lh / 2)) { pos = [x, y]; break; }
        }
        // sem espaço: o selecionado aparece mesmo assim; os outros somem até haver lugar
        if (!pos && l.f.id === selectedId) pos = [it.x, it.y];
        if (!pos) { if (l.vis !== false) { l.el.style.display = 'none'; l.vis = false; } continue; }
        ocupados.push([pos[0] - lw / 2, pos[1] - lh / 2, pos[0] + lw / 2, pos[1] + lh / 2]);
        if (l.vis !== true) { l.el.style.display = ''; l.vis = true; }
        l.el.style.left = pos[0] + 'px';
        l.el.style.top = pos[1] + 'px';
    }
}

/* ---------- Seleção e rascunho de rio ---------- */
const selGroup = new THREE.Group();
scene.add(selGroup);
const selMat = new THREE.LineBasicMaterial({ color: 0x8a2d1c, depthTest: false });
const draftMat = new THREE.PointsMaterial({ color: 0x8a2d1c, size: 7, sizeAttenuation: false, depthTest: false });

function lift(x, z, dy = 0.7) { return new THREE.Vector3(x, heightAt(x, z) + dy, z); }
const RAIO = { mountain: 0.7, lake: 1.08, forest: 1.05, city: 1.1, village: 1.1, ocean: 1.02, island: 1.02, tower: 1.25, ruins: 1.05, phenomenon: 1 };

function updateSelection() {
    selGroup.clear();
    const f = sel();
    if (!f) return;
    let obj;
    if (LINHA.has(f.type)) {
        obj = new THREE.Line(new THREE.BufferGeometry().setFromPoints(rioPath(f).map((p) => lift(p[0], p[1]))), selMat);
    } else if (POLIGONO.has(f.type)) {
        obj = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(contornoDenso(f.points || [], 1).map((p) => lift(p[0], p[1], 0.8))), selMat);
    } else {
        const F = forma(f), r = f.size * RAIO[f.type], pts = [];
        for (let i = 0; i < 120; i++) {
            const a = (i / 120) * Math.PI * 2, b = r * borda(F, a);
            const [x, z] = paraMundo(f, Math.cos(a) * b, Math.sin(a) * b, F);
            pts.push(lift(x, z));
        }
        obj = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), selMat);
    }
    obj.renderOrder = 10;
    selGroup.add(obj);
    if (EDIT && tool === 'select' && !PONTOS.has(f.type) && !f.shape?.trancado) {
        const al = alcas(f);
        const pts = al.filter((a) => a.k !== 'giro' && f.type !== 'tower').map((a) => lift(a.x, a.z, 1));
        const g1 = new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts), alcaMat);
        const g2 = new THREE.Points(new THREE.BufferGeometry().setFromPoints([lift(al[4].x, al[4].z, 1)]), giroMat);
        const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([lift(al[3].x, al[3].z, 1), lift(al[4].x, al[4].z, 1)]), selMat);
        for (const o of [ln, g1, g2]) { o.renderOrder = 11; selGroup.add(o); }
    }
}
// Alças do lugar selecionado: quatro lados (esticar só para aquele lado) e uma de girar
function circuloTex(fundo, borda) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d');
    x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.fillStyle = fundo; x.fill();
    x.lineWidth = 7; x.strokeStyle = borda; x.stroke();
    return new THREE.CanvasTexture(cv);
}
const alcaMat = new THREE.PointsMaterial({ map: circuloTex('#f6ecd2', '#8a2d1c'), size: 15, sizeAttenuation: false, depthTest: false, transparent: true, alphaTest: 0.2 });
const giroMat = new THREE.PointsMaterial({ map: circuloTex('#8a2d1c', '#f6ecd2'), size: 15, sizeAttenuation: false, depthTest: false, transparent: true, alphaTest: 0.2 });
function alcas(f) {
    const F = forma(f), R = f.size * RAIO[f.type];
    const em = (u, v, k) => { const [x, z] = paraMundo(f, u, v, F); return { x, z, k }; };
    return [em(R, 0, 'u+'), em(-R, 0, 'u-'), em(0, R, 'v+'), em(0, -R, 'v-'), em(0, -R * 1.45 - 3, 'giro')];
}
function alcaEm(e) {
    const f = sel();
    if (!f || !EDIT || tool !== 'select' || PONTOS.has(f.type) || f.shape?.trancado) return null;
    const r = canvas.getBoundingClientRect();
    let melhor = null, dm = 13;
    for (const a of alcas(f)) {
        if (f.type === 'tower' && a.k !== 'giro') continue;
        const v = lift(a.x, a.z, 1).project(camera);
        const sx = (v.x * 0.5 + 0.5) * r.width + r.left, sy = (-v.y * 0.5 + 0.5) * r.height + r.top;
        const d = Math.hypot(sx - e.clientX, sy - e.clientY);
        if (d < dm) { dm = d; melhor = a; }
    }
    return melhor ? { f, k: melhor.k } : null;
}
// Recalcula centro, tamanho, proporção e giro enquanto a alça é puxada (o lado oposto fica parado)
function puxarAlca(al, p, fino) {
    const f = al.f, a0 = al.antes, F = forma({ ...f, ...a0 }), RA = RAIO[f.type];
    const sh = { ...(a0.shape || {}) };
    if (al.k === 'giro') {
        let g = (Math.atan2(p.x - a0.x, -(p.z - a0.z)) * 180) / Math.PI;
        if (!fino) g = Math.round(g / 15) * 15;
        sh.giro = Math.round(((g % 360) + 360) % 360);
        f.shape = sh;
        return;
    }
    const eixoU = al.k[0] === 'u', sg = al.k[1] === '+' ? 1 : -1;
    const dir = eixoU ? [F.c, F.s] : [-F.s, F.c];
    let A = RA * a0.size * F.sx, B = RA * a0.size * F.sz; // meias larguras visuais em u e v
    const meio = eixoU ? A : B, outro = eixoU ? B : A;
    const ex = a0.x - sg * meio * dir[0], ez = a0.z - sg * meio * dir[1]; // borda que fica parada
    const L = Math.max(2, sg * ((p.x - ex) * dir[0] + (p.z - ez) * dir[1]));
    let novo = L / 2;
    const maxTam = Math.max(60, HALF);
    // limites: proporção entre 0,1 e 10 e tamanho dentro do permitido
    novo = Math.min(novo, outro * 10, (maxTam * RA) ** 2 / outro);
    novo = Math.max(novo, outro / 10, RA * RA / outro);
    if (eixoU) A = novo; else B = novo;
    f.size = Math.round((Math.sqrt(A * B) / RA) * 100) / 100;
    const e = A / B;
    if (Math.abs(e - 1) < 0.02) delete sh.esticar; else sh.esticar = Math.round(e * 1000) / 1000;
    f.shape = Object.keys(sh).length ? sh : null;
    f.x = noMapa(ex + sg * novo * dir[0]); f.z = noMapa(ez + sg * novo * dir[1]);
}

const draftGroup = new THREE.Group();
scene.add(draftGroup);
function updateDraft() {
    draftGroup.clear();
    if (!riverDraft.length) return;
    const pts = riverDraft.map((p) => lift(p[0], p[1], 1));
    const dots = new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts), draftMat);
    dots.renderOrder = 11;
    draftGroup.add(dots);
    if (pts.length > 1) {
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), selMat);
        line.renderOrder = 11;
        draftGroup.add(line);
    }
}
function cancelDraft() { riverDraft = []; updateDraft(); }

/* ---------- Ferramentas e cliques ---------- */
const hintText = $('#hint-text');
const finishBtn = $('#finish-river');

function setTool(t) {
    if (t === 'move' && sel()?.shape?.trancado) { toast(`${nomeDe(sel())} está trancado. Destranque no painel ou no botão direito para mover.`); t = 'select'; }
    tool = t;
    document.querySelectorAll('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
    if (!DESENHO.has(t)) cancelDraft();
    hintText.textContent = EDIT ? HINTS[t] : VIEW_HINT;
    finishBtn.hidden = !DESENHO.has(t);
    finishBtn.textContent = t === 'redraw' ? 'Trocar o traçado' : t === 'road' ? 'Concluir estrada' : t === 'region' ? 'Fechar região' : t === 'biome' ? 'Fechar bioma' : 'Concluir rio';
    if (t === 'fog' && tab !== 'nevoa') { tab = 'nevoa'; renderPanel(); }
    canvas.style.cursor = t === 'select' ? 'grab' : 'crosshair';
    updateSelection();
}
document.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(terrain)[0];
    return hit ? { x: Math.round(hit.point.x * 100) / 100, z: Math.round(hit.point.z * 100) / 100 } : null;
}
function reach(f, x, z) {
    if (LINHA.has(f.type)) return riverDist(f, x, z) / (f.size * 1.8 + 1);
    if (f.type === 'region') return dentroPoligono(f.points || [], x, z) ? 0.7 : distPoligono(f, x, z) / (f.size * 2 + 2);
    if (f.type === 'biome') return dentroPoligono(f.points || [], x, z) ? 0.75 : distPoligono(f, x, z) / 3;
    return distN(f, x, z) / RAIO[f.type];
}

let down = null, ultimoDown = null, arrasto = null, pintando = null, arrastoT = 0, puxando = null, tentouTrancado = null;
const noMapa = (v) => Math.max(-HALF, Math.min(HALF, Math.round(v * 100) / 100));
canvas.addEventListener('pointerdown', (e) => {
    down = ultimoDown = { x: e.clientX, y: e.clientY };
    fecharMenu();
    if (!EDIT || e.button !== 0) return;
    const p = pick(e);
    if (!p) return;
    if (tool === 'fog') {
        pintando = { v: fogModo === 'revelar' ? 1 : 0, antes: clonar(world.fog), ultimo: null };
        controls.enabled = false;
        pincelar(p);
        return;
    }
    // Alças do selecionado: esticar para um lado ou girar
    const al = alcaEm(e);
    if (al) {
        puxando = { ...al, antes: { x: al.f.x, z: al.f.z, size: al.f.size, shape: clonar(al.f.shape ?? null) }, moveu: false };
        controls.enabled = false;
        return;
    }
    // Arrastar o lugar já selecionado leva ele junto
    const f = tool === 'select' ? lugarEm(p) : null;
    if (f && f.id === selectedId && f.shape?.trancado) { tentouTrancado = f; }
    else if (f && f.id === selectedId) {
        arrasto = { f, p0: p, x0: f.x, z0: f.z, pts0: f.points ? f.points.map((q) => [...q]) : null, moveu: false };
        controls.enabled = false;
        canvas.style.cursor = 'grabbing';
    }
});
canvas.addEventListener('pointermove', (e) => {
    if (pintando) { const p = pick(e); if (p) pincelar(p); return; }
    if (puxando) {
        const p = pick(e);
        if (!p) return;
        puxando.moveu = true;
        puxarAlca(puxando, p, e.shiftKey);
        const agora = performance.now();
        if (agora - arrastoT > 140) { arrastoT = agora; rebuildAll(); }
        else { syncLabels(); updateSelection(); }
        return;
    }
    if (!arrasto) {
        if (EDIT && !down) canvas.style.cursor = alcaEm(e) ? 'pointer' : '';
        return;
    }
    const p = pick(e);
    if (!p) return;
    const dx = p.x - arrasto.p0.x, dz = p.z - arrasto.p0.z;
    if (!arrasto.moveu && Math.hypot(dx, dz) < 0.6) return;
    arrasto.moveu = true;
    const f = arrasto.f;
    f.x = noMapa(arrasto.x0 + dx); f.z = noMapa(arrasto.z0 + dz);
    if (arrasto.pts0) f.points = arrasto.pts0.map(([x, z]) => [noMapa(x + dx), noMapa(z + dz)]);
    const agora = performance.now();
    if (agora - arrastoT > 140) { arrastoT = agora; rebuildAll(); }
    else { syncLabels(); updateSelection(); }
});
canvas.addEventListener('pointerup', async (e) => {
    if (pintando) {
        const pin = pintando; pintando = null;
        controls.enabled = true; down = null;
        await salvarNevoa(pin.antes, pin.v ? 'revelar área' : 'cobrir área');
        return;
    }
    if (puxando) {
        const a = puxando; puxando = null;
        controls.enabled = true; down = null;
        if (!a.moveu) return;
        const f = a.f, depois = { x: f.x, z: f.z, size: f.size, shape: clonar(f.shape ?? null) };
        rebuildAll();
        try {
            const u = await api('PUT', `${API}/features/${f.id}`, depois);
            replaceFeature(u, { rebuild: false });
            registrarMudanca(f.id, a.antes, depois, (a.k === 'giro' ? 'girar ' : 'esticar ') + nomeDe(f));
        } catch { Object.assign(f, a.antes); rebuildAll(); }
        return;
    }
    if (arrasto) {
        const a = arrasto; arrasto = null;
        controls.enabled = true; canvas.style.cursor = 'grab';
        if (a.moveu) {
            down = null;
            const f = a.f, depois = { x: f.x, z: f.z }, antes = { x: a.x0, z: a.z0 };
            if (a.pts0) { depois.points = f.points; antes.points = a.pts0; }
            rebuildAll();
            try {
                const u = await api('PUT', `${API}/features/${f.id}`, depois);
                replaceFeature(u, { rebuild: false });
                registrarMudanca(f.id, antes, depois, 'mover ' + nomeDe(f));
            } catch { Object.assign(f, antes); rebuildAll(); }
            return;
        }
    }
    if (tentouTrancado) {
        const tt = tentouTrancado; tentouTrancado = null;
        if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) toast(`🔒 ${nomeDe(tt)} está trancado (a câmera girou no lugar dele).`);
    }
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 5 || e.button !== 0) return;
    const p = pick(e);
    if (p) onMapClick(p);
});
// Botão direito sem arrastar (arrastar com ele move a câmera) abre o menu do lugar
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (ultimoDown && Math.hypot(e.clientX - ultimoDown.x, e.clientY - ultimoDown.y) > 5) return;
    const p = pick(e);
    if (p) abrirMenu(p, e);
});

// Lugar sob o ponto do mapa (cidades e vilas ganham dos lugares grandes em volta; oceanos perdem)
function lugarEm(p) {
    let best = null, bestScore = 1;
    for (const f of features) {
        const rc = reach(f, p.x, p.z);
        const s = rc - (f.type === 'city' || f.type === 'village' || f.type === 'ruins' ? 0.35 : 0) - (f.type === 'tower' ? 0.6 : 0) + (f.type === 'ocean' ? 0.5 : 0) + (f.type === 'phenomenon' ? 0.4 : 0) + (f.type === 'region' ? (f.shape?.oculta ? 0.75 : 0.45) : 0) + (f.type === 'biome' ? 0.55 : 0);
        if (rc <= 1 && s < bestScore) { best = f; bestScore = s; }
    }
    return best;
}

function onMapClick(p) {
    if (tool === 'select' || !EDIT) {
        select(lugarEm(p)?.id ?? null);
    } else if (tool === 'fog') {
        // a pintura acontece no pointerdown/pointermove
    } else if (DESENHO.has(tool)) {
        riverDraft.push([p.x, p.z]);
        updateDraft();
    } else if (tool === 'move') {
        moveSelected(p);
    } else {
        criarOuAumentar(tool, p.x, p.z);
    }
}

// Clicar de novo dentro de um lugar do mesmo tipo aumenta esse lugar em vez de empilhar outro
let criando = null;
async function criarOuAumentar(type, x, z) {
    if (criando) { try { await criando; } catch { /* aviso já mostrado */ } }
    let alvo = null, menor = 0.8;
    for (const f of features) {
        if (f.type !== type) continue;
        const d = distN(f, x, z);
        if (d < menor) { alvo = f; menor = d; }
    }
    if (alvo) return aumentar(alvo, 1.25, true);
    criando = createFeature(type, x, z);
    try { await criando; } finally { criando = null; }
}
async function aumentar(f, k, avisar = false) {
    const [min, , , step] = TYPES[f.type].size, max = tamanhoMax(f.type);
    const novo = Math.min(max, Math.max(min, Math.round((f.size * k) / step) * step));
    if (Math.abs(novo - f.size) < step / 2) {
        toast(k > 1 ? `${TYPES[f.type].label} já está no tamanho máximo deste mapa.` : `${TYPES[f.type].label} já está no tamanho mínimo.`);
        return;
    }
    const u = await atualizarLugar(f, { size: Number(novo.toFixed(2)) }, { rotulo: (k > 1 ? 'aumentar ' : 'diminuir ') + nomeDe(f) });
    select(u.id);
    if (avisar) toast(`${nomeDe(u)} ficou maior. Para criar outro, clique fora dele.`);
}

async function excluirLugar(f) {
    const filhos = f.npcs.length + f.shops.length + f.loose_items.length;
    if (filhos && !confirm(`Excluir "${nomeDe(f)}" com ${filhos} ${filhos === 1 ? 'NPC, loja ou item' : 'NPCs, lojas e itens'}?`)) return;
    const r = await api('DELETE', `${API}/features/${f.id}`);
    const copia = r.restaurar, id0 = f.id;
    tirarLugar(f.id);
    toast(`${nomeDe(f)} foi excluído. Ctrl+Z desfaz.`);
    registrar({
        rotulo: 'excluir ' + nomeDe(f),
        desfazer: async () => { await recriarLugar(copia, rid(id0)); },
        refazer: async () => { const g = lugarPorId(id0); if (g) { await api('DELETE', `${API}/features/${g.id}`); tirarLugar(g.id); } },
    });
}
function tirarLugar(id) {
    features = features.filter((x) => x.id !== id);
    if (selectedId === id) { selectedId = null; tab = 'mundo'; }
    rebuildAll();
    renderPanel();
}
async function recriarLugar(copia, idAtual) {
    const n = await api('POST', `${API}/worlds/${WORLD}/features/restaurar`, { feature: copia });
    if (idAtual != null) remap.set(idAtual, n.id);
    features.push(n);
    rebuildAll();
    select(n.id);
    return n;
}
// Criar um lugar entra no histórico: desfazer apaga (guardando a cópia), refazer recria
function registrarCriacao(f) {
    const id0 = f.id;
    let copia = null;
    registrar({
        rotulo: 'criar ' + nomeDe(f),
        desfazer: async () => { const g = lugarPorId(id0); if (!g) return; copia = (await api('DELETE', `${API}/features/${g.id}`)).restaurar; tirarLugar(g.id); },
        refazer: async () => { if (copia) await recriarLugar(copia, rid(id0)); },
    });
}

async function duplicarLugar(f) {
    const desl = Math.max(4, PONTOS.has(f.type) ? 6 : f.size * 1.6);
    const cl = (v) => Math.max(-HALF, Math.min(HALF, Math.round(v * 100) / 100));
    const extra = { skin: f.skin, color: f.color, shape: f.shape, secret: f.secret, size: f.size, description: f.description };
    if (PONTOS.has(f.type)) extra.points = f.points.map(([x, z]) => [cl(x + desl), cl(z + desl)]);
    const novo = await api('POST', `${API}/worlds/${WORLD}/features`, { type: f.type, name: f.name ? f.name + ' (cópia)' : '', x: cl(f.x + desl), z: cl(f.z + desl), ...extra });
    features.push(novo);
    rebuildAll();
    select(novo.id);
    registrarCriacao(novo);
}

/* ---------- Menu do botão direito ---------- */
const menuEl = document.createElement('div');
menuEl.className = 'ctx-menu';
menuEl.setAttribute('role', 'menu');
menuEl.hidden = true;
stage.appendChild(menuEl);
let menuAlvo = null;

function abrirMenu(p, e, forcado = null) {
    const f = forcado || lugarEm(p);
    if (!f) { fecharMenu(); return; }
    if (!EDIT) { select(f.id); return; }
    menuAlvo = f;
    const T = TYPES[f.type], rio = LINHA.has(f.type), tranc = !!f.shape?.trancado;
    const itens = [
        ['abrir', 'Abrir e editar'],
        ['renomear', 'Renomear…'],
        ['maior', rio ? 'Mais largo' : 'Aumentar'],
        ['menor', rio ? 'Mais estreito' : 'Diminuir'],
        ...(tranc ? [] : [['mover', 'Mover']]),
        ...(rio || POLIGONO.has(f.type) ? [['curso', POLIGONO.has(f.type) ? 'Redesenhar o contorno' : 'Redesenhar o traçado']] : []),
        ...(f.type === 'region' ? [['ocultar', f.shape?.oculta ? 'Mostrar região' : 'Ocultar região']] : []),
        ['trancar', tranc ? '🔓 Destrancar' : '🔒 Trancar (não mover sem querer)'],
        ['modelos', 'Trocar modelo ▸'],
        ...trocasDe(f.type).filter((t) => t !== f.type).map((t) => ['tipo:' + t, 'Transformar em ' + TYPES[t].label.toLowerCase()]),
        ['duplicar', 'Duplicar ao lado'],
        ['segredo', f.secret ? 'Mostrar aos jogadores' : 'Tornar secreto'],
        ['-'],
        ['excluir', `Excluir ${T.label.toLowerCase()}`],
    ];
    menuEl.innerHTML = `<p class="ctx-titulo"><span>${esc(T.label)}</span>${esc(nomeDe(f))}</p>` + itens.map(([k, l]) => k === '-'
        ? '<hr>'
        : `<button type="button" role="menuitem" data-m="${k}"${k === 'excluir' ? ' class="perigo"' : ''}>${l}</button>`).join('');
    menuEl.hidden = false;
    const r = stage.getBoundingClientRect(), w = menuEl.offsetWidth, h = menuEl.offsetHeight;
    menuEl.style.left = Math.min(e.clientX - r.left, r.width - w - 8) + 'px';
    menuEl.style.top = Math.min(e.clientY - r.top, r.height - h - 8) + 'px';
    select(f.id);
    menuEl.querySelector('button').focus();
}
function fecharMenu() { menuEl.hidden = true; menuAlvo = null; }

menuEl.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-m]');
    if (!b || !menuAlvo) return;
    const f = features.find((x) => x.id === menuAlvo.id);
    if (!f) { fecharMenu(); return; }
    const m = b.dataset.m;
    if (m === 'modelos') {
        // segunda tela do menu: os modelos do tipo, com a cor de cada um
        menuEl.innerHTML = `<p class="ctx-titulo"><span>Modelo</span>${esc(nomeDe(f))}</p>`
            + Object.entries(SKINS[f.type]).map(([k, l]) => `<button type="button" role="menuitem" data-m="skin:${k}" class="${skinOf(f) === k ? 'atual' : ''}"><i class="bolinha" style="background:${corDaSkin(f, k)}"></i>${esc(l)}</button>`).join('')
            + '<hr><button type="button" role="menuitem" data-m="voltar">← Voltar</button>';
        menuEl.querySelector('button').focus();
        return;
    }
    if (m === 'voltar') { const r = menuEl.getBoundingClientRect(), s = stage.getBoundingClientRect(); abrirMenu({ x: f.x, z: f.z }, { clientX: r.left, clientY: r.top }, f); return; }
    fecharMenu();
    if (m.startsWith('skin:')) { await atualizarLugar(f, { skin: m.slice(5) }, { rotulo: 'modelo de ' + nomeDe(f) }); return; }
    if (m.startsWith('tipo:')) { await atualizarLugar(f, { type: m.slice(5) }, { rotulo: 'tipo de ' + nomeDe(f) }); toast(`${nomeDe(f)} agora é ${TYPES[m.slice(5)].label.toLowerCase()}.`); return; }
    switch (m) {
        case 'abrir': tab = 'lugar'; select(f.id); break;
        case 'renomear': {
            const nome = prompt('Novo nome (deixe vazio para ficar sem nome):', f.name);
            if (nome !== null && nome.trim() !== f.name) await atualizarLugar(f, { name: nome.trim().slice(0, 80) }, { rebuild: false, rotulo: 'renomear ' + nomeDe(f) });
            break;
        }
        case 'maior': await aumentar(f, 1.25); break;
        case 'menor': await aumentar(f, 0.8); break;
        case 'mover': select(f.id); setTool('move'); break;
        case 'curso': select(f.id); setTool('redraw'); break;
        case 'duplicar': await duplicarLugar(f); break;
        case 'segredo': await atualizarLugar(f, { secret: !f.secret }, { rebuild: false, rotulo: 'segredo de ' + nomeDe(f) }); break;
        case 'trancar': await alternarShape(f, 'trancado'); break;
        case 'ocultar': await alternarShape(f, 'oculta'); break;
        case 'excluir': await excluirLugar(f); break;
    }
});
menuEl.addEventListener('keydown', (e) => {
    const bs = [...menuEl.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
    if (e.key === 'Escape') { fecharMenu(); canvas.focus(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
});
document.addEventListener('pointerdown', (e) => { if (!menuEl.hidden && !menuEl.contains(e.target) && e.target !== canvas) fecharMenu(); });
canvas.addEventListener('wheel', fecharMenu, { passive: true });

async function createFeature(type, x, z, extra = {}) {
    const t = TYPES[type];
    const size = type === 'ocean' ? Math.round(HALF * 0.45) : t.size[2];
    const f = await api('POST', `${API}/worlds/${WORLD}/features`, { type, name: '', x, z, size, ...extra });
    features.push(f);
    rebuildAll();
    select(f.id);
    registrarCriacao(f);
}
async function finishRiver() {
    if (!DESENHO.has(tool)) return;
    const poligono = POLIGONO.has(tool) || (tool === 'redraw' && POLIGONO.has(sel()?.type));
    if (riverDraft.length < (poligono ? 3 : 2)) { toast(poligono ? 'Marque pelo menos três cantos no mapa.' : 'Marque pelo menos dois pontos no mapa.'); return; }
    const pts = riverDraft;
    const [cx, cz] = poligono ? centroDe(pts) : pts[0];
    cancelDraft();
    if (tool === 'redraw') {
        const f = sel();
        setTool('select');
        if (f) await atualizarLugar(f, { points: pts, x: Math.round(cx * 100) / 100, z: Math.round(cz * 100) / 100 }, { rotulo: 'traçado de ' + nomeDe(f) });
        return;
    }
    await createFeature(tool, Math.round(cx * 100) / 100, Math.round(cz * 100) / 100, { points: pts });
}
// Liga/desliga uma opção do formato (trancado, oculta...) guardando no Ctrl+Z
async function alternarShape(f, chave) {
    const shape = { ...(f.shape || {}) };
    if (shape[chave]) delete shape[chave]; else shape[chave] = 1;
    await atualizarLugar(f, { shape: Object.keys(shape).length ? shape : null }, { rotulo: ({ trancado: shape[chave] ? 'trancar ' : 'destrancar ', oculta: shape[chave] ? 'ocultar ' : 'mostrar ' }[chave] || '') + nomeDe(f) });
    toast(chave === 'trancado' ? (shape[chave] ? `${nomeDe(f)} está trancado: não sai do lugar ao arrastar.` : `${nomeDe(f)} foi destrancado.`)
        : (shape[chave] ? `${nomeDe(f)} está oculta: só aparece quando selecionada no editor.` : `${nomeDe(f)} está visível de novo.`));
}
async function moveSelected(p) {
    const f = sel();
    setTool('select');
    if (!f) return;
    const clamp = (v) => Math.max(-HALF, Math.min(HALF, Math.round(v * 100) / 100));
    const body = { x: p.x, z: p.z };
    if (PONTOS.has(f.type)) {
        const dx = p.x - f.x, dz = p.z - f.z;
        body.points = f.points.map(([x, z]) => [clamp(x + dx), clamp(z + dz)]);
        if (LINHA.has(f.type)) { body.x = body.points[0][0]; body.z = body.points[0][1]; }
    }
    await atualizarLugar(f, body, { rotulo: 'mover ' + nomeDe(f) });
}
finishBtn.addEventListener('click', finishRiver);
document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select') || e.target.isContentEditable) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (EDIT && mod && k === 'z' && !e.shiftKey) { e.preventDefault(); desfazer(); return; }
    if (EDIT && mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); refazer(); return; }
    if (EDIT && (e.key === 'Delete' || e.key === 'Backspace') && sel() && !arrasto) {
        e.preventDefault();
        if (sel().shape?.trancado && !confirm(`${nomeDe(sel())} está trancado. Excluir mesmo assim?`)) return;
        excluirLugar(sel());
        return;
    }
    if (e.key === 'Escape') { fecharMenu(); setTool('select'); }
    if (e.key === 'Enter') finishRiver();
});

/* ---------- Histórico: Ctrl+Z desfaz, Ctrl+Y (ou Ctrl+Shift+Z) refaz ---------- */
const historico = [], refeitos = [];
const remap = new Map(); // id de um lugar apagado -> id dele recriado pelo Desfazer
const rid = (id) => { let i = id, n = 0; while (remap.has(i) && n++ < 100) i = remap.get(i); return i; };
const lugarPorId = (id) => features.find((x) => x.id === rid(id)) || null;
const clonar = (o) => JSON.parse(JSON.stringify(o ?? null));
let noHistorico = false;
function registrar(acao) {
    if (noHistorico) return;
    historico.push(acao);
    if (historico.length > 100) historico.shift();
    refeitos.length = 0;
    botoesHistorico();
}
function registrarMudanca(id, antes, depois, rotulo) {
    antes = clonar(antes); depois = clonar(depois);
    const aplicar = async (corpo) => { const g = lugarPorId(id); if (g) replaceFeature(await api('PUT', `${API}/features/${g.id}`, corpo), { rebuild: true }); };
    registrar({ rotulo, desfazer: () => aplicar(antes), refazer: () => aplicar(depois) });
}
// PUT de um lugar guardando como era antes (entra no Ctrl+Z)
async function atualizarLugar(f, corpo, { rebuild = true, render = true, rotulo } = {}) {
    const antes = {};
    for (const k of Object.keys(corpo)) antes[k] = clonar(f[k] ?? null);
    const u = await api('PUT', `${API}/features/${f.id}`, corpo);
    replaceFeature(u, { rebuild, render });
    registrarMudanca(f.id, antes, corpo, rotulo || 'mudança em ' + nomeDe(u));
    return u;
}
async function desfazer() {
    const a = historico.pop();
    if (!a) { toast('Nada para desfazer.'); return; }
    noHistorico = true;
    try { await a.desfazer(); refeitos.push(a); toast('Desfeito: ' + a.rotulo); }
    catch { historico.push(a); }
    finally { noHistorico = false; botoesHistorico(); }
}
async function refazer() {
    const a = refeitos.pop();
    if (!a) { toast('Nada para refazer.'); return; }
    noHistorico = true;
    try { await a.refazer(); historico.push(a); toast('Refeito: ' + a.rotulo); }
    catch { refeitos.push(a); }
    finally { noHistorico = false; botoesHistorico(); }
}
function botoesHistorico() {
    const d = $('#btn-desfazer'), r = $('#btn-refazer');
    if (d) { d.disabled = !historico.length; d.title = historico.length ? 'Desfazer: ' + historico[historico.length - 1].rotulo + ' (Ctrl+Z)' : 'Nada para desfazer'; }
    if (r) { r.disabled = !refeitos.length; r.title = refeitos.length ? 'Refazer: ' + refeitos[refeitos.length - 1].rotulo + ' (Ctrl+Y)' : 'Nada para refazer'; }
}
$('#btn-desfazer')?.addEventListener('click', desfazer);
$('#btn-refazer')?.addEventListener('click', refazer);

/* ---------- Névoa de guerra ---------- */
let fogModo = 'revelar', fogRaio = 12, previaJogador = false;
const fogCanvas = document.createElement('canvas');
fogCanvas.width = fogCanvas.height = 512;
const fogTex = new THREE.CanvasTexture(fogCanvas);
fogTex.flipY = false;
uniforms.uFog.value = fogTex;
const nevoaAtiva = () => !!world?.fog?.ativo;
// Ponto visível para quem joga (mesma regra do servidor: a última pincelada que cobre o ponto vence)
let gradeNevoa = null; // 256x256, refeita quando a névoa muda
function montarGradeNevoa() {
    const N = 256, g = new Uint8Array(N * N), k = N / SIZE;
    for (const [ax, az, r, v] of world.fog.areas) {
        const cx = (ax + HALF) * k, cz = (az + HALF) * k, rr = r * k;
        const i0 = Math.max(0, Math.floor(cx - rr)), i1 = Math.min(N - 1, Math.ceil(cx + rr)), j0 = Math.max(0, Math.floor(cz - rr)), j1 = Math.min(N - 1, Math.ceil(cz + rr));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if ((i + 0.5 - cx) ** 2 + (j + 0.5 - cz) ** 2 <= rr * rr) g[j * N + i] = v ? 1 : 0;
    }
    return { N, g, k };
}
function pontoVisivel(x, z) {
    if (!nevoaAtiva()) return true;
    if (!gradeNevoa) gradeNevoa = montarGradeNevoa();
    const { N, g, k } = gradeNevoa;
    const i = Math.max(0, Math.min(N - 1, Math.floor((x + HALF) * k))), j = Math.max(0, Math.min(N - 1, Math.floor((z + HALF) * k)));
    return g[j * N + i] === 1;
}
// O que esconder agora: para jogadores sempre; para quem edita só na prévia
const visivelAgora = (x, z) => (PODE && !previaJogador) ? true : pontoVisivel(x, z);
function desenharNevoa() {
    gradeNevoa = null;
    const ctx = fogCanvas.getContext('2d'), S = 512;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
    for (const [x, z, r, v] of world?.fog?.areas || []) {
        const cx = ((x + HALF) / SIZE) * S, cy = ((z + HALF) / SIZE) * S, rr = Math.max(1, (r / SIZE) * S);
        const g = ctx.createRadialGradient(cx, cy, rr * 0.7, cx, cy, rr);
        const cor = v ? '255,255,255' : '0,0,0';
        g.addColorStop(0, `rgba(${cor},1)`); g.addColorStop(1, `rgba(${cor},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
    }
    fogTex.needsUpdate = true;
    uniforms.uFogOn.value = nevoaAtiva() ? 1 : 0;
    uniforms.uFogAlpha.value = PODE && !previaJogador ? 0.5 : 1;
}
function pincelar(p) {
    const u = pintando.ultimo;
    if (u && Math.hypot(p.x - u.x, p.z - u.z) < fogRaio * 0.35) return;
    pintando.ultimo = p;
    if (!world.fog.ativo) world.fog.ativo = true;
    world.fog.areas.push([Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100, fogRaio, pintando.v]);
    if (world.fog.areas.length > 1400) world.fog.areas.splice(0, world.fog.areas.length - 1400);
    desenharNevoa();
}
async function salvarNevoa(antes, rotulo) {
    const depois = clonar(world.fog);
    const enviar = async (fog) => {
        world.fog = (await api('PUT', `${API}/worlds/${WORLD}/fog`, fog)).fog;
        desenharNevoa();
        if (previaJogador) rebuildAll();
        if (tab === 'nevoa') renderPanel();
    };
    try { await enviar(depois); registrar({ rotulo: rotulo || 'névoa', desfazer: () => enviar(antes), refazer: () => enviar(depois) }); }
    catch { world.fog = antes; desenharNevoa(); }
}

const TERRENO = new Set(['mountain', 'island', 'ocean', 'lake', 'river', 'biome']);
function rebuildAll() {
    const chave = JSON.stringify([SIZE, theme.fundo, theme.cores, theme.skins,
        features.filter((f) => TERRENO.has(f.type)).map((f) => [f.id, f.type, f.x, f.z, f.size, f.skin, f.color, f.shape, f.points])]);
    if (chave !== chaveTerreno || !terrain) {
        prepare();
        buildTerrain();
        chaveTerreno = chave;
    }
    buildProps();
    syncLabels();
    updateSelection();
}
function select(id) {
    selectedId = id;
    if (id) tab = 'lugar';
    else if (tab === 'lugar') tab = 'mundo';
    updateSelection();
    markSelectedLabel();
    renderPanel();
}
function replaceFeature(f, { rebuild = false, render = true } = {}) {
    features = features.map((x) => (x.id === f.id ? f : x));
    if (rebuild) rebuildAll(); else { syncLabels(); updateSelection(); }
    markSelectedLabel();
    if (render) renderPanel();
}
function focusFeature(f) {
    const a = anchor(f), off = camera.position.clone().sub(controls.target);
    const dist = Math.min(off.length(), 110);
    off.setLength(dist);
    controls.target.copy(a);
    camera.position.copy(a).add(off);
}

/* ---------- Painel lateral ---------- */
const panel = $('#panel');

const ehDono = () => world?.papel === 'dono';
function tabsHtml() {
    const abas = [];
    if (sel()) abas.push(['lugar', 'Lugar']);
    abas.push(['mundo', 'Mundo']);
    if (EDIT) abas.push(['aparencia', 'Aparência'], ['nevoa', 'Névoa']);
    if (EDIT && ehDono()) abas.push(['compartilhar', 'Compartilhar']);
    return `<nav class="tabs" role="tablist">${abas.map(([k, l]) =>
        `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</nav>`;
}

function renderPanel() {
    if (tab === 'lugar' && !sel()) tab = 'mundo';
    if (!EDIT && ['aparencia', 'compartilhar', 'nevoa'].includes(tab)) tab = 'mundo';
    if (tab === 'compartilhar' && !ehDono()) tab = 'mundo';
    const scroll = panel.scrollTop;
    const corpo = tab === 'lugar' ? (EDIT ? lugarEditor(sel()) : lugarLeitura(sel()))
        : tab === 'aparencia' ? aparenciaHtml()
        : tab === 'compartilhar' ? compartilharHtml()
        : tab === 'nevoa' ? nevoaHtml()
        : mundoHtml();
    panel.innerHTML = tabsHtml() + `<div class="tab-body">${corpo}</div>`;
    panel.scrollTop = scroll;
}

function nevoaHtml() {
    const fog = world.fog, n = fog.areas.length;
    return `<h3>Névoa de guerra</h3>
        <label class="wb-check"><input type="checkbox" data-fog-ativo ${fog.ativo ? 'checked' : ''}> Usar névoa: jogadores só veem o que você revelar</label>
        <p class="mut nota">Com a névoa ligada, jogadores convidados (e o público, se o mapa for público) não recebem os lugares que estão cobertos. Você e os mestres convidados veem tudo, com a névoa meio transparente por cima.</p>
        <h3>Pincel</h3>
        <div class="chips" role="radiogroup">
            <label class="chip ${fogModo === 'revelar' ? 'on' : ''}"><input type="radio" name="fogmodo" value="revelar" data-fog-modo ${fogModo === 'revelar' ? 'checked' : ''}>Revelar</label>
            <label class="chip ${fogModo === 'cobrir' ? 'on' : ''}"><input type="radio" name="fogmodo" value="cobrir" data-fog-modo ${fogModo === 'cobrir' ? 'checked' : ''}>Cobrir de novo</label>
        </div>
        <label>Tamanho do pincel
            <span class="range"><input type="range" data-fog-raio min="2" max="${Math.round(HALF * 0.5)}" step="1" value="${fogRaio}"><output>${fogRaio}</output></span>
        </label>
        <div class="linha">
            <button type="button" class="${tool === 'fog' ? '' : 'primary'}" data-act="fog-pintar">${tool === 'fog' ? 'Parar de pintar' : 'Pintar no mapa'}</button>
            ${sel() ? '<button type="button" data-act="fog-lugar">Revelar o lugar selecionado</button>' : ''}
        </div>
        <div class="linha">
            <button type="button" data-act="fog-tudo">Revelar tudo</button>
            <button type="button" data-act="fog-nada">Cobrir tudo</button>
        </div>
        <label class="wb-check"><input type="checkbox" data-fog-previa ${previaJogador ? 'checked' : ''}> Prévia: ver como os jogadores veem</label>
        <p class="mut nota">${n} ${n === 1 ? 'pincelada' : 'pinceladas'}. Ctrl+Z desfaz a última.</p>`;
}

function listaLugares() {
    const grupos = Object.keys(TYPES).map((t) => {
        const fs = features.filter((f) => f.type === t);
        if (!fs.length) return '';
        return `<h3>${PLURAL[t]} <small>${fs.length}</small></h3><ul class="list lugares">${fs.map((f) =>
            `<li><button type="button" class="link" data-act="ir" data-id="${f.id}">${esc(nomeDe(f))}</button>${f.secret ? '<span class="mut">secreto</span>' : ''}</li>`).join('')}</ul>`;
    }).join('');
    return grupos || '<p class="mut">Nenhum lugar no mapa ainda.</p>';
}

function mundoHtml() {
    const n = features.length;
    if (!EDIT) {
        return `<div class="help">
            <h2>${esc(world.name)}</h2>
            ${world.owner ? `<p class="mut">Mundo de ${esc(world.owner)}</p>` : ''}
            ${world.description ? `<p>${esc(world.description)}</p>` : ''}
            <p class="mut">${n} ${n === 1 ? 'lugar' : 'lugares'} no mapa. Clique num lugar ou escolha abaixo.</p>
        </div>${listaLugares()}`;
    }
    return `<div class="head">
            <label>Nome do mundo <input data-world="name" value="${esc(world.name)}" maxlength="80"></label>
            <label>Descrição <textarea data-world="description" rows="3" maxlength="1000" placeholder="Como é esse mundo?">${esc(world.description)}</textarea></label>
            ${tamanhoMapaHtml()}
        </div>
        <div class="acoes-mundo">
            <button type="button" class="primary" data-act="salvar">Salvar agora</button>
            <button type="button" data-act="imagem">Mapa ilustrado</button>
            ${ehDono() ? `<a class="btn" href="${URLS.exportar}">Exportar arquivo</a>
            <form method="POST" action="${URLS.copiar}"><input type="hidden" name="_token" value="${CSRF}"><button type="submit">Duplicar</button></form>` : ''}
            <a class="btn" href="${URLS.ver}" target="_blank" rel="noopener">Ver como jogador</a>
        </div>
        <p class="mut nota">Tudo o que você muda no mapa é salvo na hora. "Salvar agora" também atualiza a capa do mundo; o arquivo exportado pode ser importado de volta em Meus mundos.</p>
        ${world.papel === 'mestre' ? '<p class="aviso-claro">Você é mestre convidado neste mundo: pode editar o mapa e a névoa. Tamanho, visibilidade e jogadores ficam com o dono.</p>' : ''}
        <div class="help"><p>Escolha uma ferramenta à esquerda e clique no mapa. Com Selecionar, clique num lugar para editar e arraste o lugar selecionado para movê-lo. Botão direito abre o menu rápido. <strong>Ctrl+Z</strong> desfaz, <strong>Ctrl+Y</strong> refaz e <strong>Delete</strong> apaga o lugar selecionado.</p></div>
        ${listaLugares()}`;
}

let dimPersonalizada = false;
function tamanhoMapaHtml() {
    const pl = world.plano;
    if (!pl) return '';
    const preset = Object.prototype.hasOwnProperty.call(pl.dimensoes, String(world.dimension));
    const livre = dimPersonalizada || !preset;
    const opts = Object.entries(pl.dimensoes).map(([d, nome]) => {
        const bloq = Number(d) > pl.dimensao_max;
        return `<option value="${d}" ${!livre && Number(d) === world.dimension ? 'selected' : ''}>${esc(nome)} (${d} × ${d})${bloq ? ' · plano Cartógrafo' : ''}</option>`;
    }).join('');
    return `<label>Tamanho do mapa <select data-dimensao>${opts}<option value="livre" ${livre ? 'selected' : ''}>Personalizado…</option></select></label>
        ${livre ? `<div class="dim-livre"><input type="number" data-dim-num min="${pl.dimensao_min}" max="1000" step="2" value="${world.dimension}" aria-label="Lado do mapa"><span>× mesmo valor</span><button type="button" data-act="dim-aplicar">Aplicar</button></div>
            <p class="mut nota">De ${pl.dimensao_min} a ${pl.dimensao_max} de lado no seu plano${pl.pago ? '' : ' (o plano Cartógrafo vai até 1000)'}.</p>` : ''}
        ${pl.pago ? '' : `<p class="mut nota">No plano grátis o mapa vai até ${pl.dimensao_max} × ${pl.dimensao_max}. <button type="button" class="link" data-act="planos">Ver planos</button></p>`}`;
}
async function mudarDimensao(d) {
    try {
        world = (await api('PUT', `${API}/worlds/${WORLD}`, { dimension: d })).world;
        dimPersonalizada = false;
        setDimensao(world.dimension);
        camera.position.set(0, 120 * K, 150 * K);
        controls.target.set(0, 0, 0);
        applyTheme();
        desenharNevoa();
        rebuildAll();
        toast('Mapa agora tem ' + world.dimension + ' × ' + world.dimension + '.');
    } catch { /* aviso já mostrado */ }
    renderPanel();
}

function formaHtml(f) {
    const s = f.shape || {}, F = forma(f);
    const faixa = (k, rot, min, max, step, val, fmt = (v) => v) => `<label>${rot}
        <span class="range"><input type="range" data-shape="${k}" min="${min}" max="${max}" step="${step}" value="${val}"><output>${fmt(val)}</output></span></label>`;
    if (f.type === 'biome') {
        return `<h3>Formato</h3>
            ${faixa('elevacao', 'Altura do chão (afundar ↔ elevar)', -10, 20, 0.5, s.elevacao ?? 0)}
            ${faixa('ondulacao', 'Ondulação (dunas, montes, rachaduras)', 0, 3, 0.05, s.ondulacao ?? 1)}
            ${faixa('densidade', 'Quantidade de enfeites (cactos, pedras, juncos...)', 0, 3, 0.05, s.densidade ?? 1)}
            <div class="linha"><button type="button" data-act="redesenhar">Redesenhar o contorno</button></div>`;
    }
    if (f.type === 'region') {
        return `<h3>Formato</h3>
            <label class="wb-check"><input type="checkbox" data-shape="oculta" ${s.oculta ? 'checked' : ''}> Ocultar região (só aparece quando selecionada no editor; jogadores e público não a veem)</label>
            <div class="linha"><button type="button" data-act="redesenhar">Redesenhar o contorno</button></div>`;
    }
    if (LINHA.has(f.type)) {
        return `<h3>Formato</h3>
            ${faixa('curvas', f.type === 'road' ? 'Curvas' : 'Curvas (meandros)', 0, 1, 0.05, s.curvas ?? 0)}
            <div class="linha"><button type="button" data-act="redesenhar">Redesenhar o traçado</button>
            ${f.shape ? '<button type="button" class="link" data-act="forma-padrao">Voltar ao formato padrão</button>' : ''}</div>`;
    }
    const extra = (['mountain', 'island', 'tower', 'phenomenon'].includes(f.type) ? faixa('altura', f.type === 'phenomenon' ? 'Altura das nuvens e da névoa' : 'Altura', 0.2, 3, 0.05, s.altura ?? 1) : '')
        + (['forest', 'city', 'village', 'ruins', 'phenomenon'].includes(f.type) ? faixa('densidade', { forest: 'Densidade das árvores', ruins: 'Quantidade de destroços', phenomenon: 'Intensidade' }[f.type] || 'Quantidade de casas', 0.2, 3, 0.05, s.densidade ?? 1) : '');
    return `<h3>Formato</h3>
        ${extra}
        ${faixa('esticar', 'Proporção (largo ↔ comprido)', 0.2, 5, 0.05, s.esticar ?? 1)}
        ${faixa('giro', 'Direção (graus)', 0, 360, 5, s.giro ?? 0)}
        ${faixa('irregular', 'Contorno irregular', 0, 1, 0.05, Math.round(F.irr * 100) / 100)}
        ${f.shape ? '<p><button type="button" class="link" data-act="forma-padrao">Voltar ao formato padrão</button></p>' : ''}`;
}

function chips(nome, opcoes, atual, attrs = '') {
    return `<div class="chips" role="radiogroup">${Object.entries(opcoes).map(([k, l]) =>
        `<label class="chip ${k === atual ? 'on' : ''}"><input type="radio" name="${nome}" value="${k}" ${k === atual ? 'checked' : ''} ${attrs}>${esc(l)}</label>`).join('')}</div>`;
}

function aparenciaHtml() {
    const temas = Object.entries(TEMAS).map(([k, t]) => `<button type="button" class="tema" data-act="tema" data-k="${k}">
        <span class="amostra">${['fundo', 'terra', 'montanha', 'agua'].map((c) => `<i style="background:${t.cores[c]}"></i>`).join('')}</span>${esc(t.label)}</button>`).join('');
    const cores = Object.entries(CORES).map(([k, l]) => `<label class="cor">${l}<input type="color" data-cor="${k}" value="${corDoTema(k) || '#888888'}"></label>`).join('');
    const skins = Object.keys(TYPES).map((t) => `<label>${PLURAL[t]}
        <select data-skin-padrao="${t}">${Object.entries(SKINS[t]).map(([k, l]) => `<option value="${k}" ${theme.skins[t] === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`).join('');
    return `<h3>Temas prontos</h3><div class="temas">${temas}</div>
        <h3>Fundo</h3>${chips('fundo', FUNDOS, theme.fundo, 'data-tema="fundo"')}
        <h3>Estilo do mapa</h3>${chips('estilo', ESTILOS, theme.estilo, 'data-tema="estilo"')}
        <h3>Cores</h3><div class="cores">${cores}</div>
        <h3>Modelos padrão</h3>
        <p class="mut nota">Valem para todos os lugares que não têm modelo próprio. Para mudar um lugar só, selecione-o no mapa.</p>
        <div class="skins-padrao">${skins}</div>`;
}

function compartilharHtml() {
    const players = (world.players || []).map((p) => `<li><div><span>${esc(p.name)}</span><div class="mut">${esc(p.email)}</div></div>
        <span class="papel-jog"><select data-papel="${p.id}" aria-label="Papel de ${esc(p.name)}">
            <option value="jogador" ${p.papel !== 'mestre' ? 'selected' : ''}>Jogador</option><option value="mestre" ${p.papel === 'mestre' ? 'selected' : ''}>Mestre</option></select>
        <button type="button" class="x" data-act="del-player" data-id="${p.id}" title="Remover ${esc(p.name)}">×</button></span></li>`).join('');
    const link = new URL(URLS.ver, location.href).href;
    return `<h3>Quem pode ver</h3>
        <div class="chips vis" role="radiogroup">
            <label class="chip ${world.visibility === 'private' ? 'on' : ''}"><input type="radio" name="vis" value="private" data-vis ${world.visibility === 'private' ? 'checked' : ''}>Privado</label>
            <label class="chip ${world.visibility === 'public' ? 'on' : ''}"><input type="radio" name="vis" value="public" data-vis ${world.visibility === 'public' ? 'checked' : ''}>Público</label>
        </div>
        <p class="mut nota">${world.visibility === 'public'
            ? 'Qualquer pessoa com o link vê o mapa, e ele aparece em Explorar. Outras pessoas podem copiar o mundo para a conta delas.'
            : 'Só você e os jogadores convidados abaixo veem o mapa.'}</p>
        <label>Link para ver o mapa
            <span class="copiar"><input readonly value="${esc(link)}" id="link-ver"><button type="button" data-act="copiar-link">Copiar</button></span>
        </label>

        <h3>Pessoas convidadas <small>${(world.players || []).length}</small></h3>
        <p class="mut nota"><strong>Jogador</strong> vê o mapa e as histórias, sem os lugares secretos e sem o que estiver sob a névoa. <strong>Mestre</strong> vê tudo e edita o mapa junto com você.</p>
        <ul class="list">${players}</ul>
        <form class="mini" data-form="player">
            <input name="email" type="email" placeholder="E-mail da conta da pessoa" required maxlength="255" aria-label="E-mail">
            <select name="papel" aria-label="Papel"><option value="jogador">Como jogador</option><option value="mestre">Como mestre</option></select>
            <button>Convidar</button>
        </form>`;
}

function lugarEditor(f) {
    const T = TYPES[f.type];
    const [min, , , step] = T.size, max = tamanhoMax(f.type);
    const shopOpts = f.shops.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    const canShop = f.type === 'city' || f.type === 'village';
    const padrao = SKINS[f.type][theme.skins[f.type]];

    const npcs = f.npcs.map((n) => {
        const shop = f.shops.find((s) => s.id === n.shop_id);
        return `<li><div><span>${esc(n.name)}</span>${n.role ? ` <span class="mut">${esc(n.role)}</span>` : ''}
            ${shop ? `<div class="mut">trabalha em ${esc(shop.name)}</div>` : ''}</div>
            <button type="button" class="x" data-act="del-npc" data-id="${n.id}" title="Remover ${esc(n.name)}">×</button></li>`;
    }).join('');

    const itemLi = (i) => `<li><span>${esc(i.name)}${i.quantity > 1 ? ` <span class="mut">×${i.quantity}</span>` : ''}</span>
        <span><span class="price">${i.price} po</span>
        <button type="button" class="x" data-act="del-item" data-id="${i.id}" title="Remover ${esc(i.name)}">×</button></span></li>`;
    const itemForm = (shopId) => `<form class="mini row" data-form="item"${shopId ? ` data-shop="${shopId}"` : ''}>
        <input name="name" placeholder="Item" required maxlength="80" aria-label="Nome do item">
        <input name="price" type="number" min="0" placeholder="Preço" aria-label="Preço em peças de ouro">
        <button>Adicionar</button></form>`;

    const shops = f.shops.map((s) => `<li class="shop">
        <div class="shop-head"><span>${esc(s.name)}</span>
            <button type="button" class="x" data-act="del-shop" data-id="${s.id}" title="Remover ${esc(s.name)}">×</button></div>
        <ul class="list">${s.items.map(itemLi).join('')}</ul>
        ${itemForm(s.id)}</li>`).join('');

    const trocas = trocasDe(f.type);
    const cards = [['', 'Padrão do mundo', corDaSkin(f, theme.skins[f.type])], ...Object.entries(SKINS[f.type]).map(([k, l]) => [k, l, corDaSkin(f, k)])]
        .map(([k, l, cor]) => `<button type="button" class="skin-card ${(f.skin || '') === k ? 'on' : ''}" data-act="skin" data-k="${k}" title="${esc(l)}"><i style="background:${cor}"></i><span>${esc(l)}${k === '' ? `<small>${esc(padrao)}</small>` : ''}</span></button>`).join('');
    const paleta = (PALETAS[f.type] || []).map((h) => `<button type="button" class="amostra-cor ${f.color === h ? 'on' : ''}" data-act="cor" data-k="${h}" style="background:${h}" title="${h}" aria-label="Cor ${h}"></button>`).join('');
    return `
        <div class="head">
            <div class="lugar-topo">
                <p class="kind">${T.label}</p>
                ${trocas.length > 1 ? `<div class="chips tipo-troca">${trocas.map((t) => `<button type="button" class="chip-btn ${t === f.type ? 'on' : ''}" data-act="tipo" data-k="${t}">${TYPES[t].label}</button>`).join('')}</div>` : ''}
            </div>
            <label>Nome <input data-field="name" value="${esc(f.name)}" maxlength="80" placeholder="Sem nome"></label>
            <label>Descrição <textarea data-field="description" rows="3" placeholder="Lendas, clima, história do lugar">${esc(f.description)}</textarea></label>
        </div>

        <details class="secao-lugar" open>
            <summary>Modelo</summary>
            <div class="skin-cards">${cards}</div>
        </details>

        <details class="secao-lugar" open>
            <summary>Tamanho e cor</summary>
            <label>${T.sizeLabel}
                <span class="range com-botoes"><button type="button" class="passo" data-act="tam-menos" aria-label="Diminuir">−</button><input type="range" data-field="size" min="${min}" max="${max}" step="${step}" value="${f.size}"><button type="button" class="passo" data-act="tam-mais" aria-label="Aumentar">+</button><output>${f.size}</output></span>
            </label>
            <p class="rotulo-campo">${T.corLabel}</p>
            <div class="paleta">${paleta}<label class="amostra-cor livre" title="Outra cor"><input type="color" data-field="color" value="${corOf(f)}" aria-label="Escolher outra cor"></label></div>
            ${f.color ? '<p><button type="button" class="link" data-act="cor-padrao">Voltar à cor padrão</button></p>' : '<p class="mut nota">Usando a cor padrão do modelo.</p>'}
        </details>

        <details class="secao-lugar" open>
            <summary>Formato</summary>
            ${formaHtml(f).replace('<h3>Formato</h3>', '')}
            <label class="wb-check"><input type="checkbox" data-shape="semNome" ${f.shape?.semNome ? 'checked' : ''}> Esconder o nome no mapa</label>
            <label class="wb-check"><input type="checkbox" data-shape="trancado" ${f.shape?.trancado ? 'checked' : ''}> 🔒 Trancado: não se move nem muda de formato arrastando no mapa</label>
            <label class="wb-check"><input type="checkbox" data-field="secret" ${f.secret ? 'checked' : ''}> Secreto: escondido dos jogadores e do público</label>
        </details>

        <div class="linha">
            <button type="button" data-act="mover" ${f.shape?.trancado ? 'disabled title="Destranque para mover"' : ''}>Mover</button>
            <button type="button" data-act="duplicar">Duplicar</button>
            <button type="button" class="danger" data-act="del-feature">Excluir ${T.label.toLowerCase()}</button>
        </div>
        <p class="mut nota">Dica: arraste o lugar selecionado no mapa para movê-lo; Delete apaga e Ctrl+Z desfaz.</p>

        <h3>NPCs <small>${f.npcs.length}</small></h3>
        <ul class="list">${npcs}</ul>
        <form class="mini" data-form="npc">
            <input name="name" placeholder="Nome do NPC" required maxlength="80" aria-label="Nome do NPC">
            <input name="role" placeholder="Ofício ou papel" maxlength="80" aria-label="Ofício ou papel">
            ${canShop && f.shops.length ? `<select name="shop_id" aria-label="Loja onde trabalha"><option value="">Sem loja</option>${shopOpts}</select>` : ''}
            <button>Adicionar NPC</button>
        </form>

        ${canShop ? `
        <h3>Lojas <small>${f.shops.length}</small></h3>
        <ul class="list">${shops}</ul>
        <form class="mini" data-form="shop">
            <input name="name" placeholder="Nome da loja" required maxlength="80" aria-label="Nome da loja">
            <button>Adicionar loja</button>
        </form>` : ''}

        <h3>Itens neste lugar <small>${f.loose_items.length}</small></h3>
        <ul class="list">${f.loose_items.map(itemLi).join('')}</ul>
        ${itemForm(null)}`;
}

function lugarLeitura(f) {
    const T = TYPES[f.type];
    const itemLi = (i) => `<li><span>${esc(i.name)}${i.quantity > 1 ? ` <span class="mut">×${i.quantity}</span>` : ''}
        ${i.description ? `<div class="mut">${esc(i.description)}</div>` : ''}</span><span class="price">${i.price} po</span></li>`;
    const npcs = f.npcs.map((n) => {
        const shop = f.shops.find((s) => s.id === n.shop_id);
        return `<li><div><span>${esc(n.name)}</span>${n.role ? ` <span class="mut">${esc(n.role)}</span>` : ''}
            ${shop ? `<div class="mut">trabalha em ${esc(shop.name)}</div>` : ''}
            ${n.description ? `<div class="mut">${esc(n.description)}</div>` : ''}</div></li>`;
    }).join('');
    const shops = f.shops.map((s) => `<li class="shop"><div class="shop-head"><span>${esc(s.name)}</span></div>
        <ul class="list">${s.items.map(itemLi).join('') || '<li class="mut">Prateleiras vazias.</li>'}</ul></li>`).join('');
    return `<div class="head">
            <p class="kind">${T.label} · ${esc(SKINS[f.type][skinOf(f)])}</p>
            <h2>${esc(nomeDe(f))}</h2>
            ${f.description ? `<p class="desc">${esc(f.description)}</p>` : '<p class="mut">Sem história registrada.</p>'}
        </div>
        ${f.npcs.length ? `<h3>NPCs <small>${f.npcs.length}</small></h3><ul class="list">${npcs}</ul>` : ''}
        ${f.shops.length ? `<h3>Lojas <small>${f.shops.length}</small></h3><ul class="list">${shops}</ul>` : ''}
        ${f.loose_items.length ? `<h3>Itens neste lugar <small>${f.loose_items.length}</small></h3><ul class="list">${f.loose_items.map(itemLi).join('')}</ul>` : ''}`;
}

// --- Eventos do painel ---
panel.addEventListener('input', (e) => {
    const t = e.target;
    if (t.type === 'range') { const o = t.parentElement.querySelector('output'); if (o) o.textContent = t.value; }
    if (t.dataset.cor) {            // prévia ao vivo da cor do tema
        theme.cores[t.dataset.cor] = t.value;
        applyTheme();
        agendarRebuild();
    }
});

let rebuildTimer;
function agendarRebuild() {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(rebuildAll, 120);
}

let temaTimer;
function salvarTema() {
    clearTimeout(temaTimer);
    temaTimer = setTimeout(async () => {
        try { world = (await api('PUT', `${API}/worlds/${WORLD}`, { theme })).world; } catch { /* aviso já mostrado */ }
    }, 600);
}
let temaSalvo = null; // como o tema estava na última mudança registrada (para o Ctrl+Z)
function mudarTema(fn, rotulo = 'aparência') {
    const antes = clonar(temaSalvo || theme);
    fn(theme);
    const depois = clonar(theme);
    temaSalvo = clonar(theme);
    applyTheme();
    rebuildAll();
    renderPanel();
    salvarTema();
    const aplicar = (t) => { theme = clonar(t); temaSalvo = clonar(t); applyTheme(); rebuildAll(); renderPanel(); salvarTema(); };
    registrar({ rotulo, desfazer: async () => aplicar(antes), refazer: async () => aplicar(depois) });
}

panel.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.tema) return mudarTema((th) => { th[t.dataset.tema] = t.value; });
    if (t.dataset.cor) return mudarTema(() => {});
    if (t.dataset.skinPadrao) return mudarTema((th) => { th.skins[t.dataset.skinPadrao] = t.value; });
    if (t.hasAttribute('data-vis')) {
        try { world = (await api('PUT', `${API}/worlds/${WORLD}`, { visibility: t.value })).world; } catch { /* */ }
        renderPanel();
        return;
    }
    if (t.dataset.shape) {
        const f = sel();
        if (!f) return;
        const v = t.type === 'checkbox' ? (t.checked ? 1 : 0) : Number(t.value);
        const shape = { ...(f.shape || {}), [t.dataset.shape]: v };
        try { await atualizarLugar(f, { shape }, { rotulo: 'formato de ' + nomeDe(f) }); } catch { renderPanel(); }
        return;
    }
    if (t.dataset.dimensao !== undefined) {
        if (t.value === 'livre') { dimPersonalizada = true; renderPanel(); return; }
        return mudarDimensao(Number(t.value));
    }
    if (t.dataset.papel) {
        try { world = (await api('PUT', `${API}/worlds/${WORLD}/players/${t.dataset.papel}`, { papel: t.value })).world; toast('Papel atualizado.'); } catch { /* */ }
        renderPanel();
        return;
    }
    if (t.hasAttribute('data-fog-ativo')) {
        const antes = clonar(world.fog);
        world.fog.ativo = t.checked;
        desenharNevoa();
        return salvarNevoa(antes, t.checked ? 'ligar névoa' : 'desligar névoa');
    }
    if (t.hasAttribute('data-fog-modo')) { fogModo = t.value; renderPanel(); return; }
    if (t.hasAttribute('data-fog-raio')) { fogRaio = Number(t.value); return; }
    if (t.hasAttribute('data-fog-previa')) { previaJogador = t.checked; desenharNevoa(); rebuildAll(); return; }
    if (t.dataset.world) {
        try {
            world = (await api('PUT', `${API}/worlds/${WORLD}`, { [t.dataset.world]: t.value })).world;
            $('#title').textContent = world.name;
            document.title = world.name + ' · Worldbuilder';
        } catch { renderPanel(); }
        return;
    }
    const field = t.dataset.field, f = sel();
    if (!field || !f) return;
    let valor = t.value;
    if (field === 'secret') valor = t.checked;
    if (field === 'skin') valor = t.value || null;
    try {
        const visual = ['size', 'skin', 'color'].includes(field);
        await atualizarLugar(f, { [field]: valor }, { rebuild: visual, render: field !== 'name' && field !== 'description', rotulo: ({ name: 'nome', description: 'descrição', size: 'tamanho', color: 'cor', secret: 'segredo', skin: 'modelo' }[field] || field) + ' de ' + nomeDe(f) });
    } catch { renderPanel(); }
});

panel.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;           // formulário normal (Duplicar)
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    Object.keys(data).forEach((k) => data[k] === '' && delete data[k]);
    if (form.dataset.form === 'player') {
        try { world = (await api('POST', `${API}/worlds/${WORLD}/players`, data)).world; renderPanel(); toast('Jogador convidado. O mundo aparece em "Compartilhados com você" na conta dele.'); } catch { /* */ }
        return;
    }
    const f = sel();
    if (!f) return;
    if (form.dataset.shop) data.shop_id = form.dataset.shop;
    const path = { npc: 'npcs', shop: 'shops', item: 'items' }[form.dataset.form];
    replaceFeature(await api('POST', `${API}/features/${f.id}/${path}`, data));
});

panel.addEventListener('click', async (e) => {
    const tb = e.target.closest('[data-tab]');
    if (tb) { tab = tb.dataset.tab; renderPanel(); return; }
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const f = sel(), act = btn.dataset.act, id = btn.dataset.id;
    switch (act) {
        case 'ir': {
            const alvo = features.find((x) => x.id === Number(id));
            if (alvo) { focusFeature(alvo); select(alvo.id); }
            return;
        }
        case 'tema': {
            const p = TEMAS[btn.dataset.k];
            return mudarTema((th) => { th.fundo = p.fundo; th.estilo = p.estilo; th.cores = { ...th.cores, ...p.cores }; }, 'tema ' + p.label);
        }
        case 'salvar': return salvarAgora();
        case 'imagem': return abrirAtlas();
        case 'copiar-link': {
            const inp = $('#link-ver');
            inp.select();
            try { await navigator.clipboard.writeText(inp.value); toast('Link copiado.'); } catch { document.execCommand('copy'); }
            return;
        }
        case 'del-player':
            world = (await api('DELETE', `${API}/worlds/${WORLD}/players/${id}`)).world;
            renderPanel();
            return;
        case 'mover':
            setTool('move');
            return;
        case 'redesenhar':
            setTool('redraw');
            return;
        case 'forma-padrao':
            {
                const fica = Object.fromEntries(Object.entries(f.shape || {}).filter(([k]) => ['semNome', 'trancado', 'oculta'].includes(k)));
                await atualizarLugar(f, { shape: Object.keys(fica).length ? fica : null }, { rotulo: 'formato de ' + nomeDe(f) });
            }
            return;
        case 'skin':
            await atualizarLugar(f, { skin: btn.dataset.k || null }, { rotulo: 'modelo de ' + nomeDe(f) });
            return;
        case 'cor':
            await atualizarLugar(f, { color: btn.dataset.k }, { rotulo: 'cor de ' + nomeDe(f) });
            return;
        case 'tipo':
            if (btn.dataset.k !== f.type) await atualizarLugar(f, { type: btn.dataset.k }, { rotulo: 'tipo de ' + nomeDe(f) });
            return;
        case 'tam-mais': return aumentar(f, 1.15);
        case 'tam-menos': return aumentar(f, 1 / 1.15);
        case 'duplicar': return duplicarLugar(f);
        case 'dim-aplicar': {
            const v = Number(panel.querySelector('[data-dim-num]')?.value);
            if (!v) return;
            return mudarDimensao(v);
        }
        case 'fog-pintar': setTool(tool === 'fog' ? 'select' : 'fog'); renderPanel(); return;
        case 'fog-tudo': case 'fog-nada': case 'fog-lugar': {
            const antes = clonar(world.fog);
            if (act === 'fog-tudo') world.fog = { ativo: true, areas: [[0, 0, SIZE, 1]] };
            else if (act === 'fog-nada') world.fog = { ativo: true, areas: [] };
            else if (f) {
                const r = PONTOS.has(f.type) ? null : f.size * Math.max(forma(f).sx, forma(f).sz) * 1.25 + 2;
                world.fog.ativo = true;
                if (r) world.fog.areas.push([f.x, f.z, Math.min(600, r), 1]);
                else (f.points || []).forEach(([x, z]) => world.fog.areas.push([x, z, f.size * 3 + 3, 1]));
            }
            desenharNevoa();
            return salvarNevoa(antes, { 'fog-tudo': 'revelar tudo', 'fog-nada': 'cobrir tudo', 'fog-lugar': 'revelar ' + nomeDe(f) }[act]);
        }
        case 'planos':
            location.href = world.plano?.url || '/';
            return;
        case 'cor-padrao':
            replaceFeature(await api('PUT', `${API}/features/${f.id}`, { color: null }), { rebuild: true });
            return;
        case 'del-feature':
            return excluirLugar(f);
    }
    const route = { 'del-npc': 'npcs', 'del-shop': 'shops', 'del-item': 'items' }[act];
    if (route) replaceFeature(await api('DELETE', `${API}/${route}/${id}`));
});

/* ---------- Capa, imagem e salvar ---------- */
function renderLimpo() {
    selGroup.visible = false; draftGroup.visible = false;
    renderer.render(scene, camera);
}
function restaurar() { selGroup.visible = true; draftGroup.visible = true; }

function capturarCapa() {
    renderLimpo();
    const W = 640, H = 400, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const sw = canvas.width, sh = canvas.height, k = Math.max(W / sw, H / sh);
    c.getContext('2d').drawImage(canvas, (W - sw * k) / 2, (H - sh * k) / 2, sw * k, sh * k);
    restaurar();
    return c.toDataURL('image/jpeg', 0.8);
}
let capaTimer;
function agendarCapa() {
    if (!EDIT) return;
    clearTimeout(capaTimer);
    capaTimer = setTimeout(() => enviarCapa(false), 15000);
}
async function enviarCapa(avisar) {
    clearTimeout(capaTimer);
    try {
        const r = await fetch(`${API}/worlds/${WORLD}/cover`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': CSRF },
            body: JSON.stringify({ image: capturarCapa() }),
        });
        if (avisar) toast(r.ok ? 'Mundo salvo, capa atualizada.' : 'O mundo está salvo, mas a capa não foi atualizada.');
    } catch { if (avisar) toast('Sem conexão para atualizar a capa.'); }
}
async function salvarAgora() {
    if (temaTimer) {
        clearTimeout(temaTimer);
        try { world = (await api('PUT', `${API}/worlds/${WORLD}`, { theme })).world; } catch { return; }
    }
    await enviarCapa(true);
}

// Mapa ilustrado (public/js/atlas.js): desenho 2D interativo a partir do mundo
function abrirAtlas() {
    if (!window.WBAtlas) { baixarVista3D(); return; }
    window.WBAtlas.abrir({
        world, theme, features, EDIT: PODE, SIZE, HALF, TYPES, SKINS,
        nevoa: world.fog, soJogador: !PODE, nomeDe,
        sample, forma, borda, paraMundo, distN, pontoDentro, rioPath, riverDist, skinOf, corOf, dentroPoligono, centroDe,
        comLugares(lista, fn) { const antes = features; features = lista; prepare(); try { fn(); } finally { features = antes; prepare(); } },
        baixar3D: baixarVista3D,
    });
}
function baixarVista3D() {
    renderLimpo();
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = canvas.height;
    const ctx = c.getContext('2d'), k = canvas.width / stage.clientWidth;
    ctx.drawImage(canvas, 0, 0);
    restaurar();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    labels.forEach(({ el, f }) => {
        if (el.style.display === 'none') return;
        const cs = getComputedStyle(el);
        ctx.font = `${cs.fontStyle} ${parseFloat(cs.fontSize) * k}px ${cs.fontFamily}`;
        const x = parseFloat(el.style.left) * k, y = parseFloat(el.style.top) * k;
        ctx.lineWidth = 5 * k;
        ctx.strokeStyle = getComputedStyle(stage).getPropertyValue('--rot-halo') || '#e7d3a2';
        if (!f.name || f.shape?.semNome) return;
        ctx.strokeText(f.name, x, y);
        ctx.fillStyle = cs.color;
        ctx.fillText(f.name, x, y);
    });
    ctx.textAlign = 'left';
    ctx.font = `italic ${26 * k}px 'IM Fell English', Georgia, serif`;
    ctx.fillStyle = '#f3ead2';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 6 * k;
    ctx.fillText(world.name, 16 * k, 30 * k);
    c.toBlob((b) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = (world.name.normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'mundo') + '.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, 'image/png');
}
$('#btn-imagem')?.addEventListener('click', abrirAtlas);
$('#btn-salvar')?.addEventListener('click', salvarAgora);

/* ---------- Trava do mapa: só visualização até destrancar ---------- */
const btnTrava = $('#btn-trava');
function aplicarTrava() {
    EDIT = PODE && !world?.trancado;
    document.querySelectorAll('.tool').forEach((b) => { b.hidden = !EDIT; });
    for (const id of ['#btn-desfazer', '#btn-refazer', '#btn-salvar']) { const b = $(id); if (b) b.hidden = !EDIT; }
    if (btnTrava) {
        btnTrava.hidden = !PODE;
        btnTrava.textContent = world?.trancado ? '🔒 Trancado' : '🔓';
        btnTrava.classList.toggle('trancado', !!world?.trancado);
        btnTrava.title = world?.trancado ? 'Mapa trancado: só visualização. Clique para destrancar e voltar a editar.' : 'Trancar o mapa (fica só para visualização, sem mudar nada sem querer)';
    }
    root.classList.toggle('mapa-trancado', !!world?.trancado);
    fecharMenu?.();
    cancelDraft();
    setTool('select');
    updateSelection();
    renderPanel();
}
btnTrava?.addEventListener('click', async () => {
    const novo = !world.trancado;
    try {
        const r = await api('PUT', `${API}/worlds/${WORLD}`, { trancado: novo });
        world.trancado = !!r.world.trancado;
        aplicarTrava();
        toast(world.trancado ? 'Mapa trancado: agora é só visualização. Clique no cadeado para destrancar.' : 'Mapa destrancado: pode editar de novo.');
    } catch { /* aviso já mostrado */ }
});

/* ---------- Loop e inicialização ---------- */
function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);

// Água e lava ficam paradas (sem animação) e o mapa só é redesenhado quando algo muda:
// câmera, mouse/teclado/painel ou uma resposta do servidor. Parado, não gasta GPU.
let desenharAte = 0;
function pedirDesenho(ms = 1200) { desenharAte = Math.max(desenharAte, performance.now() + ms); }
for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown', 'keyup', 'input', 'change', 'click', 'touchmove']) {
    window.addEventListener(ev, () => pedirDesenho(), { passive: true, capture: true });
}
const fetchOriginal = window.fetch.bind(window);
window.fetch = (...a) => fetchOriginal(...a).finally(() => pedirDesenho());
new ResizeObserver(() => pedirDesenho(300)).observe(stage);
let quadroAnterior = 0;
function animate(t = 0) {
    requestAnimationFrame(animate);
    // Um recálculo pesado travou a página (quadro atrasado): desenha de novo para mostrar o resultado
    if (t - quadroAnterior > 250) pedirDesenho(600);
    quadroAnterior = t;
    if (controls.update()) pedirDesenho(300);
    if (performance.now() > desenharAte) return;
    renderer.render(scene, camera);
    updateLabels();
}
pedirDesenho(3000);

(async function init() {
    setTool('select');
    resize();
    const res = await fetch(`${API}/worlds/${WORLD}/data`, { headers: { Accept: 'application/json' } });
    if (!res.ok) { toast('Não foi possível abrir este mundo.'); return; }
    const data = await res.json();
    world = data.world;
    theme = world.theme;
    features = data.features;
    setDimensao(world.dimension);
    camera.position.set(0, 120 * K, 150 * K);
    world.fog = world.fog || { ativo: false, areas: [] };
    temaSalvo = clonar(theme);
    desenharNevoa();
    botoesHistorico();
    aplicarTrava();
    if (!PODE && nevoaAtiva()) setTimeout(() => toast('Parte deste mapa ainda está coberta pela névoa: o mestre revela aos poucos.'), 1200);
    applyTheme();
    rebuildAll();
    renderPanel();
    setStatus();
    animate();
    // Primeira capa de um mundo que ainda não tem
    if (EDIT && !world.cover && features.length) setTimeout(() => enviarCapa(false), 2500);
})();
})();
