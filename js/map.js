'use strict';
/* ============================================================
   AGEZIM — mapa: geração da ilha, navegação, terreno pré-renderizado
   ============================================================ */

class GameMap {
  constructor(seed) {
    this.N = MAP_N;
    this.seed = seed | 0;
    const n = this.N * this.N;
    this.h = new Float32Array(n);          // altura (nível do mar = 0)
    this.terrain = new Uint8Array(n);
    this.blk = new Uint8Array(n);          // 1 = bloqueado p/ movimento
    this.occ = new Int32Array(n);          // id de quem ocupa (para construção)
    this.gate = new Int8Array(n).fill(-1); // time que pode atravessar o portão
    this.forest = new Float32Array(n);     // densidade de floresta (escurece o chão)
    this.starts = [];
    this.version = 0;                       // incrementa quando a navegação muda
    this.spawns = { nodes: [], animals: [] };
    this.generate();
  }

  idx(i, j) { return j * this.N + i; }
  inb(i, j) { return i >= 0 && j >= 0 && i < this.N && j < this.N; }

  walkable(i, j, team = 0) {
    if (i < 0 || j < 0 || i >= this.N || j >= this.N) return false;
    const k = j * this.N + i;
    if (this.blk[k]) return false;
    const g = this.gate[k];
    return g < 0 || g === team;
  }

  /* ---------- geração ---------- */
  generate() {
    const N = this.N, c = N / 2, R = N * 0.45;
    let sp = null;
    for (let attempt = 0; attempt < 16; attempt++) {
      const nz = new Noise(this.seed + attempt * 131);
      this.nz = nz;
      this.nz2 = new Noise(this.seed * 7 + 99 + attempt);
      this.nz3 = new Noise(this.seed * 13 + 5 + attempt);
      const lr = new RNG(this.seed + attempt * 977);
      const ph1 = lr.range(0, TAU), ph2 = lr.range(0, TAU), ph3 = lr.range(0, TAU);
      const h = this.h;
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const dx = i + 0.5 - c, dy = j + 0.5 - c;
          const th = Math.atan2(dy, dx);
          // lobos e baías: distorce o raio conforme o ângulo
          const lobes = 1 + 0.13 * Math.sin(3 * th + ph1) + 0.09 * Math.sin(5 * th + ph2) + 0.05 * Math.sin(8 * th + ph3);
          const d = Math.hypot(dx, dy) / (R * lobes);
          const n = nz.fbm(i * 0.04 + 3.1, j * 0.04 + 7.7, 4);
          let v = (1 - d) * 1.55 + (n - 0.5) * 1.15;
          v -= smooth(0.95, 1.3, d) * 1.4;
          h[j * N + i] = v;
        }
      }
      const off = 18;
      sp = [
        { x: Math.round(c - off), y: Math.round(c + off) },
        { x: Math.round(c + off), y: Math.round(c - off) },
      ];
      // aplana as áreas iniciais
      for (const s of sp) {
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          const r = Math.hypot(i + 0.5 - s.x, j + 0.5 - s.y);
          const w = 1 - smooth(8, 14, r);
          if (w > 0) { const k = j * N + i; h[k] = lerp(h[k], Math.max(h[k], 0.42), w); }
        }
      }
      // mantém só o continente do jogador 1
      const reach = this._flood(sp[0].x, sp[0].y);
      let land = 0;
      for (let k = 0; k < N * N; k++) {
        if (h[k] >= 0.02) { if (reach[k]) land++; else h[k] = -0.16; }
      }
      if (!reach[sp[1].y * N + sp[1].x] || land < 2800) continue;
      this.starts = sp.map((s) => ({ x: s.x, y: s.y, tx: s.x - 2, ty: s.y - 2 }));
      break;
    }
    if (!this.starts.length && sp) this.starts = sp.map((s) => ({ x: s.x, y: s.y, tx: s.x - 2, ty: s.y - 2 }));
    // classificação
    for (let k = 0; k < N * N; k++) {
      const v = this.h[k];
      this.terrain[k] = v < -0.10 ? T_DEEP : v < 0.02 ? T_SHALLOW : v < 0.10 ? T_SAND : T_GRASS;
      this.blk[k] = this.terrain[k] < T_SAND ? 1 : 0;
    }
    this._placeResources();
  }

  _flood(sx, sy) {
    const N = this.N, h = this.h;
    const seen = new Uint8Array(N * N);
    const st = [sy * N + sx];
    seen[st[0]] = 1;
    while (st.length) {
      const k = st.pop();
      const i = k % N, j = (k / N) | 0;
      for (let d = 0; d < 4; d++) {
        const ni = i + (d === 0) - (d === 1), nj = j + (d === 2) - (d === 3);
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const nk = nj * N + ni;
        if (seen[nk] || h[nk] < 0.02) continue;
        seen[nk] = 1; st.push(nk);
      }
    }
    return seen;
  }

  /* ---------- recursos & criaturas iniciais ---------- */
  _placeResources() {
    const N = this.N, c = N / 2;
    const rng = new RNG(this.seed * 31 + 7);
    const used = new Uint8Array(N * N);
    const nodes = this.spawns.nodes = [];
    const animals = this.spawns.animals = [];
    const clear = this.starts.map((s) => ({ x: s.x, y: s.y }));
    const nearStart = (i, j, r) => clear.some((s) => Math.hypot(i + 0.5 - s.x, j + 0.5 - s.y) < r);

    // floresta de fundo (campo de densidade)
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i;
      let f = this.nz2.fbm(i * 0.075 + 10, j * 0.075 + 10, 3);
      f = smooth(0.46, 0.68, f);
      const d = Math.hypot(i + 0.5 - c, j + 0.5 - c) / (N * 0.43);
      f *= 1 - smooth(0.8, 1.0, d) * 0.6;
      this.forest[k] = f;
    }

    const free = (i, j, sand) => {
      if (!this.inb(i, j)) return false;
      const k = j * N + i;
      if (used[k]) return false;
      const t = this.terrain[k];
      return sand ? (t === T_SAND || t === T_GRASS) : t === T_GRASS;
    };
    const put = (type, i, j) => { used[j * N + i] = 1; nodes.push({ type, i, j }); };

    const cluster = (type, cx, cy, count, radius, minStartDist = 0) => {
      let placed = 0;
      for (let tries = 0; tries < count * 60 && placed < count; tries++) {
        const a = rng.range(0, TAU), r = Math.sqrt(rng.next()) * radius;
        const i = Math.floor(cx + Math.cos(a) * r), j = Math.floor(cy + Math.sin(a) * r);
        if (!free(i, j)) continue;
        if (minStartDist && nearStart(i, j, minStartDist)) continue;
        put(type, i, j); placed++;
      }
      return placed;
    };
    const forestBlob = (cx, cy, radius, density) => {
      for (let j = Math.floor(cy - radius); j <= Math.ceil(cy + radius); j++) {
        for (let i = Math.floor(cx - radius); i <= Math.ceil(cx + radius); i++) {
          const dd = Math.hypot(i + 0.5 - cx, j + 0.5 - cy) / radius;
          if (dd > 1 || !free(i, j) || nearStart(i, j, 7.5)) continue;
          const p = density * (1 - dd * dd * 0.75) * (0.55 + 0.9 * this.nz3.n(i * 0.6, j * 0.6));
          if (rng.next() < p) {
            this.forest[j * N + i] = Math.max(this.forest[j * N + i], 0.9);
            put(rng.chance(0.35) ? 'pine' : 'tree', i, j);
          }
        }
      }
    };
    const animal = (type, cx, cy, count, radius) => {
      for (let n = 0; n < count; n++) {
        for (let t = 0; t < 40; t++) {
          const a = rng.range(0, TAU), r = Math.sqrt(rng.next()) * radius;
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          const i = Math.floor(x), j = Math.floor(y);
          if (!free(i, j)) continue;
          if (nearStart(i, j, 5)) continue;
          animals.push({ type, x, y }); break;
        }
      }
    };

    // recursos iniciais de cada jogador (orientados ao centro da ilha)
    this.starts.forEach((s, idx) => {
      const inward = Math.atan2(c - s.y, c - s.x);
      const at = (ang, dist) => ({ x: s.x + Math.cos(inward + ang) * dist, y: s.y + Math.sin(inward + ang) * dist });
      let p = at(0.95, 9);       cluster('bush', p.x, p.y, 6, 2.1);
      p = at(-0.9, 11.5);        cluster('gold', p.x, p.y, 5, 2.3);
      p = at(2.2, 11);           cluster('stone', p.x, p.y, 4, 2.0);
      p = at(Math.PI + 0.1, 12); forestBlob(p.x, p.y, 4.6, 0.95);
      p = at(-2.5, 10);          forestBlob(p.x, p.y, 3.4, 0.9);
      p = at(1.9, 15);           forestBlob(p.x, p.y, 3.8, 0.85);
      p = at(0.5, 7);            animal('chicken', p.x, p.y, 4, 2.6);
      p = at(0.15, 14);          animal('cow', p.x, p.y, 3, 3.5);
      p = at(-0.5, 17);          animal('horse', p.x, p.y, 2, 3.5);
      p = at(1.4, 12);           animal('rabbit', p.x, p.y, 3, 5);
    });

    // centro disputado
    cluster('gold', c + 1, c - 1, 6, 3.2);
    cluster('stone', c - 3, c + 3, 4, 2.4);
    animal('horse', c, c, 5, 7);
    animal('cow', c - 5, c - 4, 4, 5);

    // minas extras espalhadas
    for (let n = 0; n < 4; n++) {
      for (let t = 0; t < 80; t++) {
        const a = rng.range(0, TAU), r = rng.range(8, 28);
        const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
        if (!free(Math.floor(x), Math.floor(y))) continue;
        if (clear.some((s) => Math.hypot(x - s.x, y - s.y) < 18)) continue;
        cluster(n % 2 ? 'stone' : 'gold', x, y, n % 2 ? 3 : 4, 2); break;
      }
    }
    // florestas naturais (campo de densidade) + clareiras
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (!free(i, j) || nearStart(i, j, 8)) continue;
      const f = this.forest[j * N + i];
      if (f > 0.15 && rng.next() < f * 0.72) {
        put(this.nz3.n(i * 0.1, j * 0.1) > 0.55 ? 'pine' : 'tree', i, j);
      }
    }
    // palmeiras na praia
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (!free(i, j, true) || this.terrain[j * N + i] !== T_SAND || nearStart(i, j, 6)) continue;
      if (this.nz3.n(i * 0.25 + 50, j * 0.25) > 0.58 && rng.next() < 0.28) put('palm', i, j);
    }
    // coelhos pelo mapa
    for (let n = 0; n < 22; n++) {
      const a = rng.range(0, TAU), r = rng.range(3, 33);
      animal('rabbit', c + Math.cos(a) * r, c + Math.sin(a) * r, 1, 0.5);
    }
    for (let n = 0; n < 5; n++) {
      const a = rng.range(0, TAU), r = rng.range(5, 30);
      animal(n % 2 ? 'cow' : 'horse', c + Math.cos(a) * r, c + Math.sin(a) * r, 2, 3);
    }

    // decalques de chão (tufos, flores, pedrinhas)
    const dx = [], dy = [], dk = [];
    this.decalStart = new Int32Array(N * N + 1);
    const dr = new RNG(this.seed + 4242);
    for (let k = 0; k < N * N; k++) {
      this.decalStart[k] = dx.length;
      const t = this.terrain[k];
      const i = k % N, j = (k / N) | 0;
      if (t === T_GRASS) {
        const cnt = dr.chance(0.55) ? (dr.chance(0.5) ? 2 : 1) : 0;
        for (let n = 0; n < cnt; n++) {
          dx.push(i + dr.next()); dy.push(j + dr.next());
          const q = dr.next();
          dk.push(q < 0.62 ? dr.int(0, 3) : q < 0.86 ? 4 + dr.int(0, 3) : q < 0.95 ? 8 : 9);
        }
      } else if (t === T_SAND && dr.chance(0.18)) {
        dx.push(i + dr.next()); dy.push(j + dr.next()); dk.push(dr.chance(0.5) ? 10 : 11);
      }
    }
    this.decalStart[N * N] = dx.length;
    this.decalX = Float32Array.from(dx); this.decalY = Float32Array.from(dy); this.decalK = Uint8Array.from(dk);
  }

  /* ---------- amostragem ---------- */
  sampleH(u, v) {
    const N = this.N, h = this.h;
    const hu = u - 0.5, hv = v - 0.5;
    let i0 = Math.floor(hu), j0 = Math.floor(hv);
    const fu = hu - i0, fv = hv - j0;
    let i1 = i0 + 1, j1 = j0 + 1;
    i0 = i0 < 0 ? 0 : i0 >= N ? N - 1 : i0; i1 = i1 < 0 ? 0 : i1 >= N ? N - 1 : i1;
    j0 = j0 < 0 ? 0 : j0 >= N ? N - 1 : j0; j1 = j1 < 0 ? 0 : j1 >= N ? N - 1 : j1;
    const a = h[j0 * N + i0], b = h[j0 * N + i1], c = h[j1 * N + i0], d = h[j1 * N + i1];
    return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
  }
  sampleForest(u, v) {
    const N = this.N, f = this.forest;
    const hu = u - 0.5, hv = v - 0.5;
    let i0 = Math.floor(hu), j0 = Math.floor(hv);
    const fu = hu - i0, fv = hv - j0;
    let i1 = i0 + 1, j1 = j0 + 1;
    i0 = i0 < 0 ? 0 : i0 >= N ? N - 1 : i0; i1 = i1 < 0 ? 0 : i1 >= N ? N - 1 : i1;
    j0 = j0 < 0 ? 0 : j0 >= N ? N - 1 : j0; j1 = j1 < 0 ? 0 : j1 >= N ? N - 1 : j1;
    const a = f[j0 * N + i0], b = f[j0 * N + i1], c = f[j1 * N + i0], d = f[j1 * N + i1];
    return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
  }

  /* ---------- terreno pré-renderizado (uma textura gigante) ---------- */
  async bakeTerrain(onProgress) {
    const N = this.N, W = N * TW, H = N * TH, ox = N * HW;
    const cv = makeCanvas(W, H);
    const ctx = cv.getContext('2d');
    const band = 64;
    const img = ctx.createImageData(W, band);
    const nz = this.nz, nz2 = this.nz2, nz3 = this.nz3;
    const seed = this.seed;
    let t0 = performance.now();

    for (let y0 = 0; y0 < H; y0 += band) {
      const d = img.data;
      d.fill(0);
      const rows = Math.min(band, H - y0);
      for (let y = 0; y < rows; y++) {
        const py = y0 + y;
        const b = (py + 0.5) / HH;
        for (let x = 0; x < W; x++) {
          const a = (x + 0.5 - ox) / HW;
          const u = (a + b) * 0.5, v = (b - a) * 0.5;
          if (u < 0 || v < 0 || u >= N || v >= N) continue;
          let hj = this.sampleH(u, v);
          if (hj < -0.2) continue;
          hj += (nz3.n(u * 2.3, v * 2.3) - 0.5) * 0.035;
          let r, g, bl, al = 255;
          if (hj < 0.02) {
            if (hj < -0.15) continue;
            // água rasa
            const t = smooth(-0.15, 0.025, hj);
            const cau = nz2.n(u * 1.4 + 40, v * 1.4 + 40);
            const cau2 = nz2.n(u * 3.1 - 12, v * 3.1 + 7);
            r = lerp(22, 118, t) + (cau - 0.5) * 18 + (cau2 - 0.5) * 8;
            g = lerp(112, 224, t) + (cau - 0.5) * 22 + (cau2 - 0.5) * 10;
            bl = lerp(170, 206, t) + (cau - 0.5) * 12;
            al = smooth(-0.15, -0.05, hj) * (0.72 + 0.28 * t) * 255;
            // espuma da arrebentação
            const fo = smooth(-0.020, 0.012, hj) * (0.45 + 0.55 * nz.n(u * 3.4, v * 3.4));
            const fo2 = smooth(-0.075, -0.05, hj) * smooth(-0.025, -0.04, hj) * 0.25 * nz.n(u * 5 + 3, v * 5);
            const f = clamp(fo + fo2, 0, 1);
            r = lerp(r, 247, f); g = lerp(g, 253, f); bl = lerp(bl, 255, f);
            al = Math.max(al, f * 255);
          } else {
            const nMid = nz.n(u * 0.35 + 3, v * 0.35 + 9);
            const nLow = nz2.fbm(u * 0.07 + 20, v * 0.07 + 20, 3);
            const sp = hash2(x, py, seed);
            // areia
            const dry = smooth(0.02, 0.085, hj);
            let sr = lerp(176, 238, dry), sg = lerp(150, 218, dry), sb = lerp(98, 162, dry);
            const rip = nz.n(u * 2.6, v * 0.9 + 4) * 0.5 + nMid * 0.5;
            sr += (rip - 0.5) * 22; sg += (rip - 0.5) * 20; sb += (rip - 0.5) * 18;
            const sk = 0.95 + sp * 0.1; sr *= sk; sg *= sk; sb *= sk;
            // grama
            const gt = smooth(0.25, 0.8, nLow);
            let gr = lerp(88, 128, gt), gg = lerp(146, 182, gt), gb = lerp(46, 64, gt);
            const pat = nMid - 0.5;
            const grain = nz2.n(u * 1.7 + 11, v * 1.7 + 3) - 0.5;
            gr += pat * 15 + grain * 11; gg += pat * 17 + grain * 13; gb += pat * 6 + grain * 4;
            const fd = this.sampleForest(u, v);
            if (fd > 0) {
              const w = fd * 0.55;
              gr = lerp(gr, 52, w); gg = lerp(gg, 108, w); gb = lerp(gb, 38, w);
            }
            const dn = nz3.fbm(u * 0.22 + 70, v * 0.22 + 70, 2);
            const dw = smooth(0.64, 0.78, dn) * (1 - fd) * 0.38;
            if (dw > 0) { gr = lerp(gr, 156, dw); gg = lerp(gg, 132, dw); gb = lerp(gb, 76, dw); }
            const gk = 0.94 + sp * 0.12;
            gr *= gk; gg *= gk; gb *= gk;
            if (sp > 0.965) { gr *= 0.78; gg *= 0.84; gb *= 0.74; }
            else if (sp < 0.025) { gr = gr * 1.12 + 6; gg = gg * 1.1 + 8; gb *= 1.05; }
            // mistura areia -> grama
            const m = smooth(0.082, 0.15, hj + (nMid - 0.5) * 0.05);
            r = lerp(sr, gr, m); g = lerp(sg, gg, m); bl = lerp(sb, gb, m);
            // areia molhada junto à água
            const wet = 1 - smooth(0.02, 0.045, hj);
            if (wet > 0) { r *= 1 - wet * 0.22; g *= 1 - wet * 0.2; bl *= 1 - wet * 0.12; }
            // relevo suave
            const e = 0.35;
            const sh = 1 + (nz2.n(u * 0.5 + 33, v * 0.5 + 33) - nz2.n(u * 0.5 + 33 + e * 0.5, v * 0.5 + 33 + e * 0.5)) * 0.9;
            r *= sh; g *= sh; bl *= sh;
          }
          const o = (y * W + x) * 4;
          d[o] = r; d[o + 1] = g; d[o + 2] = bl; d[o + 3] = al;
        }
      }
      ctx.putImageData(img, 0, y0, 0, 0, W, rows);
      if (performance.now() - t0 > 24) {
        if (onProgress) onProgress(y0 / H);
        await yieldFrame();
        t0 = performance.now();
      }
    }
    this.terrainCanvas = cv;
    return cv;
  }

  /* ---------- minimapa (rombo 2:1) ---------- */
  bakeMinimap(w, h) {
    const cv = makeCanvas(w, h);
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(w, h);
    const d = img.data, N = this.N;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = ((x + 0.5) / w - 0.5) * 2 * N;    // u - v
        const b = ((y + 0.5) / h) * 2 * N;           // u + v
        const u = (a + b) / 2, v = (b - a) / 2;
        if (u < 0 || v < 0 || u >= N || v >= N) continue;
        const hh = this.sampleH(u, v);
        let col;
        if (hh < -0.10) col = [18, 68, 116];
        else if (hh < 0.02) col = [58, 168, 190];
        else if (hh < 0.10) col = [224, 205, 150];
        else {
          const f = this.sampleForest(u, v);
          col = [lerp(112, 56, f), lerp(164, 112, f), lerp(60, 44, f)];
        }
        const o = (y * w + x) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}
