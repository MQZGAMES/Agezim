'use strict';
/* ============================================================
   AGEZIM — estado do jogo, entidades e regras gerais
   ============================================================ */

class Unit {
  constructor(type, team, x, y) {
    this.id = ++G.idc;
    this.kind = 'unit';
    this.type = type;
    this.def = UNIT_DEFS[type];
    this.team = team;
    this.x = x; this.y = y;
    this.hp = this.def.hp; this.maxHp = this.def.hp;
    this.heading = Math.random() * TAU;
    this.v = this.id % 4;                // variante visual
    this.animal = !!this.def.animal;
    this.task = null; this.queue = [];
    this.goal = null; this.goalKey = null; this.path = null; this.pi = 0; this.needPath = false;
    this.pathFail = false; this.pathPartial = false;
    this.carry = { type: null, amt: 0 };
    this.cool = 0; this.swing = null;
    this.anim = 'idle'; this.animT = Math.random() * 10;
    this.dead = false; this.deadT = 0;
    this.stuckT = 0; this.lastX = x; this.lastY = y; this.moved = false;
    this.acquireT = Math.random() * 0.4;
    this.repathT = 0;
    this.hurtT = 0;
    this.selected = false;
    // animais
    this.home = { x, y };
    this.aiState = 'idle'; this.aiT = Math.random() * 4; this.tx = x; this.ty = y; this.fleeT = 0; this.fleeDir = 0;
  }
  get radius() { return this.def.radius; }
}

class Building {
  constructor(type, team, tx, ty, opts = {}) {
    this.id = ++G.idc;
    this.kind = 'building';
    this.type = type;
    this.def = BUILD_DEFS[type];
    this.team = team;
    this.tx = tx; this.ty = ty;
    this.w = this.def.w; this.d = this.def.d;
    this.x = tx + this.w / 2; this.y = ty + this.d / 2;
    this.maxHp = this.def.hp;
    this.built = !!opts.built;
    this.progress = this.built ? 1 : 0;
    this.hp = this.built ? this.maxHp : Math.max(10, this.maxHp * 0.05);
    this.queue = [];
    this.rally = null;
    this.builders = 0; this._bn = 0; this._bf = -1;
    this.dead = false;
    this.axis = opts.axis || 'x';
    this.open = false; this.openT = 0;
    this.cool = 0;
    this.selected = false;
    this.hurtT = 0;
    this.burnT = Math.random();
    this.cropStage = 0;
    if (this.def.farm) { this.amount = this.def.food; this.maxAmount = this.def.food; this.rtype = 'food'; this.gsub = 'farm'; this.workers = 0; }
  }
  get rect() { return { x0: this.tx, y0: this.ty, x1: this.tx + this.w, y1: this.ty + this.d }; }
}

class ResNode {
  constructor(sub, i, j, amount) {
    this.id = ++G.idc;
    this.kind = 'node';
    this.sub = sub;
    this.def = NODE_DEFS[sub];
    this.gsub = this.def.sub;
    this.rtype = GATHER[this.gsub].res;
    this.i = i; this.j = j; this.x = i + 0.5; this.y = j + 0.5;
    this.amount = amount != null ? amount : this.def.amount;
    this.maxAmount = this.amount;
    this.variant = (i * 7 + j * 13) % 3;
    this.dead = false;
    this.workers = 0;
    this.team = GAIA;
    this.swayPh = Math.random() * TAU;
  }
  get rect() { return { x0: this.i, y0: this.j, x1: this.i + 1, y1: this.j + 1 }; }
}

/* retângulo (em tiles) de qualquer entidade */
function rectOf(e) {
  if (e.kind === 'building') return { x0: e.tx, y0: e.ty, x1: e.tx + e.w, y1: e.ty + e.d };
  if (e.kind === 'node') return { x0: e.i, y0: e.j, x1: e.i + 1, y1: e.j + 1 };
  return { x0: e.x - 0.01, y0: e.y - 0.01, x1: e.x + 0.01, y1: e.y + 0.01 };
}
function distToRect(x, y, r) {
  const dx = Math.max(r.x0 - x, 0, x - r.x1), dy = Math.max(r.y0 - y, 0, y - r.y1);
  return Math.hypot(dx, dy);
}

const G = {
  idc: 0,
  frame: 0,
  time: 0,
  map: null,
  units: [], buildings: [], nodes: [],
  byId: new Map(),
  res: [], popCapV: [0, 0], popUsedV: [0, 0],
  mods: [], techs: [],
  market: { food: 100, wood: 100, stone: 100 },
  sel: [],
  projectiles: [], particles: [],
  explored: null, visible: null, fogSources: [],
  player: 0, ai: null,
  paused: false, speed: 1, over: null,
  toasts: [], alerts: [],
  stats: [{ made: 0, lost: 0, killed: 0 }, { made: 0, lost: 0, killed: 0 }],
  hashCell: 4,

  /* ---------------- inicialização ---------------- */
  init(map, opts = {}) {
    this.idc = 0; this.frame = 0; this.time = 0;
    this.map = map;
    this.units = []; this.buildings = []; this.nodes = [];
    this.byId = new Map();
    this.res = [0, 1].map(() => ({ ...RULES.start }));
    this.techs = [new Set(), new Set()];
    this.mods = [0, 1].map(() => this.blankMods());
    this.market = { food: 100, wood: 100, stone: 100 };
    this.sel = [];
    this.projectiles = []; this.particles = [];
    this.toasts = []; this.alerts = [];
    this.over = null; this.paused = false;
    this.stats = [{ made: 0, lost: 0, killed: 0 }, { made: 0, lost: 0, killed: 0 }];
    const N = map.N;
    this.explored = new Uint8Array(N * N);
    this.visible = new Uint8Array(N * N);
    this.fogSources = [];
    this.hw = Math.ceil(N / this.hashCell);
    this.hash = Array.from({ length: this.hw * this.hw }, () => []);
    this.nhash = Array.from({ length: this.hw * this.hw }, () => []);
    Path.init(map);
    this.aiOn = opts.ai !== false;
    this.populate();
    this.rebuildHash();
    this.recount();
    this.updateVision();
  },

  blankMods() { return { atk: {}, range: {}, armor: { melee: 0, pierce: 0 }, gather: {}, carry: 0 }; },

  populate() {
    const map = this.map;
    for (const nd of map.spawns.nodes) this.addNode(nd.type, nd.i, nd.j);
    for (const an of map.spawns.animals) this.addUnit(an.type, GAIA, an.x, an.y);
    map.starts.forEach((s, team) => {
      if (team === 1 && !this.aiOn) return;
      const tc = this.addBuilding('towncenter', team, s.tx, s.ty, { built: true });
      tc.rally = null;
      // aldeões e soldados ao redor
      const spots = this.freeTilesAround(tc.rect, 12, team);
      for (let n = 0; n < RULES.startVillagers; n++) {
        const p = spots[n] || [s.x + 0.5, s.y + 3.5];
        this.addUnit('villager', team, p[0], p[1]);
      }
      for (let n = 0; n < RULES.startWarriors; n++) {
        const p = spots[RULES.startVillagers + n] || [s.x + 1.5, s.y + 3.5];
        this.addUnit('warrior', team, p[0], p[1]);
      }
    });
  },

  /* tiles livres ao redor de um retângulo, ordenados por proximidade (centros) */
  freeTilesAround(rect, count, team = 0) {
    const m = this.map;
    const x0 = Math.floor(rect.x0), y0 = Math.floor(rect.y0), x1 = Math.ceil(rect.x1), y1 = Math.ceil(rect.y1);
    const cx = (rect.x0 + rect.x1) / 2, fy = rect.y1 + 0.5;
    const cand = [];
    for (let j = y0 - 5; j < y1 + 5; j++) {
      for (let i = x0 - 5; i < x1 + 5; i++) {
        const dx = Math.max(x0 - i, 0, i - (x1 - 1)), dy = Math.max(y0 - j, 0, j - (y1 - 1));
        const ring = Math.max(dx, dy);
        if (ring < 1 || ring > 4) continue;
        if (!m.walkable(i, j, team) || m.occ[j * m.N + i]) continue;
        cand.push({ p: [i + 0.5, j + 0.5], k: ring * 2 + Math.hypot(i + 0.5 - cx, j + 0.5 - fy) * 0.15 });
      }
    }
    cand.sort((a, b) => a.k - b.k);
    return cand.slice(0, count * 3).map((c) => c.p);
  },

  /* ---------------- criação de entidades ---------------- */
  addUnit(type, team, x, y) {
    const u = new Unit(type, team, x, y);
    this.units.push(u); this.byId.set(u.id, u);
    if (team >= 0 && !u.animal) this.stats[team].made++;
    return u;
  },

  addNode(sub, i, j, amount, x, y) {
    const n = new ResNode(sub, i, j, amount);
    if (x != null) { n.x = x; n.y = y; }
    this.nodes.push(n); this.byId.set(n.id, n);
    const m = this.map, k = j * m.N + i;
    if (n.def.block) { m.blk[k] = 1; m.occ[k] = n.id; m.version++; }
    this._hashAdd(this.nhash, n);
    return n;
  },

  removeNode(n) {
    if (n.dead) return;
    n.dead = true;
    const m = this.map, k = n.j * m.N + n.i;
    if (m.occ[k] === n.id) { m.occ[k] = 0; if (n.def.block) m.blk[k] = 0; m.version++; }
    const arr = this.nhash[this._cell(n.x, n.y)];
    const ix = arr.indexOf(n); if (ix >= 0) arr.splice(ix, 1);
    this.byId.delete(n.id);
  },

  addBuilding(type, team, tx, ty, opts = {}) {
    const b = new Building(type, team, tx, ty, opts);
    this.buildings.push(b); this.byId.set(b.id, b);
    const m = this.map;
    for (let j = ty; j < ty + b.d; j++) for (let i = tx; i < tx + b.w; i++) {
      const k = j * m.N + i;
      m.occ[k] = b.id;
      if (!b.def.walkable) m.blk[k] = 1;
    }
    if (b.built) this.onBuilt(b, true);
    m.version++;
    return b;
  },

  onBuilt(b, silent) {
    const m = this.map;
    b.built = true; b.progress = 1; b.hp = Math.max(b.hp, b.maxHp * 0.99);
    if (b.def.gate) {
      const k = b.ty * m.N + b.tx;
      m.blk[k] = 0; m.gate[k] = b.team;
      m.version++;
    }
    this.recount();
    if (!silent) {
      if (b.team === this.player) { this.toast(`${b.def.name} ${b.def.fem ? 'concluída' : 'concluído'}`, 'good'); window.Sfx && Sfx.play('built'); }
      FX.puff(b.x, b.y, b.w, 14);
    }
  },

  destroyBuilding(b, attacker) {
    if (b.dead) return;
    b.dead = true;
    const m = this.map;
    for (let j = b.ty; j < b.ty + b.d; j++) for (let i = b.tx; i < b.tx + b.w; i++) {
      const k = j * m.N + i;
      if (m.occ[k] === b.id) { m.occ[k] = 0; m.blk[k] = 0; m.gate[k] = -1; }
    }
    m.version++;
    this.byId.delete(b.id);
    // devolve recursos de itens na fila
    for (const q of b.queue) if (q.kind === 'unit' || q.kind === 'tech') this.refund(b.team, q.cost);
    b.queue = [];
    FX.collapse(b);
    if (b.team === this.player && !b.def.wall) { this.toast(`${b.def.name} ${b.def.fem ? 'destruída' : 'destruído'}!`, 'bad'); }
    if (attacker && attacker.team >= 0) this.stats[attacker.team].killed++;
    if (b.team >= 0) this.stats[b.team].lost++;
    this.rubble = this.rubble || [];
    if (!b.def.wall && !b.def.farm) this.rubble.push({ b, t: 0 });
    // desmarca
    this.sel = this.sel.filter((e) => e !== b);
    this.recount();
    window.Sfx && Sfx.play('collapse', b.x, b.y);
  },

  killUnit(u, attacker) {
    if (u.dead) return;
    u.dead = true; u.deadT = 0; u.hp = 0;
    u.task = null; u.queue.length = 0; u.path = null;
    if (u.animal) {
      // vira carcaça
      const i = Math.floor(u.x), j = Math.floor(u.y);
      const n = this.addNode('carcass', i, j, u.def.food, u.x, u.y);
      n.animalType = u.type; n.variant = u.v;
      u.carcass = n;
      u.deadT = 99;      // remove já (sem corpo de animal)
    } else {
      if (attacker && attacker.team >= 0) this.stats[attacker.team].killed++;
      if (u.team >= 0) this.stats[u.team].lost++;
      if (u.team === this.player) this.alertAt(u.x, u.y, 'Unidade perdida');
      window.Sfx && Sfx.play('die', u.x, u.y);
    }
    if (u.selected) { u.selected = false; this.sel = this.sel.filter((e) => e !== u); }
    this.recount();
  },

  /* ---------------- hash espacial ---------------- */
  _cell(x, y) {
    const hw = this.hw, c = this.hashCell;
    const cx = clamp(Math.floor(x / c), 0, hw - 1), cy = clamp(Math.floor(y / c), 0, hw - 1);
    return cy * hw + cx;
  },
  _hashAdd(h, e) { h[this._cell(e.x, e.y)].push(e); },
  rebuildHash() {
    for (const c of this.hash) c.length = 0;
    for (const u of this.units) if (!u.dead) this.hash[this._cell(u.x, u.y)].push(u);
  },
  queryUnits(x, y, r, fn) {
    const hw = this.hw, c = this.hashCell;
    const x0 = clamp(Math.floor((x - r) / c), 0, hw - 1), x1 = clamp(Math.floor((x + r) / c), 0, hw - 1);
    const y0 = clamp(Math.floor((y - r) / c), 0, hw - 1), y1 = clamp(Math.floor((y + r) / c), 0, hw - 1);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const arr = this.hash[cy * hw + cx];
      for (let i = 0; i < arr.length; i++) fn(arr[i]);
    }
  },

  /* nó de recurso mais próximo (rtype: 'food'|'wood'|... ou sub: 'tree') */
  nearestNode(x, y, pred, maxD = 40) {
    const hw = this.hw, c = this.hashCell;
    const cx = clamp(Math.floor(x / c), 0, hw - 1), cy = clamp(Math.floor(y / c), 0, hw - 1);
    let best = null, bd = maxD * maxD;
    const maxR = Math.ceil(maxD / c);
    for (let r = 0; r <= maxR; r++) {
      // quando já temos candidato mais perto que o anel atual, para
      if (best && (r - 1) * c > Math.sqrt(bd)) break;
      for (let j = cy - r; j <= cy + r; j++) for (let i = cx - r; i <= cx + r; i++) {
        if (i < 0 || j < 0 || i >= hw || j >= hw) continue;
        if (Math.max(Math.abs(i - cx), Math.abs(j - cy)) !== r) continue;
        const arr = this.nhash[j * hw + i];
        for (let k = 0; k < arr.length; k++) {
          const n = arr[k];
          if (n.dead || n.amount <= 0 || !pred(n)) continue;
          const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
          if (d < bd) { bd = d; best = n; }
        }
      }
    }
    return best;
  },

  /* recurso (nó ou fazenda) mais próximo por tipo */
  nearestResource(x, y, rtype, team, maxD = 40, exclude = null) {
    const m = this.map;
    let best = this.nearestNode(x, y, (n) => n.rtype === rtype && (!exclude || n !== exclude) && this.nodeVisibleForTeam(n, team) && n.workers < this.maxWorkers(n), maxD);
    if (rtype === 'food') {
      let bd = best ? Math.hypot(best.x - x, best.y - y) : maxD;
      for (const b of this.buildings) {
        if (b.dead || !b.built || !b.def.farm || b.team !== team || b.amount <= 0 || b === exclude) continue;
        if (b.workers >= b.def.maxWorkers) continue;
        const d = Math.hypot(b.x - x, b.y - y) - 1.2;
        if (d < bd) { bd = d; best = b; }
      }
    }
    return best;
  },
  maxWorkers(n) {
    if (n.kind === 'building') return n.def.maxWorkers || 1;
    return n.gsub === 'tree' ? 3 : n.gsub === 'bush' ? 3 : n.gsub === 'carcass' ? 4 : 5;
  },
  nodeVisibleForTeam(n, team) {
    if (team !== this.player) return true;
    return this.explored[n.j * this.map.N + n.i] > 0;
  },

  nearestDropoff(x, y, team) {
    let best = null, bd = 1e9;
    for (const b of this.buildings) {
      if (b.dead || !b.built || b.team !== team || !b.def.dropoff) continue;
      const d = distToRect(x, y, b.rect);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  },

  /* ---------------- estatísticas efetivas ---------------- */
  atk(u) { return u.def.attack + (this.mods[u.team] ? (this.mods[u.team].atk[u.type] || 0) : 0); },
  range(u) { return u.def.range + (this.mods[u.team] ? (this.mods[u.team].range[u.type] || 0) : 0); },
  armor(e, t) {
    if (e.kind === 'unit') {
      let a = e.def.armor[t] || 0;
      if (e.def.military && this.mods[e.team]) a += this.mods[e.team].armor[t] || 0;
      return a;
    }
    return (e.def.armor && e.def.armor[t]) || 0;
  },
  carryCap(u, gsub) { return GATHER[gsub].cap + (this.mods[u.team] ? this.mods[u.team].carry : 0); },
  gatherMult(team, gsub) {
    const key = gsub === 'tree' ? 'wood' : gsub;
    return (this.mods[team].gather[key] || 1);
  },

  /* ---------------- combate ---------------- */
  hit(attacker, target, dmg, dtype) {
    if (!target || target.dead) return;
    const armor = this.armor(target, dtype);
    const min = target.kind === 'building' ? RULES.armorMinBuilding : RULES.armorMin;
    const dealt = Math.max(min, dmg - armor);
    target.hp -= dealt;
    target.hurtT = 0.25;
    target.lastHurt = this.time;
    if (target.kind === 'unit') {
      FX.hitSpark(target.x, target.y, 10);
      if (attacker) target.onHit(attacker);
      if (target.team === this.player && attacker && attacker.team !== this.player) this.alertAt(target.x, target.y, 'Sob ataque!');
    } else if (target.kind === 'building') {
      FX.hitSpark(target.x + (Math.random() - 0.5) * target.w * 0.6, target.y + (Math.random() - 0.5) * target.d * 0.6, 18 + Math.random() * 14);
      if (target.team === this.player && attacker && attacker.team !== this.player) this.alertAt(target.x, target.y, 'Sob ataque!');
    }
    if (target.hp <= 0) {
      if (target.kind === 'unit') this.killUnit(target, attacker);
      else if (target.kind === 'building') this.destroyBuilding(target, attacker);
    }
  },

  /* ---------------- economia ---------------- */
  canAfford(team, cost) { const r = this.res[team]; for (const k in cost) if (r[k] < cost[k]) return false; return true; },
  spend(team, cost) { const r = this.res[team]; for (const k in cost) r[k] -= cost[k]; },
  refund(team, cost) { const r = this.res[team]; for (const k in cost) r[k] += cost[k]; },

  recount() {
    this.popUsedV = [0, 0]; this.popCapV = [0, 0];
    for (const u of this.units) if (!u.dead && !u.animal && u.team >= 0) this.popUsedV[u.team]++;
    for (const b of this.buildings) {
      if (b.dead || b.team < 0) continue;
      if (b.built && b.def.pop) this.popCapV[b.team] += b.def.pop;
      for (const q of b.queue) if (q.kind === 'unit') this.popUsedV[b.team]++;
    }
    for (const t of [0, 1]) this.popCapV[t] = Math.min(this.popCapV[t], RULES.maxPop);
  },

  /* ---------------- produção ---------------- */
  canQueue(b, kind, id) {
    if (!b.built || b.dead) return { ok: false, msg: '' };
    if (b.queue.length >= 6) return { ok: false, msg: 'Fila cheia' };
    if (kind === 'unit') {
      const def = UNIT_DEFS[id];
      if (!this.canAfford(b.team, def.cost)) return { ok: false, msg: 'Recursos insuficientes' };
      if (this.popUsedV[b.team] + def.pop > this.popCapV[b.team]) return { ok: false, msg: this.popCapV[b.team] >= RULES.maxPop ? 'Limite de população atingido' : 'Construa mais casas' };
    } else {
      const t = TECHS[id];
      if (this.techs[b.team].has(id)) return { ok: false, msg: 'Já pesquisado' };
      if (b.queue.some((q) => q.id === id)) return { ok: false, msg: 'Já em pesquisa' };
      if (t.req && !this.techs[b.team].has(t.req)) return { ok: false, msg: 'Requer ' + TECHS[t.req].name };
      if (!this.canAfford(b.team, t.cost)) return { ok: false, msg: 'Recursos insuficientes' };
    }
    return { ok: true };
  },
  queueItem(b, kind, id) {
    const c = this.canQueue(b, kind, id);
    if (!c.ok) { if (c.msg && b.team === this.player) this.toast(c.msg, 'warn'); return false; }
    const def = kind === 'unit' ? UNIT_DEFS[id] : TECHS[id];
    this.spend(b.team, def.cost);
    b.queue.push({ kind, id, t: def.time, total: def.time, cost: { ...def.cost } });
    this.recount();
    window.Sfx && Sfx.play('click');
    return true;
  },
  cancelItem(b, idx) {
    const q = b.queue[idx];
    if (!q) return;
    this.refund(b.team, q.cost);
    b.queue.splice(idx, 1);
    this.recount();
  },

  applyTech(team, id) {
    const t = TECHS[id];
    this.techs[team].add(id);
    const m = this.mods[team];
    const fx = t.fx;
    if (fx.atk) for (const k in fx.atk) m.atk[k] = (m.atk[k] || 0) + fx.atk[k];
    if (fx.range) for (const k in fx.range) m.range[k] = (m.range[k] || 0) + fx.range[k];
    if (fx.armor) for (const k in fx.armor) m.armor[k] += fx.armor[k];
    if (fx.gather) for (const k in fx.gather) m.gather[k] = (m.gather[k] || 1) * fx.gather[k];
    if (fx.carry) m.carry += fx.carry;
    if (team === this.player) { this.toast(`Pesquisa concluída: ${t.name}`, 'good'); window.Sfx && Sfx.play('tech'); }
  },

  /* ---------------- mercado ---------------- */
  tradePrice(res, mode) {
    const p = this.market[res];
    return mode === 'buy' ? Math.round(p * 1.22) : Math.round(p * 0.78);
  },
  trade(team, res, mode) {
    const r = this.res[team];
    const price = this.tradePrice(res, mode);
    if (mode === 'sell') {
      if (r[res] < 100) { if (team === this.player) this.toast('Recursos insuficientes', 'warn'); return false; }
      r[res] -= 100; r.gold += price;
      this.market[res] = Math.max(20, this.market[res] - 4);
    } else {
      if (r.gold < price) { if (team === this.player) this.toast('Ouro insuficiente', 'warn'); return false; }
      r.gold -= price; r[res] += 100;
      this.market[res] = Math.min(300, this.market[res] + 4);
    }
    window.Sfx && Sfx.play('coin');
    return true;
  },

  /* ---------------- construção ---------------- */
  canPlace(type, tx, ty, team, axis) {
    const def = BUILD_DEFS[type], m = this.map;
    for (let j = ty; j < ty + def.d; j++) for (let i = tx; i < tx + def.w; i++) {
      if (!m.inb(i, j)) return { ok: false, why: 'Fora do mapa' };
      const k = j * m.N + i;
      const t = m.terrain[k];
      if (t < T_SAND) return { ok: false, why: 'Terreno inválido' };
      if (team === this.player && this.explored[k] === 0) return { ok: false, why: 'Área inexplorada' };
      const oc = m.occ[k];
      if (oc) {
        // portão pode substituir um muro próprio
        if (def.gate) {
          const e = this.byId.get(oc);
          if (e && e.kind === 'building' && e.def.wall && !e.def.gate && e.team === team) continue;
        }
        return { ok: false, why: 'Ocupado' };
      }
    }
    return { ok: true };
  },

  /* expulsa unidades de dentro de um retângulo que acabou de ser bloqueado */
  evict(rect, team) {
    const m = this.map;
    for (const u of this.units) {
      if (u.dead) continue;
      const inside = u.x > rect.x0 - 0.2 && u.x < rect.x1 + 0.2 && u.y > rect.y0 - 0.2 && u.y < rect.y1 + 0.2;
      if (!inside) continue;
      const spot = Path.nearestWalkable(Math.floor(u.x), Math.floor(u.y), u.animal ? -1 : u.team, 8);
      if (spot) {
        // empurra para fora do retângulo
        let nx = spot[0] + 0.5, ny = spot[1] + 0.5;
        u.x = nx + (Math.random() - 0.5) * 0.3; u.y = ny + (Math.random() - 0.5) * 0.3;
        u.path = null; if (u.task) { u.goal = null; u.needPath = false; u.goalKey = null; }
      }
    }
  },

  placeBuilding(type, team, tx, ty, opts = {}) {
    const def = BUILD_DEFS[type];
    // portão sobre muro: remove o muro
    if (def.gate) {
      const m = this.map, k = ty * m.N + tx;
      const e = this.byId.get(m.occ[k]);
      if (e && e.kind === 'building' && e.def.wall && !e.def.gate) { this.removeSilently(e); }
    }
    const b = this.addBuilding(type, team, tx, ty, opts);
    if (!def.walkable || true) this.evict(b.rect, team);
    return b;
  },
  removeSilently(b) {
    b.dead = true;
    const m = this.map;
    for (let j = b.ty; j < b.ty + b.d; j++) for (let i = b.tx; i < b.tx + b.w; i++) {
      const k = j * m.N + i;
      if (m.occ[k] === b.id) { m.occ[k] = 0; m.blk[k] = 0; m.gate[k] = -1; }
    }
    m.version++;
    this.byId.delete(b.id);
    this.sel = this.sel.filter((e) => e !== b);
  },

  /* fazenda esgotada: replanta sozinha se houver madeira (como o "replantio" do AoE II) */
  farmDepleted(f) {
    const team = f.team, tx = f.tx, ty = f.ty, cost = BUILD_DEFS.farm.cost;
    this.removeSilently(f);
    if (this.canAfford(team, cost)) {
      this.spend(team, cost);
      this.addBuilding('farm', team, tx, ty, { built: true });
      if (team === this.player) this.toast('Fazenda replantada (−60 madeira)', 'info');
    } else if (team === this.player) {
      this.toast('Fazenda esgotada — falta madeira para replantar', 'warn');
    }
  },

  demolish(b) {
    if (b.dead || b.team !== this.player) return;
    if (!b.built) this.refund(b.team, Object.fromEntries(Object.entries(b.def.cost).map(([k, v]) => [k, Math.floor(v * (1 - b.progress))])));
    FX.collapse(b);
    this.destroyBuilding(b, null);
  },

  /* ---------------- visão / neblina ---------------- */
  updateVision() {
    const N = this.map.N, vis = this.visible, exp = this.explored;
    vis.fill(0);
    const src = [];
    const add = (x, y, r) => {
      src.push({ x, y, r });
      const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(N - 1, Math.ceil(x + r));
      const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(N - 1, Math.ceil(y + r));
      const r2 = r * r;
      for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
        const dx = i + 0.5 - x, dy = j + 0.5 - y;
        if (dx * dx + dy * dy <= r2) { vis[j * N + i] = 1; exp[j * N + i] = 1; }
      }
    };
    const pl = this.player;
    for (const u of this.units) if (!u.dead && u.team === pl) add(u.x, u.y, u.def.sight);
    for (const b of this.buildings) if (!b.dead && b.team === pl) add(b.x, b.y, b.built ? b.def.sight + Math.max(b.w, b.d) / 2 : 3);
    this.fogSources = src;
  },
  isVisible(x, y) {
    const N = this.map.N;
    const i = Math.floor(x), j = Math.floor(y);
    if (i < 0 || j < 0 || i >= N || j >= N) return false;
    return this.visible[j * N + i] === 1;
  },
  isExplored(x, y) {
    const N = this.map.N;
    const i = Math.floor(x), j = Math.floor(y);
    if (i < 0 || j < 0 || i >= N || j >= N) return false;
    return this.explored[j * N + i] === 1;
  },

  /* ---------------- avisos ---------------- */
  toast(msg, type = 'info') {
    if (!msg) return;
    this.toasts.push({ msg, type, t: 0, id: ++this.idc });
    if (this.toasts.length > 4) this.toasts.shift();
  },
  alertAt(x, y, msg) {
    const last = this.alerts[this.alerts.length - 1];
    if (last && this.time - last.time < 4 && Math.hypot(last.x - x, last.y - y) < 12) return;
    this.alerts.push({ x, y, time: this.time, msg });
    if (this.alerts.length > 8) this.alerts.shift();
    this.toast(msg, 'bad');
    window.Sfx && Sfx.play('alert');
  },

  /* ---------------- loop de atualização ---------------- */
  update(dt) {
    if (this.paused || this.over) return;
    this.frame++;
    this.time += dt;
    this.rebuildHash();
    for (const u of this.units) u.update(dt);
    this.separate(dt);
    for (const b of this.buildings) updateBuilding(b, dt);
    FX.update(dt);
    Path.process(3.5);
    // limpeza
    if (this.frame % 10 === 0) this.cleanup();
    if (this.frame % 8 === 0) this.updateVision();
    if (this.frame % 30 === 0) { this.recount(); this.checkVictory(); }
    if (this.ai && this.aiOn) this.ai.update(dt);
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < 4.5);
    if (this.rubble) { for (const r of this.rubble) r.t += dt; this.rubble = this.rubble.filter((r) => r.t < 30); }
  },

  cleanup() {
    this.units = this.units.filter((u) => !(u.dead && u.deadT > 6));
    this.buildings = this.buildings.filter((b) => !b.dead);
    this.nodes = this.nodes.filter((n) => !n.dead);
    for (const u of this.units) if (u.dead) this.byId.delete(u.id);
  },

  /* repulsão suave entre unidades */
  separate(dt) {
    const m = this.map;
    for (const u of this.units) {
      if (u.dead) continue;
      const ru = u.def.radius;
      this.queryUnits(u.x, u.y, 1.2, (o) => {
        if (o === u || o.dead || o.id < u.id) return;
        const dx = u.x - o.x, dy = u.y - o.y;
        const minD = (ru + o.def.radius) * 1.05;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD) return;
        const d = Math.sqrt(d2) || 0.001;
        const push = (minD - d) * 0.5;
        const nx = dx / d, ny = dy / d;
        // quem está trabalhando parado é "mais pesado"
        const wu = u.isStationary() ? 3 : 1, wo = o.isStationary() ? 3 : 1;
        const fu = wo / (wu + wo), fo = wu / (wu + wo);
        const k = Math.min(1, dt * 14);
        this.nudge(u, nx * push * fu * 2 * k, ny * push * fu * 2 * k);
        this.nudge(o, -nx * push * fo * 2 * k, -ny * push * fo * 2 * k);
      });
    }
  },
  nudge(u, dx, dy) {
    const m = this.map;
    const nx = u.x + dx, ny = u.y + dy;
    const team = u.animal ? -1 : u.team;
    if (m.walkable(Math.floor(nx), Math.floor(ny), team)) { u.x = nx; u.y = ny; }
    else if (m.walkable(Math.floor(nx), Math.floor(u.y), team)) u.x = nx;
    else if (m.walkable(Math.floor(u.x), Math.floor(ny), team)) u.y = ny;
  },

  /* ---------------- vitória / derrota ---------------- */
  checkVictory() {
    if (this.over) return;
    const alive = (t) => this.buildings.some((b) => !b.dead && b.team === t && !b.def.wall && !b.def.farm && b.built !== undefined);
    const mine = alive(0);
    const theirs = this.aiOn ? alive(1) : true;
    if (!mine) this.over = { win: false };
    else if (!theirs) this.over = { win: true };
  },

  /* ---------------- helpers de consulta ---------------- */
  nearestEnemyBuilding(u, maxD) {
    let best = null, bd = maxD;
    for (const b of this.buildings) {
      if (b.dead || b.team === u.team || b.team < 0) continue;
      const d = distToRect(u.x, u.y, b.rect);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  },
  teamBuildings(team, type) { return this.buildings.filter((b) => !b.dead && b.team === team && (!type || b.type === type)); },
  teamUnits(team, type) { return this.units.filter((u) => !u.dead && u.team === team && (!type || u.type === type)); },
};

/* ---------- produção e lógica de construções ---------- */
function updateBuilding(b, dt) {
  if (b.dead) return;
  if (b.hurtT > 0) b.hurtT -= dt;
  // contagem de construtores (do quadro anterior)
  if (b._bf !== G.frame) { b.builders = b._bn; b._bn = 0; b._bf = G.frame; }
  if (!b.built) return;
  const def = b.def;
  // produção
  if (b.queue.length) {
    const q = b.queue[0];
    q.t -= dt;
    if (q.t <= 0) {
      b.queue.shift();
      if (q.kind === 'unit') spawnTrained(b, q.id);
      else G.applyTech(b.team, q.id);
      G.recount();
    }
  }
  // portões abrem para aliados próximos
  if (def.gate) {
    b.openT -= dt;
    if (b.openT <= 0) {
      b.openT = 0.25;
      let near = false;
      G.queryUnits(b.x, b.y, 2.2, (u) => { if (!near && !u.dead && u.team === b.team && Math.hypot(u.x - b.x, u.y - b.y) < 1.9) near = true; });
      b.open = near;
    }
  }
  // flechas do centro da cidade
  if (def.attack) {
    b.cool -= dt;
    if (b.cool <= 0) {
      let tgt = null, bd = def.attack.range;
      G.queryUnits(b.x, b.y, def.attack.range + 0.5, (u) => {
        if (u.dead || u.team === b.team || u.animal) return;
        const d = distToRect(u.x, u.y, b.rect);
        if (d < bd) { bd = d; tgt = u; }
      });
      if (tgt) {
        b.cool = def.attack.rof;
        FX.arrow(b.x, b.y, 62, tgt, def.attack.dmg, 'pierce', b);
        window.Sfx && Sfx.play('arrow', b.x, b.y);
      } else b.cool = 0.4;
    }
  }
  // fumaça
  if (def.smoke && Math.random() < dt * 1.6 && (G.isVisible(b.x, b.y) || b.team === G.player)) FX.smoke(b);
  // fogo quando muito danificado
  if (b.hp < b.maxHp * 0.4 && !def.wall && !def.farm) {
    b.burnT -= dt;
    if (b.burnT <= 0) { b.burnT = 0.12 + Math.random() * 0.15; FX.flame(b); }
  }
}

function spawnTrained(b, type) {
  const def = UNIT_DEFS[type];
  const tiles = G.freeTilesAround(b.rect, 6, b.team);
  let spot = tiles[0];
  if (b.rally) {
    const rx = b.rally.x, ry = b.rally.y;
    tiles.sort((p, q) => Math.hypot(p[0] - rx, p[1] - ry) - Math.hypot(q[0] - rx, q[1] - ry));
    spot = tiles[0];
  }
  if (!spot) spot = [b.x, b.y + b.d / 2 + 1];
  const u = G.addUnit(type, b.team, spot[0] + (Math.random() - 0.5) * 0.3, spot[1] + (Math.random() - 0.5) * 0.3);
  if (b.team === G.player) { G.toast(`${def.name} pronto`, 'info'); window.Sfx && Sfx.play('ready'); }
  if (b.rally) {
    const r = b.rally;
    if (r.target && !r.target.dead && u.type === 'villager' && (r.target.kind === 'node' || (r.target.kind === 'building' && r.target.def.farm))) u.order({ k: 'gather', target: r.target, phase: 'seek' });
    else if (r.target && !r.target.dead && r.target.kind === 'building' && r.target.team === b.team && !r.target.built && u.type === 'villager') u.order({ k: 'build', target: r.target, phase: 'seek' });
    else u.order({ k: 'move', x: r.x, y: r.y });
  }
}
