'use strict';
/* ============================================================
   AGEZIM — arte da natureza: árvores, arbustos, minas, decalques, criaturas
   ============================================================ */

function leafBlob(ctx, x, y, r, base, light, dark, squash = 0.92) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(1, squash);
  const g = ctx.createRadialGradient(-r * 0.32, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
  g.addColorStop(0, C.str(light));
  g.addColorStop(0.55, C.str(base));
  g.addColorStop(1, C.str(dark));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.restore();
}

const Nature = {
  cache: new Map(),

  tree(kind, v) {
    const key = `tree|${kind}|${v}`;
    let s = this.cache.get(key);
    if (s) return s;
    if (kind === 'pine') s = this._pine(v);
    else if (kind === 'palm') s = this._palm(v);
    else s = this._oak(v);
    this.cache.set(key, s);
    return s;
  },

  _oak(v) {
    const pal = [
      { base: [74, 148, 52], light: [134, 196, 84], dark: [34, 92, 40] },
      { base: [96, 158, 52], light: [162, 206, 90], dark: [46, 100, 38] },
      { base: [58, 132, 56], light: [112, 184, 92], dark: [26, 80, 44] },
    ][v % 3];
    const r = new RNG(100 + v * 17);
    return bake(84, 104, 42, 86, (ctx) => {
      shadowBlob(ctx, 25, 10, 0.34, 7, 3);
      // tronco
      const bark = '#6b4a2b';
      ctx.beginPath();
      ctx.moveTo(-5, 1); ctx.quadraticCurveTo(-3.2, -10, -3, -24); ctx.lineTo(3, -24); ctx.quadraticCurveTo(3.4, -10, 6, 1);
      ctx.closePath();
      const tg = ctx.createLinearGradient(-6, 0, 6, 0);
      tg.addColorStop(0, '#8a6238'); tg.addColorStop(0.5, '#6b4a2b'); tg.addColorStop(1, '#3f2a17');
      ctx.fillStyle = tg; ctx.fill();
      ctx.strokeStyle = 'rgba(25,14,6,0.5)'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.strokeStyle = 'rgba(30,18,8,0.4)'; ctx.lineWidth = 0.6;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-2 + i * 1.8, -2); ctx.lineTo(-1.8 + i * 1.6, -22); ctx.stroke(); }
      // galhos
      line(ctx, [0, -22], [-13, -34], '#5a3d22', 3);
      line(ctx, [1, -24], [12, -36], '#5a3d22', 2.6);
      // copa: blobs de trás para frente
      const blobs = [];
      const n = 11;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + r.range(-0.3, 0.3);
        const rr = r.range(9, 15);
        blobs.push({ x: Math.cos(a) * r.range(8, 17), y: -42 + Math.sin(a) * r.range(5, 13), r: rr });
      }
      blobs.push({ x: -3, y: -47, r: 15 }, { x: 5, y: -38, r: 14 }, { x: -9, y: -37, r: 12 });
      blobs.sort((a, b) => a.y - b.y);
      for (const b of blobs) {
        const k = clamp((b.y + 56) / 26, 0, 1); // topo mais claro
        leafBlob(ctx, b.x, b.y, b.r, C.shade(pal.base, 0.82 + (1 - k) * 0.22), C.shade(pal.light, 0.9 + (1 - k) * 0.12), C.shade(pal.dark, 0.9));
      }
      // cachos de folhas e brilho
      for (let i = 0; i < 38; i++) {
        const a = r.range(0, TAU), d = r.range(0, 22);
        const x = Math.cos(a) * d * 1.05, y = -43 + Math.sin(a) * d * 0.62 - 1;
        const up = clamp((-y - 30) / 25, 0, 1);
        ctx.fillStyle = C.str(C.mix(pal.base, pal.light, 0.4 + up * 0.5), 0.55);
        ctx.beginPath(); ctx.ellipse(x - 2, y - 2, r.range(1.8, 3.4), r.range(1.2, 2.4), r.range(-0.5, 0.5), 0, TAU); ctx.fill();
      }
      // sombra de folhas embaixo
      ctx.fillStyle = 'rgba(10,40,20,0.20)';
      ctx.beginPath(); ctx.ellipse(2, -29, 17, 5, 0, 0, TAU); ctx.fill();
    });
  },

  _pine(v) {
    const r = new RNG(300 + v * 11);
    const pal = [
      { base: [44, 112, 70], light: [92, 164, 100], dark: [20, 66, 44] },
      { base: [52, 120, 78], light: [104, 172, 112], dark: [24, 72, 48] },
      { base: [38, 100, 66], light: [80, 150, 96], dark: [16, 58, 40] },
    ][v % 3];
    return bake(76, 112, 38, 94, (ctx) => {
      shadowBlob(ctx, 20, 8, 0.34, 6, 3);
      ctx.fillStyle = '#4d3420';
      ctx.beginPath(); ctx.moveTo(-3, 1); ctx.lineTo(-2, -16); ctx.lineTo(2, -16); ctx.lineTo(3.4, 1); ctx.closePath(); ctx.fill();
      const tiers = 5;
      for (let i = 0; i < tiers; i++) {
        const y = -12 - i * 15 - (i > 2 ? 1 : 0);
        const w = 22 - i * 3.6 + r.range(-0.8, 0.8);
        const h = 24 - i * 1.2;
        const top = y - h;
        // metade esquerda clara, direita escura
        const bottomL = [-w, y], bottomR = [w, y], tip = [r.range(-0.8, 0.8), top];
        ctx.beginPath();
        ctx.moveTo(bottomL[0], bottomL[1]);
        // borda inferior ondulada
        const n = 5;
        for (let k = 1; k <= n; k++) {
          const px = lerp(-w, w, k / n), py = y + (k % 2 ? 2.6 : -0.6);
          ctx.lineTo(px, py);
        }
        ctx.lineTo(tip[0], tip[1]);
        ctx.closePath();
        const g = ctx.createLinearGradient(-w, 0, w, 0);
        g.addColorStop(0, C.str(C.shade(pal.light, 1.0 - i * 0.02)));
        g.addColorStop(0.5, C.str(pal.base));
        g.addColorStop(1, C.str(pal.dark));
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = 'rgba(8,30,20,0.55)'; ctx.lineWidth = 0.8; ctx.stroke();
        // ramos
        ctx.strokeStyle = 'rgba(10,40,26,0.35)'; ctx.lineWidth = 0.9;
        for (let k = 0; k < 4; k++) {
          const t = (k + 1) / 5;
          ctx.beginPath(); ctx.moveTo(tip[0], tip[1] + h * (0.25 + t * 0.7));
          ctx.lineTo(lerp(-w, w, t * 0.6 + 0.2 * (k % 2)), y + 1); ctx.stroke();
        }
        // brilho
        ctx.fillStyle = 'rgba(190,235,160,0.18)';
        ctx.beginPath(); ctx.moveTo(tip[0] - 1, tip[1] + 3); ctx.lineTo(-w * 0.55, y - 2); ctx.lineTo(-w * 0.2, y - 3); ctx.closePath(); ctx.fill();
      }
    });
  },

  _palm(v) {
    const r = new RNG(500 + v * 9);
    return bake(96, 100, 48, 84, (ctx) => {
      shadowBlob(ctx, 22, 8, 0.3, 8, 3);
      const lean = [-7, 5, -3][v % 3];
      // tronco curvo anelado
      const top = [lean, -50];
      ctx.beginPath();
      ctx.moveTo(-3.2, 0); ctx.quadraticCurveTo(lean * 0.2 - 4, -26, top[0] - 2, top[1]);
      ctx.lineTo(top[0] + 2, top[1]); ctx.quadraticCurveTo(lean * 0.2 + 4.5, -26, 3.6, 0);
      ctx.closePath();
      const g = ctx.createLinearGradient(-5, 0, 5, 0);
      g.addColorStop(0, '#b08a58'); g.addColorStop(0.5, '#8a6a40'); g.addColorStop(1, '#5a4228');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(40,26,12,0.55)'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.strokeStyle = 'rgba(40,26,12,0.35)'; ctx.lineWidth = 0.7;
      for (let i = 1; i < 12; i++) {
        const t = i / 12;
        const x = lerp(0, top[0], t * t * 0.9), y = -50 * t;
        ctx.beginPath(); ctx.moveTo(x - 4 + t * 1.5, y); ctx.lineTo(x + 4 - t * 1.5, y - 1); ctx.stroke();
      }
      // folhas
      const leaves = 9;
      for (let i = 0; i < leaves; i++) {
        const a = (i / leaves) * TAU + 0.2 + r.range(-0.15, 0.15);
        const len = r.range(26, 34);
        const dx = Math.cos(a), dy = Math.sin(a) * 0.52;
        const tip = [top[0] + dx * len, top[1] + dy * len + 7 + Math.abs(dx) * 6];
        const mid = [top[0] + dx * len * 0.55, top[1] + dy * len * 0.55 - 7];
        const back = dy < -0.05;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(top[0], top[1]);
        ctx.quadraticCurveTo(mid[0] - dy * 6, mid[1] + dx * 3, tip[0], tip[1]);
        ctx.quadraticCurveTo(mid[0] + dy * 6, mid[1] - dx * 3 + 5, top[0], top[1]);
        ctx.closePath();
        const lg = ctx.createLinearGradient(top[0], top[1] - 8, tip[0], tip[1] + 6);
        lg.addColorStop(0, back ? '#3f8a3c' : '#5aa845');
        lg.addColorStop(1, back ? '#2c6a30' : '#3f8c3a');
        ctx.fillStyle = lg; ctx.fill();
        ctx.strokeStyle = 'rgba(15,50,25,0.55)'; ctx.lineWidth = 0.7; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.quadraticCurveTo(mid[0], mid[1] + 1, tip[0], tip[1]);
        ctx.strokeStyle = 'rgba(180,230,140,0.55)'; ctx.lineWidth = 0.7; ctx.stroke();
        ctx.restore();
      }
      circle(ctx, top[0] - 1.5, top[1] + 3, 2.6, '#6a4a22', '#2a1a0a', 0.5);
      circle(ctx, top[0] + 2, top[1] + 3.5, 2.5, '#7a5a2a', '#2a1a0a', 0.5);
    });
  },

  /* arbusto de frutas: level 0 cheio, 1 médio, 2 poucas */
  bush(v, level) {
    const key = `bush|${v}|${level}`;
    let s = this.cache.get(key);
    if (s) return s;
    const r = new RNG(700 + v * 13 + level);
    s = bake(56, 44, 28, 32, (ctx) => {
      shadowBlob(ctx, 17, 6, 0.3, 4, 2);
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const x = Math.cos(a) * 9 + r.range(-1, 1), y = -9 + Math.sin(a) * 4.5;
        leafBlob(ctx, x, y, r.range(6, 8.5), [58, 128, 50], [118, 184, 78], [30, 82, 38], 0.86);
      }
      leafBlob(ctx, -1, -13, 9, [66, 138, 54], [128, 192, 84], [34, 90, 40], 0.86);
      const cnt = [14, 8, 3][level];
      for (let i = 0; i < cnt; i++) {
        const a = r.range(0, TAU), d = r.range(1, 14);
        const x = Math.cos(a) * d, y = -10 + Math.sin(a) * d * 0.42 - 2;
        circle(ctx, x, y, 1.9, '#d4302a', '#6a1410', 0.5);
        circle(ctx, x - 0.5, y - 0.6, 0.6, 'rgba(255,200,190,0.9)');
      }
    });
    this.cache.set(key, s);
    return s;
  },

  /* minas */
  mine(kind, v, level) {
    const key = `mine|${kind}|${v}|${level}`;
    let s = this.cache.get(key);
    if (s) return s;
    const r = new RNG((kind === 'gold' ? 900 : 1100) + v * 19 + level * 5);
    const gold = kind === 'gold';
    const scale = [1, 0.82, 0.62][level];
    s = bake(70, 60, 35, 44, (ctx) => {
      shadowBlob(ctx, 22 * scale, 8 * scale, 0.36, 5, 2);
      ctx.save(); ctx.scale(scale, scale);
      const rockBase = gold ? [134, 120, 100] : [118, 120, 124];
      const rockLight = gold ? [190, 174, 142] : [176, 180, 186];
      const rockDark = gold ? [78, 68, 60] : [64, 66, 72];
      const rocks = [];
      const n = 5;
      for (let i = 0; i < n; i++) {
        rocks.push({ x: r.range(-14, 14), y: r.range(-4, 2) - i * 0.4, w: r.range(9, 15), h: r.range(9, 17) });
      }
      rocks.sort((a, b) => a.y - b.y);
      for (const k of rocks) {
        // pedra facetada
        const pts = [];
        const m = 7;
        for (let i = 0; i < m; i++) {
          const a = (i / m) * TAU + r.range(-0.2, 0.2);
          const rr = 1 + r.range(-0.15, 0.15);
          pts.push([k.x + Math.cos(a) * k.w * rr, k.y - k.h * 0.55 + Math.sin(a) * k.h * 0.6 * rr]);
        }
        const g = ctx.createLinearGradient(k.x - k.w, k.y - k.h, k.x + k.w, k.y);
        g.addColorStop(0, C.str(rockLight)); g.addColorStop(0.5, C.str(rockBase)); g.addColorStop(1, C.str(rockDark));
        poly(ctx, pts, g, 'rgba(20,16,14,0.7)', 0.8);
        // faces
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.lineTo(k.x, k.y - k.h * 0.55); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath(); ctx.moveTo(pts[3][0], pts[3][1]); ctx.lineTo(pts[4][0], pts[4][1]); ctx.lineTo(k.x, k.y - k.h * 0.55); ctx.closePath(); ctx.fill();
        if (gold) {
          // veios dourados
          for (let q = 0; q < 2; q++) {
            const a0 = r.range(0, TAU), d0 = r.range(0.1, 0.5);
            const cx = k.x + Math.cos(a0) * k.w * d0, cy = k.y - k.h * 0.55 + Math.sin(a0) * k.h * d0 * 0.5;
            const nug = [[cx - 3.2, cy + 0.8], [cx - 1.4, cy - 2.6], [cx + 1.6, cy - 3], [cx + 3.4, cy + 0.2], [cx + 1, cy + 2.6]];
            poly(ctx, nug, '#f4c430', '#7a5a08', 0.6);
            poly(ctx, [nug[1], nug[2], [cx + 0.4, cy - 0.2]], '#fff2a8');
          }
        }
      }
      if (gold) {
        // pepitas soltas
        for (let i = 0; i < 4; i++) {
          const x = r.range(-15, 15), y = r.range(-1, 3);
          poly(ctx, [[x - 2, y], [x - 0.6, y - 2.2], [x + 1.8, y - 1.8], [x + 2.2, y + 0.6], [x, y + 1.6]], '#ffd23a', '#7a5a08', 0.5);
          poly(ctx, [[x - 0.6, y - 2.2], [x + 1.8, y - 1.8], [x + 0.4, y - 0.4]], '#fff4b8');
        }
      } else {
        for (let i = 0; i < 5; i++) {
          const x = r.range(-16, 16), y = r.range(0, 4);
          poly(ctx, [[x - 2, y], [x - 1, y - 2.4], [x + 1.6, y - 2], [x + 2.4, y + 0.4], [x, y + 1.4]], '#a2a6ac', '#3a3c42', 0.5);
        }
      }
      ctx.restore();
    });
    this.cache.set(key, s);
    return s;
  },

  carcass(type) {
    const key = `carcass|${type}`;
    let s = this.cache.get(key);
    if (s) return s;
    s = bake(60, 40, 30, 26, (ctx) => {
      shadowBlob(ctx, 16, 5, 0.3, 2, 2);
      const sz = { cow: 1.2, horse: 1.3, chicken: 0.5, rabbit: 0.42 }[type] || 1;
      ctx.save(); ctx.scale(sz, sz);
      const col = { cow: '#7a4a2a', horse: '#8a5a34', chicken: '#f1ece0', rabbit: '#a99a86' }[type];
      ellipse(ctx, 0, -5, 13, 6.5, C.str(C.shade(col, 0.7)));
      ellipse(ctx, -0.5, -6.3, 12.2, 5.4, col);
      ellipse(ctx, -3, -8, 6, 2.2, C.str(C.shade(col, 1.18), 0.8));
      if (type === 'cow') { ellipse(ctx, 3, -6, 4, 2.6, '#f4efe4'); }
      // patas para cima
      for (let i = 0; i < 4; i++) {
        const x = -8 + i * 5.2;
        line(ctx, [x, -7], [x + 1.5, type === 'horse' ? -17 : -14], C.str(C.shade(col, 0.8)), type === 'chicken' || type === 'rabbit' ? 1.6 : 2.4);
      }
      const hc = type === 'chicken' ? '#f1ece0' : C.str(C.shade(col, 0.9));
      circle(ctx, 14, -3.5, type === 'horse' ? 3.8 : 3.4, hc, 'rgba(0,0,0,0.4)', 0.5);
      ctx.restore();
    });
    this.cache.set(key, s);
    return s;
  },

  /* decalques de chão: 0-3 tufos, 4-7 flores, 8 cogumelo, 9 pedrinha, 10-11 areia */
  decal(k) {
    const key = `decal|${k}`;
    let s = this.cache.get(key);
    if (s) return s;
    const r = new RNG(2000 + k * 7);
    s = bake(24, 24, 12, 18, (ctx) => {
      if (k <= 3) {
        const blades = 5 + k;
        for (let i = 0; i < blades; i++) {
          const a = (i / blades - 0.5) * 1.8 + r.range(-0.15, 0.15);
          const len = r.range(5, 9 + k);
          const tip = [Math.sin(a) * len * 0.8, -len * Math.cos(a * 0.6)];
          ctx.beginPath(); ctx.moveTo(Math.sin(a) * 1.5, 0); ctx.quadraticCurveTo(tip[0] * 0.3, -len * 0.55, tip[0], tip[1]);
          ctx.strokeStyle = C.str(C.mix([40, 100, 30], [150, 205, 80], r.next())); ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.stroke();
        }
      } else if (k <= 7) {
        const cols = [['#ffffff', '#ffe06a'], ['#ffd84a', '#d98a1a'], ['#ff7a8a', '#ffe0e4'], ['#9a8cff', '#f2eeff']][k - 4];
        for (let i = 0; i < 2; i++) {
          const x = r.range(-4, 4), y = -r.range(5, 8);
          line(ctx, [x, 0], [x, y + 1], '#3f7a2a', 0.9);
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * TAU;
            circle(ctx, x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.4, 1.5, cols[0], 'rgba(0,0,0,0.18)', 0.3);
          }
          circle(ctx, x, y, 1.1, cols[1]);
        }
      } else if (k === 8) {
        line(ctx, [0, 0], [0, -4], '#efe6d2', 2);
        ellipse(ctx, 0, -5, 3.6, 2.2, '#c8382a');
        circle(ctx, -1.2, -5.4, 0.5, '#fff'); circle(ctx, 1.2, -4.8, 0.5, '#fff');
      } else if (k === 9) {
        ellipse(ctx, 0, -1.5, 3.6, 2.2, '#8a8d92'); ellipse(ctx, -0.6, -2.2, 2.4, 1.2, '#b4b8bd');
        ellipse(ctx, 4.2, -0.6, 1.8, 1.1, '#7b7e83');
      } else if (k === 10) {
        ellipse(ctx, 0, -1, 2.4, 1.4, '#f4e8d0', 0.2); ellipse(ctx, 3.5, 0, 1.5, 1, '#d7c7a5');
        ellipse(ctx, -3, 0.2, 1.3, 0.9, '#cdbd9a');
      } else {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6 - 0.5) * 1.6;
          line(ctx, [0, 0], [Math.sin(a) * 6, -7 * Math.cos(a * 0.5)], '#9fae5a', 0.9);
        }
      }
    });
    this.cache.set(key, s);
    return s;
  },
};

/* ============================================================
   Animais (esqueleto 3D)
   ============================================================ */
const ANIMAL_FRAMES = { walk: 6, idle: 1, graze: 4 };

function drawAnimal(ctx, o) {
  const B = makeBody(o.heading);
  const t = (o.ph || 0) * TAU;
  const parts = new PartList();
  const walk = o.anim === 'walk';
  const graze = o.anim === 'graze';
  const s = Math.sin(t), c = Math.cos(t);
  const sideVis = (b) => ((b > 0 ? 1 : -1) * (B.lx + B.ly)) > -0.15;

  if (o.type === 'cow') {
    shadowBlob(ctx, 20, 8, 0.36, 1, 1);
    const spotty = o.v % 2 === 0;
    const body = spotty ? [244, 238, 226] : [122, 80, 48];
    const patch = spotty ? [58, 44, 38] : [240, 232, 214];
    const bob = walk ? Math.abs(c) * 0.7 : 0;
    const headDown = graze ? (0.5 + 0.5 * Math.sin(t - 1.2)) : 0;
    const legs = [[6.8, 3.4, 0], [6.8, -3.4, Math.PI], [-6.8, 3.4, Math.PI], [-6.8, -3.4, 0]];
    for (const [la, lb, ph] of legs) {
      const lift = walk ? Math.max(0, Math.sin(t + ph)) * 2.8 : 0;
      const sw = walk ? Math.cos(t + ph) * 3.4 : 0;
      const top = B.P(la, lb, 9.5 + bob), bot = B.P(la + sw, lb, lift);
      parts.add((top[2] + bot[2]) / 2, (g) => {
        tube(g, top, bot, 3.0, C.shade(body, 0.85));
        const hv = B.P(la + sw, lb, lift + 0.8);
        circle(g, hv[0], hv[1], 1.7, '#2e2420');
      });
    }
    const b1 = B.P(-9, 0, 15 + bob), b2 = B.P(8, 0, 15 + bob);
    parts.add((b1[2] + b2[2]) / 2 + 0.01, (g) => {
      tube(g, b1, b2, 14, body);
      // manchas
      const spots = [[-3, 6.6, 18], [3.5, 6.4, 14.5], [-6.5, 5.2, 12.5], [-1, -6.6, 18], [4.5, -6.4, 13], [-7, -5, 17]];
      for (const [sa, sb, sz] of spots) {
        if (!sideVis(sb)) continue;
        const p = B.P(sa, sb, sz + bob);
        ellipse(g, p[0], p[1], 4.4, 3.2, C.str(patch, 0.95), 0.2);
      }
      const top = B.P(0, 0, 21.5 + bob);
      ellipse(g, top[0], top[1], 8, 2.5, C.str(C.shade(body, 1.12), 0.55));
    });
    // cabeça
    const nk = B.P(8.5, 0, 19 + bob);
    const hz = lerp(15.5, 3.4, headDown);
    const ha = lerp(14.5, 17, headDown);
    const hd = B.P(ha, 0, hz + bob * (1 - headDown)), mz = B.P(ha + lerp(3.6, 2.6, headDown), 0, hz - lerp(2.2, 1.2, headDown));
    parts.add(hd[2] + 0.3, (g) => {
      tube(g, nk, hd, 6.4, body);
      tube(g, hd, mz, 7.3, body);
      tube(g, B.P(ha + lerp(3.2, 2.4, headDown), 0, hz - lerp(2, 1.2, headDown)), B.P(ha + lerp(4.6, 3.4, headDown), 0, hz - lerp(2.6, 1.8, headDown)), 4.8, '#e9a9a0');
      const e1 = B.P(ha + 1.6, 2.8, hz + 1.5), e2 = B.P(ha + 1.6, -2.8, hz + 1.5);
      circle(g, e1[0], e1[1], 0.6, '#161212'); circle(g, e2[0], e2[1], 0.6, '#161212');
      // chifres e orelhas
      const h1 = B.P(ha - 0.6, 3.2, hz + 3.2), h1t = B.P(ha - 0.6, 5.0, hz + 6);
      const h2 = B.P(ha - 0.6, -3.2, hz + 3.2), h2t = B.P(ha - 0.6, -5.0, hz + 6);
      line(g, h1, h1t, '#f3ecd6', 1.5); line(g, h2, h2t, '#f3ecd6', 1.5);
      const o1 = B.P(ha - 1.2, 4.6, hz + 1.2), o2 = B.P(ha - 1.2, -4.6, hz + 1.2);
      ellipse(g, o1[0], o1[1], 2.6, 1.3, C.str(C.shade(body, 0.9)), 0.4); ellipse(g, o2[0], o2[1], 2.6, 1.3, C.str(C.shade(body, 0.9)), -0.4);
    });
    // cauda
    const tb = B.P(-9.5, 0, 17 + bob), te = B.P(-11.4 + (walk ? s * 1.2 : 0), walk ? c * 1.5 : 0, 6.5);
    parts.add(tb[2] - 1, (g) => { tube(g, tb, te, 1.6, C.shade(body, 0.7)); circle(g, te[0], te[1], 1.7, '#2a201a'); });
  } else if (o.type === 'horse') {
    shadowBlob(ctx, 21, 8, 0.36, 1, 1);
    const coat = [[142, 90, 52], [74, 54, 42], [212, 196, 170]][o.v % 3];
    const mane = o.v % 3 === 2 ? [186, 168, 138] : [38, 26, 20];
    const bob = walk ? Math.abs(c) * 0.9 : 0;
    const headDown = graze ? (0.5 + 0.5 * Math.sin(t - 1.2)) : 0;
    const legs = [[7, 3, 0], [7, -3, Math.PI], [-7.5, 3, Math.PI], [-7.5, -3, 0]];
    for (const [la, lb, ph] of legs) {
      const lift = walk ? Math.max(0, Math.sin(t + ph)) * 4 : 0;
      const sw = walk ? Math.cos(t + ph) * 4.8 : 0;
      const top = B.P(la, lb, 14 + bob), kn = B.P(la + sw * 0.5 + 1, lb, 7.5 + lift * 0.6), bot = B.P(la + sw, lb, lift);
      parts.add((top[2] + bot[2]) / 2, (g) => {
        tube(g, top, kn, 3.1, coat); tube(g, kn, bot, 2.4, coat);
        const hv = B.P(la + sw, lb, lift + 0.6);
        circle(g, hv[0], hv[1], 1.7, '#2a211c');
      });
    }
    const b1 = B.P(-9.5, 0, 20.5 + bob), b2 = B.P(7, 0, 20.5 + bob);
    parts.add((b1[2] + b2[2]) / 2 + 0.01, (g) => {
      tube(g, b1, b2, 12.5, coat);
      const top = B.P(-1, 0, 26 + bob);
      ellipse(g, top[0], top[1], 8, 2.2, C.str(C.shade(coat, 1.15), 0.5));
    });
    const nb = B.P(6.5, 0, 24 + bob);
    const ne = B.P(lerp(12.5, 15.5, headDown), 0, lerp(32, 9, headDown) + bob * (1 - headDown));
    const hd = B.P(lerp(18, 19, headDown), 0, lerp(29, 3.5, headDown) + bob * (1 - headDown));
    parts.add(ne[2] + 0.4, (g) => {
      tube(g, nb, ne, 7, coat);
      // crina
      const m1 = B.P(6, 0, 28 + bob), m2 = B.P(lerp(11.5, 14.5, headDown), 0, lerp(34, 11, headDown) + bob * (1 - headDown));
      tube(g, m1, m2, 2.6, mane);
      tube(g, ne, hd, 5.4, coat);
      const nose = B.P(lerp(20.5, 20.5, headDown), 0, lerp(27.2, 1.8, headDown));
      tube(g, hd, nose, 4.2, C.shade(coat, 0.9));
      const e1 = B.P(lerp(15.5, 17, headDown), 2.2, lerp(31, 5, headDown)), e2 = B.P(lerp(15.5, 17, headDown), -2.2, lerp(31, 5, headDown));
      circle(g, e1[0], e1[1], 0.6, '#12100e'); circle(g, e2[0], e2[1], 0.6, '#12100e');
      const r1 = B.P(lerp(12.5, 15, headDown), 1.8, lerp(35, 12, headDown)), r2 = B.P(lerp(12.5, 15, headDown), -1.8, lerp(35, 12, headDown));
      const r1t = B.P(lerp(12, 14.5, headDown), 2, lerp(38.5, 15, headDown)), r2t = B.P(lerp(12, 14.5, headDown), -2, lerp(38.5, 15, headDown));
      line(g, r1, r1t, C.str(C.shade(coat, 0.8)), 1.5); line(g, r2, r2t, C.str(C.shade(coat, 0.8)), 1.5);
    });
    const tb2 = B.P(-10, 0, 23 + bob), te = B.P(-15 + (walk ? s : 0), walk ? c * 2 : 0, 10 + (walk ? 1 : 0));
    parts.add(tb2[2] - 1, (g) => { tube(g, tb2, te, 3.6, mane); });
  } else if (o.type === 'chicken') {
    shadowBlob(ctx, 8, 3.4, 0.32, 0.5, 0.5);
    const hop = walk ? Math.abs(Math.sin(t)) * 1.1 : 0;
    const peck = graze ? Math.max(0, Math.sin(t)) : 0;
    const legs = [[0.5, 1.8, 0], [0.5, -1.8, Math.PI]];
    for (const [la, lb, ph] of legs) {
      const lift = walk ? Math.max(0, Math.sin(t * 2 + ph)) * 1.4 : 0;
      const sw = walk ? Math.cos(t * 2 + ph) * 2 : 0;
      const top = B.P(la, lb, 4.8 + hop), bot = B.P(la + sw, lb, lift);
      parts.add((top[2] + bot[2]) / 2, (g) => {
        line(g, top, bot, '#d79a2a', 1.0);
        const f1 = B.P(la + sw + 1.8, lb, lift);
        line(g, bot, f1, '#d79a2a', 1.0);
      });
    }
    const b1 = B.P(-3, 0, 6.8 + hop), b2 = B.P(2, 0, 7.4 + hop);
    parts.add(0.1, (g) => {
      tube(g, b1, b2, 7.2, [246, 242, 232]);
      const w1 = B.P(-1.5, 3.2, 7.4 + hop), w2 = B.P(-3.5, 3.4, 6.2 + hop);
      const w3 = B.P(-1.5, -3.2, 7.4 + hop), w4 = B.P(-3.5, -3.4, 6.2 + hop);
      if (sideVis(1)) tube(g, w1, w2, 3.2, [220, 212, 196]);
      if (sideVis(-1)) tube(g, w3, w4, 3.2, [220, 212, 196]);
      // cauda
      for (let i = 0; i < 3; i++) {
        const tt = B.P(-4.6, (i - 1) * 1.2, 7.8 + hop), te = B.P(-7.2, (i - 1) * 1.9, 11 + hop - Math.abs(i - 1));
        tube(g, tt, te, 1.8, [236, 230, 216]);
      }
    });
    const hdz = 11.2 - peck * 6.2 + hop, hda = 4.2 + peck * 2.8;
    const hd = B.P(hda, 0, hdz);
    parts.add(hd[2] + 0.4, (g) => {
      tube(g, B.P(2.2, 0, 8 + hop), hd, 3.2, [246, 242, 232]);
      circle(g, hd[0], hd[1], 2.5, '#faf7ee', 'rgba(60,40,20,0.5)', 0.5);
      const bk = B.P(hda + 2.8, 0, hdz - 0.6);
      line(g, hd, bk, '#e8a020', 1.5);
      const cb = B.P(hda - 0.4, 0, hdz + 2.2);
      circle(g, cb[0], cb[1], 1.3, '#d83a2a'); circle(g, cb[0] + 0.8, cb[1] - 0.2, 1.0, '#d83a2a');
      const e1 = B.P(hda + 1.6, 1.4, hdz + 0.6), e2 = B.P(hda + 1.6, -1.4, hdz + 0.6);
      circle(g, e1[0], e1[1], 0.45, '#111'); circle(g, e2[0], e2[1], 0.45, '#111');
    });
  } else if (o.type === 'rabbit') {
    shadowBlob(ctx, 7, 3, 0.32, 0.5, 0.5);
    const hopH = walk ? Math.max(0, Math.sin(t)) * 4.5 : 0;
    const fur = [[160, 140, 116], [196, 190, 182], [120, 100, 84]][o.v % 3];
    const stretch = walk ? Math.sin(t) * 2 : 0;
    const b1 = B.P(-2.5 - stretch * 0.5, 0, 3.6 + hopH), b2 = B.P(2 + stretch * 0.4, 0, 4.6 + hopH);
    parts.add(0.1, (g) => {
      // patas traseiras
      const hl = B.P(-2.8 + stretch * 0.6, 2.2, 1.2 + hopH * 0.4), hr = B.P(-2.8 + stretch * 0.6, -2.2, 1.2 + hopH * 0.4);
      const hs = B.P(-1, 1.8, 3.4 + hopH), hs2 = B.P(-1, -1.8, 3.4 + hopH);
      tube(g, hs, hl, 2.8, C.shade(fur, 0.88)); tube(g, hs2, hr, 2.8, C.shade(fur, 0.88));
      tube(g, b1, b2, 6.3, fur);
      const tl = B.P(-4.6, 0, 4.4 + hopH);
      circle(g, tl[0], tl[1], 1.9, '#fbf8f2', 'rgba(0,0,0,0.25)', 0.4);
    });
    const hd = B.P(4.6 + stretch * 0.4, 0, 6.2 + hopH);
    parts.add(hd[2] + 0.4, (g) => {
      const fp1 = B.P(3, 1.4, 1 + hopH * 0.5), fp2 = B.P(3, -1.4, 1 + hopH * 0.5);
      line(g, B.P(2.6, 1.4, 3 + hopH), fp1, C.str(C.shade(fur, 0.9)), 1.6); line(g, B.P(2.6, -1.4, 3 + hopH), fp2, C.str(C.shade(fur, 0.9)), 1.6);
      circle(g, hd[0], hd[1], 3.0, C.str(fur), 'rgba(30,20,10,0.5)', 0.5);
      const e1 = B.P(3.8, 1.3, 9 + hopH), e1t = B.P(2.4, 1.7, 14 + hopH);
      const e2 = B.P(3.8, -1.3, 9 + hopH), e2t = B.P(2.4, -1.7, 14 + hopH);
      tube(g, e1, e1t, 2.1, C.shade(fur, 1.0)); tube(g, e2, e2t, 2.1, C.shade(fur, 1.0));
      line(g, e1, e1t, '#e8a6a0', 0.8); line(g, e2, e2t, '#e8a6a0', 0.8);
      const e3 = B.P(6.2, 1.3, 6.8 + hopH), e4 = B.P(6.2, -1.3, 6.8 + hopH);
      circle(g, e3[0], e3[1], 0.5, '#111'); circle(g, e4[0], e4[1], 0.5, '#111');
      const ns = B.P(7.4, 0, 5.6 + hopH);
      circle(g, ns[0], ns[1], 0.55, '#d98a92');
    });
  }
  parts.run(ctx);
}

const AnimalSprites = {
  cache: new Map(),
  get(type, v, dir, anim, frame) {
    const k = `${type}|${v}|${dir}|${anim}|${frame}`;
    let s = this.cache.get(k);
    if (s) return s;
    const n = ANIMAL_FRAMES[anim] || 1;
    const o = { type, v, heading: (dir / 8) * TAU, anim, ph: frame / n };
    s = bake(76, 72, 38, 52, (ctx) => drawAnimal(ctx, o));
    this.cache.set(k, s);
    return s;
  },
};
