/* Worldbuilder – editor e visualizador de mapas 3D (Three.js r128) */
(() => {
'use strict';

const root = document.getElementById('app');
const API = root.dataset.api;
const WORLD = root.dataset.world;
const EDIT = root.dataset.mode === 'edit';
const URLS = { ver: root.dataset.urlVer, exportar: root.dataset.urlExportar, copiar: root.dataset.urlCopiar };
const CSRF = document.querySelector('meta[name="csrf-token"]').content;

const SIZE = 200, HALF = SIZE / 2, SEG = 220;

/* ---------- Catálogo ---------- */
const TYPES = {
    mountain: { label: 'Montanha', fresh: 'Montanha sem nome', size: [6, 45, 18, 1],     sizeLabel: 'Extensão', corLabel: 'Cor da rocha' },
    lake:     { label: 'Lago',     fresh: 'Lago sem nome',     size: [4, 40, 12, 1],     sizeLabel: 'Raio',     corLabel: 'Cor da água' },
    river:    { label: 'Rio',      fresh: 'Rio sem nome',      size: [1.5, 6, 2.5, 0.1], sizeLabel: 'Largura',  corLabel: 'Cor da água' },
    forest:   { label: 'Floresta', fresh: 'Floresta sem nome', size: [4, 35, 12, 1],     sizeLabel: 'Extensão', corLabel: 'Cor das copas' },
    city:     { label: 'Cidade',   fresh: 'Cidade sem nome',   size: [3, 14, 7, 0.5],    sizeLabel: 'Extensão', corLabel: 'Cor dos telhados' },
    village:  { label: 'Vila',     fresh: 'Vila sem nome',     size: [2, 6, 3.5, 0.5],   sizeLabel: 'Extensão', corLabel: 'Cor dos telhados' },
};
const PLURAL = { mountain: 'Montanhas', lake: 'Lagos', river: 'Rios', forest: 'Florestas', city: 'Cidades', village: 'Vilas' };
const HINTS = {
    select:   'Clique num lugar para abri-lo. Arraste para girar, role para aproximar, botão direito para mover a câmera.',
    mountain: 'Clique no mapa para erguer uma montanha.',
    lake:     'Clique no mapa para abrir um lago.',
    river:    'Clique para marcar o curso do rio e aperte Enter para concluir.',
    forest:   'Clique no mapa para plantar uma floresta.',
    city:     'Clique no mapa para fundar uma cidade.',
    village:  'Clique no mapa para fundar uma vila.',
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
};
// Cor própria de cada skin (null = cor do tema: montanha ou água)
const SKIN_COR = {
    mountain: { classica: null, picos: null, vulcao: '#4b3b36', colinas: '#7f9a56', rochosa: '#7c7468', cristal: '#6d5a8a' },
    lake: { calma: null, cristalina: null, congelada: '#cfe6ef', pantano: '#5d6b3a', lava: '#e2561c' },
    forest: { carvalhos: '#4f7a3a', pinheiros: '#2f5a3a', outono: '#c86a28', morta: '#6a5a48', magica: '#3fc6b0' },
    city: { medieval: '#9a4a2c', elfica: '#4d7a4a', deserto: '#3f6f9a', nordica: '#4a4136', fortaleza: '#7a3a2a', oriental: '#a8322a', ruinas: '#9a958a' },
};
SKIN_COR.river = SKIN_COR.lake;
SKIN_COR.village = SKIN_COR.city;
const WS = { calma: 0, cristalina: 1, congelada: 2, pantano: 3, lava: 4 };

const FUNDOS = { pergaminho: 'Pergaminho', oceano: 'Ilha no oceano', noite: 'Céu noturno', nevoa: 'Névoa', cor: 'Cor sólida' };
const ESTILOS = { pergaminho: 'Pergaminho', natural: 'Natural', ilustrado: 'Ilustrado' };
const CORES = { fundo: 'Fundo', terra: 'Terra', montanha: 'Montanhas', agua: 'Lagos e rios', tinta: 'Tinta e contornos' };
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
        if (!res.ok) {
            const msg = json.errors ? Object.values(json.errors)[0][0] : json.message;
            toast(msg && res.status === 422 ? msg : 'Não foi possível salvar. Confira os campos e tente de novo.');
            if (res.status !== 422) falhou = true;
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
function riverDist(f, x, z) {
    const p = f.points || [];
    let m = 1e9;
    for (let i = 0; i < p.length - 1; i++) m = Math.min(m, distSeg(x, z, p[i], p[i + 1]));
    return m;
}

// Locais pré-processados (skin e cor resolvidas) para o laço por vértice
let prep = { mountains: [], waters: [], agua: [0.5, 0.6, 0.6], oceano: false };
function prepare() {
    prep = {
        mountains: features.filter((f) => f.type === 'mountain').map((f) => ({ f, skin: skinOf(f), c: rgb(corOf(f)) })),
        waters: features.filter((f) => f.type === 'lake' || f.type === 'river').map((f) => ({ f, ws: WS[skinOf(f)] ?? 0, c: rgb(corOf(f)) })),
        agua: rgb(theme.cores.agua),
        oceano: theme.fundo === 'oceano',
    };
}

function mountainHeight(m, x, z, out) {
    const f = m.f, dx = x - f.x, dz = z - f.z, d2 = dx * dx + dz * dz, size = f.size;
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
        const c = mountainHeight(m, x, z, o);
        if (c > 0.01) { hm += c; mr += m.c[0] * c; mg += m.c[1] * c; mb += m.c[2] * c; }
    }
    o.h += hm;
    if (hm > 0.01) { o.m = sm(0.4, 3, hm); o.mc = [mr / hm, mg / hm, mb / hm]; }
    else { o.snow = 0; }

    let melhor = 0;
    for (const wt of prep.waters) {
        const f = wt.f;
        let amt = 0, t = 0;
        if (f.type === 'lake') {
            const d = Math.hypot(x - f.x, z - f.z);
            if (d >= f.size * 1.25) continue;
            t = sm(f.size * 1.25, f.size * 0.7, d);
            o.h = o.h * (1 - t) + (-0.6) * t;
            if (d < f.size) amt = sm(f.size, f.size * 0.88, d);
        } else {
            const d = riverDist(f, x, z), w = f.size;
            if (d >= w * 2.2) continue;
            t = sm(w * 2.2, w * 0.6, d);
            o.h = o.h * (1 - t) + (-0.5) * t;
            amt = sm(w, w * 0.7, d);
        }
        const peso = amt + t * 0.01; // perto da margem também herda a cor, para não misturar estilos na borda
        if (peso > melhor) { melhor = peso; o.wc = wt.c; o.ws = wt.ws; }
        o.w = Math.max(o.w, amt);
    }

    if (prep.oceano) {
        const r = Math.hypot(x, z) / HALF + (Math.sin(x * 0.07 + z * 0.03) + Math.cos(z * 0.06 - x * 0.045)) * 0.05;
        const t = sm(0.72, 0.92, r);
        o.h = o.h * (1 - t) + (-1.4) * t;
        o.sea = sm(0.78, 0.88, r);
        if (o.sea > o.w) { o.w = o.sea; o.wc = prep.agua; o.ws = 0; }
    }
    return o;
}
const heightAt = (x, z) => sample(x, z).h;

/* ---------- Cena ---------- */
const stage = $('#stage');
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 1500);
camera.position.set(0, 120, 150);
const controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minDistance = 15;
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
    uTime: { value: 0 }, uEstilo: { value: 0 }, uFundo: { value: 0 },
    uTerra: { value: new THREE.Color() }, uTinta: { value: new THREE.Color() },
    uFundoCor: { value: new THREE.Color() }, uAgua: { value: new THREE.Color() },
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
        varying float vW; varying float vH; varying float vM; varying vec3 vWCol; varying vec3 vMCol; varying vec4 vFx;
        varying vec3 vN; varying vec3 vP;
        const float HALF = ${HALF}.0;
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
            float r = length(vP.xz)/HALF + (noise(vP.xz*0.12)-0.5)*0.25;
            if (uFundo < 0.5) {
                col *= 1.0 - smoothstep(0.62,0.8,noise(vP.xz*0.05+7.0))*0.12;
                col = mix(col, uFundoCor, smoothstep(0.62,1.12,r)*0.85);
            } else if (uFundo < 1.5) {
                col = mix(col, uFundoCor, smoothstep(0.88,1.02,length(vP.xz)/HALF));
            } else {
                col = mix(col, uFundoCor, smoothstep(0.8,1.06,r));
            }
            gl_FragColor = vec4(col, 1.0);
        }`,
});

let terrain = null;
function buildTerrain() {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
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
    scene.fog = theme.fundo === 'nevoa' ? new THREE.Fog(c.fundo, 170, 430) : null;
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
    const R = f.size * 0.95, n = Math.max(10, Math.round(R * 2.2)), pedra = '#bdb39a';
    for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
        const x0 = f.x + Math.cos(a0) * R, z0 = f.z + Math.sin(a0) * R, x1 = f.x + Math.cos(a1) * R, z1 = f.z + Math.sin(a1) * R;
        const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, len = Math.hypot(x1 - x0, z1 - z0);
        peca(grupo, 'box', pedra, mx, Math.max(heightAt(mx, mz), 0.2) - 0.1, mz, len * 1.04, 1.2, 0.45, -Math.atan2(z1 - z0, x1 - x0));
        if (i % 3 === 0) peca(grupo, 'cyl', pedra, x0, Math.max(heightAt(x0, z0), 0.2) - 0.1, z0, 0.6, 2, 0.6);
    }
}

function povoado(f) {
    const g = new THREE.Group(), r = rng(f.id + 11), city = f.type === 'city';
    const skin = skinOf(f), roof = corOf(f);
    const n = city ? Math.round(8 + f.size * 1.6) : Math.round(3 + f.size);
    for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = (city ? 0.18 : 0) * f.size + Math.sqrt(r()) * f.size * (city ? 0.6 : 0.75);
        const x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d;
        const w = city ? 1.4 + r() * 1.4 : 1.1 + r() * 0.8;
        const h = city ? 1.6 + r() * 2.2 : 1.0 + r() * 0.9;
        const m = casa(skin, roof, w, h, w * (0.8 + r() * 0.5), r);
        m.position.set(x, Math.max(heightAt(x, z), 0.2) - 0.05, z);
        m.rotation.y = r() * Math.PI;
        g.add(m);
    }
    if (city) {
        const t = marco(skin, roof);
        t.position.set(f.x, Math.max(heightAt(f.x, f.z), 0.2) - 0.05, f.z);
        g.add(t);
    }
    if (skin === 'fortaleza') muralha(f, g);
    props.add(g);
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
    props.add(im);
}
const corVar = (hex, r, k = 0.18) => '#' + new THREE.Color(hex).offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * k, (r() - 0.5) * k).getHexString();

function floresta(f) {
    const r = rng(f.id * 7 + 3), skin = skinOf(f), cor = corOf(f);
    const n = Math.min(320, Math.round(f.size * f.size * 0.38 + 6));
    const troncos = [], copas = [], galhos = [];
    for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * f.size;
        const x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d;
        if (Math.abs(x) > HALF - 2 || Math.abs(z) > HALF - 2) continue;
        const s = sample(x, z);
        if (s.w > 0.15) continue;
        const y = s.h - 0.1, k = 0.75 + r() * 0.6;
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
    const r = rng(f.id * 13 + 5), cor = corOf(f), lista = [];
    const n = Math.round(f.size * (skin === 'rochosa' ? 1.3 : 0.9));
    for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * f.size * (skin === 'rochosa' ? 0.65 : 0.45);
        const x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d, y = heightAt(x, z);
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
    const r = rng(f.id * 17 + 1), lista = [];
    const n = Math.round(f.size * 6);
    for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = f.size * (0.85 + r() * 0.3);
        const x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d;
        lista.push({ x, y: heightAt(x, z) - 0.1, z, sx: 0.05, sy: 0.8 + r() * 0.9, sz: 0.05, rz: (r() - 0.5) * 0.4, c: corVar('#7a8a3a', r, 0.2) });
    }
    instancias(G.cyl, new THREE.MeshLambertMaterial({ color: 0xffffff }), lista);
}

function buildProps() {
    props.children.forEach((c) => { if (c.isInstancedMesh) { c.material.dispose(); c.dispose?.(); } });
    props.clear();
    contorno = theme.estilo !== 'natural';
    inkMat.color.set(theme.cores.tinta);
    for (const f of features) {
        if (f.type === 'city' || f.type === 'village') povoado(f);
        else if (f.type === 'forest') floresta(f);
        else if (f.type === 'mountain') enfeitesMontanha(f);
        else if (f.type === 'lake') juncos(f);
    }
}

/* ---------- Rótulos (HTML sobre o canvas) ---------- */
const labelsEl = $('#labels');
const labels = new Map();
function anchor(f) {
    let x = f.x, z = f.z;
    if (f.type === 'river' && f.points?.length) {
        const p = f.points[Math.floor(f.points.length / 2)];
        x = p[0]; z = p[1];
    }
    const up = { mountain: 1.5, lake: 1, river: 1, forest: 3.5, city: 7, village: 3.5 }[f.type];
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
    return esc(f.name) + (bits.length ? `<small>${bits.join(', ')}</small>` : '');
}
function syncLabels() {
    labelsEl.innerHTML = '';
    labels.clear();
    for (const f of features) {
        const el = document.createElement('div');
        el.className = 'label ' + f.type + (f.id === selectedId ? ' sel' : '') + (f.secret ? ' secreto' : '');
        el.innerHTML = labelHtml(f);
        labelsEl.appendChild(el);
        labels.set(f.id, { el, pos: anchor(f), f });
    }
}
function markSelectedLabel() {
    labels.forEach(({ el, f }) => el.classList.toggle('sel', f.id === selectedId));
}
const tmp = new THREE.Vector3();
function updateLabels() {
    const w = stage.clientWidth, h = stage.clientHeight;
    labels.forEach(({ el, pos, f }) => {
        tmp.copy(pos).project(camera);
        const far = f.type === 'village' && camera.position.distanceTo(pos) > 200;
        const hide = tmp.z > 1 || Math.abs(tmp.x) > 1.1 || Math.abs(tmp.y) > 1.1 || far;
        el.style.display = hide ? 'none' : '';
        if (!hide) {
            el.style.left = (tmp.x * 0.5 + 0.5) * w + 'px';
            el.style.top = (-tmp.y * 0.5 + 0.5) * h + 'px';
        }
    });
}

/* ---------- Seleção e rascunho de rio ---------- */
const selGroup = new THREE.Group();
scene.add(selGroup);
const selMat = new THREE.LineBasicMaterial({ color: 0x8a2d1c, depthTest: false });
const draftMat = new THREE.PointsMaterial({ color: 0x8a2d1c, size: 7, sizeAttenuation: false, depthTest: false });

function lift(x, z, dy = 0.7) { return new THREE.Vector3(x, heightAt(x, z) + dy, z); }
const RAIO = { mountain: 0.7, lake: 1.08, forest: 1.05, city: 1.1, village: 1.1 };

function updateSelection() {
    selGroup.clear();
    const f = sel();
    if (!f) return;
    let obj;
    if (f.type === 'river') {
        obj = new THREE.Line(new THREE.BufferGeometry().setFromPoints(f.points.map((p) => lift(p[0], p[1]))), selMat);
    } else {
        const r = f.size * RAIO[f.type], pts = [];
        for (let i = 0; i < 72; i++) {
            const a = (i / 72) * Math.PI * 2;
            pts.push(lift(f.x + Math.cos(a) * r, f.z + Math.sin(a) * r));
        }
        obj = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), selMat);
    }
    obj.renderOrder = 10;
    selGroup.add(obj);
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
    tool = t;
    document.querySelectorAll('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
    if (t !== 'river') cancelDraft();
    hintText.textContent = EDIT ? HINTS[t] : VIEW_HINT;
    finishBtn.hidden = t !== 'river';
    canvas.style.cursor = t === 'select' ? 'grab' : 'crosshair';
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
    if (f.type === 'river') return riverDist(f, x, z) / (f.size * 1.8 + 1);
    return Math.hypot(x - f.x, z - f.z) / (f.size * RAIO[f.type]);
}

let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 5 || e.button !== 0) return;
    const p = pick(e);
    if (p) onMapClick(p);
});

function onMapClick(p) {
    if (tool === 'select' || !EDIT) {
        let best = null, bestScore = 1;
        for (const f of features) {
            const rc = reach(f, p.x, p.z);
            const s = rc - (f.type === 'city' || f.type === 'village' ? 0.35 : 0);
            if (rc <= 1 && s < bestScore) { best = f; bestScore = s; }
        }
        select(best ? best.id : null);
    } else if (tool === 'river') {
        riverDraft.push([p.x, p.z]);
        updateDraft();
    } else if (tool === 'move') {
        moveSelected(p);
    } else {
        createFeature(tool, p.x, p.z);
    }
}

async function createFeature(type, x, z, extra = {}) {
    const t = TYPES[type];
    const f = await api('POST', `${API}/worlds/${WORLD}/features`, { type, name: t.fresh, x, z, size: t.size[2], ...extra });
    features.push(f);
    rebuildAll();
    select(f.id);
}
async function finishRiver() {
    if (tool !== 'river') return;
    if (riverDraft.length < 2) { toast('Marque pelo menos dois pontos para traçar o rio.'); return; }
    const pts = riverDraft;
    cancelDraft();
    await createFeature('river', pts[0][0], pts[0][1], { points: pts });
}
async function moveSelected(p) {
    const f = sel();
    setTool('select');
    if (!f) return;
    const clamp = (v) => Math.max(-100, Math.min(100, Math.round(v * 100) / 100));
    const body = { x: p.x, z: p.z };
    if (f.type === 'river') {
        const dx = p.x - f.x, dz = p.z - f.z;
        body.points = f.points.map(([x, z]) => [clamp(x + dx), clamp(z + dz)]);
        body.x = body.points[0][0]; body.z = body.points[0][1];
    }
    replaceFeature(await api('PUT', `${API}/features/${f.id}`, body), { rebuild: true });
}
finishBtn.addEventListener('click', finishRiver);
document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'Escape') setTool('select');
    if (e.key === 'Enter') finishRiver();
});

function rebuildAll() {
    prepare();
    buildTerrain();
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

function tabsHtml() {
    const abas = [];
    if (sel()) abas.push(['lugar', 'Lugar']);
    abas.push(['mundo', 'Mundo']);
    if (EDIT) abas.push(['aparencia', 'Aparência'], ['compartilhar', 'Compartilhar']);
    return `<nav class="tabs" role="tablist">${abas.map(([k, l]) =>
        `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</nav>`;
}

function renderPanel() {
    if (tab === 'lugar' && !sel()) tab = 'mundo';
    if (!EDIT && (tab === 'aparencia' || tab === 'compartilhar')) tab = 'mundo';
    const scroll = panel.scrollTop;
    const corpo = tab === 'lugar' ? (EDIT ? lugarEditor(sel()) : lugarLeitura(sel()))
        : tab === 'aparencia' ? aparenciaHtml()
        : tab === 'compartilhar' ? compartilharHtml()
        : mundoHtml();
    panel.innerHTML = tabsHtml() + `<div class="tab-body">${corpo}</div>`;
    panel.scrollTop = scroll;
}

function listaLugares() {
    const grupos = Object.keys(TYPES).map((t) => {
        const fs = features.filter((f) => f.type === t);
        if (!fs.length) return '';
        return `<h3>${PLURAL[t]} <small>${fs.length}</small></h3><ul class="list lugares">${fs.map((f) =>
            `<li><button type="button" class="link" data-act="ir" data-id="${f.id}">${esc(f.name)}</button>${f.secret ? '<span class="mut">secreto</span>' : ''}</li>`).join('')}</ul>`;
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
        </div>
        <div class="acoes-mundo">
            <button type="button" class="primary" data-act="salvar">Salvar agora</button>
            <button type="button" data-act="imagem">Baixar imagem</button>
            <a class="btn" href="${URLS.exportar}">Exportar arquivo</a>
            <form method="POST" action="${URLS.copiar}"><input type="hidden" name="_token" value="${CSRF}"><button type="submit">Duplicar</button></form>
            <a class="btn" href="${URLS.ver}" target="_blank" rel="noopener">Ver como jogador</a>
        </div>
        <p class="mut nota">Tudo o que você muda no mapa é salvo na hora. "Salvar agora" também atualiza a capa do mundo; o arquivo exportado pode ser importado de volta em Meus mundos.</p>
        <div class="help"><p>Escolha uma ferramenta à esquerda e clique no mapa para criar montanhas, lagos, rios, florestas, cidades e vilas. Com Selecionar, clique num lugar para mudar nome, história, modelo e cor.</p></div>
        ${listaLugares()}`;
}

function chips(nome, opcoes, atual, attrs = '') {
    return `<div class="chips" role="radiogroup">${Object.entries(opcoes).map(([k, l]) =>
        `<label class="chip ${k === atual ? 'on' : ''}"><input type="radio" name="${nome}" value="${k}" ${k === atual ? 'checked' : ''} ${attrs}>${esc(l)}</label>`).join('')}</div>`;
}

function aparenciaHtml() {
    const temas = Object.entries(TEMAS).map(([k, t]) => `<button type="button" class="tema" data-act="tema" data-k="${k}">
        <span class="amostra">${['fundo', 'terra', 'montanha', 'agua'].map((c) => `<i style="background:${t.cores[c]}"></i>`).join('')}</span>${esc(t.label)}</button>`).join('');
    const cores = Object.entries(CORES).map(([k, l]) => `<label class="cor">${l}<input type="color" data-cor="${k}" value="${theme.cores[k]}"></label>`).join('');
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
        <button type="button" class="x" data-act="del-player" data-id="${p.id}" title="Remover ${esc(p.name)}">×</button></li>`).join('');
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

        <h3>Jogadores <small>${(world.players || []).length}</small></h3>
        <p class="mut nota">Jogadores veem o mapa e as histórias, mas não editam. Lugares marcados como secretos ficam escondidos deles.</p>
        <ul class="list">${players}</ul>
        <form class="mini" data-form="player">
            <input name="email" type="email" placeholder="E-mail da conta do jogador" required maxlength="255" aria-label="E-mail do jogador">
            <button>Convidar jogador</button>
        </form>`;
}

function lugarEditor(f) {
    const T = TYPES[f.type];
    const [min, max, , step] = T.size;
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

    return `
        <div class="head">
            <p class="kind">${T.label}</p>
            <label>Nome <input data-field="name" value="${esc(f.name)}" maxlength="80"></label>
            <label>Descrição <textarea data-field="description" rows="3" placeholder="Lendas, clima, história do lugar">${esc(f.description)}</textarea></label>
            <label>${T.sizeLabel}
                <span class="range"><input type="range" data-field="size" min="${min}" max="${max}" step="${step}" value="${f.size}"><output>${f.size}</output></span>
            </label>
            <label>Modelo
                <select data-field="skin">
                    <option value="" ${f.skin ? '' : 'selected'}>Padrão do mundo (${esc(padrao)})</option>
                    ${Object.entries(SKINS[f.type]).map(([k, l]) => `<option value="${k}" ${f.skin === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}
                </select>
            </label>
            <div class="cor-linha">
                <label class="cor">${T.corLabel}<input type="color" data-field="color" value="${corOf(f)}"></label>
                ${f.color ? '<button type="button" class="link" data-act="cor-padrao">Voltar à cor padrão</button>' : '<span class="mut">cor padrão</span>'}
            </div>
            <label class="wb-check"><input type="checkbox" data-field="secret" ${f.secret ? 'checked' : ''}> Secreto: escondido dos jogadores e do público</label>
            <div class="linha">
                <button type="button" data-act="mover">Mover</button>
                <button type="button" class="danger" data-act="del-feature">Excluir ${T.label.toLowerCase()}</button>
            </div>
        </div>

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
            <h2>${esc(f.name)}</h2>
            ${f.description ? `<p class="desc">${esc(f.description)}</p>` : '<p class="mut">Sem história registrada.</p>'}
        </div>
        ${f.npcs.length ? `<h3>NPCs <small>${f.npcs.length}</small></h3><ul class="list">${npcs}</ul>` : ''}
        ${f.shops.length ? `<h3>Lojas <small>${f.shops.length}</small></h3><ul class="list">${shops}</ul>` : ''}
        ${f.loose_items.length ? `<h3>Itens neste lugar <small>${f.loose_items.length}</small></h3><ul class="list">${f.loose_items.map(itemLi).join('')}</ul>` : ''}`;
}

// --- Eventos do painel ---
panel.addEventListener('input', (e) => {
    const t = e.target;
    if (t.type === 'range') t.nextElementSibling.textContent = t.value;
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
function mudarTema(fn) {
    fn(theme);
    applyTheme();
    rebuildAll();
    renderPanel();
    salvarTema();
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
        const u = await api('PUT', `${API}/features/${f.id}`, { [field]: valor });
        const visual = ['size', 'skin', 'color'].includes(field);
        replaceFeature(u, { rebuild: visual, render: field !== 'name' && field !== 'description' });
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
            return mudarTema((th) => { th.fundo = p.fundo; th.estilo = p.estilo; th.cores = { ...p.cores }; });
        }
        case 'salvar': return salvarAgora();
        case 'imagem': return baixarImagem();
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
        case 'cor-padrao':
            replaceFeature(await api('PUT', `${API}/features/${f.id}`, { color: null }), { rebuild: true });
            return;
        case 'del-feature':
            if (!confirm(`Excluir "${f.name}" com todos os NPCs, lojas e itens daqui?`)) return;
            await api('DELETE', `${API}/features/${f.id}`);
            features = features.filter((x) => x.id !== f.id);
            selectedId = null;
            tab = 'mundo';
            rebuildAll();
            renderPanel();
            return;
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

function baixarImagem() {
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
$('#btn-imagem')?.addEventListener('click', baixarImagem);
$('#btn-salvar')?.addEventListener('click', salvarAgora);

/* ---------- Loop e inicialização ---------- */
function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    uniforms.uTime.value = clock.getElapsedTime();
    controls.update();
    renderer.render(scene, camera);
    updateLabels();
}

(async function init() {
    setTool('select');
    resize();
    const res = await fetch(`${API}/worlds/${WORLD}/data`, { headers: { Accept: 'application/json' } });
    if (!res.ok) { toast('Não foi possível abrir este mundo.'); return; }
    const data = await res.json();
    world = data.world;
    theme = world.theme;
    features = data.features;
    applyTheme();
    rebuildAll();
    renderPanel();
    setStatus();
    animate();
    // Primeira capa de um mundo que ainda não tem
    if (EDIT && !world.cover && features.length) setTimeout(() => enviarCapa(false), 2500);
})();
})();
