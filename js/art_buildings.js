'use strict';
/* ============================================================
   AGEZIM — arte das construções (medieval, isométrica)
   ============================================================ */

const PAL = {
  stone: [158, 153, 144], stoneDark: [118, 114, 108], stoneLight: [186, 182, 172],
  plaster: [233, 221, 190], timber: [92, 62, 38], wood: [160, 114, 66], woodDark: [112, 78, 44],
  terracotta: [178, 86, 54], slate: [92, 104, 122], thatch: [196, 164, 84], shingle: [132, 96, 58],
  dirt: [150, 120, 78],
};

/* ---------- detalhes de face ---------- */
function timberTex(plaster, beam, o = {}) {
  const seed = o.seed || 2;
  return (ctx, F, u0, u1, v0, v1) => {
    Tex.plaster(plaster, { seed })(ctx, F, u0, u1, v0, v1);
    const bc = C.str(beam), bd = C.str(C.shade(beam, 0.55));
    const beamLine = (a, b, w) => { line(ctx, a, b, bd, w + 1.0, 'butt'); line(ctx, a, b, bc, w, 'butt'); };
    const span = u1 - u0;
    const n = Math.max(1, Math.round(span / (o.panel || 0.55)));
    // montantes
    for (let i = 0; i <= n; i++) {
      const u = lerp(u0, u1, i / n);
      beamLine(F(u, v0), F(u, v1), 1.7);
    }
    // vigas horizontais
    beamLine(F(u0, v0 + 1.2), F(u1, v0 + 1.2), 1.7);
    beamLine(F(u0, v1 - 1.2), F(u1, v1 - 1.2), 1.7);
    if (o.mid) beamLine(F(u0, lerp(v0, v1, 0.5)), F(u1, lerp(v0, v1, 0.5)), 1.3);
    // diagonais
    if (o.braces !== false) {
      for (let i = 0; i < n; i++) {
        const ua = lerp(u0, u1, i / n), ub = lerp(u0, u1, (i + 1) / n);
        if ((i + (o.flip ? 1 : 0)) % 2 === 0) beamLine(F(ua, v0 + 1.2), F(ub, v1 - 1.2), 1.1);
        else beamLine(F(ua, v1 - 1.2), F(ub, v0 + 1.2), 1.1);
      }
    }
  };
}

function archPts(F, u0, u1, v0, v1, steps = 8) {
  const um = (u0 + u1) / 2, hw = (u1 - u0) / 2;
  const ah = Math.min(hw * 36, (v1 - v0) * 0.45);
  const vt = v1 - ah;
  const pts = [F(u0, v0), F(u1, v0), F(u1, vt)];
  for (let i = 1; i < steps; i++) {
    const a = (i / steps) * Math.PI;
    pts.push(F(um + Math.cos(a) * hw, vt + Math.sin(a) * ah));
  }
  pts.push(F(u0, vt));
  return pts;
}

function archDoor(ctx, F, u0, u1, v0, v1, o = {}) {
  const frame = o.frame || [96, 88, 80];
  const pts = archPts(F, u0 - 0.03, u1 + 0.03, v0, v1 + 1.5);
  poly(ctx, pts, C.str(C.shade(frame, 0.95)), 'rgba(20,14,10,0.7)', 0.8);
  const p2 = archPts(F, u0 + 0.02, u1 - 0.02, v0, v1 - 1.2);
  ctx.save();
  pathPoly(ctx, p2); ctx.clip();
  ctx.fillStyle = o.open ? '#1c1410' : C.str(o.wood || [118, 80, 46]);
  ctx.fillRect(-500, -500, 1000, 1000);
  if (!o.open) {
    Tex.planks(o.wood || [118, 80, 46], { pw: 0.07, seed: 11 })(ctx, F, u0, u1, v0, v1);
    const um = (u0 + u1) / 2;
    line(ctx, F(um, v0), F(um, v1), 'rgba(20,12,6,0.8)', 1);
    for (const t of [0.28, 0.62]) {
      const v = lerp(v0, v1, t);
      line(ctx, F(u0, v), F(u1, v), '#2c2a2a', 1.3);
    }
    const h1 = F(um - 0.05, lerp(v0, v1, 0.45)), h2 = F(um + 0.05, lerp(v0, v1, 0.45));
    circle(ctx, h1[0], h1[1], 0.8, '#d1b25a'); circle(ctx, h2[0], h2[1], 0.8, '#d1b25a');
  } else {
    const g = ctx.createLinearGradient(0, F(u0, v0)[1] - 30, 0, F(u0, v0)[1] + 4);
    g.addColorStop(0, 'rgba(255,170,60,0.0)'); g.addColorStop(1, 'rgba(255,170,60,0.0)');
  }
  ctx.restore();
  pathPoly(ctx, p2); ctx.strokeStyle = 'rgba(20,12,6,0.7)'; ctx.lineWidth = 0.7; ctx.stroke();
}

function windowQuad(ctx, F, u0, u1, v0, v1, o = {}) {
  const frame = o.frame || [80, 54, 34];
  poly(ctx, [F(u0 - 0.02, v0 - 0.8), F(u1 + 0.02, v0 - 0.8), F(u1 + 0.02, v1 + 0.8), F(u0 - 0.02, v1 + 0.8)], C.str(frame), 'rgba(20,12,6,0.6)', 0.6);
  poly(ctx, [F(u0, v0), F(u1, v0), F(u1, v1), F(u0, v1)], o.glass || '#27384f');
  poly(ctx, [F(u0, lerp(v0, v1, 0.5)), F(u1, lerp(v0, v1, 0.5)), F(u1, v1), F(u0, v1)], 'rgba(150,200,255,0.25)');
  const um = (u0 + u1) / 2;
  line(ctx, F(um, v0), F(um, v1), C.str(frame), 0.8, 'butt');
  line(ctx, F(u0, (v0 + v1) / 2), F(u1, (v0 + v1) / 2), C.str(frame), 0.8, 'butt');
  if (o.shutters) {
    const w = (u1 - u0) * 0.5;
    poly(ctx, [F(u0 - w, v0), F(u0 - 0.01, v0), F(u0 - 0.01, v1), F(u0 - w, v1)], C.str(o.shutters), 'rgba(20,12,6,0.6)', 0.5);
    poly(ctx, [F(u1 + 0.01, v0), F(u1 + w, v0), F(u1 + w, v1), F(u1 + 0.01, v1)], C.str(o.shutters), 'rgba(20,12,6,0.6)', 0.5);
  }
}
function slit(ctx, F, u, v0, v1) {
  poly(ctx, [F(u - 0.035, v0), F(u + 0.035, v0), F(u + 0.035, v1), F(u - 0.035, v1)], '#15110f', 'rgba(0,0,0,0.5)', 0.4);
}

/* objetos pequenos */
function crate(ctx, cx, cy, s, z, col = [150, 104, 58]) {
  const o = boxColors(col); o.edge = 'rgba(30,18,8,0.7)';
  o.texL = Tex.planks(col, { pw: 0.5 * s * 2, seed: 4 }); o.texR = Tex.planks(col, { pw: 0.5 * s * 2, seed: 6 });
  box(ctx, cx - s, cy - s, cx + s, cy + s, z, z + s * 36, o);
}
function barrel(ctx, cx, cy, r, z, h, col = [130, 88, 48]) {
  cylinder(ctx, cx, cy, r, z, z + h, col, { top: C.shade(col, 1.15), edge: 'rgba(25,14,6,0.65)' });
  for (const t of [0.22, 0.78]) {
    const c = PX(cx, cy, z + h * t);
    ctx.beginPath(); ctx.ellipse(c[0], c[1], r * 45.25, r * 22.6, 0, 0.0, Math.PI);
    ctx.strokeStyle = '#2a2a2e'; ctx.lineWidth = 1.2; ctx.stroke();
  }
}
function sack(ctx, cx, cy, z, col = [214, 196, 150]) {
  const p = PX(cx, cy, z);
  ellipse(ctx, p[0], p[1] - 4, 5.2, 5.4, C.str(C.shade(col, 0.78)));
  ellipse(ctx, p[0] - 0.5, p[1] - 4.5, 4.6, 4.9, C.str(col));
  ellipse(ctx, p[0] - 1.2, p[1] - 6, 2.2, 1.6, C.str(C.shade(col, 1.15), 0.8));
  line(ctx, [p[0] - 1.6, p[1] - 9.4], [p[0] + 1.6, p[1] - 9.4], C.str(C.shade(col, 0.6)), 1.2);
}
function logPile(ctx, cx, cy, z, n = 3) {
  for (let r = 0; r < 2; r++) {
    const cnt = n - r;
    for (let i = 0; i < cnt; i++) {
      const y = cy + (i - (cnt - 1) / 2) * 0.17;
      const a = PX(cx - 0.34, y, z + 3 + r * 5), b = PX(cx + 0.34, y, z + 3 + r * 5);
      tube(ctx, a, b, 4.4, [136, 92, 54]);
      circle(ctx, b[0], b[1], 2.1, '#d6ad74', '#5a3a1c', 0.5);
      circle(ctx, b[0], b[1], 1.0, 'rgba(120,80,40,0.55)');
    }
  }
}
function anvil(ctx, cx, cy, z) {
  const p = PX(cx, cy, z);
  poly(ctx, [[p[0] - 4, p[1] - 6], [p[0] + 5, p[1] - 6], [p[0] + 3.5, p[1] - 3.5], [p[0] - 2.5, p[1] - 3.5]], '#4a4f57', '#15171a', 0.6);
  poly(ctx, [[p[0] - 7, p[1] - 6.2], [p[0] - 4, p[1] - 6], [p[0] - 3, p[1] - 4.6], [p[0] - 5, p[1] - 4.8]], '#4a4f57', '#15171a', 0.5);
  poly(ctx, [[p[0] - 2.6, p[1] - 3.5], [p[0] + 2.4, p[1] - 3.5], [p[0] + 2, p[1] - 0.5], [p[0] - 2, p[1] - 0.5]], '#33373d', '#15171a', 0.5);
  line(ctx, [p[0] - 3, p[1] - 6.2], [p[0] + 4, p[1] - 6.2], '#9aa2ac', 0.8);
}

/* ---------- caches ---------- */
const Buildings = {
  cache: new Map(),
  hpx: { house: 54, farm: 6, depot: 44, barracks: 88, blacksmith: 76, market: 66, towncenter: 122, wall: 38, gate: 44 },

  spriteDims(def, hmax) {
    const w = def.w, d = def.d;
    const W = (w + d) * HW + 56;
    const ay = (w + d) * 8 + hmax + 18;
    const H = ay + (w + d) * 8 + 16;
    return { W, H, ax: W / 2, ay };
  },

  get(type, team, opts = {}) {
    const key = `${type}|${team}|${opts.mask || 0}|${opts.axis || 'x'}|${opts.open ? 1 : 0}|${opts.stage || 0}`;
    let s = this.cache.get(key);
    if (s) return s;
    const def = BUILD_DEFS[type];
    const hmax = this.hpx[type] + 14;
    const dm = this.spriteDims(def, hmax);
    s = bake(dm.W, dm.H, dm.ax, dm.ay, (ctx) => {
      const fn = this['_' + type];
      fn.call(this, ctx, TEAM_COLORS[team], opts, def);
    });
    s.bh = this.hpx[type];   // altura visual da construção em px (não confundir com s.h)
    this.cache.set(key, s);
    return s;
  },

  /* ================= CASA ================= */
  _house(ctx, tm, o) {
    groundShadow(ctx, -0.8, -0.8, 0.8, 0.8, 44, 0.3);
    groundAO(ctx, -0.8, -0.8, 0.8, 0.8, 0.12, 0.3);
    // fundação
    box(ctx, -0.8, -0.8, 0.8, 0.8, 0, 5, { ...boxColors(PAL.stone), texL: Tex.stone(PAL.stone, { course: 2.6, bw: 0.14 }), texR: Tex.stone(PAL.stone, { course: 2.6, bw: 0.14 }) });
    // paredes
    const wall = boxColors(PAL.plaster);
    wall.texL = timberTex(PAL.plaster, PAL.timber, { panel: 0.52, seed: 3 });
    wall.texR = timberTex(PAL.plaster, PAL.timber, { panel: 0.5, seed: 5, flip: true });
    const F = box(ctx, -0.72, -0.72, 0.72, 0.72, 5, 24, wall);
    // porta (face esquerda +y) e janelas
    archDoor(ctx, F.FL, -0.16, 0.16, 5, 17, { frame: PAL.stoneDark, wood: [120, 78, 40] });
    windowQuad(ctx, F.FL, -0.58, -0.38, 12, 19, { shutters: tm.main });
    windowQuad(ctx, F.FL, 0.38, 0.58, 12, 19, { shutters: tm.main });
    windowQuad(ctx, F.FR, -0.22, 0.22, 11, 19, { shutters: tm.main });
    // telhado
    const roof = { axis: 'x', over: 0.16, tex: Tex.shingles(PAL.terracotta, { rows: 5, cols: 7 }), front: C.shade(PAL.terracotta, 1.0), back: C.shade(PAL.terracotta, 0.74), gable: C.shade(PAL.plaster, 0.9) };
    roof.between = (g) => {
      // chaminé
      const o2 = boxColors(PAL.stone); o2.edge = 'rgba(20,14,10,0.6)';
      o2.texL = Tex.stone(PAL.stone, { course: 3, bw: 0.12 }); o2.texR = Tex.stone(PAL.stone, { course: 3, bw: 0.12 });
      box(g, 0.28, -0.42, 0.5, -0.2, 28, 50, o2);
      box(g, 0.25, -0.45, 0.53, -0.17, 50, 53, boxColors(PAL.stoneDark));
    };
    gableRoof(ctx, -0.72, -0.72, 0.72, 0.72, 24, 44, roof);
    // bandeira da equipe na cumeeira
    const base = PX(0.88, 0, 41);
    flagPole(ctx, base, 18, tm === TEAM_COLORS[0] ? 0 : 1, 0, 0.8);
  },

  /* ================= FAZENDA (chão) ================= */
  _farm(ctx, tm, o) {
    const stage = o.stage | 0; // 0 = terra, 1 = brotos, 2 = trigo dourado, 3 = trigo médio, 4 = restolho
    const h = 1.5;
    // terra
    const P = (x, y) => PX(x, y, 0);
    const dia = [P(-h, -h), P(h, -h), P(h, h), P(-h, h)];
    ctx.save();
    pathPoly(ctx, dia); ctx.clip();
    const g = ctx.createLinearGradient(0, -48, 0, 48);
    g.addColorStop(0, '#8a6238'); g.addColorStop(1, '#6e4a28');
    ctx.fillStyle = g; ctx.fillRect(-200, -100, 400, 200);
    // sulcos
    for (let i = 0; i < 12; i++) {
      const y = -h + 0.12 + i * (2 * h - 0.2) / 11;
      const a = P(-h, y), b = P(h, y);
      line(ctx, a, b, 'rgba(45,28,12,0.55)', 1.7, 'butt');
      line(ctx, [a[0], a[1] - 1.3], [b[0], b[1] - 1.3], 'rgba(190,140,80,0.35)', 0.9, 'butt');
    }
    ctx.restore();
    // borda de terra levantada
    poly(ctx, dia, null, 'rgba(60,38,18,0.9)', 1.6);
    poly(ctx, dia.map((p, i) => [p[0] * 0.985, p[1] * 0.985]), null, 'rgba(210,160,100,0.35)', 0.8);
    // cercas nos dois lados de trás
    const post = (x, y) => { const p = PX(x, y, 0); line(ctx, p, [p[0], p[1] - 7], '#5c3d22', 1.8); circle(ctx, p[0], p[1] - 7, 1.0, '#8a6238'); };
    for (let i = 0; i <= 6; i++) { post(-h + (2 * h) * i / 6, -h); post(-h, -h + (2 * h) * i / 6); }
    line(ctx, PX(-h, -h, 5), PX(h, -h, 5), '#6e4a2a', 1.4); line(ctx, PX(-h, -h, 5), PX(-h, h, 5), '#6e4a2a', 1.4);
    line(ctx, PX(-h, -h, 2.5), PX(h, -h, 2.5), '#6e4a2a', 1.2); line(ctx, PX(-h, -h, 2.5), PX(-h, h, 2.5), '#6e4a2a', 1.2);
    // plantas
    const rng = new RNG(77 + stage);
    if (stage >= 1) {
      const rows = 11;
      for (let i = 0; i < rows; i++) {
        const y = -h + 0.12 + i * (2 * h - 0.2) / (rows - 1);
        const per = stage === 4 ? 14 : 22;
        for (let k = 0; k < per; k++) {
          const x = -h + 0.1 + (k + rng.range(-0.2, 0.2)) * (2 * h - 0.2) / (per - 1);
          if ((stage === 3 && rng.chance(0.38)) || (stage === 4 && rng.chance(0.2))) continue;
          const p = PX(x, y, 0);
          let ht, col1, col2;
          if (stage === 1) { ht = 3; col1 = '#7ac24a'; col2 = '#4a8f2c'; }
          else if (stage === 2) { ht = rng.range(8, 11); col1 = '#f0cf5a'; col2 = '#c79a2a'; }
          else if (stage === 3) { ht = rng.range(6, 9); col1 = '#e6c453'; col2 = '#b88c26'; }
          else { ht = rng.range(2, 3.4); col1 = '#b99a52'; col2 = '#8a6e30'; }
          const sway = rng.range(-0.8, 0.8);
          line(ctx, p, [p[0] + sway, p[1] - ht], col2, 1.3);
          if (stage >= 2 && stage <= 3) {
            ellipse(ctx, p[0] + sway, p[1] - ht - 1.4, 1.1, 2.4, col1);
            line(ctx, [p[0] + sway, p[1] - ht + 1.2], [p[0] + sway - 1.6, p[1] - ht - 0.6], col2, 0.5);
          } else {
            line(ctx, p, [p[0] - 1.1, p[1] - ht * 0.8], col1, 1.0);
            line(ctx, p, [p[0] + 1.1, p[1] - ht * 0.9], col1, 1.0);
          }
        }
      }
    }
    // espantalho (só quando há plantação)
    if (stage >= 2 && stage <= 3) {
      const p = PX(0.2, -0.2, 0);
      line(ctx, p, [p[0], p[1] - 17], '#5c3d22', 1.6);
      line(ctx, [p[0] - 6, p[1] - 13], [p[0] + 6, p[1] - 12], '#5c3d22', 1.6);
      poly(ctx, [[p[0] - 3, p[1] - 14], [p[0] + 3, p[1] - 14], [p[0] + 2, p[1] - 6], [p[0] - 2, p[1] - 6]], C.str(tm.main), C.str(tm.dark), 0.5);
      circle(ctx, p[0], p[1] - 18.5, 2.6, '#e8d28a', '#6a5420', 0.5);
      poly(ctx, [[p[0] - 4.5, p[1] - 19.5], [p[0] + 4.5, p[1] - 19.5], [p[0], p[1] - 24.5]], '#7a5a2a');
    }
  },

  /* ================= DEPÓSITO ================= */
  _depot(ctx, tm, o) {
    groundShadow(ctx, -0.85, -0.85, 0.85, 0.85, 36, 0.3);
    groundAO(ctx, -0.85, -0.85, 0.85, 0.85, 0.1, 0.3);
    // piso
    box(ctx, -0.9, -0.9, 0.9, 0.9, 0, 3, { ...boxColors(PAL.wood), texL: Tex.planks(PAL.wood, { pw: 0.12 }), texR: Tex.planks(PAL.wood, { pw: 0.12 }), topTex: (c, F, x0, x1, y0, y1) => { for (let u = x0; u < x1; u += 0.15) line(c, F(u, y0), F(u, y1), 'rgba(40,24,10,0.35)', 0.6, 'butt'); } });
    const postCol = boxColors(PAL.woodDark); postCol.edge = 'rgba(25,14,6,0.7)';
    const post = (x, y, h) => box(ctx, x - 0.07, y - 0.07, x + 0.07, y + 0.07, 3, h, postCol);
    post(-0.78, -0.78, 30); post(0.78, -0.78, 30); post(-0.78, 0.78, 30);
    // parede de trás (x = -0.78 e y = -0.78)
    const back = boxColors(PAL.wood);
    box(ctx, -0.8, -0.8, -0.72, 0.8, 3, 28, { ...back, texR: Tex.planks(PAL.wood, { pw: 0.12 }) });
    box(ctx, -0.8, -0.8, 0.8, -0.72, 3, 28, { ...back, texL: Tex.planks(PAL.wood, { pw: 0.12 }) });
    // mercadorias
    crate(ctx, -0.4, -0.35, 0.28, 3, [160, 112, 62]);
    crate(ctx, -0.42, 0.15, 0.24, 3, [150, 104, 58]);
    crate(ctx, -0.38, -0.35, 0.2, 12, [170, 120, 66]);
    barrel(ctx, 0.05, -0.5, 0.22, 3, 17, [128, 86, 48]);
    barrel(ctx, 0.45, -0.52, 0.2, 3, 15, [140, 96, 54]);
    sack(ctx, 0.0, 0.05, 3); sack(ctx, 0.28, 0.0, 3, [200, 180, 130]); sack(ctx, 0.14, -0.15, 8);
    post(0.78, 0.78, 30);
    // telhado de palha
    const roof = { axis: 'y', over: 0.2, tex: Tex.thatch(PAL.thatch, { n: 30 }), front: PAL.thatch, back: C.shade(PAL.thatch, 0.74) };
    gableRoof(ctx, -0.8, -0.8, 0.8, 0.8, 30, 46, roof);
    // pilha de toras ao lado
    logPile(ctx, 1.1, 0.5, 0, 3);
    flagPole(ctx, PX(0, 0.88, 44), 14, tm === TEAM_COLORS[0] ? 0 : 1, 0, 0.7);
  },

  /* ================= QUARTEL ================= */
  _barracks(ctx, tm, o) {
    const team = tm === TEAM_COLORS[0] ? 0 : 1;
    groundShadow(ctx, -1.3, -1.3, 1.3, 1.3, 74, 0.32);
    groundAO(ctx, -1.3, -1.3, 1.3, 1.3, 0.12, 0.3);
    const stoneTex = Tex.stone(PAL.stone, { course: 4.6, bw: 0.2, seed: 9 });
    box(ctx, -1.34, -1.34, 1.34, 1.34, 0, 4, { ...boxColors(PAL.stoneLight), texL: stoneTex, texR: stoneTex });
    // base de pedra
    const sb = boxColors(PAL.stone);
    sb.texL = stoneTex; sb.texR = stoneTex;
    const F1 = box(ctx, -1.28, -1.28, 1.28, 1.28, 4, 20, sb);
    // porta grande com arco
    archDoor(ctx, F1.FL, -0.34, 0.34, 4, 18, { frame: PAL.stoneLight, wood: [104, 70, 40] });
    slit(ctx, F1.FL, -0.95, 9, 16); slit(ctx, F1.FL, 0.95, 9, 16);
    slit(ctx, F1.FR, -0.6, 9, 16); slit(ctx, F1.FR, 0.0, 9, 16); slit(ctx, F1.FR, 0.6, 9, 16);
    // andar superior em enxaimel
    const up = boxColors(PAL.plaster);
    up.texL = timberTex(PAL.plaster, PAL.timber, { panel: 0.62, seed: 21, mid: true });
    up.texR = timberTex(PAL.plaster, PAL.timber, { panel: 0.62, seed: 23, flip: true, mid: true });
    const F2 = box(ctx, -1.2, -1.2, 1.2, 1.2, 20, 42, up);
    windowQuad(ctx, F2.FL, -0.84, -0.6, 28, 36, { shutters: tm.main });
    windowQuad(ctx, F2.FL, 0.6, 0.84, 28, 36, { shutters: tm.main });
    windowQuad(ctx, F2.FL, -0.12, 0.12, 28, 36, { shutters: tm.main });
    windowQuad(ctx, F2.FR, -0.5, -0.26, 28, 36, { shutters: tm.main });
    windowQuad(ctx, F2.FR, 0.26, 0.5, 28, 36, { shutters: tm.main });
    // faixa da equipe
    poly(ctx, [PX(-1.2, 1.2, 20), PX(1.2, 1.2, 20), PX(1.2, 1.2, 22.4), PX(-1.2, 1.2, 22.4)], C.str(tm.main), C.str(tm.dark), 0.5);
    poly(ctx, [PX(1.2, -1.2, 20), PX(1.2, 1.2, 20), PX(1.2, 1.2, 22.4), PX(1.2, -1.2, 22.4)], C.str(C.shade(tm.main, 0.8)), C.str(tm.dark), 0.5);
    // telhado de ardósia
    const roof = {
      axis: 'x', over: 0.22, tex: Tex.shingles(PAL.slate, { rows: 7, cols: 10 }),
      front: C.shade(PAL.slate, 1.05), back: C.shade(PAL.slate, 0.72), gable: C.shade(PAL.plaster, 0.9),
    };
    // emblema na empena (lado +x): escudo da equipe com espadas
    gableRoof(ctx, -1.2, -1.2, 1.2, 1.2, 42, 66, roof);
    {
      const c = PX(1.2, 0, 50);
      ctx.save();
      ctx.beginPath(); ctx.moveTo(c[0] - 5, c[1] - 6); ctx.lineTo(c[0] + 5, c[1] - 6 + 1); ctx.lineTo(c[0] + 5, c[1] + 2); ctx.quadraticCurveTo(c[0] + 5, c[1] + 8, c[0], c[1] + 10); ctx.quadraticCurveTo(c[0] - 5, c[1] + 8, c[0] - 5, c[1] + 2); ctx.closePath();
      ctx.fillStyle = C.str(tm.main); ctx.fill(); ctx.strokeStyle = '#d8b84a'; ctx.lineWidth = 1.1; ctx.stroke();
      line(ctx, [c[0] - 8, c[1] - 3], [c[0] + 8, c[1] + 6], '#cfd6de', 1.3); line(ctx, [c[0] + 8, c[1] - 3 + 1], [c[0] - 8, c[1] + 6 + 1], '#cfd6de', 1.3);
      ctx.restore();
    }
    // bandeira
    flagPole(ctx, PX(1.34, 1.34, 4), 52, team, 0, 1.15);
    // boneco de treino e rack de armas
    const dm = PX(-1.0, 1.43, 0);
    line(ctx, dm, [dm[0], dm[1] - 14], '#5c3d22', 2);
    line(ctx, [dm[0] - 5, dm[1] - 11], [dm[0] + 5, dm[1] - 11], '#5c3d22', 1.8);
    ellipse(ctx, dm[0], dm[1] - 9, 3.6, 5, '#d1b87a'); circle(ctx, dm[0], dm[1] - 16, 2.6, '#d1b87a');
    const rk = PX(1.43, -0.4, 0);
    line(ctx, [rk[0] - 5, rk[1]], [rk[0] - 5, rk[1] - 12], '#5c3d22', 1.6); line(ctx, [rk[0] + 5, rk[1] + 2.5], [rk[0] + 5, rk[1] - 9.5], '#5c3d22', 1.6);
    for (let i = 0; i < 3; i++) { const a = [rk[0] - 3 + i * 3, rk[1] + i * 0.8 - 1], b = [a[0] - 0.5, a[1] - 16]; line(ctx, a, b, '#7a5a34', 1.1); poly(ctx, [[b[0] - 1.2, b[1]], [b[0] + 1.2, b[1]], [b[0], b[1] - 4]], '#c3cad2'); }
  },

  /* ================= FERREIRO ================= */
  _blacksmith(ctx, tm, o) {
    const team = tm === TEAM_COLORS[0] ? 0 : 1;
    groundShadow(ctx, -1.3, -1.3, 1.3, 1.3, 66, 0.32);
    groundAO(ctx, -1.3, -1.3, 1.3, 1.3, 0.12, 0.3);
    const stoneTex = Tex.stone(PAL.stone, { course: 4.4, bw: 0.19, seed: 14 });
    box(ctx, -1.34, -1.34, 1.34, 1.34, 0, 3, { ...boxColors(PAL.stoneLight), texL: stoneTex, texR: stoneTex });
    // oficina principal (parte de trás/esquerda)
    const wb = boxColors(PAL.stone); wb.texL = stoneTex; wb.texR = stoneTex;
    box(ctx, -1.25, -1.25, 0.4, 1.25, 3, 14, wb);
    const up = boxColors([214, 198, 168]);
    up.texL = timberTex([214, 198, 168], PAL.timber, { panel: 0.6, seed: 31, braces: false });
    up.texR = timberTex([214, 198, 168], PAL.timber, { panel: 0.6, seed: 33, braces: false });
    const F = box(ctx, -1.2, -1.2, 0.35, 1.2, 14, 28, up);
    // chaminé grande de pedra
    const ch = boxColors(PAL.stone); ch.texL = Tex.stone(PAL.stone, { course: 3.4, bw: 0.14 }); ch.texR = Tex.stone(PAL.stone, { course: 3.4, bw: 0.14 });
    // telhado de madeira
    const roof = { axis: 'y', over: 0.2, tex: Tex.shingles(PAL.shingle, { rows: 6, cols: 8 }), front: PAL.shingle, back: C.shade(PAL.shingle, 0.72), gable: C.shade([214, 198, 168], 0.92) };
    roof.between = (g) => {
      box(g, -0.9, -0.95, -0.42, -0.5, 30, 62, ch);
      box(g, -0.95, -1.0, -0.37, -0.45, 62, 66, boxColors(PAL.stoneDark));
    };
    gableRoof(ctx, -1.2, -1.2, 0.35, 1.2, 28, 46, roof);
    // porta
    archDoor(ctx, F.FL, -0.55, -0.05, 3, 20, { frame: PAL.stoneLight, wood: [100, 68, 38] });
    windowQuad(ctx, F.FL, -1.0, -0.78, 18, 25, { shutters: tm.main });
    // forja aberta (anexo à direita)
    const post = (x, y) => box(ctx, x - 0.07, y - 0.07, x + 0.07, y + 0.07, 3, 26, { ...boxColors(PAL.woodDark), edge: 'rgba(25,14,6,0.7)' });
    box(ctx, 0.45, -0.55, 1.28, 0.85, 3, 9, { ...boxColors([112, 108, 102]), texL: Tex.stone([112, 108, 102], { course: 3, bw: 0.14 }), texR: Tex.stone([112, 108, 102], { course: 3, bw: 0.14 }) });
    // brasa
    const glow = PX(0.9, 0.15, 9.5);
    const gg = ctx.createRadialGradient(glow[0], glow[1], 0, glow[0], glow[1], 16);
    gg.addColorStop(0, 'rgba(255,200,90,0.95)'); gg.addColorStop(0.4, 'rgba(255,120,30,0.55)'); gg.addColorStop(1, 'rgba(255,80,10,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(glow[0], glow[1], 16, 0, TAU); ctx.fill();
    poly(ctx, [PX(0.6, -0.3, 9), PX(1.2, -0.3, 9), PX(1.2, 0.6, 9), PX(0.6, 0.6, 9)], '#3a1d10');
    poly(ctx, [PX(0.7, -0.15, 9.2), PX(1.1, -0.15, 9.2), PX(1.1, 0.45, 9.2), PX(0.7, 0.45, 9.2)], '#ff8a2a');
    poly(ctx, [PX(0.8, 0, 9.4), PX(1.0, 0, 9.4), PX(1.0, 0.3, 9.4), PX(0.8, 0.3, 9.4)], '#ffe27a');
    post(0.5, -0.5); post(1.2, -0.5); post(0.5, 0.8);
    gableRoof(ctx, 0.4, -0.6, 1.3, 0.9, 26, 36, { axis: 'y', over: 0.12, tex: Tex.shingles(PAL.shingle, { rows: 4, cols: 5 }), front: C.shade(PAL.shingle, 0.95), back: C.shade(PAL.shingle, 0.7) });
    post(1.2, 0.8);
    // bigorna e barris
    anvil(ctx, 0.7, 1.05, 0);
    barrel(ctx, 1.05, 1.08, 0.18, 0, 12, [96, 70, 48]);
    barrel(ctx, 0.35, 1.25, 0.16, 3, 11, [124, 84, 46]);
    // ferramentas na parede e placa
    const sg = F.FL(0.1, 22);
    poly(ctx, [[sg[0] - 8, sg[1] - 3], [sg[0] + 8, sg[1] - 3 + 4], [sg[0] + 8, sg[1] + 3 + 4], [sg[0] - 8, sg[1] + 3]], C.str(tm.main), C.str(tm.dark), 0.6);
    line(ctx, [sg[0] - 3, sg[1] - 1], [sg[0] + 3, sg[1] + 3], '#e8eef4', 1.4);
    flagPole(ctx, PX(1.34, 1.34, 3), 40, team, 0, 0.9);
  },

  /* ================= MERCADO ================= */
  _market(ctx, tm, o) {
    const team = tm === TEAM_COLORS[0] ? 0 : 1;
    groundShadow(ctx, -1.35, -1.35, 1.35, 1.35, 50, 0.3);
    groundAO(ctx, -1.4, -1.4, 1.4, 1.4, 0.1, 0.3);
    // plataforma de pedra
    box(ctx, -1.42, -1.42, 1.42, 1.42, 0, 3, { ...boxColors(PAL.stoneLight), texL: Tex.stone(PAL.stoneLight, { course: 3, bw: 0.2 }), texR: Tex.stone(PAL.stoneLight, { course: 3, bw: 0.2 }), topTex: (c, F, x0, x1, y0, y1) => { c.strokeStyle = 'rgba(70,60,50,0.28)'; c.lineWidth = 0.6; for (let u = x0; u <= x1 + 0.01; u += 0.36) { const a = F(u, y0), b = F(u, y1); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); const a2 = F(x0, u - x0 + y0), b2 = F(x1, u - x0 + y0); c.beginPath(); c.moveTo(a2[0], a2[1]); c.lineTo(b2[0], b2[1]); c.stroke(); } } });
    const postC = { ...boxColors(PAL.woodDark), edge: 'rgba(25,14,6,0.7)' };
    const post = (x, y, h) => box(ctx, x - 0.06, y - 0.06, x + 0.06, y + 0.06, 3, h, postC);
    const awning = (x0, y0, x1, y1, zHi, zLo, along) => {
      // toldo inclinado listrado (equipe + creme)
      const n = 7;
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        let pts;
        if (along === 'x') {
          const xa = lerp(x0, x1, t0), xb = lerp(x0, x1, t1);
          pts = [PX(xa, y0, zHi), PX(xb, y0, zHi), PX(xb, y1, zLo), PX(xa, y1, zLo)];
        } else {
          const ya = lerp(y0, y1, t0), yb = lerp(y0, y1, t1);
          pts = [PX(x0, ya, zHi), PX(x0, yb, zHi), PX(x1, yb, zLo), PX(x1, ya, zLo)];
        }
        poly(ctx, pts, i % 2 ? C.str([244, 234, 208]) : C.str(tm.main), 'rgba(40,20,10,0.45)', 0.5);
      }
      // beiral ondulado
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        let a, b;
        if (along === 'x') { a = PX(lerp(x0, x1, t0), y1, zLo); b = PX(lerp(x0, x1, t1), y1, zLo); }
        else { a = PX(x1, lerp(y0, y1, t0), zLo); b = PX(x1, lerp(y0, y1, t1), zLo); }
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 4.2, b[0], b[1]);
        ctx.lineTo(b[0], b[1] - 1); ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 2.2, a[0], a[1] - 1); ctx.closePath();
        ctx.fillStyle = i % 2 ? C.str([244, 234, 208]) : C.str(tm.main); ctx.fill(); ctx.strokeStyle = 'rgba(40,20,10,0.5)'; ctx.lineWidth = 0.5; ctx.stroke();
      }
    };
    // barraca de trás (canto -,-)
    post(-1.3, -1.3, 34); post(-0.3, -1.3, 34); post(-1.3, -0.3, 34);
    crate(ctx, -1.0, -1.05, 0.2, 3, [150, 104, 58]);
    // frutas
    const fruit = (x, y, z, col) => { const p = PX(x, y, z); circle(ctx, p[0], p[1] - 1, 2, col, 'rgba(0,0,0,0.3)', 0.4); circle(ctx, p[0] - 0.6, p[1] - 1.6, 0.6, 'rgba(255,255,255,0.7)'); };
    fruit(-1.05, -1.1, 10, '#d8352a'); fruit(-0.95, -1.0, 10, '#e84a3a'); fruit(-1.1, -0.98, 10, '#c92c22');
    barrel(ctx, -0.55, -1.1, 0.2, 3, 14, [120, 82, 46]);
    // mesa central com mercadorias
    box(ctx, -0.45, -0.45, 0.45, 0.45, 3, 12, { ...boxColors(PAL.wood), texL: Tex.planks(PAL.wood, { pw: 0.12 }), texR: Tex.planks(PAL.wood, { pw: 0.12 }) });
    const cloth = PX(0, 0, 12);
    poly(ctx, [PX(-0.45, -0.45, 12), PX(0.45, -0.45, 12), PX(0.45, 0.45, 12), PX(-0.45, 0.45, 12)], C.str(C.shade(tm.main, 1.05)), C.str(tm.dark), 0.6);
    fruit(-0.2, 0.0, 13, '#f2a630'); fruit(0.0, 0.1, 13, '#f2a630'); fruit(0.15, -0.1, 13, '#8fc44a'); fruit(-0.05, -0.2, 13, '#8fc44a'); fruit(0.25, 0.15, 13, '#d8352a');
    // postes frente
    post(1.3, -1.3, 34); post(-1.3, 1.3, 34);
    awning(-1.45, -1.45, 0.0, 0.0, 38, 28, 'x');
    // balcão da frente esquerdo
    box(ctx, -1.2, 0.7, -0.2, 1.2, 3, 12, { ...boxColors(PAL.wood), texL: Tex.planks(PAL.wood, { pw: 0.12 }), texR: Tex.planks(PAL.wood, { pw: 0.12 }) });
    poly(ctx, [PX(-1.2, 0.7, 12), PX(-0.2, 0.7, 12), PX(-0.2, 1.2, 12), PX(-1.2, 1.2, 12)], C.str([244, 234, 208]), C.str([190, 170, 130]), 0.6);
    sack(ctx, -0.95, 0.92, 12, [214, 196, 150]); sack(ctx, -0.7, 0.95, 12, [200, 178, 128]); sack(ctx, -0.45, 0.9, 12, [190, 150, 90]);
    post(-1.3, 1.3, 34); post(-0.2, 1.3, 34); post(-1.3, 0.6, 34);
    awning(-1.35, 0.55, -0.1, 1.45, 36, 27, 'x');
    // barraca do lado direito
    post(1.3, -0.3, 34); post(1.3, 0.8, 34); post(0.45, -0.3, 34);
    box(ctx, 0.8, -0.2, 1.25, 0.8, 3, 12, { ...boxColors(PAL.wood), texL: Tex.planks(PAL.wood, { pw: 0.12 }), texR: Tex.planks(PAL.wood, { pw: 0.12 }) });
    poly(ctx, [PX(0.8, -0.2, 12), PX(1.25, -0.2, 12), PX(1.25, 0.8, 12), PX(0.8, 0.8, 12)], C.str([244, 234, 208]), C.str([190, 170, 130]), 0.6);
    fruit(1.0, 0.0, 13, '#ffd23a'); fruit(1.05, 0.2, 13, '#ffd23a'); fruit(1.0, 0.45, 13, '#9ad24a'); fruit(1.1, 0.6, 13, '#9ad24a');
    awning(0.3, -0.35, 1.45, 0.9, 37, 28, 'y');
    // bandeira central
    flagPole(ctx, PX(1.3, 1.3, 3), 48, team, 0, 1.1);
  },

  /* ================= CENTRO DA CIDADE ================= */
  _towncenter(ctx, tm, o) {
    const team = tm === TEAM_COLORS[0] ? 0 : 1;
    groundShadow(ctx, -1.8, -1.8, 1.8, 1.8, 98, 0.34);
    groundAO(ctx, -1.95, -1.95, 1.95, 1.95, 0.12, 0.32);
    const stoneTex = Tex.stone(PAL.stone, { course: 4.8, bw: 0.2, seed: 17 });
    const slabTex = Tex.stone(PAL.stoneLight, { course: 3, bw: 0.26, seed: 5 });
    box(ctx, -1.96, -1.96, 1.96, 1.96, 0, 3, { ...boxColors(PAL.stoneLight), texL: slabTex, texR: slabTex });
    const turret = (cx, cy) => {
      cylinder(ctx, cx, cy, 0.42, 3, 52, PAL.stone, { courses: 4.6, top: PAL.stoneLight });
      // beiral
      cylinder(ctx, cx, cy, 0.48, 52, 56, PAL.stoneDark, { top: PAL.stone });
      coneRoof(ctx, cx, cy, 0.5, 56, 80, tm.main);
      const tp = PX(cx, cy, 80);
      circle(ctx, tp[0], tp[1], 1.2, '#e8c463');
      // fenda
      const sl = PX(cx + 0.2, cy + 0.2, 34);
      line(ctx, [sl[0] - 1, sl[1]], [sl[0] - 1, sl[1] - 8], '#15110f', 1.8);
    };
    turret(-1.55, -1.55);
    // salão principal
    const keep = boxColors(PAL.stone); keep.texL = stoneTex; keep.texR = stoneTex;
    const F1 = box(ctx, -1.5, -1.5, 1.5, 1.5, 3, 40, keep);
    // portal e janelas (face esquerda +y)
    archDoor(ctx, F1.FL, -0.5, 0.5, 3, 25, { frame: PAL.stoneLight, wood: [100, 66, 36] });
    slit(ctx, F1.FL, -1.1, 22, 34); slit(ctx, F1.FL, 1.1, 22, 34); slit(ctx, F1.FL, -0.8, 12, 20); slit(ctx, F1.FL, 0.8, 12, 20);
    // face direita
    archDoor(ctx, F1.FR, -0.32, 0.32, 3, 21, { frame: PAL.stoneLight, wood: [100, 66, 36] });
    slit(ctx, F1.FR, -1.0, 22, 34); slit(ctx, F1.FR, 1.0, 22, 34); slit(ctx, F1.FR, -0.7, 10, 18); slit(ctx, F1.FR, 0.7, 10, 18);
    // faixa de brasão
    for (const [F, u0, u1] of [[F1.FL, -1.5, 1.5], [F1.FR, -1.5, 1.5]]) {
      poly(ctx, [F(u0, 38.2), F(u1, 38.2), F(u1, 40), F(u0, 40)], C.str(tm.main), C.str(tm.dark), 0.5);
    }
    // estandartes pendurados sobre o portal
    const banner = (F, u, v) => {
      const a = F(u - 0.12, v), b = F(u + 0.12, v), c2 = F(u + 0.12, v - 12), d = F(u, v - 15), e = F(u - 0.12, v - 12);
      poly(ctx, [a, b, c2, d, e], C.str(tm.main), C.str(tm.dark), 0.7);
      const m = F(u, v - 6); circle(ctx, m[0], m[1], 1.6, '#e8c463');
    };
    banner(F1.FL, -0.85, 36); banner(F1.FL, 0.85, 36); banner(F1.FR, -0.75, 36); banner(F1.FR, 0.75, 36);
    merlons(ctx, -1.5, -1.5, 1.5, 1.5, 40, 5, PAL.stone, 7);
    // andar superior
    const up = boxColors(PAL.plaster);
    up.texL = timberTex(PAL.plaster, PAL.timber, { panel: 0.55, seed: 41, mid: true });
    up.texR = timberTex(PAL.plaster, PAL.timber, { panel: 0.55, seed: 43, flip: true, mid: true });
    const F2 = box(ctx, -0.98, -0.98, 0.98, 0.98, 45, 66, up);
    windowQuad(ctx, F2.FL, -0.62, -0.38, 52, 60, { shutters: tm.main });
    windowQuad(ctx, F2.FL, 0.38, 0.62, 52, 60, { shutters: tm.main });
    windowQuad(ctx, F2.FR, -0.62, -0.38, 52, 60, { shutters: tm.main });
    windowQuad(ctx, F2.FR, 0.38, 0.62, 52, 60, { shutters: tm.main });
    // telhado principal
    const roof = {
      axis: 'x', over: 0.26, tex: Tex.shingles(PAL.terracotta, { rows: 8, cols: 11 }),
      front: C.shade(PAL.terracotta, 1.0), back: C.shade(PAL.terracotta, 0.72), gable: C.shade(PAL.plaster, 0.9),
    };
    gableRoof(ctx, -0.98, -0.98, 0.98, 0.98, 66, 92, roof);
    // brasão na empena
    {
      const c = PX(0.98, 0, 74);
      ctx.beginPath(); ctx.moveTo(c[0] - 6, c[1] - 7); ctx.lineTo(c[0] + 6, c[1] - 6); ctx.lineTo(c[0] + 6, c[1] + 2); ctx.quadraticCurveTo(c[0] + 6, c[1] + 9, c[0], c[1] + 12); ctx.quadraticCurveTo(c[0] - 6, c[1] + 9, c[0] - 6, c[1] + 2); ctx.closePath();
      ctx.fillStyle = C.str(tm.main); ctx.fill(); ctx.strokeStyle = '#e8c463'; ctx.lineWidth = 1.3; ctx.stroke();
      line(ctx, [c[0], c[1] - 5], [c[0], c[1] + 8], '#e8c463', 1.1); line(ctx, [c[0] - 4, c[1]], [c[0] + 4, c[1] + 0.5], '#e8c463', 1.1);
    }
    // mastro com bandeira grande
    flagPole(ctx, PX(0.8, 0, 90), 30, team, 1.2, 1.7);
    turret(1.55, -1.55); turret(-1.55, 1.55);
    turret(1.55, 1.55);
    // tochas
    for (const [x, y] of [[1.8, 0.6], [0.6, 1.8], [1.8, -0.6], [-0.6, 1.8]]) {
      const p = PX(x, y, 0);
      line(ctx, p, [p[0], p[1] - 9], '#4a3320', 1.6);
      circle(ctx, p[0], p[1] - 10, 2.2, '#ffb43a'); circle(ctx, p[0], p[1] - 10.8, 1.2, '#fff2a0');
    }
  },

  /* ================= MURO ================= */
  _wall(ctx, tm, o) {
    const m = o.mask | 0;
    const N = m & 1, E = m & 2, S = m & 4, W = m & 8;
    groundShadow(ctx, -0.18, -0.18, 0.18, 0.18, 24, 0.22);
    const sc = boxColors(PAL.stone);
    const tex = Tex.stone(PAL.stone, { course: 4.2, bw: 0.16, seed: 22 });
    sc.texL = tex; sc.texR = tex; sc.edge = 'rgba(20,16,12,0.6)';
    const arm = (x0, y0, x1, y1) => {
      box(ctx, x0, y0, x1, y1, 0, 19, sc);
      // ameias do muro
      const mer = boxColors(PAL.stoneLight); mer.edge = 'rgba(20,16,12,0.5)';
      if (x1 - x0 > y1 - y0) {
        for (let i = 0; i < 3; i++) { const x = lerp(x0, x1, (i + 0.5) / 3); box(ctx, x - 0.05, y0, x + 0.05, y1, 19, 24, mer); }
      } else {
        for (let i = 0; i < 3; i++) { const y = lerp(y0, y1, (i + 0.5) / 3); box(ctx, x0, y - 0.05, x1, y + 0.05, 19, 24, mer); }
      }
    };
    const t = 0.15;
    if (N) arm(-t, -0.5, t, 0);
    if (W) arm(-0.5, -t, 0, t);
    // poste central
    const pc = boxColors(PAL.stoneLight); pc.texL = tex; pc.texR = tex; pc.edge = 'rgba(20,16,12,0.6)';
    box(ctx, -0.21, -0.21, 0.21, 0.21, 0, 26, pc);
    box(ctx, -0.25, -0.25, 0.25, 0.25, 26, 29, boxColors(PAL.stone));
    const cap = PX(0, 0, 29);
    // capuz piramidal pequeno
    pyramidRoof(ctx, 0, 0, 0.2, 0.2, 29, 37, { back: C.shade(tm.main, 0.7), left: C.shade(tm.main, 1.0), right: C.shade(tm.main, 0.75) }, null, 'rgba(20,10,10,0.6)');
    if (E) arm(0, -t, 0.5, t);
    if (S) arm(-t, 0, t, 0.5);
  },

  /* ================= PORTÃO (guarita de pedra com arco) ================= */
  _gate(ctx, tm, o) {
    const ax = o.axis === "y" ? "y" : "x";
    const open = !!o.open;
    const hx = ax === "x" ? 0.5 : 0.3, hy = ax === "x" ? 0.3 : 0.5;
    groundShadow(ctx, -hx, -hy, hx, hy, 40, 0.26);
    groundAO(ctx, -hx, -hy, hx, hy, 0.06, 0.25);
    // soleira
    box(ctx, -hx - 0.04, -hy - 0.04, hx + 0.04, hy + 0.04, 0, 3, { ...boxColors(PAL.stone), texL: Tex.stone(PAL.stone, { course: 3, bw: 0.18 }), texR: Tex.stone(PAL.stone, { course: 3, bw: 0.18 }) });
    const tex = Tex.stone(PAL.stone, { course: 4.2, bw: 0.16, seed: 31 });
    const sc = boxColors(PAL.stoneLight);
    sc.texL = tex; sc.texR = tex; sc.edge = "rgba(20,16,12,0.6)";
    const F = box(ctx, -hx, -hy, hx, hy, 3, 42, sc);
    const face = ax === "x" ? F.FL : F.FR;   // face voltada para a câmera onde fica o arco
    // arco: portas de madeira (fechado) ou passagem escura com folhas abertas
    archDoor(ctx, face, -0.27, 0.27, 3, 27, { frame: PAL.stoneLight, wood: [112, 76, 42], open });
    if (open) {
      for (const s of [-1, 1]) {
        const a = face(s * 0.27, 3), b = face(s * 0.27, 24);
        line(ctx, a, b, "#2a1a0c", 3); line(ctx, a, b, "#8a5a30", 1.8);
      }
    }
    // estandarte da equipe sobre o arco
    const bn = (u, v) => face(u, v);
    const p0 = bn(-0.16, 38), p1 = bn(0.16, 38), p2 = bn(0.16, 31), p3 = bn(0, 28.5), p4 = bn(-0.16, 31);
    poly(ctx, [p0, p1, p2, p3, p4], C.str(tm.main), C.str(tm.dark), 0.7);
    const m = bn(0, 34); circle(ctx, m[0], m[1], 1.3, "#e8c463");
    // fenda de tiro na outra face
    const other = ax === "x" ? F.FR : F.FL;
    slit(ctx, other, 0, 20, 32);
    // ameias
    merlons(ctx, -hx, -hy, hx, hy, 42, 5, PAL.stone, 4);
  },

  /* ---------- fundação em terra batida (em construção) ---------- */
  foundation(w, d) {
    const key = `found|${w}|${d}`;
    let s = this.cache.get(key);
    if (s) return s;
    const W = (w + d) * HW + 40, H = (w + d) * HH + 40;
    s = bake(W, H, W / 2, H / 2, (ctx) => {
      const hx = w / 2, hy = d / 2;
      const dia = [PX(-hx, -hy), PX(hx, -hy), PX(hx, hy), PX(-hx, hy)];
      ctx.save();
      ctx.filter = 'blur(1.2px)';
      poly(ctx, dia.map((p) => [p[0] * 1.04, p[1] * 1.04]), 'rgba(70,48,24,0.55)');
      ctx.restore();
      ctx.save();
      pathPoly(ctx, dia); ctx.clip();
      const g = ctx.createLinearGradient(0, -H / 2, 0, H / 2);
      g.addColorStop(0, '#9a7a4e'); g.addColorStop(1, '#7a5c36');
      ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 2, H * 2);
      const r = new RNG(w * 31 + d);
      for (let i = 0; i < 90; i++) {
        const p = PX(r.range(-hx, hx), r.range(-hy, hy));
        ctx.fillStyle = r.chance(0.5) ? 'rgba(60,40,20,0.35)' : 'rgba(210,175,120,0.3)';
        ctx.beginPath(); ctx.ellipse(p[0], p[1], r.range(1, 3), r.range(0.6, 1.4), 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
      poly(ctx, dia, null, 'rgba(50,34,16,0.75)', 1.2);
      // estacas de marcação nos cantos
      for (const p of dia) { line(ctx, p, [p[0], p[1] - 8], '#6a4a2a', 1.6); line(ctx, [p[0], p[1] - 8], [p[0] + 5, p[1] - 6.5], '#d8c6a0', 1.6); }
    });
    this.cache.set(key, s);
    return s;
  },

  /* ---------- andaime ---------- */
  scaffold(w, d, h) {
    const key = `scaf|${w}|${d}|${h}`;
    let s = this.cache.get(key);
    if (s) return s;
    const W = (w + d) * HW + 40, H = (w + d) * HH + h + 50;
    const ay = (w + d) * 8 + h + 24;
    s = bake(W, H, W / 2, ay, (ctx) => {
      const hx = w / 2 + 0.05, hy = d / 2 + 0.05;
      const wood = '#8a6238', dk = '#3a2512';
      const pole = (x, y, hh) => { const a = PX(x, y, 0), b = PX(x, y, hh); line(ctx, a, b, dk, 3); line(ctx, a, b, wood, 1.9); };
      const bar = (a, b) => { line(ctx, a, b, dk, 2.6); line(ctx, a, b, '#a47848', 1.6); };
      const levels = Math.max(2, Math.floor(h / 18));
      // postes de trás
      pole(-hx, -hy, h); pole(hx, -hy, h); pole(-hx, hy, h);
      for (let l = 1; l <= levels; l++) {
        const z = (l / levels) * h * 0.95;
        bar(PX(-hx, -hy, z), PX(hx, -hy, z)); bar(PX(-hx, -hy, z), PX(-hx, hy, z));
      }
      // frente
      pole(hx, hy, h);
      for (let l = 1; l <= levels; l++) {
        const z = (l / levels) * h * 0.95;
        bar(PX(-hx, hy, z), PX(hx, hy, z)); bar(PX(hx, -hy, z), PX(hx, hy, z));
        // pranchas
        if (l % 2 === 0) {
          poly(ctx, [PX(-hx, hy, z), PX(hx, hy, z), PX(hx, hy, z + 2.2), PX(-hx, hy, z + 2.2)], '#b58650', 'rgba(40,24,10,0.6)', 0.5);
        }
      }
      // diagonais
      bar(PX(-hx, hy, 0), PX(0, hy, h * 0.5)); bar(PX(hx, hy, 0), PX(hx, 0, h * 0.5));
      bar(PX(0, hy, h * 0.5), PX(hx, hy, h * 0.95));
    });
    this.cache.set(key, s);
    return s;
  },

  /* ---------- escombros ---------- */
  rubble(w, d) {
    const key = `rubble|${w}|${d}`;
    let s = this.cache.get(key);
    if (s) return s;
    const W = (w + d) * HW + 40, H = (w + d) * HH + 40;
    s = bake(W, H, W / 2, H / 2, (ctx) => {
      const r = new RNG(w * 7 + d * 3);
      const hx = w / 2 - 0.1, hy = d / 2 - 0.1;
      for (let i = 0; i < 26 * w; i++) {
        const p = PX(r.range(-hx, hx), r.range(-hy, hy));
        const k = r.next();
        if (k < 0.5) { // pedras
          poly(ctx, [[p[0] - 3, p[1]], [p[0] - 1, p[1] - 3], [p[0] + 2.5, p[1] - 2.2], [p[0] + 3.4, p[1] + 0.6], [p[0], p[1] + 1.6]], C.str(C.shade(PAL.stone, r.range(0.6, 1.05))), '#2a2622', 0.5);
        } else if (k < 0.8) { // vigas
          const a = [p[0] - 4, p[1] + r.range(-1, 1)], b = [p[0] + 4, p[1] + r.range(-2, 2)];
          line(ctx, a, b, '#2a1a0c', 2.6); line(ctx, a, b, '#7a5230', 1.6);
        } else { ellipse(ctx, p[0], p[1], r.range(2, 5), r.range(1, 2), 'rgba(40,36,34,0.55)'); }
      }
    });
    this.cache.set(key, s);
    return s;
  },
};
