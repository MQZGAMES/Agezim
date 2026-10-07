'use strict';
/* ============================================================
   AGEZIM — câmera e renderização
   ============================================================ */

const Cam = {
  x: 48, y: 48, zoom: 1.0, W: 800, H: 600, dpr: 1,
  minZoom: 0.55, maxZoom: 2.0,
  w2s(wx, wy, wz = 0) {
    return [((wx - wy) - (this.x - this.y)) * HW * this.zoom + this.W / 2,
      ((wx + wy) - (this.x + this.y)) * HH * this.zoom + this.H / 2 - wz * this.zoom];
  },
  s2w(sx, sy) {
    const a = (sx - this.W / 2) / (HW * this.zoom) + (this.x - this.y);
    const b = (sy - this.H / 2) / (HH * this.zoom) + (this.x + this.y);
    return [(a + b) / 2, (b - a) / 2];
  },
  clamp() {
    const N = MAP_N;
    // mantém o centro dentro do losango do mapa (com folga)
    const a = this.x - this.y, b = this.x + this.y;
    const m = 8;
    const lim = N;
    let na = clamp(a, -lim + m, lim - m), nb = clamp(b, m, 2 * N - m);
    // restringe ao losango: |a| <= min(b, 2N-b)
    const maxA = Math.min(nb, 2 * N - nb) - 2;
    na = clamp(na, -maxA, maxA);
    this.x = (na + nb) / 2; this.y = (nb - na) / 2;
  },
  centerOn(x, y) { this.x = x; this.y = y; this.clamp(); },
  zoomAt(factor, sx, sy) {
    const [wx, wy] = this.s2w(sx, sy);
    this.zoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);
    const [wx2, wy2] = this.s2w(sx, sy);
    this.x += wx - wx2; this.y += wy - wy2;
    this.clamp();
  },
};

/* ---------- névoa de guerra ---------- */
const Fog = {
  FS: 4, M: 56,
  init() {
    const n = (MAP_N + this.M * 2) * this.FS;
    this.size = n;
    this.exp = makeCanvas(n, n); this.vis = makeCanvas(n, n); this.fog = makeCanvas(n, n);
    this.ectx = this.exp.getContext('2d'); this.vctx = this.vis.getContext('2d'); this.fctx = this.fog.getContext('2d');
    this.ver = -1;
    this.rebuild();
  },
  circle(ctx, x, y, r) {
    const FS = this.FS, M = this.M;
    const cx = (x + M) * FS, cy = (y + M) * FS, rr = r * FS;
    const g = ctx.createRadialGradient(cx, cy, rr * 0.55, cx, cy, rr + 4);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, rr + 4, 0, TAU); ctx.fill();
  },
  rebuild() {
    this.vctx.clearRect(0, 0, this.size, this.size);
    for (const s of G.fogSources || []) { this.circle(this.ectx, s.x, s.y, s.r); this.circle(this.vctx, s.x, s.y, s.r); }
    const f = this.fctx;
    f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, this.size, this.size);
    f.fillStyle = 'rgb(5,8,14)';
    f.fillRect(0, 0, this.size, this.size);
    f.globalCompositeOperation = 'destination-out';
    f.globalAlpha = 0.58; f.drawImage(this.exp, 0, 0);
    f.globalAlpha = 1; f.drawImage(this.vis, 0, 0);
    f.globalCompositeOperation = 'source-over';
  },
  update() {
    if (this.ver !== G.fogSources) { this.ver = G.fogSources; this.rebuild(); }
  },
};

/* ---------- água ---------- */
const Water = {
  init() {
    this.p1 = this.makePattern(256, 11, 70, 1.4, 0.9);
    this.p2 = this.makePattern(256, 29, 26, 2.6, 0.55);
    this.sparkle = this.makePattern(256, 47, 40, 1.0, 1.0, true);
  },
  makePattern(size, seed, count, lw, alpha, dots) {
    const cv = makeCanvas(size, size), c = cv.getContext('2d');
    const r = new RNG(seed);
    for (let i = 0; i < count; i++) {
      const x = r.range(0, size), y = r.range(0, size);
      const len = dots ? r.range(1.5, 3) : r.range(14, 46) * (lw > 2 ? 1.5 : 1);
      const bend = r.range(-5, 5);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const px = x + ox * size, py = y + oy * size;
        if (px < -60 || py < -60 || px > size + 60 || py > size + 60) continue;
        c.beginPath();
        if (dots) { c.fillStyle = `rgba(255,255,255,${r.range(0.35, 0.9)})`; c.arc(px, py, len * 0.5, 0, TAU); c.fill(); continue; }
        c.moveTo(px - len / 2, py + bend * 0.2);
        c.quadraticCurveTo(px, py - bend, px + len / 2, py + bend * 0.2);
        c.strokeStyle = `rgba(190,235,255,${alpha * r.range(0.3, 0.8)})`;
        c.lineWidth = lw; c.lineCap = 'round'; c.stroke();
      }
    }
    return cv;
  },
  draw(ctx, W, H, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    const wx0 = W / 2 - (Cam.x - Cam.y) * HW * Cam.zoom;
    const wy0 = H / 2 - (Cam.x + Cam.y) * HH * Cam.zoom;
    const layer = (cv, s, vx, vy, a) => {
      const pat = ctx.createPattern(cv, 'repeat');
      pat.setTransform(new DOMMatrix([s, 0, 0, s * 0.5, wx0 + t * vx, wy0 + t * vy]));
      ctx.globalAlpha = a; ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
    };
    const z = Cam.zoom;
    layer(this.sparkle, z * 1.6, -9 * z, 4 * z, 0.5 + 0.2 * Math.sin(t * 1.3));
    layer(this.p2, z * 1.2, 7 * z, 3 * z, 0.5);
    layer(this.p1, z * 0.9, -5 * z, 2.5 * z, 0.55);
    ctx.globalAlpha = 1;
    const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, '#0d5a8a'); g.addColorStop(0.5, '#0f6a9c'); g.addColorStop(1, '#0b5282');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },
};

/* ---------- renderizador principal ---------- */
const Render = {
  cv: null, ctx: null,

  init(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    Water.init(); Fog.init();
    this.resize();
  },
  resize() {
    const dpr = Math.min(IS_TOUCH ? 1.5 : 2, window.devicePixelRatio || 1);
    Cam.dpr = dpr;
    Cam.W = this.cv.clientWidth || window.innerWidth; Cam.H = this.cv.clientHeight || window.innerHeight;
    this.cv.width = Math.round(Cam.W * dpr); this.cv.height = Math.round(Cam.H * dpr);
  },

  visibleTiles() {
    const c = [[0, 0], [Cam.W, 0], [0, Cam.H], [Cam.W, Cam.H]].map((p) => Cam.s2w(p[0], p[1]));
    const N = G.map.N;
    return {
      i0: clamp(Math.floor(Math.min(...c.map((p) => p[0]))) - 2, 0, N - 1),
      i1: clamp(Math.ceil(Math.max(...c.map((p) => p[0]))) + 2, 0, N - 1),
      j0: clamp(Math.floor(Math.min(...c.map((p) => p[1]))) - 2, 0, N - 1),
      j1: clamp(Math.ceil(Math.max(...c.map((p) => p[1]))) + 2, 0, N - 1),
    };
  },

  draw(t, ui) {
    const ctx = this.ctx, map = G.map, W = Cam.W, H = Cam.H, z = Cam.zoom;
    ctx.setTransform(Cam.dpr, 0, 0, Cam.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';

    // 1. terreno
    const tc = map.terrainCanvas, N = map.N;
    if (tc) {
      const ts = map.terrainScale || 1, tw = tc.width / ts, th = tc.height / ts;   // dimensões em px lógicos
      const srcW = W / z, srcH = H / z;
      let sx0 = (Cam.x - Cam.y) * HW + N * HW - srcW / 2, sy0 = (Cam.x + Cam.y) * HH - srcH / 2;
      let dx = 0, dy = 0, sw = srcW, sh = srcH;
      if (sx0 < 0) { dx = -sx0 * z; sw += sx0; sx0 = 0; }
      if (sy0 < 0) { dy = -sy0 * z; sh += sy0; sy0 = 0; }
      if (sx0 + sw > tw) sw = tw - sx0;
      if (sy0 + sh > th) sh = th - sy0;
      if (sw > 0 && sh > 0) ctx.drawImage(tc, sx0 * ts, sy0 * ts, sw * ts, sh * ts, dx, dy, sw * z, sh * z);
    }
    // 2. água por trás
    Water.draw(ctx, W, H, t);

    const vt = this.visibleTiles();

    // 3. decalques
    if (z >= 0.7) this.drawDecals(ctx, vt);

    // 4. camada de chão
    this.drawGround(ctx, vt, t);

    // 5. entidades ordenadas
    this.drawEntities(ctx, t, vt);

    // 6. projéteis e partículas
    this.drawProjectiles(ctx);
    this.drawParticles(ctx, t);

    // 7. barras de vida
    this.drawBars(ctx);

    // 8. névoa
    Fog.update();
    this.drawFog(ctx);

    // 9. sobreposições da interface (ghost, caixa de seleção...)
    if (ui) ui.drawOverlay(ctx);

    // 10. vinheta / luz
    this.drawVignette(ctx, W, H);
  },

  /* ---------- decalques (tufos, flores) ---------- */
  drawDecals(ctx, vt) {
    const map = G.map, N = map.N, z = Cam.zoom;
    const ds = map.decalStart, dx = map.decalX, dy = map.decalY, dk = map.decalK, occ = map.occ, exp = G.explored;
    for (let j = vt.j0; j <= vt.j1; j++) {
      for (let i = vt.i0; i <= vt.i1; i++) {
        const k = j * N + i;
        if (occ[k] || !exp[k]) continue;
        for (let n = ds[k]; n < ds[k + 1]; n++) {
          const s = Nature.decal(dk[n]);
          const p = Cam.w2s(dx[n], dy[n]);
          if (p[0] < -20 || p[0] > Cam.W + 20 || p[1] < -20 || p[1] > Cam.H + 40) continue;
          blit(ctx, s, p[0], p[1], z * 0.8);
        }
      }
    }
  },

  /* ---------- chão: fazendas, fundações, entulho, seleção ---------- */
  drawGround(ctx, vt, t) {
    const z = Cam.zoom;
    // entulho
    if (G.rubble) for (const r of G.rubble) {
      const b = r.b;
      if (!G.isExplored(b.x, b.y)) continue;
      const p = Cam.w2s(b.x, b.y);
      ctx.globalAlpha = clamp(1 - (r.t - 18) / 12, 0, 1);
      blit(ctx, Buildings.rubble(b.w, b.d), p[0], p[1], z);
      ctx.globalAlpha = 1;
    }
    // fazendas e fundações
    for (const b of G.buildings) {
      if (b.dead || !G.isExplored(b.x, b.y)) continue;
      if (this.offscreen(b.x, b.y, (b.w + b.d) * 34)) continue;
      const p = Cam.w2s(b.x, b.y);
      if (b.def.farm) {
        const spr = Buildings.get('farm', b.team, { stage: b.built ? (b.cropStage || 2) : 0 });
        blit(ctx, spr, p[0], p[1], z);
      } else if (!b.built && !b.def.wall) {
        blit(ctx, Buildings.foundation(b.w, b.d), p[0], p[1], z);
      }
    }
    // anéis de seleção e destaque
    for (const u of G.units) {
      if (u.dead) continue;
      if (u.team !== G.player && !G.isVisible(u.x, u.y)) continue;
      const hover = ui_hover === u;
      if (!u.selected && !hover) continue;
      if (this.offscreen(u.x, u.y, 60)) continue;
      const p = Cam.w2s(u.x, u.y);
      const r = (u.def.radius * 38 + 4) * z;
      const col = u.team === G.player ? [96, 255, 120] : u.team < 0 ? [255, 230, 90] : [255, 80, 70];
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.scale(1, 0.5);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
      ctx.strokeStyle = C.str(col, u.selected ? 0.95 : 0.65); ctx.lineWidth = (u.selected ? 2.2 : 1.6) * z;
      ctx.shadowColor = C.str(col, 0.8); ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.restore();
    }
    for (const e of G.sel) {
      if (e.dead) continue;
      if (e.kind === 'building') this.drawFootprint(ctx, e.rect, e.team === G.player ? [96, 255, 120] : [255, 80, 70], 0.9, t);
      else if (e.kind === 'node') this.drawFootprint(ctx, e.rect, [255, 230, 90], 0.9, t);
    }
    if (ui_hover && !ui_hover.dead && (ui_hover.kind === 'building' || ui_hover.kind === 'node') && !ui_hover.selected) {
      const e = ui_hover;
      this.drawFootprint(ctx, rectOf(e), e.team === G.player ? [200, 255, 210] : e.team < 0 ? [255, 240, 140] : [255, 150, 140], 0.55, t);
    }
    // pontos de reunião
    for (const e of G.sel) {
      if (e.kind === 'building' && e.rally && !e.dead && e.team === G.player) {
        const a = Cam.w2s(e.x, e.y), b = Cam.w2s(e.rally.x, e.rally.y);
        ctx.save();
        ctx.setLineDash([5 * z, 5 * z]); ctx.lineDashOffset = -t * 20;
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        ctx.restore();
        // bandeirinha
        ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0], b[1] - 22 * z); ctx.stroke();
        ctx.fillStyle = C.str(TEAM_COLORS[e.team].main);
        ctx.beginPath(); ctx.moveTo(b[0], b[1] - 22 * z); ctx.lineTo(b[0] + 14 * z, b[1] - 18 * z + Math.sin(t * 5) * 1.5); ctx.lineTo(b[0], b[1] - 13 * z); ctx.closePath(); ctx.fill();
      }
    }
    // marcadores de comando
    for (const pg of FX.pings) {
      const p = Cam.w2s(pg.x, pg.y);
      const k = pg.t / 0.7;
      ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(1, 0.5);
      ctx.beginPath(); ctx.arc(0, 0, (6 + 18 * k) * z, 0, TAU);
      ctx.strokeStyle = pg.kind === 'attack' ? `rgba(255,80,70,${1 - k})` : `rgba(120,255,140,${1 - k})`;
      ctx.lineWidth = 2.4 * z * (1 - k * 0.5); ctx.stroke();
      ctx.restore();
    }
  },

  drawFootprint(ctx, r, col, alpha, t) {
    const p = [Cam.w2s(r.x0, r.y0), Cam.w2s(r.x1, r.y0), Cam.w2s(r.x1, r.y1), Cam.w2s(r.x0, r.y1)];
    ctx.save();
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath();
    ctx.fillStyle = C.str(col, 0.10 + 0.04 * Math.sin(t * 5)); ctx.fill();
    ctx.strokeStyle = C.str(col, alpha); ctx.lineWidth = 2 * Math.max(0.8, Cam.zoom);
    ctx.shadowColor = C.str(col, 0.9); ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  },

  offscreen(wx, wy, margin = 80) {
    const p = Cam.w2s(wx, wy);
    return p[0] < -margin || p[0] > Cam.W + margin || p[1] < -margin * 1.6 || p[1] > Cam.H + margin;
  },

  /* ---------- entidades ---------- */
  drawEntities(ctx, t, vt) {
    const list = this._list || (this._list = []);
    list.length = 0;
    const exp = G.explored, N = G.map.N;
    for (const n of G.nodes) {
      if (n.dead || !exp[n.j * N + n.i]) continue;
      if (this.offscreen(n.x, n.y, 70)) continue;
      list.push({ d: n.x + n.y, e: n });
    }
    for (const b of G.buildings) {
      if (b.dead || b.def.farm || !G.isExplored(b.x, b.y)) continue;
      if (this.offscreen(b.x, b.y, (b.w + b.d) * 40 + 60)) continue;
      list.push({ d: b.x + b.y + (b.def.wall ? 0.02 : 0.2), e: b });
    }
    for (const u of G.units) {
      if (u.team !== G.player && !u.dead && !G.isVisible(u.x, u.y)) continue;
      if (u.dead && u.animal) continue;
      if (u.dead && !G.isExplored(u.x, u.y)) continue;
      if (this.offscreen(u.x, u.y, 60)) continue;
      list.push({ d: u.x + u.y + (u.dead ? -0.3 : 0), e: u });
    }
    list.sort((a, b) => a.d - b.d);
    for (const it of list) {
      const e = it.e;
      if (e.kind === 'unit') this.drawUnit(ctx, e, t);
      else if (e.kind === 'building') this.drawBuilding(ctx, e, t);
      else this.drawNode(ctx, e, t);
    }
  },

  drawUnit(ctx, u, t) {
    const z = Cam.zoom;
    const p = Cam.w2s(u.x, u.y);
    const dir = ((Math.round(u.heading / (TAU / 8)) % 8) + 8) % 8;
    let spr;
    if (u.animal) {
      const anim = u.anim;
      const n = ANIMAL_FRAMES[anim] || 1;
      const fr = anim === 'idle' ? 0 : Math.floor((u.ph || 0) * n) % n;
      spr = AnimalSprites.get(u.type, u.v, dir, anim, fr);
    } else {
      let anim = u.anim;
      if (u.dead) anim = 'dead';
      const n = ANIM_FRAMES[anim] || 1;
      let fr = anim === 'idle' ? 0 : Math.floor((u.ph || 0) * n) % n;
      if (u.dead) fr = Math.min(4, Math.floor(u.deadT / 0.12));
      let carry = null;
      if ((anim === 'idle' || anim === 'walk') && u.carry.amt >= 1 && u.carry.type) carry = u.carry.sub === 'carcass' ? 'meat' : u.carry.type;
      spr = HumanSprites.get(u.type, u.team, u.v, dir, anim, fr, carry);
    }
    if (u.dead) ctx.globalAlpha = clamp(1 - (u.deadT - 4) / 2, 0, 1);
    if (u.hurtT > 0 && !u.dead) ctx.filter = 'brightness(1.5)';
    blit(ctx, spr, p[0], p[1], z);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
  },

  drawNode(ctx, n, t) {
    const z = Cam.zoom;
    const p = Cam.w2s(n.x, n.y);
    let spr;
    const g = n.gsub;
    if (g === 'tree') {
      spr = Nature.tree(n.sub === 'tree' ? 'oak' : n.sub, n.variant);
      // balanço ao vento: leve skew em torno da base
      const sway = Math.sin(t * 1.3 + n.swayPh) * 0.022;
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.transform(1, 0, sway, 1, 0, 0);
      blit(ctx, spr, 0, 0, z);
      ctx.restore();
      // tocos de árvores sendo cortadas: leve encolhimento
      return;
    }
    if (g === 'bush') { const fr = n.amount / n.maxAmount; spr = Nature.bush(n.variant, fr > 0.66 ? 0 : fr > 0.33 ? 1 : 2); }
    else if (g === 'gold' || g === 'stone') { const fr = n.amount / n.maxAmount; spr = Nature.mine(g, n.variant, fr > 0.6 ? 0 : fr > 0.3 ? 1 : 2); }
    else if (g === 'carcass') { spr = Nature.carcass(n.animalType || 'cow'); }
    blit(ctx, spr, p[0], p[1], z);
    // brilho do ouro
    if (g === 'gold' && n.amount > 0) {
      const a = 0.5 + 0.5 * Math.sin(t * 3 + n.swayPh * 3);
      if (a > 0.82) { ctx.fillStyle = `rgba(255,250,200,${(a - 0.82) * 5})`; ctx.beginPath(); ctx.arc(p[0] - 4 * z, p[1] - 14 * z, 2 * z, 0, TAU); ctx.fill(); }
    }
  },

  wallMask(b) {
    const m = G.map;
    let mask = 0;
    const chk = (i, j) => {
      if (!m.inb(i, j)) return false;
      const e = G.byId.get(m.occ[j * m.N + i]);
      return e && e.kind === 'building' && e.def.wall && e.team === b.team;
    };
    if (chk(b.tx, b.ty - 1)) mask |= 1;
    if (chk(b.tx + 1, b.ty)) mask |= 2;
    if (chk(b.tx, b.ty + 1)) mask |= 4;
    if (chk(b.tx - 1, b.ty)) mask |= 8;
    return mask;
  },

  drawBuilding(ctx, b, t) {
    const z = Cam.zoom;
    const p = Cam.w2s(b.x, b.y);
    let opts = {};
    if (b.def.wall && !b.def.gate) opts = { mask: this.wallMask(b) };
    else if (b.def.gate) {
      const mk = this.wallMask(b);
      b.axis = (mk & 5) && !(mk & 10) ? 'y' : (mk & 10) ? 'x' : b.axis;
      opts = { axis: b.axis, open: b.open && b.built };
    }
    const spr = Buildings.get(b.type, b.team, opts);
    const dim = b.team !== G.player && !G.isVisible(b.x, b.y);
    if (b.hurtT > 0) ctx.filter = 'brightness(1.35)';
    if (!b.built && !b.def.wall) {
      const prog = b.progress;
      const f = prog <= 0 ? 0 : 1 - Math.pow(1 - prog, 1.6);
      const yF = p[1] + (b.w + b.d) * 8 * z;
      const yT = p[1] - (spr.bh + (b.w + b.d) * 8) * z;
      const cut = yF - (yF - yT) * f;
      if (f > 0.02) {
        ctx.save();
        ctx.beginPath(); ctx.rect(p[0] - 500 * z, cut, 1000 * z, 2000 * z); ctx.clip();
        ctx.globalAlpha = 0.97;
        blit(ctx, spr, p[0], p[1], z);
        ctx.restore();
      }
      const sh = Math.max(16, Math.round(spr.bh * (0.3 + 0.7 * f) / 8) * 8);
      blit(ctx, Buildings.scaffold(b.w, b.d, sh), p[0], p[1], z);
    } else if (!b.built && b.def.wall) {
      ctx.globalAlpha = 0.45 + 0.55 * b.progress;
      blit(ctx, spr, p[0], p[1], z);
      ctx.globalAlpha = 1;
    } else {
      blit(ctx, spr, p[0], p[1], z);
    }
    ctx.filter = 'none';
    // bandeiras animadas sobre o Centro da Cidade são parte do sprite; ondulação extra: nada
  },

  /* ---------- projéteis ---------- */
  drawProjectiles(ctx) {
    const z = Cam.zoom;
    for (const a of FX.arrows) {
      if (!G.isVisible(a.x, a.y) && !G.isVisible(a.sx, a.sy) && !G.isVisible(a.tx, a.ty)) continue;
      const p1 = Cam.w2s(a.x, a.y, a.z), p0 = Cam.w2s(a.px, a.py, a.pz);
      let dx = p1[0] - p0[0], dy = p1[1] - p0[1];
      const l = Math.hypot(dx, dy) || 1;
      dx = dx / l * 9 * z; dy = dy / l * 9 * z;
      ctx.beginPath(); ctx.moveTo(p1[0] - dx, p1[1] - dy); ctx.lineTo(p1[0], p1[1]);
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2.2 * z; ctx.lineCap = 'round'; ctx.stroke();
      ctx.strokeStyle = '#d8c9a4'; ctx.lineWidth = 1.1 * z; ctx.stroke();
      ctx.fillStyle = '#c9d0d8'; ctx.beginPath(); ctx.arc(p1[0], p1[1], 1.3 * z, 0, TAU); ctx.fill();
      // sombra no chão
      const gs = Cam.w2s(a.x, a.y);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(gs[0], gs[1], 3 * z, 1.4 * z, 0, 0, TAU); ctx.fill();
    }
  },

  /* ---------- partículas ---------- */
  drawParticles(ctx, t) {
    const z = Cam.zoom;
    for (const q of FX.p) {
      if (q.type !== 'text' && !G.isVisible(q.x, q.y) && q.type !== 'smoke' && q.type !== 'dust') continue;
      const p = Cam.w2s(q.x, q.y, q.z);
      if (p[0] < -40 || p[0] > Cam.W + 40 || p[1] < -60 || p[1] > Cam.H + 40) continue;
      const k = q.life / q.max;
      switch (q.type) {
        case 'smoke': case 'dust': {
          const r = q.size * z;
          const a = (q.type === 'smoke' ? 0.42 : 0.5) * Math.min(1, k * 2.2) * (q.type === 'smoke' ? 1 : k);
          const c = q.color;
          const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
          g.addColorStop(0, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`); g.addColorStop(1, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0)`);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill();
          break;
        }
        case 'spark': case 'chip': case 'debris': {
          ctx.fillStyle = C.str(q.color, Math.min(1, k * 2));
          const s = q.size * z;
          ctx.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
          break;
        }
        case 'flame': {
          const r = Math.max(1, q.size * z * k + 1);
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
          g.addColorStop(0, `rgba(255,${200 * k + 40 | 0},60,${0.8 * k + 0.1})`); g.addColorStop(1, 'rgba(255,60,10,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'text': {
          ctx.save();
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.font = `bold ${Math.round(13 * Math.max(0.8, z))}px "Trebuchet MS", sans-serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(q.text, p[0], p[1]);
          ctx.fillStyle = q.color; ctx.fillText(q.text, p[0], p[1]);
          ctx.restore();
          break;
        }
        case 'arrowstuck': {
          ctx.save(); ctx.globalAlpha = Math.min(1, k * 2);
          const dx = Math.cos(q.ang) * 5 * z, dy = Math.sin(q.ang) * 2.5 * z;
          ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.6 * z; ctx.beginPath(); ctx.moveTo(p[0] - dx, p[1] - dy - 4 * z); ctx.lineTo(p[0], p[1]); ctx.stroke();
          ctx.restore();
          break;
        }
      }
    }
  },

  /* ---------- barras de vida ---------- */
  drawBars(ctx) {
    const z = Cam.zoom;
    const bar = (cx, cy, w, frac, col) => {
      const h = Math.max(3, 4 * z);
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(cx - w / 2 - 1, cy - 1, w + 2, h + 2);
      const c = frac > 0.6 ? '#46d65a' : frac > 0.3 ? '#e8c53a' : '#e0453a';
      ctx.fillStyle = col || c; ctx.fillRect(cx - w / 2, cy, w * clamp(frac, 0, 1), h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(cx - w / 2, cy, w * clamp(frac, 0, 1), h * 0.4);
    };
    for (const u of G.units) {
      if (u.dead) continue;
      if (u.team !== G.player && !G.isVisible(u.x, u.y)) continue;
      const recentlyHurt = u.hp < u.maxHp - 0.01 && G.time - (u.lastHurt || -99) < 6;
      if (!u.selected && ui_hover !== u && !recentlyHurt) continue;
      if (this.offscreen(u.x, u.y, 40)) continue;
      const p = Cam.w2s(u.x, u.y, u.animal ? (u.type === 'horse' ? 42 : u.type === 'cow' ? 34 : 18) : 40);
      bar(p[0], p[1], 22 * z, u.hp / u.maxHp);
    }
    for (const b of G.buildings) {
      if (b.dead || b.def.farm && !b.selected) continue;
      const show = b.selected || b.hp < b.maxHp - 0.5 || !b.built || ui_hover === b;
      if (!show || !G.isExplored(b.x, b.y)) continue;
      if (b.team !== G.player && !G.isVisible(b.x, b.y) && !b.selected) continue;
      if (this.offscreen(b.x, b.y, 100)) continue;
      const hh = (Buildings.hpx[b.type] || 30) + 8;
      const p = Cam.w2s(b.x, b.y, hh * 0.9 - (b.w + b.d) * 4);
      const w = Math.max(30, (b.w + b.d) * 11) * z;
      if (!b.built) {
        bar(p[0], p[1] - 4 * z, w, b.progress, '#52b8f0');
      } else bar(p[0], p[1], w, b.hp / b.maxHp);
    }
  },

  /* ---------- névoa ---------- */
  drawFog(ctx) {
    const z = Cam.zoom, FS = Fog.FS, M = Fog.M;
    ctx.save();
    const a = z * HW / FS, b = z * HH / FS;
    const e = Cam.W / 2 - (Cam.x - Cam.y) * HW * z;
    const f = Cam.H / 2 - (2 * M + Cam.x + Cam.y) * HH * z;
    ctx.transform(a, b, -a, b, e, f);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(Fog.fog, 0, 0);
    ctx.restore();
  },

  drawVignette(ctx, W, H) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.78);
    g.addColorStop(0, 'rgba(10,14,30,0)'); g.addColorStop(1, 'rgba(10,14,30,0.34)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // luz quente vinda do canto superior esquerdo
    const g2 = ctx.createLinearGradient(0, 0, W, H);
    g2.addColorStop(0, 'rgba(255,236,190,0.07)'); g2.addColorStop(0.5, 'rgba(255,236,190,0)'); g2.addColorStop(1, 'rgba(40,50,110,0.07)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
  },
};

let ui_hover = null;   // entidade sob o cursor (definida pelo input)
