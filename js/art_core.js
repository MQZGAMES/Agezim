'use strict';
/* ============================================================
   AGEZIM — arte procedural: primitivas isométricas e mini-3D
   Tudo é desenhado em canvas e "assado" em sprites (2x de resolução).
   ============================================================ */

const ART_S = 2; // fator de bake (nitidez até zoom 2x)

/* assa um sprite: fn desenha com origem na âncora (ax, ay) em pixels lógicos */
function bake(w, h, ax, ay, fn) {
  const cv = makeCanvas(w * ART_S, h * ART_S);
  const ctx = cv.getContext('2d');
  ctx.scale(ART_S, ART_S);
  ctx.translate(ax, ay);
  fn(ctx);
  return { cv, ax, ay, w, h };
}

/* desenha sprite na tela: (sx, sy) = posição da âncora, k = pixels de tela por pixel lógico */
function blit(ctx, spr, sx, sy, k) {
  ctx.drawImage(spr.cv, sx - spr.ax * k, sy - spr.ay * k, spr.w * k, spr.h * k);
}

/* projeção: (x, y) em tiles relativos, z em px */
function PX(x, y, z = 0) { return [(x - y) * HW, (x + y) * HH - z]; }

function pathPoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
function poly(ctx, pts, fill, stroke, lw = 1) {
  pathPoly(ctx, pts);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function line(ctx, a, b, col, w = 1, cap = 'round') {
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = cap; ctx.stroke();
}
function circle(ctx, x, y, r, fill, stroke, lw = 1) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function ellipse(ctx, x, y, rx, ry, fill, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
}
function vgrad(ctx, y0, y1, c0, c1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, C.str(c0)); g.addColorStop(1, C.str(c1));
  return g;
}
function hgrad(ctx, x0, x1, c0, c1, c2) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, C.str(c0)); if (c2) g.addColorStop(0.5, C.str(c1)); g.addColorStop(1, C.str(c2 || c1));
  return g;
}

/* sombra projetada no chão: polígono do footprint estendido para sudeste */
function groundShadow(ctx, x0, y0, x1, y1, h, alpha = 0.32) {
  const dx = h * 0.34, dy = h * 0.13;
  const base = [PX(x0, y0), PX(x1, y0), PX(x1, y1), PX(x0, y1)];
  const sh = base.map((p) => [p[0] + dx, p[1] + dy]);
  ctx.save();
  ctx.filter = 'blur(2.5px)';
  ctx.fillStyle = `rgba(16,22,40,${alpha * 0.85})`;
  const hull = [base[0], base[1], sh[1], sh[2], sh[3], base[3]];
  pathPoly(ctx, hull); ctx.fill();
  ctx.restore();
}
/* contato suave no chão (oclusão ambiente) */
function groundAO(ctx, x0, y0, x1, y1, grow = 0.12, alpha = 0.28) {
  const pts = [PX(x0 - grow, y0 - grow), PX(x1 + grow, y0 - grow), PX(x1 + grow, y1 + grow), PX(x0 - grow, y1 + grow)];
  ctx.save();
  ctx.filter = 'blur(3px)';
  poly(ctx, pts, `rgba(10,14,24,${alpha})`);
  ctx.restore();
}

/* ---------------- texturas de faces ---------------- */
/* Cada textura recebe (ctx, F, u0, u1, v0, v1) onde F(u, v) -> [sx, sy] */
const Tex = {
  stone(col, opts = {}) {
    const course = opts.course || 5.2, bw = opts.bw || 0.2, seed = opts.seed || 1;
    return (ctx, F, u0, u1, v0, v1) => {
      const base = C.hex(col);
      let r = 0;
      for (let v = v0; v < v1 - 0.01; v += course, r++) {
        const vt = Math.min(v + course, v1);
        const off = (r % 2) * bw * 0.5;
        for (let u = u0 - off; u < u1; u += bw) {
          const ua = Math.max(u, u0), ub = Math.min(u + bw, u1);
          if (ub - ua < 0.01) continue;
          const hv = hash2(Math.floor((u + 9) * 40), r * 7 + Math.floor(v), seed);
          const k = 0.9 + hv * 0.2;
          poly(ctx, [F(ua, v), F(ub, v), F(ub, vt), F(ua, vt)], C.str(C.shade(base, k)));
        }
      }
      // juntas
      ctx.strokeStyle = 'rgba(40,36,34,0.28)'; ctx.lineWidth = 0.55;
      r = 0;
      for (let v = v0; v < v1; v += course, r++) {
        const a = F(u0, v), b = F(u1, v);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        const off = (r % 2) * bw * 0.5;
        const vt = Math.min(v + course, v1);
        for (let u = u0 + bw - off; u < u1; u += bw) {
          const p = F(u, v), q = F(u, vt);
          ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
        }
      }
    };
  },
  plaster(col, opts = {}) {
    const seed = opts.seed || 3;
    return (ctx, F, u0, u1, v0, v1) => {
      const base = C.hex(col);
      ctx.strokeStyle = 'rgba(90,70,40,0.10)'; ctx.lineWidth = 0.7;
      for (let n = 0; n < 14; n++) {
        const u = lerp(u0, u1, hash2(n, 1, seed)), v = lerp(v0, v1, hash2(n, 2, seed));
        const a = F(u, v), b = F(u + (u1 - u0) * 0.12, v - 1.5);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    };
  },
  planks(col, opts = {}) {
    const pw = opts.pw || 0.1, seed = opts.seed || 5;
    return (ctx, F, u0, u1, v0, v1) => {
      let i = 0;
      for (let u = u0; u < u1; u += pw, i++) {
        const ub = Math.min(u + pw, u1);
        const k = 0.88 + hash2(i, 3, seed) * 0.24;
        poly(ctx, [F(u, v0), F(ub, v0), F(ub, v1), F(u, v1)], C.str(C.shade(col, k)));
        const a = F(u, v0), b = F(u, v1);
        line(ctx, a, b, 'rgba(30,18,8,0.45)', 0.6, 'butt');
        if (hash2(i, 9, seed) > 0.5) {
          const g0 = F(u + pw * 0.5, lerp(v0, v1, 0.2 + hash2(i, 4, seed) * 0.5));
          const g1 = F(u + pw * 0.5, lerp(v0, v1, 0.4 + hash2(i, 5, seed) * 0.5));
          line(ctx, g0, g1, 'rgba(30,18,8,0.25)', 0.5, 'butt');
        }
      }
    };
  },
  shingles(col, opts = {}) { // telhas sobre a água do telhado: linhas paralelas ao beiral
    const seed = opts.seed || 7;
    return (ctx, F, u0, u1, v0, v1) => {
      const rows = opts.rows || 6;
      for (let r = 0; r < rows; r++) {
        const va = lerp(v0, v1, r / rows), vb = lerp(v0, v1, (r + 1) / rows);
        const off = (r % 2) * 0.5;
        const n = opts.cols || 8;
        for (let c = -1; c < n; c++) {
          const ua = lerp(u0, u1, (c + off) / n), ub = lerp(u0, u1, (c + off + 1) / n);
          const uA = Math.max(ua, u0), uB = Math.min(ub, u1);
          if (uB - uA < 0.001) continue;
          const k = 0.86 + hash2(c + 20, r, seed) * 0.28;
          poly(ctx, [F(uA, va), F(uB, va), F(uB, vb), F(uA, vb)], C.str(C.shade(col, k)), 'rgba(40,18,10,0.35)', 0.5);
        }
      }
    };
  },
  thatch(col, opts = {}) {
    const seed = opts.seed || 8;
    return (ctx, F, u0, u1, v0, v1) => {
      const n = opts.n || 26;
      for (let i = 0; i < n; i++) {
        const u = lerp(u0, u1, i / n);
        const k = 0.85 + hash2(i, 1, seed) * 0.3;
        line(ctx, F(u, v0), F(u, v1), C.str(C.shade(col, k)), 1.2, 'butt');
      }
      for (let r = 1; r < 5; r++) {
        const v = lerp(v0, v1, r / 5);
        line(ctx, F(u0, v), F(u1, v), 'rgba(50,34,10,0.28)', 0.8, 'butt');
      }
    };
  },
};

/* ---------------- caixa isométrica ---------------- */
/* o: { top, left, right, edge, texL, texR, topTex, ao } cores como arrays/hex */
function box(ctx, x0, y0, x1, y1, z0, z1, o) {
  const T = [PX(x0, y0, z1), PX(x1, y0, z1), PX(x1, y1, z1), PX(x0, y1, z1)];
  const L = [PX(x0, y1, z0), PX(x1, y1, z0), PX(x1, y1, z1), PX(x0, y1, z1)];
  const R = [PX(x1, y0, z0), PX(x1, y1, z0), PX(x1, y1, z1), PX(x1, y0, z1)];
  const edge = o.edge || 'rgba(20,14,10,0.55)';
  // face esquerda (+y)
  const FL = (u, v) => PX(u, y1, v);
  const FR = (u, v) => PX(x1, u, v);
  const face = (pts, base, tex, F, u0, u1) => {
    ctx.save();
    pathPoly(ctx, pts); ctx.clip();
    const g = ctx.createLinearGradient(0, PX(0, 0, z1)[1] - 20, 0, PX(x1, y1, z0)[1] + 4);
    g.addColorStop(0, C.str(C.shade(base, 1.06)));
    g.addColorStop(1, C.str(C.shade(base, 0.8)));
    ctx.fillStyle = g;
    ctx.fillRect(-400, -400, 800, 800);
    if (tex) tex(ctx, F, u0, u1, z0, z1);
    // luz/sombra
    const lg = ctx.createLinearGradient(pts[0][0], 0, pts[1][0], 0);
    lg.addColorStop(0, 'rgba(255,255,255,0.05)'); lg.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = lg; ctx.fillRect(-400, -400, 800, 800);
    ctx.restore();
    pathPoly(ctx, pts); ctx.strokeStyle = edge; ctx.lineWidth = 0.9; ctx.lineJoin = 'round'; ctx.stroke();
  };
  if (!o.noSides) {
    face(R, o.right, o.texR, FR, y0, y1);
    face(L, o.left, o.texL, FL, x0, x1);
  }
  if (!o.noTop) {
    ctx.save();
    pathPoly(ctx, T); ctx.clip();
    ctx.fillStyle = C.str(o.top);
    ctx.fillRect(-400, -400, 800, 800);
    if (o.topTex) o.topTex(ctx, (u, v) => PX(u, v, z1), x0, x1, y0, y1);
    ctx.restore();
    pathPoly(ctx, T); ctx.strokeStyle = edge; ctx.lineWidth = 0.9; ctx.lineJoin = 'round'; ctx.stroke();
  }
  return { FL, FR };
}

/* conjunto de cores para caixas a partir de uma cor base */
function boxColors(base, light = 1.0) {
  base = C.hex(base);
  return { top: C.warm(C.shade(base, 1.14 * light), 0.12), left: C.shade(base, 0.92 * light), right: C.cool(C.shade(base, 0.7 * light), 0.12) };
}

/* ameias ao longo do topo de uma caixa */
function merlons(ctx, x0, y0, x1, y1, z, h, col, count = 5, sides = 'both') {
  const base = C.hex(col);
  const o = boxColors(base);
  o.edge = 'rgba(20,14,10,0.5)';
  const mw = 0.075;
  const items = [];
  // ao longo de x (borda y0 e y1) e de y (borda x0 e x1)
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const x = lerp(x0, x1, t), y = lerp(y0, y1, t);
    items.push({ x0: x - mw, x1: x + mw, y0: y0, y1: y0 + mw * 1.6 });
    items.push({ x0: x - mw, x1: x + mw, y0: y1 - mw * 1.6, y1: y1 });
    items.push({ x0: x0, x1: x0 + mw * 1.6, y0: y - mw, y1: y + mw });
    items.push({ x0: x1 - mw * 1.6, x1: x1, y0: y - mw, y1: y + mw });
  }
  // remove duplicatas de cantos e ordena por profundidade
  items.sort((a, b) => (a.x0 + a.x1 + a.y0 + a.y1) - (b.x0 + b.x1 + b.y0 + b.y1));
  for (const m of items) box(ctx, m.x0, m.y0, m.x1, m.y1, z, z + h, o);
}

/* telhado de duas águas. axis 'x': cumeeira paralela a x. */
function gableRoof(ctx, x0, y0, x1, y1, zEave, zRidge, o) {
  const over = o.over == null ? 0.12 : o.over;
  const xa = x0 - (o.axis === 'x' ? over : over * 0.6), xb = x1 + (o.axis === 'x' ? over : over * 0.6);
  const ya = y0 - (o.axis === 'y' ? over : over * 0.6), yb = y1 + (o.axis === 'y' ? over : over * 0.6);
  const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
  const edge = o.edge || 'rgba(30,14,8,0.6)';
  const roofTex = o.tex;
  if (o.axis === 'x') {
    // triângulo da empena (lado +x)
    if (o.gable) poly(ctx, [PX(x1, y0, zEave), PX(x1, y1, zEave), PX(x1, ym, zRidge)], C.str(o.gable), edge, 0.8);
    // água de trás
    drawSlope(ctx, [PX(xa, ya, zEave - 2), PX(xb, ya, zEave - 2), PX(xb, ym, zRidge), PX(xa, ym, zRidge)], o.back, roofTex, edge,
      (u, v) => PX(lerp(xa, xb, u), lerp(ya, ym, v), lerp(zEave - 2, zRidge, v)));
    if (o.between) o.between(ctx);
    // água da frente
    drawSlope(ctx, [PX(xa, yb, zEave - 2), PX(xb, yb, zEave - 2), PX(xb, ym, zRidge), PX(xa, ym, zRidge)], o.front, roofTex, edge,
      (u, v) => PX(lerp(xa, xb, u), lerp(yb, ym, v), lerp(zEave - 2, zRidge, v)));
    line(ctx, PX(xa, ym, zRidge), PX(xb, ym, zRidge), C.str(C.shade(o.front, 0.6)), 1.6, 'round');
  } else {
    if (o.gable) poly(ctx, [PX(x0, y1, zEave), PX(x1, y1, zEave), PX(xm, y1, zRidge)], C.str(o.gable), edge, 0.8);
    drawSlope(ctx, [PX(xa, ya, zEave - 2), PX(xa, yb, zEave - 2), PX(xm, yb, zRidge), PX(xm, ya, zRidge)], o.back, roofTex, edge,
      (u, v) => PX(lerp(xa, xm, v), lerp(ya, yb, u), lerp(zEave - 2, zRidge, v)));
    if (o.between) o.between(ctx);
    drawSlope(ctx, [PX(xb, ya, zEave - 2), PX(xb, yb, zEave - 2), PX(xm, yb, zRidge), PX(xm, ya, zRidge)], o.front, roofTex, edge,
      (u, v) => PX(lerp(xb, xm, v), lerp(ya, yb, u), lerp(zEave - 2, zRidge, v)));
    line(ctx, PX(xm, ya, zRidge), PX(xm, yb, zRidge), C.str(C.shade(o.front, 0.6)), 1.6, 'round');
  }
}
function drawSlope(ctx, pts, col, tex, edge, F) {
  ctx.save();
  pathPoly(ctx, pts); ctx.clip();
  ctx.fillStyle = C.str(col); ctx.fillRect(-400, -400, 800, 800);
  if (tex) tex(ctx, F, 0, 1, 0, 1);
  const g = ctx.createLinearGradient(0, pts[0][1] - 30, 0, pts[2][1] + 4);
  g.addColorStop(0, 'rgba(255,240,200,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = g; ctx.fillRect(-400, -400, 800, 800);
  ctx.restore();
  pathPoly(ctx, pts); ctx.strokeStyle = edge; ctx.lineWidth = 0.9; ctx.lineJoin = 'round'; ctx.stroke();
}

/* telhado piramidal (4 águas até um ponto) */
function pyramidRoof(ctx, cx, cy, hx, hy, zEave, zTop, cols, tex, edge = 'rgba(30,14,8,0.6)') {
  const a = [PX(cx - hx, cy - hy, zEave), PX(cx + hx, cy - hy, zEave), PX(cx + hx, cy + hy, zEave), PX(cx - hx, cy + hy, zEave)];
  const top = PX(cx, cy, zTop);
  // trás
  poly(ctx, [a[0], a[1], top], C.str(cols.back), edge, 0.8);
  poly(ctx, [a[0], a[3], top], C.str(cols.back2 || cols.back), edge, 0.8);
  // frente
  const draw = (pts, col, F) => {
    ctx.save();
    pathPoly(ctx, pts); ctx.clip();
    ctx.fillStyle = C.str(col); ctx.fillRect(-400, -400, 800, 800);
    if (tex) tex(ctx, F, 0, 1, 0, 1);
    const g = ctx.createLinearGradient(0, top[1], 0, a[2][1]);
    g.addColorStop(0, 'rgba(255,240,200,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = g; ctx.fillRect(-400, -400, 800, 800);
    ctx.restore();
    pathPoly(ctx, pts); ctx.strokeStyle = edge; ctx.lineWidth = 0.9; ctx.stroke();
  };
  // face +y (esquerda): v=0 beiral -> v=1 topo
  draw([a[3], a[2], top], cols.left, (u, v) => {
    const p = [lerp(a[3][0], a[2][0], u), lerp(a[3][1], a[2][1], u)];
    const q = [lerp(p[0], top[0], v * (1 - u * 0.0)), lerp(p[1], top[1], v)];
    return q;
  });
  draw([a[1], a[2], top], cols.right, (u, v) => {
    const p = [lerp(a[1][0], a[2][0], u), lerp(a[1][1], a[2][1], u)];
    return [lerp(p[0], top[0], v), lerp(p[1], top[1], v)];
  });
  return top;
}

/* cone (torreta) com base elíptica, eixo vertical */
function coneRoof(ctx, cx, cy, r, zEave, zTop, col, edge = 'rgba(30,14,8,0.6)') {
  const c = PX(cx, cy, zEave);
  const rx = r * 45.25, ry = r * 22.6;
  const top = PX(cx, cy, zTop);
  // laterais do cone
  const g = ctx.createLinearGradient(c[0] - rx, 0, c[0] + rx, 0);
  g.addColorStop(0, C.str(C.shade(col, 1.2))); g.addColorStop(0.55, C.str(col)); g.addColorStop(1, C.str(C.shade(col, 0.62)));
  ctx.beginPath();
  ctx.moveTo(c[0] - rx, c[1]);
  ctx.lineTo(top[0], top[1]);
  ctx.lineTo(c[0] + rx, c[1]);
  ctx.ellipse(c[0], c[1], rx, ry, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = 0.9; ctx.stroke();
}

/* cilindro (torre) */
function cylinder(ctx, cx, cy, r, z0, z1, col, o = {}) {
  const c0 = PX(cx, cy, z0), c1 = PX(cx, cy, z1);
  const rx = r * 45.25, ry = r * 22.6;
  col = C.hex(col);
  const g = ctx.createLinearGradient(c0[0] - rx, 0, c0[0] + rx, 0);
  g.addColorStop(0, C.str(C.shade(col, 1.12)));
  g.addColorStop(0.45, C.str(C.shade(col, 0.98)));
  g.addColorStop(1, C.str(C.cool(C.shade(col, 0.58), 0.15)));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(c0[0] - rx, c0[1]);
  ctx.lineTo(c1[0] - rx, c1[1]);
  ctx.ellipse(c1[0], c1[1], rx, ry, 0, Math.PI, 0, false);
  ctx.lineTo(c0[0] + rx, c0[1]);
  ctx.ellipse(c0[0], c0[1], rx, ry, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  ctx.clip();
  if (o.courses) {
    ctx.strokeStyle = 'rgba(30,26,24,0.28)'; ctx.lineWidth = 0.55;
    let rr = 0;
    for (let z = z0 + o.courses; z < z1; z += o.courses, rr++) {
      const c = PX(cx, cy, z);
      ctx.beginPath(); ctx.ellipse(c[0], c[1], rx, ry, 0, 0, Math.PI, false); ctx.stroke();
      // juntas verticais
      for (let a = 0.15; a < Math.PI; a += 0.5) {
        const aa = a + (rr % 2) * 0.25;
        if (aa >= Math.PI) continue;
        const px = c[0] + Math.cos(aa) * rx, py = c[1] + Math.sin(aa) * ry;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - o.courses); ctx.stroke();
      }
    }
  }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(c0[0] - rx, c0[1]); ctx.lineTo(c1[0] - rx, c1[1]);
  ctx.moveTo(c0[0] + rx, c0[1]); ctx.lineTo(c1[0] + rx, c1[1]);
  ctx.strokeStyle = o.edge || 'rgba(20,14,10,0.5)'; ctx.lineWidth = 0.9; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(c0[0], c0[1], rx, ry, 0, 0, Math.PI, false); ctx.stroke();
  // topo
  ctx.beginPath(); ctx.ellipse(c1[0], c1[1], rx, ry, 0, 0, TAU);
  ctx.fillStyle = C.str(o.top || C.shade(col, 1.18)); ctx.fill(); ctx.stroke();
}

/* bandeira com mastro (em px de tela, relativo a um ponto base) */
function flagPole(ctx, base, h, team, wave = 0, size = 1) {
  const col = TEAM_COLORS[team] || TEAM_COLORS[0];
  const top = [base[0], base[1] - h];
  line(ctx, base, top, '#4a3320', 1.5);
  circle(ctx, top[0], top[1] - 0.6, 1.4, '#e8c463');
  const w = 13 * size, hh = 8 * size;
  ctx.beginPath();
  ctx.moveTo(top[0], top[1] + 1);
  ctx.bezierCurveTo(top[0] + w * 0.35, top[1] + 1 + wave, top[0] + w * 0.65, top[1] - 1 - wave, top[0] + w, top[1] + 2 + wave * 0.5);
  ctx.lineTo(top[0] + w * 0.84, top[1] + hh * 0.55 + wave * 0.5);
  ctx.lineTo(top[0] + w, top[1] + hh + wave * 0.3);
  ctx.bezierCurveTo(top[0] + w * 0.65, top[1] + hh - 1 - wave, top[0] + w * 0.35, top[1] + hh + 1 + wave, top[0], top[1] + hh);
  ctx.closePath();
  ctx.fillStyle = C.str(col.main); ctx.fill();
  ctx.strokeStyle = C.str(col.dark); ctx.lineWidth = 0.8; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(top[0] + 1, top[1] + hh * 0.3); ctx.lineTo(top[0] + w * 0.7, top[1] + hh * 0.32 + wave * 0.3);
  ctx.strokeStyle = C.str(col.light, 0.7); ctx.lineWidth = 0.9; ctx.stroke();
}

/* ============================================================
   mini 3D para personagens: heading em radianos do mundo
   a = frente, b = esquerda (px), z = altura (px)
   ============================================================ */
const PX2T = 1 / 36;
function makeBody(heading) {
  const fx = Math.cos(heading), fy = Math.sin(heading);
  const lx = -fy, ly = fx;
  const f = {
    fx, fy, lx, ly,
    facing: (fx + fy), // >0: de frente para a câmera
    P(a, b, z) {
      const wa = a * PX2T, wb = b * PX2T;
      const wx = wa * fx + wb * lx, wy = wa * fy + wb * ly;
      return [(wx - wy) * HW, (wx + wy) * HH - z, wx + wy];
    },
  };
  return f;
}

/* cápsula "sombreada": traço grosso com contorno, realce e sombra */
function tube(ctx, p1, p2, w, col, o = {}) {
  col = C.hex(col);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
  ctx.strokeStyle = o.outline || C.str(C.shade(col, 0.4), 0.9);
  ctx.lineWidth = w + 1.5; ctx.stroke();
  ctx.strokeStyle = C.str(C.shade(col, 0.82));
  ctx.lineWidth = w; ctx.stroke();
  if (w >= 3) {
    ctx.beginPath(); ctx.moveTo(p1[0] - w * 0.14, p1[1] - w * 0.2); ctx.lineTo(p2[0] - w * 0.14, p2[1] - w * 0.2);
    ctx.strokeStyle = C.str(col); ctx.lineWidth = w * 0.62; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p1[0] - w * 0.22, p1[1] - w * 0.3); ctx.lineTo(p2[0] - w * 0.22, p2[1] - w * 0.3);
    ctx.strokeStyle = C.str(C.shade(col, 1.22), 0.8); ctx.lineWidth = w * 0.26; ctx.stroke();
  }
}

/* execução ordenada por profundidade das partes de um personagem */
class PartList {
  constructor() { this.a = []; }
  add(depth, fn) { this.a.push({ d: depth, fn }); }
  run(ctx) { this.a.sort((x, y) => x.d - y.d); for (const p of this.a) p.fn(ctx); }
}

function shadowBlob(ctx, rx, ry, a = 0.32, ox = 0, oy = 0) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(10,14,20,${a})`);
  g.addColorStop(0.6, `rgba(10,14,20,${a * 0.7})`);
  g.addColorStop(1, 'rgba(10,14,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
  ctx.restore();
}
