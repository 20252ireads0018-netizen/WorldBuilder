/* Worldbuilder – editor de mapa 3D estilo pergaminho (Three.js r128) */
(() => {
'use strict';

const root = document.getElementById('app');
const API = root.dataset.api;
const WORLD = root.dataset.world;
const CSRF = document.querySelector('meta[name="csrf-token"]').content;

const SIZE = 200, HALF = SIZE / 2, SEG = 220;

const TYPES = {
    mountain: { label: 'Montanha', fresh: 'Montanha sem nome', size: [6, 45, 18, 1],     sizeLabel: 'Extensão' },
    lake:     { label: 'Lago',     fresh: 'Lago sem nome',     size: [4, 40, 12, 1],     sizeLabel: 'Raio' },
    river:    { label: 'Rio',      fresh: 'Rio sem nome',      size: [1.5, 6, 2.5, 0.1], sizeLabel: 'Largura' },
    city:     { label: 'Cidade',   fresh: 'Cidade sem nome',   size: [3, 14, 7, 0.5],    sizeLabel: 'Extensão' },
    village:  { label: 'Vila',     fresh: 'Vila sem nome',     size: [2, 6, 3.5, 0.5],   sizeLabel: 'Extensão' },
};
const HINTS = {
    select:   'Clique num lugar para abri-lo. Arraste para girar, role para aproximar, botão direito para mover.',
    mountain: 'Clique no mapa para erguer uma montanha.',
    lake:     'Clique no mapa para abrir um lago.',
    river:    'Clique para marcar o curso do rio e aperte Enter para concluir.',
    city:     'Clique no mapa para fundar uma cidade.',
    village:  'Clique no mapa para fundar uma vila.',
};

let features = [];
let selectedId = null;
let tool = 'select';
let riverDraft = [];

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sel = () => features.find((f) => f.id === selectedId) || null;

/* ---------- API ---------- */
async function api(method, url, body) {
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': CSRF },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        toast('Não foi possível salvar. Confira os campos e tente de novo.');
        throw new Error('HTTP ' + res.status);
    }
    return res.json();
}
let toastTimer;
function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- Terreno (altura calculada a partir dos locais) ---------- */
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
function sample(x, z) {
    let h = baseNoise(x, z), water = 0;
    for (const f of features) {
        if (f.type !== 'mountain') continue;
        const s = f.size * 0.6, d2 = (x - f.x) ** 2 + (z - f.z) ** 2;
        const ridge = 1 + 0.18 * Math.sin((x - f.x) * 0.7) * Math.cos((z - f.z) * 0.6);
        h += f.size * 0.7 * Math.exp(-d2 / (2 * s * s)) * ridge;
    }
    for (const f of features) {
        if (f.type === 'lake') {
            const d = Math.hypot(x - f.x, z - f.z);
            if (d < f.size * 1.25) {
                const t = sm(f.size * 1.25, f.size * 0.7, d);
                h = h * (1 - t) + (-0.6) * t;
                if (d < f.size) water = Math.max(water, sm(f.size, f.size * 0.88, d));
            }
        } else if (f.type === 'river') {
            const d = riverDist(f, x, z), w = f.size;
            if (d < w * 2.2) {
                const t = sm(w * 2.2, w * 0.6, d);
                h = h * (1 - t) + (-0.5) * t;
                water = Math.max(water, sm(w, w * 0.7, d));
            }
        }
    }
    return { h, w: water };
}

/* ---------- Cena ---------- */
const stage = $('#stage');
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1c10);
const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 1200);
camera.position.set(0, 120, 150);
const controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minDistance = 15;
controls.maxDistance = 330;

scene.add(new THREE.AmbientLight(0xfff0d0, 0.85));
const sun = new THREE.DirectionalLight(0xfff2d8, 0.6);
sun.position.set(-60, 90, 40);
scene.add(sun);

const material = new THREE.ShaderMaterial({
    vertexShader: `
        attribute float aWater; attribute float aH;
        varying float vW; varying float vH; varying vec3 vN; varying vec3 vP;
        void main(){ vW=aWater; vH=aH; vN=normal; vP=position;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
        precision highp float;
        varying float vW; varying float vH; varying vec3 vN; varying vec3 vP;
        const float HALF = ${HALF}.0;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
        void main(){
            vec3 L = normalize(vec3(-0.6, 0.7, 0.4));
            float sh = clamp(dot(normalize(vN), L), 0.0, 1.0);
            float grain = noise(vP.xz*0.35)*0.5 + noise(vP.xz*2.2)*0.3 + noise(vP.xz*9.0)*0.2;
            vec3 paper = mix(vec3(0.90,0.77,0.48), vec3(0.80,0.64,0.36), grain);
            vec3 col = paper * (0.62 + 0.55*sh);
            // curvas de nível em tinta
            float f = fract(vH*0.8);
            float cl = 1.0 - smoothstep(0.0, 0.07, min(f, 1.0-f));
            col = mix(col, vec3(0.30,0.19,0.09), cl*0.32*(1.0-vW)*step(0.9, vH));
            // água hachurada
            float hatch = 0.5 + 0.5*sin((vP.x+vP.z)*3.2 + noise(vP.xz*0.8)*3.0);
            vec3 wcol = mix(vec3(0.52,0.63,0.58), vec3(0.40,0.54,0.51), hatch*0.6) * (0.85+0.2*grain);
            col = mix(col, wcol, vW);
            float edge = smoothstep(0.0,0.5,vW) * (1.0 - smoothstep(0.5,1.0,vW));
            col = mix(col, vec3(0.25,0.16,0.08), edge*0.7);
            // papel envelhecido: manchas e bordas queimadas
            col *= 1.0 - smoothstep(0.62,0.8,noise(vP.xz*0.05+7.0))*0.12;
            float r = length(vP.xz)/HALF + (noise(vP.xz*0.12)-0.5)*0.25;
            col = mix(col, vec3(0.28,0.15,0.06), smoothstep(0.62,1.12,r)*0.85);
            gl_FragColor = vec4(col, 1.0);
        }`,
});

let terrain = null;
function buildTerrain() {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const water = new Float32Array(pos.count), hs = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
        const s = sample(pos.getX(i), pos.getZ(i));
        pos.setY(i, s.h);
        hs[i] = s.h;
        water[i] = s.w;
    }
    g.setAttribute('aWater', new THREE.BufferAttribute(water, 1));
    g.setAttribute('aH', new THREE.BufferAttribute(hs, 1));
    g.computeVertexNormals();
    if (terrain) { scene.remove(terrain); terrain.geometry.dispose(); }
    terrain = new THREE.Mesh(g, material);
    scene.add(terrain);
}

/* ---------- Casas de cidades e vilas ---------- */
const mats = {
    wall: new THREE.MeshLambertMaterial({ color: 0xdcc48e }),
    roof: new THREE.MeshLambertMaterial({ color: 0x9a4a2c }),
    ink: new THREE.LineBasicMaterial({ color: 0x2e1d0e }),
};
const markers = new THREE.Group();
scene.add(markers);

function rng(seed) {
    let a = (seed * 2654435761) >>> 0;
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function outline(mesh) {
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), mats.ink);
    l.position.copy(mesh.position);
    l.rotation.copy(mesh.rotation);
    return l;
}
function house(w, h, d, tower) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.wall);
    body.position.y = h / 2;
    g.add(body, outline(body));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * (tower ? 0.9 : 0.6), 4), mats.roof);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = h + h * (tower ? 0.45 : 0.3);
    g.add(roof, outline(roof));
    return g;
}
function buildMarkers() {
    markers.clear();
    for (const f of features) {
        if (f.type !== 'city' && f.type !== 'village') continue;
        const r = rng(f.id + 11);
        const city = f.type === 'city';
        const n = city ? Math.round(8 + f.size * 1.6) : Math.round(3 + f.size);
        for (let i = 0; i < n; i++) {
            const a = r() * Math.PI * 2, d = Math.sqrt(r()) * f.size * 0.75;
            const x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d;
            const w = city ? 1.4 + r() * 1.4 : 1.1 + r() * 0.8;
            const h = city ? 1.6 + r() * 2.2 : 1.0 + r() * 0.9;
            const m = house(w, h, w * (0.8 + r() * 0.5), false);
            m.position.set(x, Math.max(sample(x, z).h, 0.2) - 0.05, z);
            m.rotation.y = r() * Math.PI;
            markers.add(m);
        }
        if (city) {
            const t = house(2.2, 5.5, 2.2, true);
            t.position.set(f.x, Math.max(sample(f.x, f.z).h, 0.2) - 0.05, f.z);
            markers.add(t);
        }
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
    const up = { mountain: 1.5, lake: 1, river: 1, city: 7, village: 3.5 }[f.type];
    return new THREE.Vector3(x, sample(x, z).h + up, z);
}
function labelHtml(f) {
    const n = f.npcs.length, s = f.shops.length;
    const i = f.loose_items.length + f.shops.reduce((a, x) => a + x.items.length, 0);
    const bits = [];
    if (n) bits.push(n + (n > 1 ? ' NPCs' : ' NPC'));
    if (s) bits.push(s + (s > 1 ? ' lojas' : ' loja'));
    if (i) bits.push(i + (i > 1 ? ' itens' : ' item'));
    return esc(f.name) + (bits.length ? `<small>${bits.join(', ')}</small>` : '');
}
function syncLabels() {
    labelsEl.innerHTML = '';
    labels.clear();
    for (const f of features) {
        const el = document.createElement('div');
        el.className = 'label ' + f.type + (f.id === selectedId ? ' sel' : '');
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

function lift(x, z, dy = 0.7) { return new THREE.Vector3(x, sample(x, z).h + dy, z); }

function updateSelection() {
    selGroup.clear();
    const f = sel();
    if (!f) return;
    let obj;
    if (f.type === 'river') {
        obj = new THREE.Line(new THREE.BufferGeometry().setFromPoints(f.points.map((p) => lift(p[0], p[1]))), selMat);
    } else {
        const r = { mountain: f.size * 0.7, lake: f.size * 1.08, city: f.size * 1.1, village: f.size * 1.1 }[f.type];
        const pts = [];
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
    hintText.textContent = HINTS[t];
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
    const r = { mountain: f.size * 0.7, lake: f.size * 1.05, city: f.size * 1.1, village: f.size * 1.1 }[f.type];
    return Math.hypot(x - f.x, z - f.z) / r;
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
    if (tool === 'select') {
        let best = null, bestScore = 1;
        for (const f of features) {
            const s = reach(f, p.x, p.z) - (f.type === 'city' || f.type === 'village' ? 0.35 : 0);
            if (reach(f, p.x, p.z) <= 1 && s < bestScore) { best = f; bestScore = s; }
        }
        select(best ? best.id : null);
    } else if (tool === 'river') {
        riverDraft.push([p.x, p.z]);
        updateDraft();
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
finishBtn.addEventListener('click', finishRiver);
document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'Escape') setTool('select');
    if (e.key === 'Enter') finishRiver();
});

function rebuildAll() {
    buildTerrain();
    buildMarkers();
    syncLabels();
    updateSelection();
}
function select(id) {
    selectedId = id;
    updateSelection();
    markSelectedLabel();
    renderPanel();
}
function replaceFeature(f, { rebuild = false, render = true } = {}) {
    features = features.map((x) => (x.id === f.id ? f : x));
    if (rebuild) rebuildAll(); else syncLabels();
    markSelectedLabel();
    if (render) renderPanel();
}

/* ---------- Painel lateral ---------- */
const panel = $('#panel');

function renderPanel() {
    const f = sel();
    if (!f) {
        panel.innerHTML = `
            <div class="help">
                <h2>${esc($('#title').textContent)}</h2>
                <p class="mut">${features.length} ${features.length === 1 ? 'lugar' : 'lugares'} no mapa.</p>
                <p>Escolha uma ferramenta à esquerda e clique no mapa para criar montanhas, lagos, rios, cidades e vilas.</p>
                <p>Com Selecionar, clique num lugar para nomeá-lo, contar sua história e povoá-lo com NPCs, lojas e itens.</p>
            </div>`;
        return;
    }
    const T = TYPES[f.type];
    const [min, max, , step] = T.size;
    const shopOpts = f.shops.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    const canShop = f.type === 'city' || f.type === 'village';

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

    const itemsCount = f.loose_items.length;
    panel.innerHTML = `
        <div class="head">
            <p class="kind">${T.label}</p>
            <label>Nome <input data-field="name" value="${esc(f.name)}" maxlength="80"></label>
            <label>Descrição <textarea data-field="description" rows="3" placeholder="Lendas, clima, história do lugar">${esc(f.description)}</textarea></label>
            <label>${T.sizeLabel}
                <span class="range"><input type="range" data-field="size" min="${min}" max="${max}" step="${step}" value="${f.size}"><output>${f.size}</output></span>
            </label>
            <button type="button" class="danger" data-act="del-feature">Excluir ${T.label.toLowerCase()}</button>
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

        <h3>Itens neste lugar <small>${itemsCount}</small></h3>
        <ul class="list">${f.loose_items.map(itemLi).join('')}</ul>
        ${itemForm(null)}`;
}

panel.addEventListener('input', (e) => {
    if (e.target.type === 'range') e.target.nextElementSibling.textContent = e.target.value;
});

panel.addEventListener('change', async (e) => {
    const t = e.target, field = t.dataset.field, f = sel();
    if (!field || !f) return;
    try {
        const u = await api('PUT', `${API}/features/${f.id}`, { [field]: t.value });
        replaceFeature(u, { rebuild: field === 'size', render: false });
    } catch { renderPanel(); }
});

panel.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target.closest('form[data-form]'), f = sel();
    if (!form || !f) return;
    const data = Object.fromEntries(new FormData(form));
    Object.keys(data).forEach((k) => data[k] === '' && delete data[k]);
    if (form.dataset.shop) data.shop_id = form.dataset.shop;
    const path = { npc: 'npcs', shop: 'shops', item: 'items' }[form.dataset.form];
    replaceFeature(await api('POST', `${API}/features/${f.id}/${path}`, data));
});

panel.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const f = sel(), act = btn.dataset.act, id = btn.dataset.id;
    if (act === 'del-feature') {
        if (!confirm(`Excluir "${f.name}" com todos os NPCs, lojas e itens daqui?`)) return;
        await api('DELETE', `${API}/features/${f.id}`);
        features = features.filter((x) => x.id !== f.id);
        selectedId = null;
        rebuildAll();
        renderPanel();
        return;
    }
    const route = { 'del-npc': 'npcs', 'del-shop': 'shops', 'del-item': 'items' }[act];
    if (route) replaceFeature(await api('DELETE', `${API}/${route}/${id}`));
});

/* ---------- Loop e inicialização ---------- */
function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    updateLabels();
}

(async function init() {
    setTool('select');
    resize();
    const res = await fetch(`${API}/worlds/${WORLD}/data`, { headers: { Accept: 'application/json' } });
    features = (await res.json()).features;
    rebuildAll();
    renderPanel();
    animate();
})();
})();
