'use strict';
/* ============================================================
   AGEZIM — pathfinding (A* 8 direções + suavização por linha de visão)
   ============================================================ */

const SQRT2 = Math.SQRT2;

const Path = {
  init(map) {
    this.map = map;
    const n = map.N * map.N;
    this.stamp = new Int32Array(n);
    this.cur = 0;
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.closed = new Int32Array(n);
    this.heap = new MinHeap();
    this.queue = [];
  },

  /* linha livre (com folga lateral) entre dois pontos do mundo */
  los(x0, y0, x1, y1, team, clear = 0.27) {
    const m = this.map;
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return m.walkable(Math.floor(x0), Math.floor(y0), team);
    const nx = -dy / len * clear, ny = dx / len * clear;
    const steps = Math.ceil(len / 0.28);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + dx * t, y = y0 + dy * t;
      if (!m.walkable(Math.floor(x), Math.floor(y), team)) return false;
      if (!m.walkable(Math.floor(x + nx), Math.floor(y + ny), team)) return false;
      if (!m.walkable(Math.floor(x - nx), Math.floor(y - ny), team)) return false;
    }
    return true;
  },

  nearestWalkable(i, j, team, maxR = 6) {
    const m = this.map;
    if (m.walkable(i, j, team)) return [i, j];
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = 1e9;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          if (!m.walkable(i + di, j + dj, team)) continue;
          const d = di * di + dj * dj;
          if (d < bd) { bd = d; best = [i + di, j + dj]; }
        }
      }
      if (best) return best;
    }
    return null;
  },

  /* goal: {t:'tile',x,y} | {t:'rect',x0,y0,x1,y1} (tiles; x1,y1 exclusivos) | {t:'range',x,y,r} */
  find(sx, sy, goal, team = 0, maxNodes = 9000) {
    const m = this.map, N = m.N;
    let si = Math.floor(sx), sj = Math.floor(sy);
    if (!m.walkable(si, sj, team)) {
      const nw = this.nearestWalkable(si, sj, team, 5);
      if (!nw) return { pts: [], ok: false, partial: true };
      si = nw[0]; sj = nw[1];
    }
    // ---- atalhos por linha de visão ----
    if (goal.t === 'tile') {
      if (this.los(sx, sy, goal.x, goal.y, team)) return { pts: [[goal.x, goal.y]], ok: true, partial: false };
    } else if (goal.t === 'range') {
      if (Math.hypot(goal.x - sx, goal.y - sy) <= goal.r - 0.2) return { pts: [], ok: true, partial: false };
    }
    // ---- função objetivo e heurística ----
    let gi = 0, gj = 0, isGoal, hFn;
    if (goal.t === 'tile') {
      gi = Math.floor(goal.x); gj = Math.floor(goal.y);
      if (!m.walkable(gi, gj, team)) {
        const nw = this.nearestWalkable(gi, gj, team, 6);
        if (!nw) return { pts: [], ok: false, partial: true };
        gi = nw[0]; gj = nw[1];
      }
      isGoal = (i, j) => i === gi && j === gj;
      hFn = (i, j) => { const dx = Math.abs(i - gi), dy = Math.abs(j - gj); return dx + dy + (SQRT2 - 2) * Math.min(dx, dy); };
    } else if (goal.t === 'rect') {
      const { x0, y0, x1, y1 } = goal;
      isGoal = (i, j) => i >= x0 - 1 && i <= x1 && j >= y0 - 1 && j <= y1;
      hFn = (i, j) => {
        const dx = Math.max(0, x0 - 1 - i, i - x1), dy = Math.max(0, y0 - 1 - j, j - y1);
        return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
      };
    } else { // range
      const r = goal.r - 0.3;
      isGoal = (i, j) => Math.hypot(i + 0.5 - goal.x, j + 0.5 - goal.y) <= r;
      hFn = (i, j) => Math.max(0, Math.hypot(i + 0.5 - goal.x, j + 0.5 - goal.y) - r);
    }

    this.cur++;
    const cur = this.cur, stamp = this.stamp, g = this.g, parent = this.parent, closed = this.closed, heap = this.heap;
    heap.clear();
    const sidx = sj * N + si;
    stamp[sidx] = cur; g[sidx] = 0; parent[sidx] = -1;
    heap.push(hFn(si, sj), sidx);
    let found = -1, best = sidx, bestH = hFn(si, sj), nodes = 0;
    const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1];
    while (heap.n > 0) {
      const k = heap.pop();
      if (closed[k] === cur) continue;
      closed[k] = cur;
      const i = k % N, j = (k / N) | 0;
      if (isGoal(i, j)) { found = k; break; }
      if (++nodes > maxNodes) break;
      const gk = g[k];
      for (let d = 0; d < 8; d++) {
        const ni = i + DI[d], nj = j + DJ[d];
        if (!m.walkable(ni, nj, team)) continue;
        if (d >= 4 && (!m.walkable(i + DI[d], j, team) || !m.walkable(i, j + DJ[d], team))) continue;
        const nk = nj * N + ni;
        if (closed[nk] === cur) continue;
        const ng = gk + (d < 4 ? 1 : SQRT2);
        if (stamp[nk] !== cur || ng < g[nk]) {
          stamp[nk] = cur; g[nk] = ng; parent[nk] = k;
          const h = hFn(ni, nj);
          if (h < bestH) { bestH = h; best = nk; }
          heap.push(ng + h, nk);
        }
      }
    }
    const partial = found < 0;
    const endK = partial ? best : found;
    // reconstrói
    const tiles = [];
    for (let k = endK; k >= 0; k = parent[k]) { tiles.push(k); if (parent[k] === -1) break; }
    tiles.reverse();
    let pts = tiles.map((k) => [(k % N) + 0.5, ((k / N) | 0) + 0.5]);
    if (!partial && goal.t === 'tile' && m.walkable(Math.floor(goal.x), Math.floor(goal.y), team)) pts[pts.length - 1] = [goal.x, goal.y];
    pts = this.smooth(sx, sy, pts, team);
    return { pts, ok: !partial, partial };
  },

  smooth(sx, sy, pts, team) {
    if (pts.length <= 2) return pts;
    const out = [];
    let ax = sx, ay = sy, i = 0;
    while (i < pts.length) {
      let far = i;
      for (let k = pts.length - 1; k > i; k--) {
        if (this.los(ax, ay, pts[k][0], pts[k][1], team)) { far = k; break; }
      }
      out.push(pts[far]);
      ax = pts[far][0]; ay = pts[far][1];
      i = far + 1;
    }
    return out;
  },

  /* gerenciador de requisições (limita custo por quadro) */
  enqueue(u) { if (!u._inPathQ) { u._inPathQ = true; this.queue.push(u); } },
  process(budgetMs = 3.5) {
    const t0 = performance.now();
    let n = 0;
    while (this.queue.length && (performance.now() - t0 < budgetMs || n < 2)) {
      const u = this.queue.shift();
      u._inPathQ = false;
      if (u.dead || !u.needPath || !u.goal) continue;
      const r = this.find(u.x, u.y, u.goal, u.team);
      u.path = r.pts; u.pi = 0; u.pathPartial = r.partial; u.needPath = false;
      u.pathFail = r.pts.length === 0 && !r.ok && !(r.partial === false);
      if (r.pts.length === 0 && r.ok) u.path = null;   // já no objetivo
      n++;
    }
  },
};
