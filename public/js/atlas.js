/* Worldbuilder – mapa ilustrado (desenho 2D estilo cartografia antiga, interativo e exportável em PNG).
   Recebe do editor o mundo, os lugares e as funções de terreno/formato: window.WBAtlas.abrir(ctx). */
(() => {
'use strict';

const PI2 = Math.PI * 2;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mixHex(a, b, t) { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join(''); }
const escurecer = (h, k) => mixHex(h, '#000000', k);
const clarear = (h, k) => mixHex(h, '#ffffff', k);
function rng(seed) {
    let a = (seed * 2654435761) >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- Estilos do desenho ---------- */
const ESTILOS = {
    pergaminho: { nome: 'Pergaminho antigo' },
    aquarela: { nome: 'Aquarela' },
    tinta: { nome: 'Nanquim' },
    noturno: { nome: 'Noturno' },
};
function paleta(estilo, theme) {
    const c = theme.cores;
    switch (estilo) {
        case 'aquarela': return {
            papel: '#f1e4c3', papel2: '#ddc590', terra: mixHex(c.terra, '#f1e4c3', 0.35), alto: mixHex(c.montanha, '#f1e4c3', 0.25),
            agua: mixHex(c.agua, '#f1e4c3', 0.2), tinta: mixHex(c.tinta, '#2a1a0a', 0.3), tintaAgua: escurecer(c.agua, 0.45),
            halo: '#f4e9cc', copa: null, montanha: mixHex(c.montanha, '#f1e4c3', 0.35), sombra: escurecer(c.montanha, 0.35), cor: true, neve: '#ffffff',
        };
        case 'tinta': return {
            papel: '#f7f3e8', papel2: '#e6dfcc', terra: '#fbf8ef', alto: '#f1ece0', agua: '#e4ecef', tinta: '#1d1b18', tintaAgua: '#2b3e48',
            halo: '#fbf8ef', copa: '#fbf8ef', montanha: '#fbf8ef', sombra: '#1d1b18', cor: false, neve: '#ffffff',
        };
        case 'noturno': return {
            papel: '#121a2c', papel2: '#0a1020', terra: '#1b2640', alto: '#25324f', agua: '#0c1324', tinta: '#e3c47e', tintaAgua: '#8fb2d6',
            halo: '#121a2c', copa: '#1b2a3c', montanha: '#24314d', sombra: '#e3c47e', cor: false, neve: '#dfe7f5',
        };
        default: return {
            papel: '#ecdcb0', papel2: '#d6bb82', terra: '#efe0b8', alto: '#e2cb98', agua: '#c3cfb9', tinta: '#4a3015', tintaAgua: '#3d5a52',
            halo: '#efe0b8', copa: '#d8cc98', montanha: '#eadbb0', sombra: '#4a3015', cor: false, neve: '#fbf6e8',
        };
    }
}

/* ---------- Grade de terreno (amostrada do editor) ---------- */
function calcularCampo(C, lugares) {
    const N = C.SIZE >= 400 ? 300 : 240;
    const h = new Float32Array(N * N), w = new Float32Array(N * N), m = new Float32Array(N * N);
    const neve = new Float32Array(N * N), lava = new Float32Array(N * N), wc = new Array(N * N), mc = new Array(N * N);
    C.comLugares(lugares, () => {
        for (let j = 0; j < N; j++) {
            const z = -C.HALF + (j / (N - 1)) * C.SIZE;
            for (let i = 0; i < N; i++) {
                const x = -C.HALF + (i / (N - 1)) * C.SIZE, s = C.sample(x, z), k = j * N + i;
                h[k] = s.h; w[k] = s.w; m[k] = s.m; neve[k] = s.snow; lava[k] = s.lava; wc[k] = s.wc; mc[k] = s.mc;
            }
        }
    });
    // Distância (em células) até a terra, dentro da água: base das linhas de costa
    const d = new Float32Array(N * N), INF = 1e6;
    for (let k = 0; k < N * N; k++) d[k] = w[k] > 0.5 ? INF : 0;
    const a = 1, b = 1.414;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = j * N + i; if (!d[k]) continue;
        let v = d[k];
        if (i > 0) v = Math.min(v, d[k - 1] + a);
        if (j > 0) { v = Math.min(v, d[k - N] + a); if (i > 0) v = Math.min(v, d[k - N - 1] + b); if (i < N - 1) v = Math.min(v, d[k - N + 1] + b); }
        d[k] = v;
    }
    for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) {
        const k = j * N + i; if (!d[k]) continue;
        let v = d[k];
        if (i < N - 1) v = Math.min(v, d[k + 1] + a);
        if (j < N - 1) { v = Math.min(v, d[k + N] + a); if (i < N - 1) v = Math.min(v, d[k + N + 1] + b); if (i > 0) v = Math.min(v, d[k + N - 1] + b); }
        d[k] = v;
    }
    return { N, h, w, m, neve, lava, wc, mc, d };
}

// Marching squares: chama seg(x1,y1,x2,y2) em coordenadas de grade
function contorno(campo, N, nivel, seg, mascara) {
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
        const k = j * N + i;
        if (mascara && !mascara(k)) continue;
        const v0 = campo[k], v1 = campo[k + 1], v2 = campo[k + N + 1], v3 = campo[k + N];
        const c = (v0 > nivel ? 1 : 0) | (v1 > nivel ? 2 : 0) | (v2 > nivel ? 4 : 0) | (v3 > nivel ? 8 : 0);
        if (c === 0 || c === 15) continue;
        const t = (a, b) => (nivel - a) / ((b - a) || 1e-6);
        const T = [i + t(v0, v1), j], R = [i + 1, j + t(v1, v2)], B = [i + t(v3, v2), j + 1], L = [i, j + t(v0, v3)];
        const s = (p, q) => seg(p[0], p[1], q[0], q[1]);
        switch (c) {
            case 1: case 14: s(L, T); break;
            case 2: case 13: s(T, R); break;
            case 3: case 12: s(L, R); break;
            case 4: case 11: s(R, B); break;
            case 6: case 9: s(T, B); break;
            case 7: case 8: s(L, B); break;
            case 5: s(L, T); s(R, B); break;
            case 10: s(T, R); s(L, B); break;
        }
    }
}

/* ---------- Textura de papel ---------- */
let texturaCache = null;
function textura() {
    if (texturaCache) return texturaCache;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'), img = x.createImageData(256, 256), r = rng(99);
    for (let i = 0; i < img.data.length; i += 4) {
        const v = 200 + r() * 55;
        img.data[i] = v; img.data[i + 1] = v * 0.97; img.data[i + 2] = v * 0.9; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    texturaCache = c;
    return c;
}

/* ---------- Desenho de um lugar (glifos) ---------- */
function arvore(x, ctx, px, py, s, skin, cor, P, r) {
    ctx.lineWidth = Math.max(0.6, s * 0.09);
    ctx.strokeStyle = P.tinta;
    if (skin === 'morta') {
        ctx.beginPath();
        ctx.moveTo(px, py); ctx.lineTo(px, py - s);
        ctx.moveTo(px, py - s * 0.55); ctx.lineTo(px - s * 0.3, py - s * 0.85);
        ctx.moveTo(px, py - s * 0.7); ctx.lineTo(px + s * 0.28, py - s * 0.98);
        ctx.stroke();
        return;
    }
    const fill = P.cor ? cor : (P.copa || cor);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - s * 0.35); ctx.stroke();
    if (skin === 'pinheiros') {
        ctx.beginPath();
        ctx.moveTo(px - s * 0.34, py - s * 0.22); ctx.lineTo(px, py - s * 1.25); ctx.lineTo(px + s * 0.34, py - s * 0.22); ctx.closePath();
        ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px, py - s * 1.2); ctx.lineTo(px + s * 0.3, py - s * 0.25); ctx.lineTo(px, py - s * 0.25); ctx.closePath();
        ctx.fillStyle = P.cor ? escurecer(fill, 0.25) : 'rgba(0,0,0,.12)'; ctx.fill();
        return;
    }
    const cy = py - s * 0.72, rr = s * 0.42;
    ctx.beginPath();
    ctx.arc(px - rr * 0.45, cy + rr * 0.15, rr * 0.62, 0, PI2);
    ctx.arc(px + rr * 0.45, cy + rr * 0.15, rr * 0.62, 0, PI2);
    ctx.arc(px, cy - rr * 0.3, rr * 0.7, 0, PI2);
    ctx.fillStyle = fill; ctx.fill();
    ctx.beginPath();
    ctx.arc(px - rr * 0.45, cy + rr * 0.15, rr * 0.62, Math.PI * 0.55, Math.PI * 1.6);
    ctx.arc(px, cy - rr * 0.3, rr * 0.7, Math.PI * 1.05, Math.PI * 1.95);
    ctx.arc(px + rr * 0.45, cy + rr * 0.15, rr * 0.62, Math.PI * 1.4, Math.PI * 0.45);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(px + rr * 0.3, cy + rr * 0.1, rr * 0.5, -0.4, Math.PI * 0.6);
    ctx.strokeStyle = P.cor ? escurecer(fill, 0.35) : 'rgba(0,0,0,.25)'; ctx.stroke();
    if (skin === 'magica' && r() < 0.5) {
        ctx.fillStyle = P.cor ? '#fff6c0' : P.tinta;
        ctx.beginPath(); ctx.arc(px + (r() - 0.5) * s, cy - s * 0.5, s * 0.06, 0, PI2); ctx.fill();
    }
}

function pico(ctx, bx, by, w, h, skin, P, cor, r) {
    const sombra = P.cor ? escurecer(cor, 0.3) : P.sombra;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(0.8, w * 0.035);
    ctx.strokeStyle = P.tinta;
    const fill = P.cor ? clarear(cor, 0.15) : P.montanha;
    if (skin === 'colinas') {
        ctx.beginPath(); ctx.moveTo(bx - w / 2, by); ctx.quadraticCurveTo(bx, by - h * 1.6, bx + w / 2, by);
        ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx + w * 0.05, by - h * 0.75); ctx.quadraticCurveTo(bx + w * 0.3, by - h * 0.55, bx + w * 0.4, by - h * 0.1);
        ctx.globalAlpha = 0.45; ctx.strokeStyle = sombra; ctx.stroke(); ctx.globalAlpha = 1;
        return;
    }
    if (skin === 'cristal') {
        for (let i = 0; i < 3; i++) {
            const cx = bx + (i - 1) * w * 0.22, hh = h * (i === 1 ? 1 : 0.65), ww = w * 0.16;
            ctx.beginPath(); ctx.moveTo(cx - ww, by); ctx.lineTo(cx - ww * 0.8, by - hh * 0.7); ctx.lineTo(cx, by - hh); ctx.lineTo(cx + ww * 0.8, by - hh * 0.7); ctx.lineTo(cx + ww, by); ctx.closePath();
            ctx.fillStyle = P.cor ? clarear(cor, 0.3) : fill; ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx, by - hh); ctx.lineTo(cx, by); ctx.globalAlpha = 0.4; ctx.stroke(); ctx.globalAlpha = 1;
        }
        return;
    }
    // Contorno do pico (rochosa = serrilhado)
    const pts = skin === 'rochosa'
        ? [[-0.5, 0], [-0.32, -0.45], [-0.22, -0.38], [-0.08, -0.92], [0, -1], [0.1, -0.7], [0.2, -0.78], [0.5, 0]]
        : skin === 'vulcao'
            ? [[-0.5, 0], [-0.14, -0.9], [0.14, -0.9], [0.5, 0]]
            : [[-0.5, 0], [-0.25, -0.52], [-0.1, -0.86], [0, -1], [0.14, -0.72], [0.3, -0.42], [0.5, 0]];
    ctx.beginPath();
    pts.forEach(([u, v], i) => (i ? ctx.lineTo(bx + u * w, by + v * h) : ctx.moveTo(bx + u * w, by + v * h)));
    ctx.fillStyle = fill; ctx.fill();
    // lado na sombra com hachura
    ctx.save(); ctx.clip();
    ctx.beginPath();
    const topo = skin === 'vulcao' ? 0.14 : 0;
    ctx.moveTo(bx + topo * w, by - h * (skin === 'vulcao' ? 0.9 : 1)); ctx.lineTo(bx + w * 0.5, by); ctx.lineTo(bx + w * 0.02, by); ctx.closePath();
    ctx.fillStyle = P.cor ? sombra : 'rgba(0,0,0,0)'; ctx.globalAlpha = P.cor ? 0.45 : 1; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = sombra; ctx.lineWidth = Math.max(0.5, w * 0.018); ctx.globalAlpha = P.cor ? 0.35 : 0.6;
    const n = Math.max(3, Math.round(w / 5));
    for (let i = 1; i <= n; i++) {
        const t = i / (n + 1), x1 = bx + lerp(topo * w, w * 0.5, t), y1 = by - h * (skin === 'vulcao' ? 0.9 : 1) * (1 - t);
        ctx.moveTo(x1, y1); ctx.lineTo(x1 - w * 0.14, y1 + h * 0.08);
    }
    ctx.stroke(); ctx.globalAlpha = 1; ctx.restore();
    ctx.beginPath();
    pts.forEach(([u, v], i) => (i ? ctx.lineTo(bx + u * w, by + v * h) : ctx.moveTo(bx + u * w, by + v * h)));
    ctx.strokeStyle = P.tinta; ctx.lineWidth = Math.max(0.8, w * 0.035); ctx.stroke();
    if (skin === 'picos') {
        ctx.beginPath();
        ctx.moveTo(bx, by - h); ctx.lineTo(bx - w * 0.17, by - h * 0.66); ctx.lineTo(bx - w * 0.07, by - h * 0.72);
        ctx.lineTo(bx, by - h * 0.62); ctx.lineTo(bx + w * 0.07, by - h * 0.7); ctx.lineTo(bx + w * 0.15, by - h * 0.62); ctx.closePath();
        ctx.fillStyle = P.neve; ctx.fill(); ctx.stroke();
    }
    if (skin === 'vulcao') {
        ctx.beginPath(); ctx.ellipse(bx, by - h * 0.9, w * 0.14, h * 0.06, 0, 0, PI2);
        ctx.fillStyle = '#d2481c'; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx - w * 0.04, by - h * 0.86); ctx.quadraticCurveTo(bx - w * 0.1, by - h * 0.5, bx - w * 0.06, by - h * 0.2);
        ctx.strokeStyle = '#d2481c'; ctx.lineWidth = Math.max(1, w * 0.03); ctx.stroke();
        ctx.fillStyle = P.cor ? 'rgba(90,80,80,.35)' : 'rgba(0,0,0,0)'; ctx.strokeStyle = P.tinta; ctx.lineWidth = Math.max(0.6, w * 0.02);
        for (let i = 0; i < 3; i++) {
            ctx.beginPath(); ctx.arc(bx + (i - 0.5) * w * 0.12 + r() * w * 0.05, by - h * (1.1 + i * 0.22), w * (0.07 + i * 0.03), 0, PI2);
            ctx.fill(); ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1;
        }
    }
}

function predio(ctx, x, y, w, h, tipo, P, roof, parede) {
    ctx.lineWidth = Math.max(0.8, w * 0.07); ctx.strokeStyle = P.tinta; ctx.lineJoin = 'round';
    const rect = () => { ctx.beginPath(); ctx.rect(x - w / 2, y - h, w, h); ctx.fillStyle = parede; ctx.fill(); ctx.stroke(); };
    const telhado = (path) => { ctx.beginPath(); path(); ctx.closePath(); ctx.fillStyle = roof; ctx.fill(); ctx.stroke(); };
    switch (tipo) {
        case 'cone':
            ctx.beginPath(); ctx.rect(x - w * 0.3, y - h, w * 0.6, h); ctx.fillStyle = parede; ctx.fill(); ctx.stroke();
            telhado(() => { ctx.moveTo(x - w * 0.42, y - h); ctx.lineTo(x, y - h - w * 1.3); ctx.lineTo(x + w * 0.42, y - h); });
            break;
        case 'dome':
            rect();
            telhado(() => { ctx.arc(x, y - h, w * 0.4, Math.PI, 0); });
            break;
        case 'gable':
            ctx.beginPath(); ctx.rect(x - w * 0.6, y - h * 0.6, w * 1.2, h * 0.6); ctx.fillStyle = parede; ctx.fill(); ctx.stroke();
            telhado(() => { ctx.moveTo(x - w * 0.72, y - h * 0.6); ctx.lineTo(x, y - h * 1.15); ctx.lineTo(x + w * 0.72, y - h * 0.6); });
            break;
        case 'pagoda':
            for (let i = 0; i < 3; i++) {
                const yy = y - i * h * 0.38, ww = w * (1 - i * 0.22);
                ctx.beginPath(); ctx.rect(x - ww * 0.35, yy - h * 0.3, ww * 0.7, h * 0.3); ctx.fillStyle = parede; ctx.fill(); ctx.stroke();
                telhado(() => { ctx.moveTo(x - ww * 0.6, yy - h * 0.28); ctx.quadraticCurveTo(x, yy - h * 0.48, x + ww * 0.6, yy - h * 0.28); ctx.lineTo(x + ww * 0.3, yy - h * 0.4); ctx.lineTo(x - ww * 0.3, yy - h * 0.4); });
            }
            break;
        case 'ruina':
            ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - h); ctx.lineTo(x - w * 0.2, y - h * 0.7); ctx.lineTo(x, y - h * 0.85);
            ctx.lineTo(x + w * 0.15, y - h * 0.45); ctx.lineTo(x + w / 2, y - h * 0.55); ctx.lineTo(x + w / 2, y); ctx.closePath();
            ctx.fillStyle = parede; ctx.fill(); ctx.stroke();
            break;
        case 'ameia': {
            rect();
            ctx.beginPath();
            const n = 3, cw = w / (n * 2 - 1);
            for (let i = 0; i < n; i++) ctx.rect(x - w / 2 + i * cw * 2, y - h - cw, cw, cw);
            ctx.fillStyle = parede; ctx.fill(); ctx.stroke();
            break;
        }
        default: // pontudo (medieval)
            rect();
            telhado(() => { ctx.moveTo(x - w * 0.62, y - h); ctx.lineTo(x, y - h - w * 0.9); ctx.lineTo(x + w * 0.62, y - h); });
    }
}
const TIPO_PREDIO = { medieval: ['pont', 'pont'], elfica: ['cone', 'cone'], deserto: ['dome', 'flat'], nordica: ['gable', 'gable'], fortaleza: ['ameia', 'pont'], oriental: ['pagoda', 'pagoda'], ruinas: ['ruina', 'ruina'] };

/* ---------- O desenho completo de uma página ---------- */
function desenhar(ctx, L, C, opt, campo, lugares, escala) {
    const P = paleta(opt.estilo, C.theme);
    const { W, H, mx, my, S } = L;
    const u = S / C.SIZE; // px de página por unidade do mundo
    const X = (x) => mx + ((x + C.HALF) / C.SIZE) * S, Y = (z) => my + ((z + C.HALF) / C.SIZE) * S;
    const G = (i) => (i / (campo.N - 1)) * S; // grade -> página
    const R = rng((C.world.id || 1) * 31 + 7);
    ctx.save();
    ctx.scale(escala, escala);

    // Papel
    ctx.fillStyle = P.papel; ctx.fillRect(0, 0, W, H);

    // Terra e água (grade pequena ampliada com suavização)
    const N = campo.N, cv = document.createElement('canvas'); cv.width = cv.height = N;
    const cx = cv.getContext('2d'), img = cx.createImageData(N, N);
    const terra = hex(P.terra), alto = hex(P.alto), agua = hex(P.agua), monte = hex(P.montanha);
    for (let k = 0; k < N * N; k++) {
        const hh = clamp((campo.h[k] - 1) / 18, 0, 1), w = clamp((campo.w[k] - 0.35) * 2.2, 0, 1);
        let c = terra.map((v, i) => lerp(v, alto[i], hh * 0.8));
        if (P.cor) {
            const mc = campo.mc[k] ? campo.mc[k].map((v) => v * 255) : monte;
            c = c.map((v, i) => lerp(v, lerp(mc[i], v, 0.35), campo.m[k] * 0.45));
            c = c.map((v) => lerp(v, 250, clamp((campo.neve[k] - 0.55) * 2.2, 0, 1) * 0.8));
            c = c.map((v, i) => lerp(v, [214, 72, 28][i], campo.lava[k]));
        }
        let a = agua;
        if (P.cor && campo.wc[k]) a = campo.wc[k].map((v, i) => lerp(v * 255, 241, 0.18));
        const fundo = clamp(campo.d[k] / 14, 0, 1) * 0.25;
        const ac = a.map((v) => v * (1 - fundo));
        c = c.map((v, i) => lerp(v, ac[i], w));
        img.data.set([c[0], c[1], c[2], 255], k * 4);
    }
    cx.putImageData(img, 0, 0);
    ctx.save();
    ctx.beginPath(); ctx.rect(mx, my, S, S); ctx.clip();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cv, mx, my, S, S);

    // Linhas de costa na água (onduladas para longe da terra)
    const linhas = (campoV, nivel, cor, lw, alpha, mascara) => {
        ctx.beginPath();
        contorno(campoV, N, nivel, (x1, y1, x2, y2) => { ctx.moveTo(mx + G(x1), my + G(y1)); ctx.lineTo(mx + G(x2), my + G(y2)); }, mascara);
        ctx.strokeStyle = cor; ctx.lineWidth = lw; ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.stroke(); ctx.globalAlpha = 1;
    };
    [[1.3, 0.55], [2.6, 0.38], [4.2, 0.24], [6.2, 0.14]].forEach(([nv, al]) => linhas(campo.d, nv, P.tintaAgua, 0.9, al));
    // Relevo (curvas de nível)
    if (opt.relevo) for (let nv = 3; nv < 40; nv += 3) linhas(campo.h, nv, P.tinta, 0.6, 0.22, (k) => campo.w[k] < 0.4);
    // Costa
    linhas(campo.w, 0.5, P.tinta, 1.7, 0.95);

    // Hachuras na água rasa (pergaminho e nanquim)
    if (!P.cor && opt.estilo !== 'noturno') {
        ctx.strokeStyle = P.tintaAgua; ctx.globalAlpha = 0.12; ctx.lineWidth = 0.6; ctx.beginPath();
        for (let j = 0; j < N; j += 2) for (let i = 0; i < N; i += 3) {
            const k = j * N + i;
            if (campo.w[k] > 0.6 && campo.d[k] > 2 && ((i * 7 + j * 13) % 5 === 0)) {
                const x = mx + G(i), y = my + G(j);
                ctx.moveTo(x - 3, y); ctx.quadraticCurveTo(x, y - 1.6, x + 3, y);
            }
        }
        ctx.stroke(); ctx.globalAlpha = 1;
    }

    // Grade de coordenadas
    if (opt.grade) {
        ctx.strokeStyle = P.tinta; ctx.globalAlpha = 0.18; ctx.lineWidth = 0.8; ctx.setLineDash([4, 5]); ctx.beginPath();
        for (let i = 1; i < 8; i++) { ctx.moveTo(mx + (S * i) / 8, my); ctx.lineTo(mx + (S * i) / 8, my + S); ctx.moveTo(mx, my + (S * i) / 8); ctx.lineTo(mx + S, my + (S * i) / 8); }
        ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }

    const naAgua = (x, z) => {
        const i = Math.round(((x + C.HALF) / C.SIZE) * (N - 1)), j = Math.round(((z + C.HALF) / C.SIZE) * (N - 1));
        if (i < 0 || j < 0 || i >= N || j >= N) return true;
        return campo.w[j * N + i] > 0.35;
    };

    // Regiões marcadas pelo usuário (translúcidas, para ver o que cobrem)
    for (const f of lugares.filter((l) => l.type === 'region' && !l.shape?.oculta && (l.points || []).length > 2)) {
        const skin = C.skinOf(f), cor = P.cor ? C.corOf(f) : P.tinta;
        const caminho = () => { ctx.beginPath(); f.points.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z)))); ctx.closePath(); };
        ctx.save();
        if (skin === 'preenchida') { caminho(); ctx.fillStyle = cor; ctx.globalAlpha = 0.2; ctx.fill(); }
        else if (skin === 'hachurada') {
            caminho(); ctx.save(); ctx.clip();
            const xs = f.points.map((p) => X(p[0])), ys = f.points.map((p) => Y(p[1]));
            const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
            ctx.strokeStyle = cor; ctx.globalAlpha = 0.4; ctx.lineWidth = 1.3;
            for (let d = x0 - (y1 - y0); d < x1; d += 8) { ctx.beginPath(); ctx.moveTo(d, y1); ctx.lineTo(d + (y1 - y0), y0); ctx.stroke(); }
            ctx.restore();
        }
        caminho(); ctx.globalAlpha = 0.85; ctx.strokeStyle = cor; ctx.lineWidth = Math.max(1.4, f.size * 1.3); ctx.lineJoin = 'round';
        ctx.setLineDash(skin === 'borda' ? [9, 6] : [14, 4, 2, 4]); ctx.stroke();
        ctx.restore();
    }

    // Rios (afinam na nascente, engrossam na foz)
    for (const f of lugares.filter((l) => l.type === 'river')) {
        const pts = C.rioPath(f); if (pts.length < 2) continue;
        const cor = P.cor ? mixHex(C.corOf(f), '#f1e4c3', 0.15) : P.agua;
        for (const camada of [0, 1]) {
            for (let i = 0; i < pts.length - 1; i++) {
                const t = i / (pts.length - 1), largura = f.size * u * lerp(0.55, 1.15, t) * 1.3;
                ctx.beginPath(); ctx.moveTo(X(pts[i][0]), Y(pts[i][1])); ctx.lineTo(X(pts[i + 1][0]), Y(pts[i + 1][1]));
                ctx.lineCap = 'round';
                ctx.strokeStyle = camada ? cor : P.tinta;
                ctx.lineWidth = camada ? Math.max(1, largura) : Math.max(2.2, largura + 2.2);
                ctx.stroke();
            }
        }
    }

    // Estradas
    for (const f of lugares.filter((l) => l.type === 'road')) {
        const pts = C.rioPath(f); if (pts.length < 2) continue;
        const skin = C.skinOf(f), cor = P.cor ? C.corOf(f) : (opt.estilo === 'noturno' ? '#c9a964' : '#a8865a');
        const larg = Math.max(1.4, f.size * u * 1.1);
        const caminho = () => { ctx.beginPath(); pts.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z)))); };
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (skin === 'trilha') {
            caminho(); ctx.setLineDash([larg * 2.2, larg * 1.6]); ctx.strokeStyle = P.tinta; ctx.lineWidth = Math.max(1, larg * 0.6); ctx.stroke();
        } else {
            caminho(); ctx.strokeStyle = P.tinta; ctx.lineWidth = larg + (skin === 'real' ? 3.2 : 1.8); ctx.stroke();
            caminho(); ctx.strokeStyle = cor; ctx.lineWidth = larg; ctx.stroke();
            if (skin === 'real') { caminho(); ctx.setLineDash([6, 6]); ctx.strokeStyle = P.tinta; ctx.globalAlpha = 0.5; ctx.lineWidth = 0.8; ctx.stroke(); }
            if (skin === 'pedra') { caminho(); ctx.setLineDash([1.5, 3]); ctx.strokeStyle = P.tinta; ctx.globalAlpha = 0.45; ctx.lineWidth = larg * 0.7; ctx.stroke(); }
        }
        ctx.restore();
    }

    // Florestas
    for (const f of lugares.filter((l) => l.type === 'forest')) {
        const F = C.forma(f), r = rng(f.id * 7 + 3), skin = C.skinOf(f), cor = P.cor ? C.corOf(f) : null;
        const s = 9;
        const area = Math.PI * Math.pow(f.size * u, 2) * F.sx * F.sz;
        const n = Math.min(2400, Math.round(area / (s * s * 0.42) * (f.shape?.densidade ?? 1)));
        const lista = [];
        for (let i = 0; i < n; i++) {
            const [x, z] = C.pontoDentro(f, r, F);
            if (Math.abs(x) > C.HALF - 1 || Math.abs(z) > C.HALF - 1 || naAgua(x, z)) continue;
            lista.push([X(x), Y(z), s * (0.8 + r() * 0.45), r]);
        }
        lista.sort((a, b) => a[1] - b[1]);
        const tons = skin === 'outono' ? [cor || P.copa, '#d9a03a', '#b8442a', '#e0c068'] : null;
        for (const [px, py, ss] of lista) {
            const c = tons && P.cor ? tons[Math.floor(r() * tons.length)] : (cor || P.copa);
            arvore(null, ctx, px, py, ss, skin, P.cor ? mixHex(c, '#f1e4c3', 0.1) : c, P, r);
        }
    }

    // Montanhas (picos de trás para frente)
    const picos = [];
    for (const f of lugares.filter((l) => l.type === 'mountain')) {
        const F = C.forma(f), r = rng(f.id * 13 + 5), skin = C.skinOf(f), cor = C.corOf(f);
        const base = clamp(f.size * u * 0.6, 14, 90) * (skin === 'colinas' ? 1.1 : 1);
        if (skin === 'vulcao') { picos.push({ x: X(f.x), y: Y(f.z) + base * 0.35, w: base * 1.5, h: base * 1.15, skin, cor, r }); continue; }
        const area = Math.PI * Math.pow(f.size * u * 0.75, 2) * F.sx * F.sz;
        const n = clamp(Math.round(area / (base * base * 0.35)), 2, 80);
        for (let i = 0; i < n; i++) {
            const [x, z] = C.pontoDentro(f, r, F, 0, 0.75);
            const dn = Math.min(1, C.distN(f, x, z, F) / 0.75), k = (1 - dn * 0.55) * (0.7 + r() * 0.4);
            if (naAgua(x, z) && C.distN(f, x, z, F) > 0.3) continue;
            picos.push({ x: X(x), y: Y(z) + base * 0.3, w: base * k, h: base * k * (skin === 'colinas' ? 0.45 : skin === 'picos' ? 1.15 : 0.9), skin, cor, r });
        }
        const [cx0, cz0] = [f.x, f.z];
        picos.push({ x: X(cx0), y: Y(cz0) + base * 0.4, w: base * 1.15, h: base * (skin === 'colinas' ? 0.55 : skin === 'picos' ? 1.35 : 1.05), skin, cor, r });
    }
    picos.sort((a, b) => a.y - b.y).forEach((p) => pico(ctx, p.x, p.y, p.w, p.h, p.skin, P, p.cor, p.r));

    // Cidades e vilas
    for (const f of lugares.filter((l) => l.type === 'city' || l.type === 'village').sort((a, b) => a.z - b.z)) {
        const F = C.forma(f), r = rng(f.id + 11), skin = C.skinOf(f), cidade = f.type === 'city';
        const roof = P.cor ? C.corOf(f) : (opt.estilo === 'noturno' ? '#3a4766' : escurecer(P.terra, 0.35));
        const parede = P.cor ? '#efe3c4' : (opt.estilo === 'noturno' ? '#2a3654' : clarear(P.terra, 0.3));
        const [t1, t2] = TIPO_PREDIO[skin] || TIPO_PREDIO.medieval;
        const tam = cidade ? clamp(f.size * u * 0.55, 20, 52) : clamp(f.size * u * 0.6, 14, 26);
        // muralha seguindo o contorno
        if (skin === 'fortaleza' || (cidade && f.size * u > 30)) {
            ctx.beginPath();
            for (let i = 0; i <= 64; i++) {
                const a = (i / 64) * PI2, b = f.size * 0.95 * C.borda(F, a);
                const [x, z] = C.paraMundo(f, Math.cos(a) * b, Math.sin(a) * b, F);
                i ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z));
            }
            ctx.strokeStyle = P.tinta; ctx.lineWidth = 2.2; ctx.stroke();
            ctx.setLineDash([2, 3]); ctx.lineWidth = 4; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        }
        // casas espalhadas pela forma (cidades grandes)
        const extras = Math.round((cidade ? clamp(Math.round(f.size * u * Math.max(F.sx, F.sz) / 7), 3, 40) : clamp(Math.round(f.size * u / 5), 2, 7)) * (f.shape?.densidade ?? 1));
        const casas = [];
        for (let i = 0; i < extras; i++) {
            const [x, z] = C.pontoDentro(f, r, F, cidade ? 0.3 : 0.2, 0.85);
            if (naAgua(x, z)) continue;
            casas.push([X(x), Y(z)]);
        }
        const centro = [X(f.x), Y(f.z)];
        [...casas, centro].sort((a, b) => a[1] - b[1]).forEach(([x, y]) => {
            const principal = x === centro[0] && y === centro[1];
            if (principal && cidade) {
                predio(ctx, x - tam * 0.38, y, tam * 0.32, tam * 0.55, t2, P, roof, parede);
                predio(ctx, x + tam * 0.38, y, tam * 0.32, tam * 0.55, t2, P, roof, parede);
                predio(ctx, x, y + 1, tam * 0.42, tam * 0.85, t1, P, roof, parede);
            } else {
                const s = principal ? tam : tam * (cidade ? 0.42 : 0.62);
                predio(ctx, x, y, s * 0.55, s * 0.55, principal ? t1 : (skin === 'nordica' || !cidade ? 'gable' : t2), P, roof, parede);
            }
        });
    }

    // Ruínas
    const rgba = (h, a) => `rgba(${hex(h).join(',')},${a})`;
    for (const f of lugares.filter((l) => l.type === 'ruins')) {
        const F = C.forma(f), r = rng(f.id * 19 + 7), skin = C.skinOf(f);
        const pedra = P.cor ? C.corOf(f) : (opt.estilo === 'noturno' ? '#55607a' : escurecer(P.terra, 0.22));
        const k = clamp(f.size * u / 9, 3, 14);
        const naBorda = (d, a) => { const b = f.size * d * C.borda(F, a), [x, z] = C.paraMundo(f, Math.cos(a) * b, Math.sin(a) * b, F); return [X(x), Y(z), x, z]; };
        ctx.save(); ctx.strokeStyle = P.tinta; ctx.lineWidth = 1.1; ctx.fillStyle = pedra; ctx.lineJoin = 'round';
        if (skin === 'pedras' || skin === 'templo') {
            const m = Math.max(6, Math.round(f.size * 1.3)), alto = skin === 'templo' ? 1.2 : 0.8;
            if (skin === 'templo') {
                ctx.beginPath();
                for (let i = 0; i <= 48; i++) { const [x, y] = naBorda(0.75, (i / 48) * PI2); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
                ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
            }
            const cols = [];
            for (let i = 0; i < m; i++) { const [x, y, wx, wz] = naBorda(skin === 'pedras' ? 0.7 : 0.62, (i / m) * PI2); if (!naAgua(wx, wz)) cols.push([x, y]); }
            cols.sort((a, b) => a[1] - b[1]).forEach(([x, y]) => {
                const h = k * alto * (skin === 'templo' ? 0.5 + r() * 0.6 : 1);
                ctx.beginPath(); ctx.rect(x - k * 0.22, y - h, k * 0.44, h); ctx.fill(); ctx.stroke();
            });
        } else if (skin === 'castelo') {
            const m = 36;
            for (let i = 0; i < m; i++) {
                if (r() < 0.3) continue;
                const [x0, y0] = naBorda(0.85, (i / m) * PI2), [x1, y1] = naBorda(0.85, ((i + 1) / m) * PI2);
                ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
                ctx.lineWidth = Math.max(2.5, k * 0.45); ctx.strokeStyle = P.tinta; ctx.stroke();
                ctx.lineWidth = Math.max(1.2, k * 0.3); ctx.strokeStyle = pedra; ctx.stroke();
            }
            // torre de menagem quebrada
            const x = X(f.x), y = Y(f.z), w = k * 1.3, h = k * 1.6;
            ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - h); ctx.lineTo(x - w / 4, y - h * 0.8); ctx.lineTo(x, y - h * 1.05); ctx.lineTo(x + w / 5, y - h * 0.7); ctx.lineTo(x + w / 2, y - h * 0.85); ctx.lineTo(x + w / 2, y); ctx.closePath();
            ctx.lineWidth = 1.2; ctx.strokeStyle = P.tinta; ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.rect(x - w * 0.1, y - h * 0.45, w * 0.2, h * 0.3); ctx.fillStyle = P.tinta; ctx.fill();
        } else {
            const n = clamp(Math.round(f.size * u / 3), 5, 34), blocos = [];
            for (let i = 0; i < n; i++) { const [wx, wz] = C.pontoDentro(f, r, F, 0, 0.85); if (!naAgua(wx, wz)) blocos.push([X(wx), Y(wz)]); }
            blocos.sort((a, b) => a[1] - b[1]).forEach(([x, y]) => {
                const w = k * (0.5 + r() * 0.7), h = k * (0.25 + r() * 0.5);
                ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - h); ctx.lineTo(x - w / 6, y - h * (0.6 + r() * 0.4)); ctx.lineTo(x + w / 2, y - h * 0.7); ctx.lineTo(x + w / 2, y); ctx.closePath();
                ctx.fill(); ctx.stroke();
                if (skin === 'arcana' && r() < 0.5) estrela(ctx, x + (r() - 0.5) * k, y - h - k * 0.6, k * 0.35, P.cor ? C.corOf(f) : P.tinta);
            });
        }
        ctx.restore();
    }

    // Torres
    for (const f of lugares.filter((l) => l.type === 'tower').sort((a, b) => a.z - b.z)) {
        const x = X(f.x), y = Y(f.z), skin = C.skinOf(f);
        const h = clamp(f.size * u * 1.6 * (f.shape?.altura ?? 1), 18, 52), w = h * 0.3;
        const corpo = skin === 'sombria' ? '#3a3440' : skin === 'elfica' ? '#f2ecdc' : P.cor ? '#d8ccb0' : (opt.estilo === 'noturno' ? '#2a3654' : clarear(P.terra, 0.3));
        const topo = P.cor ? C.corOf(f) : (opt.estilo === 'noturno' ? '#c9a964' : escurecer(P.terra, 0.4));
        ctx.save(); ctx.lineWidth = 1.2; ctx.strokeStyle = P.tinta; ctx.lineJoin = 'round';
        ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(x + w * 0.3, y, w * 0.9, w * 0.32, 0, 0, PI2); ctx.fill();
        const fino = skin === 'elfica' ? 0.75 : 1;
        ctx.beginPath(); ctx.moveTo(x - w / 2 * fino, y); ctx.lineTo(x - w * 0.4 * fino, y - h); ctx.lineTo(x + w * 0.4 * fino, y - h); ctx.lineTo(x + w / 2 * fino, y); ctx.closePath();
        ctx.fillStyle = corpo; ctx.fill(); ctx.stroke();
        if (skin === 'farol') for (const t of [0.25, 0.65]) { ctx.beginPath(); ctx.rect(x - w * 0.46, y - h * t - h * 0.12, w * 0.92, h * 0.12); ctx.fillStyle = topo; ctx.fill(); ctx.stroke(); }
        if (skin === 'vigia') {
            ctx.beginPath(); ctx.rect(x - w * 0.55, y - h - w * 0.35, w * 1.1, w * 0.35); ctx.fillStyle = corpo; ctx.fill(); ctx.stroke();
            for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.rect(x - w * 0.55 + i * w * 0.42, y - h - w * 0.6, w * 0.26, w * 0.25); ctx.fill(); ctx.stroke(); }
            ctx.beginPath(); ctx.moveTo(x, y - h - w * 0.6); ctx.lineTo(x, y - h - w * 1.5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x, y - h - w * 1.5); ctx.lineTo(x + w * 0.6, y - h - w * 1.3); ctx.lineTo(x, y - h - w * 1.1); ctx.fillStyle = topo; ctx.fill(); ctx.stroke();
        } else if (skin === 'farol') {
            const gy = y - h - w * 0.35;
            const g = ctx.createRadialGradient(x, gy, 0, x, gy, w * 1.8); g.addColorStop(0, 'rgba(255,230,140,.75)'); g.addColorStop(1, 'rgba(255,230,140,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, gy, w * 1.8, 0, PI2); ctx.fill();
            ctx.beginPath(); ctx.rect(x - w * 0.3, y - h - w * 0.55, w * 0.6, w * 0.55); ctx.fillStyle = '#ffe48a'; ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x - w * 0.42, y - h - w * 0.55); ctx.lineTo(x, y - h - w * 1.05); ctx.lineTo(x + w * 0.42, y - h - w * 0.55); ctx.closePath(); ctx.fillStyle = P.tinta; ctx.fill();
        } else {
            const alto = skin === 'elfica' ? 0.55 : 0.42, larg = skin === 'sombria' ? 0.45 : 0.55;
            ctx.beginPath(); ctx.moveTo(x - w * larg, y - h); ctx.lineTo(x, y - h - h * alto); ctx.lineTo(x + w * larg, y - h); ctx.closePath();
            ctx.fillStyle = skin === 'sombria' ? '#26222c' : topo; ctx.fill(); ctx.stroke();
            if (skin === 'mago' || skin === 'sombria') estrela(ctx, x, y - h - h * alto - w * 0.4, w * 0.45, P.cor ? C.corOf(f) : P.tinta);
        }
        ctx.beginPath(); ctx.rect(x - w * 0.09, y - h * 0.55, w * 0.18, h * 0.14); ctx.fillStyle = P.tinta; ctx.fill();
        ctx.restore();
    }

    // Fenômenos: névoas coloridas, chuva, tempestade, terremoto, nevasca e auras mágicas
    for (const f of lugares.filter((l) => l.type === 'phenomenon')) {
        const F = C.forma(f), skin = C.skinOf(f), cor = C.corOf(f), r = rng(f.id * 23 + 3);
        const caminho = (d = 1) => {
            ctx.beginPath();
            for (let i = 0; i <= 72; i++) {
                const a = (i / 72) * PI2, b = f.size * d * C.borda(F, a), [x, z] = C.paraMundo(f, Math.cos(a) * b, Math.sin(a) * b, F);
                i ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z));
            }
            ctx.closePath();
        };
        const R = f.size * u * Math.max(F.sx, F.sz), cx = X(f.x), cy = Y(f.z);
        const base = { chuva: '#6f8fb0', tempestade: '#3a4250', terremoto: '#8a6a44', nevasca: '#e8eef4' }[skin] || cor;
        ctx.save();
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        g.addColorStop(0, rgba(base, skin === 'nevasca' ? 0.7 : 0.5)); g.addColorStop(0.7, rgba(base, 0.28)); g.addColorStop(1, rgba(base, 0));
        caminho(); ctx.fillStyle = g; ctx.fill();
        caminho(); ctx.setLineDash([4, 5]); ctx.strokeStyle = P.tinta; ctx.globalAlpha = 0.45; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        caminho(); ctx.clip();
        const pts = (n, d1 = 0.95) => Array.from({ length: n }, () => { const [x, z] = C.pontoDentro(f, r, F, 0, d1); return [X(x), Y(z)]; });
        const area = Math.max(1, (R * R) / 400);
        switch (skin) {
            case 'chuva': case 'tempestade': {
                ctx.strokeStyle = skin === 'tempestade' ? P.tinta : (P.cor ? '#3d6a96' : P.tinta); ctx.globalAlpha = 0.55; ctx.lineWidth = 1;
                for (const [x, y] of pts(Math.min(500, Math.round(area * (skin === 'tempestade' ? 14 : 9))))) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2.5, y + 8); ctx.stroke(); }
                ctx.globalAlpha = 1;
                for (const [x, y] of pts(Math.max(2, Math.round(area * 0.8)), 0.7)) nuvem(ctx, x, y - 6, clamp(R / 7, 7, 22), skin === 'tempestade' ? '#59606e' : '#eef0f2', P.tinta);
                if (skin === 'tempestade') for (const [x, y] of pts(clamp(Math.round(area * 0.5), 1, 6), 0.6)) relampago(ctx, x, y, clamp(R / 5, 10, 30), P.tinta);
                break;
            }
            case 'terremoto': {
                ctx.strokeStyle = P.tinta; ctx.lineCap = 'round';
                const nr = Math.max(3, Math.round(3 + f.size / 6));
                for (let q = 0; q < nr; q++) {
                    const a0 = (q / nr) * PI2 + r() * 0.5;
                    ctx.beginPath(); ctx.moveTo(cx, cy);
                    for (let i = 1; i <= 10; i++) {
                        const a = a0 + (r() - 0.5) * 0.5, b = f.size * 0.95 * (i / 10) * C.borda(F, a), [x, z] = C.paraMundo(f, Math.cos(a) * b, Math.sin(a) * b, F);
                        ctx.lineTo(X(x), Y(z));
                    }
                    ctx.lineWidth = 2.2; ctx.stroke(); ctx.lineWidth = 0.8; ctx.stroke();
                }
                break;
            }
            case 'nevasca':
                ctx.strokeStyle = P.tinta; ctx.lineWidth = 0.8;
                for (const [x, y] of pts(Math.min(400, Math.round(area * 8)))) floco(ctx, x, y, 2.4);
                for (const [x, y] of pts(Math.max(2, Math.round(area * 0.6)), 0.7)) nuvem(ctx, x, y - 6, clamp(R / 7, 7, 22), '#f6f8fa', P.tinta);
                break;
            case 'magia':
                for (const [x, y] of pts(Math.min(200, Math.round(area * 4)))) estrela(ctx, x, y, 2 + r() * 4, P.cor ? cor : P.tinta);
                break;
            default: // névoa
                ctx.strokeStyle = P.cor ? escurecer(cor, 0.35) : P.tinta; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.1;
                for (const [x, y] of pts(Math.min(160, Math.round(area * 3)))) {
                    ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.bezierCurveTo(x - 5, y - 3, x - 2, y + 3, x + 2, y); ctx.bezierCurveTo(x + 5, y - 3, x + 8, y + 2, x + 11, y); ctx.stroke();
                }
                ctx.globalAlpha = 1;
        }
        ctx.restore();
    }

    // Mar: navios e serpentes onde a água é funda
    if (opt.mar) {
        const fundos = [];
        for (let j = 4; j < N - 4; j += 6) for (let i = 4; i < N - 4; i += 6) if (campo.d[j * N + i] > 9) fundos.push([i, j]);
        const rr = rng((C.world.id || 1) * 5 + 2);
        for (let q = 0; q < Math.min(3, Math.floor(fundos.length / 12)); q++) {
            const [i, j] = fundos[Math.floor(rr() * fundos.length)], x = mx + G(i), y = my + G(j);
            if (q === 1) serpente(ctx, x, y, 26, P); else navio(ctx, x, y, 18, P);
        }
    }
    // Névoa de guerra: nuvens onde os jogadores ainda não chegaram
    const comNevoa = C.nevoa?.ativo && (C.soJogador || opt.nevoa);
    if (comNevoa) {
        const nv = document.createElement('canvas'), Q = 600;
        nv.width = nv.height = Q;
        const nx = nv.getContext('2d');
        const g0 = nx.createLinearGradient(0, 0, Q, Q);
        g0.addColorStop(0, opt.estilo === 'noturno' ? '#1d2436' : '#d9cdb0'); g0.addColorStop(1, opt.estilo === 'noturno' ? '#252e44' : '#cfc2a3');
        nx.fillStyle = g0; nx.fillRect(0, 0, Q, Q);
        const rn = rng(77);
        for (let i = 0; i < 90; i++) {
            // nuvem: três arcos encostados
            const x = rn() * Q, y = rn() * Q, rr = 5 + rn() * 9;
            nx.beginPath(); nx.arc(x - rr, y, rr * 0.8, Math.PI, 0); nx.arc(x, y - rr * 0.3, rr, Math.PI, 0); nx.arc(x + rr * 1.1, y, rr * 0.75, Math.PI, 0);
            nx.strokeStyle = opt.estilo === 'noturno' ? 'rgba(227,196,126,.2)' : 'rgba(74,48,21,.16)'; nx.lineWidth = 0.9; nx.stroke();
        }
        nx.globalCompositeOperation = 'destination-out';
        for (const [x, z, r, v] of C.nevoa.areas) {
            const cx = ((x + C.HALF) / C.SIZE) * Q, cy = ((z + C.HALF) / C.SIZE) * Q, rr = (r / C.SIZE) * Q;
            nx.globalCompositeOperation = v ? 'destination-out' : 'source-over';
            const g = nx.createRadialGradient(cx, cy, rr * 0.75, cx, cy, rr);
            const base = opt.estilo === 'noturno' ? '33,40,60' : '214,201,172';
            g.addColorStop(0, `rgba(${base},1)`); g.addColorStop(1, `rgba(${base},0)`);
            nx.fillStyle = g; nx.beginPath(); nx.arc(cx, cy, rr, 0, PI2); nx.fill();
        }
        ctx.globalAlpha = C.soJogador ? 1 : 0.85;
        ctx.drawImage(nv, mx, my, S, S);
        ctx.globalAlpha = 1;
    }
    const visivel = (x, z) => {
        if (!comNevoa) return true;
        let vis = false;
        for (const [ax, az, r, v] of C.nevoa.areas) if ((x - ax) ** 2 + (z - az) ** 2 <= r * r) vis = !!v;
        return vis;
    };
    ctx.restore(); // clip do mapa

    // Rótulos: cada nome procura um lugar livre perto do seu ponto (sem cobrir outros nomes nem os desenhos principais)
    if (opt.nomes) {
        const rotulos = [], obstaculos = [];
        for (const f of lugares) {
            if (!visivel(f.x, f.z)) continue;
            const x = X(f.x), y = Y(f.z), k = f.size * u;
            if (f.type === 'city') obstaculos.push([x - clamp(k * 0.55, 20, 52) * 0.6, y - clamp(k * 0.55, 20, 52) * 0.9, clamp(k * 0.55, 20, 52) * 1.2, clamp(k * 0.55, 20, 52)]);
            else if (f.type === 'village') obstaculos.push([x - 9, y - 12, 18, 14]);
            else if (f.type === 'tower') { const h = clamp(k * 1.6 * (f.shape?.altura ?? 1), 18, 52); obstaculos.push([x - h * 0.2, y - h * 1.45, h * 0.4, h * 1.45]); }
            else if (f.type === 'mountain') { const h = clamp(k * 0.6, 14, 90); obstaculos.push([x - h * 0.6, y - h, h * 1.2, h]); }
        }
        for (const f of lugares) {
            if (f.shape?.semNome || !f.name) continue;
            if (!visivel(f.x, f.z) && !(f.points && f.points.some(([x, z]) => visivel(x, z)))) continue;
            let x = X(f.x), y = Y(f.z), ang = 0;
            const T = f.type;
            let fonte, cor = P.tinta, esp = 0;
            switch (T) {
                case 'city': case 'village': {
                    const F = C.forma(f);
                    let fundo = 0;
                    for (let i = 0; i < 48; i++) {
                        const a = (i / 48) * PI2, b = f.size * 0.95 * C.borda(F, a);
                        fundo = Math.max(fundo, C.paraMundo(f, Math.cos(a) * b, Math.sin(a) * b, F)[1]);
                    }
                    y = Math.max(y + (T === 'city' ? 22 : 14), Y(fundo) + 4) + 10;
                    fonte = T === 'city' ? `700 ${clamp(14 + f.size * 0.6, 16, 28)}px Cinzel, Georgia, serif` : `${clamp(12 + f.size * 0.5, 13, 18)}px 'IM Fell English', Georgia, serif`;
                    esp = T === 'city' ? 1 : 0;
                    break;
                }
                case 'mountain': fonte = `italic ${clamp(13 + f.size * 0.18, 14, 24)}px 'IM Fell English', Georgia, serif`; y += clamp(f.size * u * 0.6, 14, 90) * 0.75 + 10; esp = 2; break;
                case 'forest': fonte = `italic ${clamp(12 + f.size * 0.15, 13, 20)}px 'IM Fell English', Georgia, serif`; esp = 1.5; break;
                case 'lake': fonte = `italic ${clamp(12 + f.size * 0.2, 13, 22)}px 'IM Fell English', Georgia, serif`; cor = P.tintaAgua; esp = 3; break;
                case 'ocean': fonte = `italic ${clamp(18 + f.size * 0.12, 22, 44)}px 'IM Fell English', Georgia, serif`; cor = P.tintaAgua; esp = 8; break;
                case 'island': fonte = `italic ${clamp(13 + f.size * 0.15, 14, 24)}px 'IM Fell English', Georgia, serif`; esp = 2; break;
                case 'tower': fonte = `600 ${clamp(12 + f.size, 13, 18)}px Cinzel, Georgia, serif`; y += 14; esp = 0.5; break;
                case 'ruins': fonte = `italic ${clamp(12 + f.size * 0.2, 13, 19)}px 'IM Fell English', Georgia, serif`; y += clamp(f.size * u / 9, 3, 14) + 12; esp = 1; break;
                case 'region': {
                    if (f.shape?.oculta || !(f.points || []).length) continue;
                    [x, y] = ((c) => [X(c[0]), Y(c[1])])(C.centroDe(f.points));
                    const xs = f.points.map((p) => p[0]), larg = (Math.max(...xs) - Math.min(...xs)) * u;
                    fonte = `600 ${clamp(larg / 14, 14, 30)}px Cinzel, Georgia, serif`; esp = 3;
                    cor = P.cor ? escurecer(C.corOf(f), 0.25) : P.tinta;
                    break;
                }
                case 'phenomenon': fonte = `italic ${clamp(13 + f.size * 0.12, 14, 22)}px 'IM Fell English', Georgia, serif`; esp = 2; break;
                case 'road':
                case 'river': {
                    const pts = C.rioPath(f), a = pts[Math.floor(pts.length * 0.45)], b = pts[Math.min(pts.length - 1, Math.floor(pts.length * 0.45) + 3)];
                    if (!a || !b) continue;
                    x = X(a[0]); y = Y(a[1]); ang = Math.atan2(Y(b[1]) - y, X(b[0]) - x);
                    if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
                    fonte = `italic 13px 'IM Fell English', Georgia, serif`; cor = T === 'road' ? P.tinta : P.tintaAgua; esp = 1;
                    y -= 8;
                    break;
                }
                default: continue;
            }
            rotulos.push({ f, x, y, ang, fonte, cor, esp, T, nome: T === 'region' ? f.name.toUpperCase() : f.name });
        }
        posicionarRotulos(ctx, rotulos, obstaculos, { mx, my, S, halo: P.halo });
    }

    // Moldura, título, rosa-dos-ventos, escala e legenda
    ctx.strokeStyle = P.tinta; ctx.lineWidth = 1.6; ctx.strokeRect(mx, my, S, S);
    if (opt.grade) {
        ctx.fillStyle = P.tinta; ctx.font = `600 13px Cinzel, Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let i = 0; i < 8; i++) {
            ctx.fillText('ABCDEFGH'[i], mx + (S * (i + 0.5)) / 8, my - 12);
            ctx.fillText(String(i + 1), mx - 14, my + (S * (i + 0.5)) / 8);
        }
    }
    if (opt.moldura) moldura(ctx, L, P);
    if (opt.titulo) cartela(ctx, L, P, opt.tituloTexto || C.world.name, opt.subtitulo);
    if (opt.rosa) rosa(ctx, mx + S - 70, my + S - 76, 52, P);
    if (opt.escala) barraEscala(ctx, mx + 26, my + S - 30, u, C.SIZE, P);
    if (opt.legenda) legenda(ctx, mx + S - 16, my + 16, lugares, P, C);

    // Textura do papel e manchas
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = opt.estilo === 'noturno' ? 0.12 : 0.28;
    ctx.fillStyle = ctx.createPattern(textura(), 'repeat'); ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    if (opt.estilo !== 'tinta') {
        const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, opt.estilo === 'noturno' ? 'rgba(0,0,0,.55)' : 'rgba(110,70,20,.38)');
        ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
        const rs = rng((C.world.id || 1) * 3);
        for (let i = 0; i < 5; i++) {
            const x = rs() * W, y = rs() * H, rad = 40 + rs() * 120, g = ctx.createRadialGradient(x, y, 0, x, y, rad);
            g.addColorStop(0, 'rgba(120,80,30,.10)'); g.addColorStop(1, 'rgba(120,80,30,0)');
            ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
}

// Estrela de quatro pontas (magia, torres arcanas)
function estrela(ctx, x, y, s, cor) {
    ctx.save(); ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI2 - Math.PI / 2, d = i % 2 ? s * 0.32 : s; i ? ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d) : ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
    ctx.closePath(); ctx.fillStyle = cor; ctx.fill(); ctx.restore();
}
// Nuvem de contorno ondulado
function nuvem(ctx, x, y, s, cor, tinta) {
    ctx.save(); ctx.beginPath();
    ctx.moveTo(x - s, y + s * 0.3);
    ctx.arc(x - s * 0.55, y, s * 0.45, Math.PI * 0.8, Math.PI * 1.75);
    ctx.arc(x, y - s * 0.25, s * 0.55, Math.PI * 1.15, Math.PI * 1.9);
    ctx.arc(x + s * 0.6, y + s * 0.02, s * 0.42, Math.PI * 1.3, Math.PI * 0.2);
    ctx.closePath(); ctx.fillStyle = cor; ctx.fill(); ctx.strokeStyle = tinta; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
}
function relampago(ctx, x, y, s, tinta) {
    ctx.save(); ctx.beginPath();
    ctx.moveTo(x, y - s * 0.5); ctx.lineTo(x - s * 0.22, y + s * 0.05); ctx.lineTo(x + s * 0.02, y + s * 0.05); ctx.lineTo(x - s * 0.12, y + s * 0.6);
    ctx.lineTo(x + s * 0.25, y - s * 0.08); ctx.lineTo(x + s * 0.02, y - s * 0.08); ctx.lineTo(x + s * 0.14, y - s * 0.5); ctx.closePath();
    ctx.fillStyle = '#ffe36e'; ctx.fill(); ctx.strokeStyle = tinta; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
}
function floco(ctx, x, y, s) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI; ctx.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s); ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); }
    ctx.stroke();
}

// Ordem de importância: quem vem antes escolhe o lugar primeiro
const PRIORIDADE = { city: 0, region: 1, ocean: 2, island: 3, mountain: 4, lake: 5, tower: 6, forest: 7, ruins: 8, village: 9, phenomenon: 10, river: 11, road: 12 };
function posicionarRotulos(ctx, rotulos, obstaculos, { mx, my, S, halo }) {
    const ocupados = [];
    const bate = (r, lista) => lista.reduce((t, o) => {
        const ix = Math.min(r[0] + r[2], o[0] + o[2]) - Math.max(r[0], o[0]), iy = Math.min(r[1] + r[3], o[1] + o[3]) - Math.max(r[1], o[1]);
        return t + (ix > 0 && iy > 0 ? ix * iy : 0);
    }, 0);
    rotulos.sort((a, b) => (PRIORIDADE[a.T] ?? 9) - (PRIORIDADE[b.T] ?? 9));
    for (const r of rotulos) {
        const tam0 = parseFloat(r.fonte.match(/(\d+(?:\.\d+)?)px/)[1]);
        let melhor = null;
        for (const escala of [1, 0.86, 0.74]) {
            const tam = Math.round(tam0 * escala * 10) / 10, fonte = r.fonte.replace(/\d+(?:\.\d+)?px/, tam + 'px');
            ctx.font = fonte;
            const esp = r.esp * escala;
            // nomes longos quebram em duas linhas (menos em rios e estradas, que seguem o traçado)
            const nome = r.nome || r.f.name;
            let linhas = [nome];
            const largura = (s) => ctx.measureText(s).width + esp * (s.length - 1);
            if (!r.ang && largura(nome) > Math.max(170, tam * 11) && nome.includes(' ')) {
                const meio = nome.length / 2;
                let corte = -1;
                for (let i = 0; i < nome.length; i++) if (nome[i] === ' ' && (corte < 0 || Math.abs(i - meio) < Math.abs(corte - meio))) corte = i;
                linhas = [nome.slice(0, corte), nome.slice(corte + 1)];
            }
            const w = Math.max(...linhas.map(largura)) + 6, lh = tam * 1.12, h = lh * linhas.length + 2;
            const bw = r.ang ? Math.abs(w * Math.cos(r.ang)) + Math.abs(h * Math.sin(r.ang)) : w, bh = r.ang ? Math.abs(w * Math.sin(r.ang)) + Math.abs(h * Math.cos(r.ang)) : h;
            const passos = r.ang ? [[0, 0], [0, -h], [0, h], [bw * 0.5, 0], [-bw * 0.5, 0]]
                : [[0, 0], [0, h * 0.9], [0, -h * 0.9], [0, h * 1.8], [0, -h * 1.8], [w * 0.55, 0], [-w * 0.55, 0], [w * 0.55, h], [-w * 0.55, h], [w * 0.55, -h], [-w * 0.55, -h], [0, h * 2.7], [0, -h * 2.7]];
            for (const [dx, dy] of passos) {
                let x = r.x + dx, y = r.y + dy;
                x = clamp(x, mx + bw / 2 + 4, mx + S - bw / 2 - 4); y = clamp(y, my + bh / 2 + 4, my + S - bh / 2 - 4);
                const caixa = [x - bw / 2, y - bh / 2, bw, bh];
                const sobre = bate(caixa, ocupados), cobre = bate(caixa, obstaculos);
                const custo = sobre * 4 + cobre + Math.hypot(dx, dy) * 0.6 + (1 - escala) * 400;
                const achou = sobre === 0 && cobre === 0;
                if (!melhor || achou || custo < melhor.custo) melhor = { custo, x, y, fonte, esp, linhas, lh, caixa, livre: sobre === 0, achou };
                if (achou) break; // primeiro lugar totalmente livre, o mais perto do ponto
            }
            if (melhor.achou) break;
        }
        // rios e estradas só ganham nome se houver espaço livre; os outros ficam no melhor lugar achado
        if (!melhor.livre && (r.T === 'river' || r.T === 'road')) continue;
        ocupados.push(melhor.caixa);
        const lw = r.T === 'city' || r.T === 'region' ? 5 : 4.2;
        melhor.linhas.forEach((s, i) => texto(ctx, s, melhor.x, melhor.y + (i - (melhor.linhas.length - 1) / 2) * melhor.lh, melhor.fonte, r.cor, halo, melhor.esp, r.ang, lw));
    }
}

function texto(ctx, s, x, y, fonte, cor, halo, esp, ang, lw) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.font = fonte; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const chars = [...s], larg = chars.reduce((a, c) => a + ctx.measureText(c).width + esp, -esp);
    let cx = -larg / 2;
    ctx.strokeStyle = halo; ctx.lineWidth = lw; ctx.fillStyle = cor;
    for (const c of chars) { ctx.strokeText(c, cx, 0); cx += ctx.measureText(c).width + esp; }
    cx = -larg / 2;
    for (const c of chars) { ctx.fillText(c, cx, 0); cx += ctx.measureText(c).width + esp; }
    ctx.restore();
}

function navio(ctx, x, y, s, P) {
    ctx.save(); ctx.strokeStyle = P.tinta; ctx.lineWidth = 1.1; ctx.fillStyle = P.cor ? '#8a5a2b' : P.halo;
    ctx.beginPath(); ctx.moveTo(x - s, y); ctx.quadraticCurveTo(x, y + s * 0.55, x + s, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - s * 1.3); ctx.stroke();
    ctx.fillStyle = P.cor ? '#f5ecd5' : P.halo;
    ctx.beginPath(); ctx.moveTo(x + 1, y - s * 1.25); ctx.quadraticCurveTo(x + s * 0.8, y - s * 0.7, x + 1, y - s * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 1, y - s * 1.1); ctx.quadraticCurveTo(x - s * 0.6, y - s * 0.6, x - 1, y - s * 0.25); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s * 1.3, y + 3); ctx.quadraticCurveTo(x - s * 1.1, y + 1, x - s * 0.9, y + 3); ctx.moveTo(x + s * 0.9, y + 3); ctx.quadraticCurveTo(x + s * 1.1, y + 1, x + s * 1.3, y + 3);
    ctx.globalAlpha = 0.6; ctx.stroke();
    ctx.restore();
}
function serpente(ctx, x, y, s, P) {
    ctx.save(); ctx.strokeStyle = P.tinta; ctx.lineWidth = 1.2; ctx.fillStyle = P.cor ? '#4f7a6a' : P.halo;
    for (let i = 0; i < 3; i++) {
        const cx = x - s + i * s * 0.8;
        ctx.beginPath(); ctx.arc(cx, y, s * 0.3, Math.PI, 0); ctx.fill(); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(x + s * 1.2, y); ctx.quadraticCurveTo(x + s * 1.3, y - s * 0.9, x + s * 1.7, y - s * 0.8);
    ctx.lineTo(x + s * 1.65, y - s * 0.55); ctx.quadraticCurveTo(x + s * 1.45, y - s * 0.5, x + s * 1.45, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + s * 1.6, y - s * 0.72, 1.4, 0, PI2); ctx.fillStyle = P.tinta; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - s * 1.5, y + 2); ctx.lineTo(x + s * 1.9, y + 2); ctx.globalAlpha = 0.5; ctx.stroke();
    ctx.restore();
}

function moldura(ctx, L, P) {
    const { W, H } = L, m1 = 14, m2 = 22;
    ctx.save(); ctx.strokeStyle = P.tinta;
    ctx.lineWidth = 3; ctx.strokeRect(m1, m1, W - m1 * 2, H - m1 * 2);
    ctx.lineWidth = 1; ctx.strokeRect(m2, m2, W - m2 * 2, H - m2 * 2);
    // Faixa com marcas
    ctx.lineWidth = 0.8; ctx.globalAlpha = 0.6; ctx.beginPath();
    for (let x = m2 + 12; x < W - m2; x += 24) { ctx.moveTo(x, m1); ctx.lineTo(x, m2); ctx.moveTo(x, H - m2); ctx.lineTo(x, H - m1); }
    for (let y = m2 + 12; y < H - m2; y += 24) { ctx.moveTo(m1, y); ctx.lineTo(m2, y); ctx.moveTo(W - m2, y); ctx.lineTo(W - m1, y); }
    ctx.stroke(); ctx.globalAlpha = 1;
    for (const [x, y] of [[m1, m1], [W - m1, m1], [m1, H - m1], [W - m1, H - m1]]) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = P.halo; ctx.fillRect(-9, -9, 18, 18); ctx.strokeRect(-9, -9, 18, 18);
        ctx.fillStyle = P.tinta; ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
    }
    ctx.restore();
}

function cartela(ctx, L, P, titulo, sub) {
    const cx = L.W / 2, y = L.my - L.topo / 2 - 4;
    ctx.save();
    ctx.font = `700 40px Cinzel, Georgia, serif`;
    const w = Math.min(L.W - 160, Math.max(320, ctx.measureText(titulo).width + 120)), h = 64;
    // Faixa de pergaminho com pontas dobradas
    ctx.fillStyle = escurecer(P.halo, 0.12); ctx.strokeStyle = P.tinta; ctx.lineWidth = 1.4;
    for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * (w / 2 - 10), y - h / 2 + 12); ctx.lineTo(cx + s * (w / 2 + 34), y - h / 2 + 12);
        ctx.lineTo(cx + s * (w / 2 + 18), y + 6); ctx.lineTo(cx + s * (w / 2 + 34), y + h / 2 + 4); ctx.lineTo(cx + s * (w / 2 - 10), y + h / 2 + 4);
        ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = P.halo;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, y - h / 2); ctx.quadraticCurveTo(cx, y - h / 2 - 10, cx + w / 2, y - h / 2);
    ctx.lineTo(cx + w / 2, y + h / 2 - 6); ctx.quadraticCurveTo(cx, y + h / 2 - 16, cx - w / 2, y + h / 2 - 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let tam = 40;
    while (tam > 18 && ctx.measureText(titulo).width > w - 50) { tam -= 2; ctx.font = `700 ${tam}px Cinzel, Georgia, serif`; }
    ctx.fillText(titulo, cx, y - 6);
    if (sub) { ctx.font = `italic 17px 'IM Fell English', Georgia, serif`; ctx.fillText(sub, cx, y + h / 2 + 22); }
    ctx.restore();
}

function rosa(ctx, x, y, r, P) {
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = P.tinta; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, PI2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, PI2); ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 16; i++) {
        const a = (i / 16) * PI2; ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); ctx.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95); ctx.stroke();
    }
    const ponta = (a, len, larg, cheio) => {
        const c = Math.cos(a), s = Math.sin(a), pc = Math.cos(a + Math.PI / 2), ps = Math.sin(a + Math.PI / 2);
        ctx.beginPath(); ctx.moveTo(c * len, s * len); ctx.lineTo(pc * larg, ps * larg); ctx.lineTo(0, 0); ctx.closePath();
        ctx.fillStyle = cheio ? P.tinta : P.halo; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(c * len, s * len); ctx.lineTo(-pc * larg, -ps * larg); ctx.lineTo(0, 0); ctx.closePath();
        ctx.fillStyle = cheio ? P.halo : P.tinta; ctx.fill(); ctx.stroke();
    };
    for (let i = 0; i < 4; i++) ponta(Math.PI / 4 + (i * Math.PI) / 2, r * 0.55, r * 0.1, i % 2);
    for (let i = 0; i < 4; i++) ponta(-Math.PI / 2 + (i * Math.PI) / 2, r * 0.9, r * 0.16, i % 2 === 0);
    ctx.fillStyle = P.tinta; ctx.font = `700 ${Math.round(r * 0.36)}px Cinzel, Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, -r * 1.18);
    ctx.restore();
}

function barraEscala(ctx, x, y, u, size, P) {
    const passo = [5, 10, 20, 25, 50, 100, 200].find((v) => v * 4 * u > 140) || 200, seg = passo * u;
    ctx.save(); ctx.strokeStyle = P.tinta; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? P.halo : P.tinta; ctx.fillRect(x + i * seg, y, seg, 6); ctx.strokeRect(x + i * seg, y, seg, 6); }
    ctx.fillStyle = P.tinta; ctx.font = `13px 'IM Fell English', Georgia, serif`; ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i += 2) ctx.fillText(String(passo * i), x + i * seg, y - 6);
    ctx.textAlign = 'left'; ctx.font = `italic 13px 'IM Fell English', Georgia, serif`;
    ctx.fillText('léguas', x + seg * 4 + 8, y + 6);
    ctx.restore();
}

function legenda(ctx, xd, y, lugares, P, C) {
    const NOMES = { city: 'Cidade', village: 'Vila', mountain: 'Montanha', forest: 'Floresta', road: 'Estrada', river: 'Rio', lake: 'Lago', ocean: 'Mar', island: 'Ilha', tower: 'Torre', ruins: 'Ruínas', phenomenon: 'Fenômeno', region: 'Região' };
    const tipos = Object.keys(NOMES).filter((t) => lugares.some((l) => l.type === t));
    if (!tipos.length) return;
    const w = 150, h = 26 + tipos.length * 22, x = xd - w;
    ctx.save();
    ctx.fillStyle = P.halo; ctx.globalAlpha = 0.92; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
    ctx.strokeStyle = P.tinta; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h); ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
    ctx.fillStyle = P.tinta; ctx.font = `700 12px Cinzel, Georgia, serif`; ctx.textAlign = 'center'; ctx.fillText('LEGENDA', x + w / 2, y + 17);
    const r = rng(4);
    tipos.forEach((t, i) => {
        const yy = y + 40 + i * 22, ix = x + 22;
        if (t === 'city') predio(ctx, ix, yy + 4, 9, 10, 'pont', P, P.cor ? '#9a4a2c' : escurecer(P.terra, 0.35), P.cor ? '#efe3c4' : clarear(P.terra, 0.3));
        else if (t === 'village') predio(ctx, ix, yy + 4, 8, 8, 'gable', P, P.cor ? '#9a4a2c' : escurecer(P.terra, 0.35), P.cor ? '#efe3c4' : clarear(P.terra, 0.3));
        else if (t === 'mountain') pico(ctx, ix, yy + 5, 18, 14, 'classica', P, C.theme.cores.montanha, r);
        else if (t === 'forest') arvore(null, ctx, ix, yy + 5, 13, 'carvalhos', P.cor ? '#4f7a3a' : P.copa, P, r);
        else if (t === 'tower') { ctx.beginPath(); ctx.rect(ix - 3, yy - 8, 6, 15); ctx.fillStyle = P.cor ? '#d8ccb0' : P.halo; ctx.fill(); ctx.strokeStyle = P.tinta; ctx.lineWidth = 1; ctx.stroke(); ctx.beginPath(); ctx.moveTo(ix - 5, yy - 8); ctx.lineTo(ix, yy - 15); ctx.lineTo(ix + 5, yy - 8); ctx.closePath(); ctx.fillStyle = P.cor ? '#a8322a' : P.tinta; ctx.fill(); ctx.stroke(); }
        else if (t === 'ruins') { ctx.fillStyle = P.cor ? '#a39c8c' : P.halo; ctx.strokeStyle = P.tinta; ctx.lineWidth = 1; for (const [dx, h] of [[-7, 12], [-1, 7], [5, 10]]) { ctx.beginPath(); ctx.rect(ix + dx, yy + 6 - h, 4, h); ctx.fill(); ctx.stroke(); } }
        else if (t === 'region') { ctx.save(); ctx.beginPath(); ctx.moveTo(ix - 10, yy - 6); ctx.lineTo(ix + 8, yy - 8); ctx.lineTo(ix + 10, yy + 6); ctx.lineTo(ix - 8, yy + 7); ctx.closePath(); ctx.fillStyle = P.cor ? 'rgba(176,58,46,.25)' : 'rgba(0,0,0,.08)'; ctx.fill(); ctx.setLineDash([4, 2]); ctx.strokeStyle = P.cor ? '#b03a2e' : P.tinta; ctx.lineWidth = 1.4; ctx.stroke(); ctx.restore(); }
        else if (t === 'phenomenon') nuvem(ctx, ix, yy + 2, 10, P.cor ? '#c9b8e8' : P.halo, P.tinta);
        else {
            ctx.fillStyle = P.agua; ctx.strokeStyle = P.tinta;
            if (t === 'river') { ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ix - 9, yy); ctx.quadraticCurveTo(ix, yy - 6, ix + 9, yy); ctx.strokeStyle = P.agua; ctx.stroke(); }
            else if (t === 'road') { ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ix - 10, yy + 2); ctx.lineTo(ix + 10, yy - 2); ctx.strokeStyle = '#a8865a'; ctx.stroke(); ctx.lineWidth = 0.8; ctx.strokeStyle = P.tinta; ctx.stroke(); }
            else if (t === 'island') { ctx.beginPath(); ctx.ellipse(ix, yy, 11, 7, 0, 0, PI2); ctx.fillStyle = P.agua; ctx.fill(); ctx.beginPath(); ctx.ellipse(ix, yy, 6, 4, 0, 0, PI2); ctx.fillStyle = P.terra; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = P.tinta; ctx.stroke(); }
            else { ctx.beginPath(); ctx.ellipse(ix, yy, 10, 6, 0, 0, PI2); ctx.fill(); ctx.lineWidth = 1; ctx.stroke(); }
        }
        ctx.fillStyle = P.tinta; ctx.font = `14px 'IM Fell English', Georgia, serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(NOMES[t], x + 44, yy);
    });
    ctx.restore();
}

/* ---------- Janela interativa ---------- */
let C = null, opt = null, campo = null, lugares = [], L = null;
let off = null, offEscala = 0, view = { z: 1, x: 0, y: 0 }, hover = null, el = null;

function layout() {
    const S = 1000, m = 60, topo = opt.titulo ? 120 : 30;
    return { S, mx: m, my: m + topo, W: S + m * 2, H: S + m * 2 + topo, topo };
}

function montarDom() {
    el = document.createElement('div');
    el.className = 'atlas';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Mapa ilustrado');
    el.innerHTML = `
        <div class="atlas-palco">
            <canvas></canvas>
            <div class="atlas-carregando">Desenhando o mapa…</div>
            <div class="atlas-zoom">
                <button type="button" data-z="in" title="Aproximar">+</button>
                <button type="button" data-z="out" title="Afastar">−</button>
                <button type="button" data-z="fit" title="Ver inteiro">⤢</button>
            </div>
            <div class="atlas-dica">Arraste para mover, role para aproximar, clique num lugar para ver a história.</div>
            <div class="atlas-info" hidden></div>
        </div>
        <aside class="atlas-lado">
            <div class="atlas-topo"><h2>Mapa ilustrado</h2><button type="button" class="x" data-fechar title="Fechar">×</button></div>
            <p class="mut nota">Um desenho do seu mundo no estilo dos mapas antigos, feito a partir do que está no mapa 3D.</p>
            <label>Título <input data-o="tituloTexto" maxlength="60"></label>
            <label>Subtítulo <input data-o="subtitulo" maxlength="90" placeholder="Ex.: Terras conhecidas no ano 312"></label>
            <h3>Estilo</h3>
            <div class="chips atlas-estilos">${Object.entries(ESTILOS).map(([k, e]) => `<label class="chip"><input type="radio" name="atlas-estilo" value="${k}">${e.nome}</label>`).join('')}</div>
            <h3>Mostrar</h3>
            <div class="atlas-opcoes">
                ${[['nomes', 'Nomes dos lugares'], ['titulo', 'Título em faixa'], ['moldura', 'Moldura decorada'], ['rosa', 'Rosa-dos-ventos'], ['escala', 'Escala em léguas'], ['legenda', 'Legenda'], ['grade', 'Grade de coordenadas'], ['relevo', 'Curvas de relevo'], ['mar', 'Navios e serpentes no mar'], ['nevoa', 'Névoa dos jogadores'], ['segredos', 'Lugares secretos']]
                    .map(([k, l]) => `<label class="wb-check" data-op="${k}"><input type="checkbox" data-o="${k}"> ${l}</label>`).join('')}
            </div>
            <h3>Arquivo</h3>
            <label>Largura da imagem
                <select data-o="largura"><option value="1600">1600 px (tela)</option><option value="3200">3200 px (impressão A4)</option><option value="4800">4800 px (pôster)</option></select>
            </label>
            <div class="atlas-botoes">
                <button type="button" class="primary" data-baixar>Baixar mapa ilustrado (PNG)</button>
                <button type="button" data-vista3d>Baixar a vista 3D atual</button>
            </div>
        </aside>`;
    document.body.appendChild(el);

    const cv = el.querySelector('canvas');
    el.querySelector('[data-fechar]').addEventListener('click', fechar);
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
    el.querySelector('[data-baixar]').addEventListener('click', baixar);
    el.querySelector('[data-vista3d]').addEventListener('click', () => C.baixar3D());
    el.querySelector('.atlas-lado').addEventListener('change', (e) => {
        const t = e.target;
        if (t.name === 'atlas-estilo') opt.estilo = t.value;
        else if (t.dataset.o) opt[t.dataset.o] = t.type === 'checkbox' ? t.checked : t.value;
        sincronizarLado();
        try { const { tituloTexto, segredos, ...resto } = opt; localStorage.setItem('wb-atlas', JSON.stringify(resto)); } catch { /* sem armazenamento */ }
        if (t.dataset.o === 'largura') return;
        if (t.dataset.o === 'segredos') { prepararCampo(); }
        refazer();
    });
    el.querySelector('.atlas-lado').addEventListener('input', (e) => {
        if (e.target.dataset.o === 'tituloTexto' || e.target.dataset.o === 'subtitulo') {
            opt[e.target.dataset.o] = e.target.value;
            clearTimeout(refazer.t); refazer.t = setTimeout(refazer, 250);
        }
    });
    el.querySelector('.atlas-zoom').addEventListener('click', (e) => {
        const z = e.target.dataset.z; if (!z) return;
        if (z === 'fit') return ajustar();
        zoomEm(cv.clientWidth / 2, cv.clientHeight / 2, z === 'in' ? 1.4 : 1 / 1.4);
    });

    // Arrastar, rolar, passar o mouse e clicar
    let arrasto = null;
    cv.addEventListener('pointerdown', (e) => { arrasto = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, mov: 0 }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => {
        if (arrasto) {
            view.x = arrasto.vx + (e.clientX - arrasto.x); view.y = arrasto.vy + (e.clientY - arrasto.y);
            arrasto.mov = Math.max(arrasto.mov, Math.hypot(e.clientX - arrasto.x, e.clientY - arrasto.y));
            pintar();
            return;
        }
        const r = cv.getBoundingClientRect(), f = lugarEm(e.clientX - r.left, e.clientY - r.top);
        if (f !== hover) { hover = f; cv.style.cursor = f ? 'pointer' : 'grab'; pintar(); }
    });
    cv.addEventListener('pointerup', (e) => {
        const a = arrasto; arrasto = null;
        if (a && a.mov < 5) {
            const r = cv.getBoundingClientRect();
            mostrarInfo(lugarEm(e.clientX - r.left, e.clientY - r.top), e.clientX - r.left, e.clientY - r.top);
        }
    });
    cv.addEventListener('wheel', (e) => {
        e.preventDefault();
        const r = cv.getBoundingClientRect();
        zoomEm(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    cv.addEventListener('dblclick', (e) => { const r = cv.getBoundingClientRect(); zoomEm(e.clientX - r.left, e.clientY - r.top, 1.8); });
    new ResizeObserver(() => { if (el.classList.contains('aberto')) { dimensionarCanvas(); pintar(); } }).observe(cv);
}

function sincronizarLado() {
    el.querySelectorAll('[data-o]').forEach((i) => {
        const v = opt[i.dataset.o];
        if (i.type === 'checkbox') i.checked = !!v; else if (document.activeElement !== i) i.value = v ?? '';
    });
    el.querySelectorAll('input[name="atlas-estilo"]').forEach((i) => { i.checked = i.value === opt.estilo; i.parentElement.classList.toggle('on', i.checked); });
    el.querySelector('[data-op="segredos"]').hidden = !C.EDIT || !C.features.some((f) => f.secret);
    el.querySelector('[data-op="nevoa"]').hidden = !C.EDIT || !C.nevoa?.ativo;
}

function prepararCampo() {
    lugares = C.features.filter((f) => opt.segredos || !f.secret);
    campo = calcularCampo(C, lugares);
}

function dimensionarCanvas() {
    const cv = el.querySelector('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr);
}

// Desenha a página inteira numa tela fora da vista, numa resolução que acompanha o zoom
function refazer(escalaMin) {
    if (!campo) return; // ainda calculando o terreno
    L = layout();
    const cv = el.querySelector('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
    const precisa = clamp(Math.max(escalaMin || 0, view.z * dpr * 1.25, 1.6), 1, 4.4);
    offEscala = precisa;
    off = document.createElement('canvas');
    off.width = Math.round(L.W * precisa); off.height = Math.round(L.H * precisa);
    desenhar(off.getContext('2d'), L, C, opt, campo, lugares, precisa);
    pintar();
}
let refinarT;
function pintar() {
    if (!off) return;
    const cv = el.querySelector('canvas'), ctx = cv.getContext('2d'), dpr = cv.width / (cv.clientWidth || 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1a120a'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr * view.z, 0, 0, dpr * view.z, dpr * view.x, dpr * view.y);
    ctx.imageSmoothingQuality = 'high';
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30;
    ctx.drawImage(off, 0, 0, L.W, L.H);
    ctx.shadowBlur = 0;
    if (hover) contornoLugar(ctx, hover);
    // aproximou muito: redesenha com mais detalhe
    if (view.z * dpr > offEscala * 1.15 && offEscala < 4.4) {
        clearTimeout(refinarT);
        refinarT = setTimeout(() => refazer(view.z * dpr * 1.3), 220);
    }
}
function contornoLugar(ctx, f) {
    const { mx, my, S } = L, X = (x) => mx + ((x + C.HALF) / C.SIZE) * S, Y = (z) => my + ((z + C.HALF) / C.SIZE) * S;
    ctx.save(); ctx.strokeStyle = '#9b2f1d'; ctx.lineWidth = 2.4 / view.z; ctx.setLineDash([6 / view.z, 4 / view.z]);
    ctx.beginPath();
    if (f.type === 'river') C.rioPath(f).forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z))));
    else {
        const F = C.forma(f);
        for (let i = 0; i <= 80; i++) {
            const a = (i / 80) * PI2, b = f.size * 1.05 * C.borda(F, a), [x, z] = C.paraMundo(f, Math.cos(a) * b, Math.sin(a) * b, F);
            i ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z));
        }
    }
    ctx.stroke(); ctx.restore();
}

function ajustar() {
    const cv = el.querySelector('canvas'), w = cv.clientWidth, h = cv.clientHeight;
    view.z = Math.min(w / L.W, h / L.H) * 0.94;
    view.x = (w - L.W * view.z) / 2; view.y = (h - L.H * view.z) / 2;
    pintar();
}
function zoomEm(sx, sy, k) {
    const z = clamp(view.z * k, 0.15, 6);
    view.x = sx - ((sx - view.x) * z) / view.z; view.y = sy - ((sy - view.y) * z) / view.z; view.z = z;
    pintar();
}
function lugarEm(sx, sy) {
    if (!L) return null;
    const px = (sx - view.x) / view.z, py = (sy - view.y) / view.z;
    const x = ((px - L.mx) / L.S) * C.SIZE - C.HALF, z = ((py - L.my) / L.S) * C.SIZE - C.HALF;
    if (Math.abs(x) > C.HALF || Math.abs(z) > C.HALF) return null;
    let melhor = null, nota = 1;
    for (const f of lugares) {
        if (f.type === 'region') { if (!f.shape?.oculta && f.points?.length > 2 && C.dentroPoligono(f.points, x, z) && nota > 0.9) { melhor = f; nota = 0.9; } continue; }
        const d = f.type === 'river' ? C.riverDist(f, x, z) / (f.size * 2 + 2) : C.distN(f, x, z) / (f.type === 'city' || f.type === 'village' ? 1.3 : 1);
        const s = d + (f.type === 'ocean' ? 0.5 : 0) - (f.type === 'city' || f.type === 'village' ? 0.3 : 0);
        if (d <= 1 && s < nota) { melhor = f; nota = s; }
    }
    return melhor;
}
function mostrarInfo(f, sx, sy) {
    const box = el.querySelector('.atlas-info');
    if (!f) { box.hidden = true; return; }
    const n = f.npcs?.length || 0, lojas = f.shops?.length || 0;
    box.innerHTML = `<button type="button" class="x" title="Fechar">×</button>
        <p class="kind">${esc(C.TYPES[f.type]?.label || '')} · ${esc(C.SKINS[f.type]?.[C.skinOf(f)] || '')}</p>
        <h3>${esc(C.nomeDe ? C.nomeDe(f) : f.name)}</h3>
        ${f.description ? `<p>${esc(f.description)}</p>` : ''}
        ${n || lojas ? `<p class="mut">${n ? n + (n > 1 ? ' NPCs' : ' NPC') : ''}${n && lojas ? ' · ' : ''}${lojas ? lojas + (lojas > 1 ? ' lojas' : ' loja') : ''}</p>` : ''}`;
    box.hidden = false;
    const pal = el.querySelector('.atlas-palco');
    box.style.left = clamp(sx + 14, 10, pal.clientWidth - 300) + 'px';
    box.style.top = clamp(sy + 14, 10, pal.clientHeight - 180) + 'px';
    box.querySelector('.x').onclick = () => { box.hidden = true; };
}

async function baixar() {
    const btn = el.querySelector('[data-baixar]'), txt = btn.textContent;
    btn.disabled = true; btn.textContent = 'Preparando a imagem…';
    await new Promise((r) => setTimeout(r, 30));
    try {
        const larg = Number(opt.largura) || 1600, k = larg / L.W, c = document.createElement('canvas');
        c.width = larg; c.height = Math.round(L.H * k);
        desenhar(c.getContext('2d'), L, C, opt, campo, lugares, k);
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (C.world.name.normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'mundo') + '-mapa.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    } catch (e) {
        alert('Não deu para gerar a imagem nesse tamanho. Tente uma largura menor.');
    } finally {
        btn.disabled = false; btn.textContent = txt;
    }
}

function fechar() {
    el.classList.remove('aberto');
    document.body.classList.remove('atlas-on');
    C.aoFechar?.();
}

async function abrir(ctx) {
    C = ctx;
    if (!el) montarDom();
    const padrao = { estilo: 'pergaminho', nomes: true, titulo: true, moldura: true, rosa: true, escala: true, legenda: true, grade: false, relevo: false, mar: true, segredos: false, largura: '3200', subtitulo: '' };
    const salvo = (() => { try { return JSON.parse(localStorage.getItem('wb-atlas') || '{}'); } catch { return {}; } })();
    opt = { ...padrao, ...salvo, tituloTexto: C.world.name, segredos: false };
    el.classList.add('aberto');
    document.body.classList.add('atlas-on');
    sincronizarLado();
    el.querySelector('.atlas-carregando').hidden = false;
    el.querySelector('.atlas-info').hidden = true;
    dimensionarCanvas();
    await Promise.all(["700 40px Cinzel", "italic 20px 'IM Fell English'", "20px 'IM Fell English'"].map((f) => document.fonts?.load(f).catch(() => {})));
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 20)));
    prepararCampo();
    L = layout();
    view.z = 0; // ajustar depois do primeiro desenho
    refazer(1.6);
    ajustar();
    el.querySelector('.atlas-carregando').hidden = true;
    el.querySelector('[data-fechar]').focus();
}

window.WBAtlas = { abrir, ESTILOS };
})();
