'use strict';
/* ============================================================
   AGEZIM — IA do reino inimigo (joga com as mesmas regras)
   ============================================================ */

class AI {
  constructor(team) {
    this.team = team;
    this.tick = 2;
    this.t = 0;
    this.nextWave = AI_CFG.firstWaveTime;
    this.waveSize = AI_CFG.firstWave;
    this.waves = 0;
    this.attacking = false;
    this.techOrder = ['axe', 'forge1', 'plow', 'armor1', 'bow1', 'pick', 'wheel', 'forge2', 'armor2', 'bow2'];
    this.lastBuild = 0;
  }

  update(dt) {
    this.t += dt;
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick = 0.7;
    this.think();
  }

  /* ---------- utilidades ---------- */
  mine(type) { return G.buildings.filter((b) => !b.dead && b.team === this.team && (!type || b.type === type)); }
  units(type) { return G.units.filter((u) => !u.dead && u.team === this.team && (!type || u.type === type)); }

  think() {
    const team = this.team;
    const tc = this.mine('towncenter')[0];
    const vils = this.units('villager');
    const army = G.units.filter((u) => !u.dead && u.team === team && u.def.military);
    const res = G.res[team];
    const pop = G.popUsedV[team], cap = G.popCapV[team];
    const built = (t) => this.mine(t).filter((b) => b.built);
    if (!tc && !this.mine().length) return;
    const home = tc || this.mine()[0];

    this.assignIdle(vils, home);
    this.assignBuilders(vils);

    // ---------- construção ----------
    const unbuilt = this.mine().filter((b) => !b.built && !b.def.wall);
    const houseInProg = unbuilt.filter((b) => b.type === 'house').length;
    const count = (t) => this.mine(t).length;
    if (this.t - this.lastBuild > 2 && vils.length) {
      let did = false;
      const tryBuild = (type, near, minR, maxR, gap = 1) => {
        if (did) return;
        const def = BUILD_DEFS[type];
        if (!G.canAfford(team, def.cost)) return;
        let spot = this.findSpot(def.w, def.d, near.x, near.y, minR, maxR, gap, type);
        if (!spot) spot = this.findSpot(def.w, def.d, near.x, near.y, minR, maxR + 14, 0, type);   // base apertada: amplia a busca
        if (!spot) return;
        const builder = this.pickBuilder(vils, spot.x, spot.y);
        if (!builder) return;
        G.spend(team, def.cost);
        const b = G.placeBuilding(type, team, spot.tx, spot.ty, {});
        builder.order({ k: 'build', target: b });
        did = true;
      };
      // casas
      const popSoon = pop + (this.mine('towncenter').reduce((a, b) => a + b.queue.length, 0));
      if (cap - popSoon <= 3 && houseInProg < (pop > 30 ? 2 : 1) && cap < RULES.maxPop) tryBuild('house', home, 3, 12, 1);
      // depósito perto de recursos distantes
      if (!did && vils.length >= 7 && unbuilt.filter((b) => b.type === 'depot').length === 0 && count('depot') < 5) {
        const far = this.farResource(vils);
        if (far) tryBuild('depot', far, 1.5, 5, 0);
      }
      // fazendas
      if (!did && vils.length >= 8) {
        const farms = count('farm');
        const foodNear = G.nearestResource(home.x, home.y, 'food', team, 22);
        const needFarms = !foodNear || (farms === 0 && this.t > 150);
        if (needFarms && farms < 6 && unbuilt.filter((b) => b.type === 'farm').length === 0) tryBuild('farm', home, 3, 9, 0);
      }
      if (!did && vils.length >= 10 && count('barracks') === 0) tryBuild('barracks', home, 5, 14, 1);
      if (!did && count('barracks') >= 1 && vils.length >= 14 && count('blacksmith') === 0) tryBuild('blacksmith', home, 5, 14, 1);
      if (!did && this.t > 480 && count('barracks') === 1 && vils.length >= 18) tryBuild('barracks', home, 5, 15, 1);
      if (did) this.lastBuild = this.t;
    }

    // ---------- produção ----------
    if (tc && tc.built) {
      const wantVils = Math.min(AI_CFG.villagerTarget + (this.t > 600 ? 6 : 0), RULES.maxPop);
      const queued = tc.queue.filter((q) => q.kind === 'unit').length;
      if (vils.length + queued < wantVils && queued < 2 && res.food >= 50) G.queueItem(tc, 'unit', 'villager');
    }
    for (const b of built('barracks')) {
      if (b.queue.length >= 2) continue;
      const w = army.filter((u) => u.type === 'warrior').length, a = army.filter((u) => u.type === 'archer').length;
      const id = a * 1.1 <= w ? 'archer' : 'warrior';
      const alt = id === 'archer' ? 'warrior' : 'archer';
      if (!G.queueItem(b, 'unit', id)) G.queueItem(b, 'unit', alt);
    }
    // pesquisas (só se sobrar recurso)
    if (this.t > 120) {
      for (const id of this.techOrder) {
        if (G.techs[team].has(id)) continue;
        const td = TECHS[id];
        const host = G.buildings.find((b) => !b.dead && b.built && b.team === team && b.def.techs && b.def.techs.includes(id));
        if (!host || host.queue.length) continue;
        const spare = RULES.start.wood * 0.5;
        if (G.canAfford(team, td.cost) && res.food >= (td.cost.food || 0) + 60 && res.gold >= (td.cost.gold || 0) + 20) { G.queueItem(host, 'tech', id); break; }
      }
    }

    // ---------- exército ----------
    this.manageArmy(army, home);
  }

  /* aldeões ociosos: distribui entre recursos conforme necessidade */
  assignIdle(vils, home) {
    const team = this.team;
    const idle = vils.filter((v) => !v.task);
    if (!idle.length) return;
    const cnt = { food: 0, wood: 0, gold: 0, stone: 0 };
    for (const v of vils) {
      if (v.task && v.task.k === 'gather' && v.task.rtype) cnt[v.task.rtype]++;
      else if (v.task && v.task.k === 'attack' && v.task.hunt) cnt.food++;
    }
    const total = Math.max(1, vils.length);
    const hasBarracks = this.mine('barracks').length > 0;
    const want = hasBarracks ? { food: 0.34, wood: 0.34, gold: 0.24, stone: 0.08 } : { food: 0.42, wood: 0.42, gold: 0.12, stone: 0.04 };
    for (const v of idle) {
      // tipo com maior déficit
      let best = 'wood', bd = -9;
      for (const r of RES_TYPES) {
        let def = want[r] * total - cnt[r];
        if (r === 'stone' && this.t < 200) def -= 3;
        if (def > bd) { bd = def; best = r; }
      }
      let order = null;
      if (best === 'food') {
        const n = G.nearestResource(home.x, home.y, 'food', team, 30);
        if (n) order = { k: 'gather', target: n, phase: 'seek', rtype: 'food' };
        else {
          const an = this.nearestAnimal(home.x, home.y, 28);
          if (an) order = { k: 'attack', target: an, hunt: true };
        }
      }
      if (!order) {
        const type = best === 'food' ? 'wood' : best;
        const n = G.nearestResource(home.x, home.y, type, team, 45) || G.nearestResource(v.x, v.y, type, team, 60);
        if (n) { order = { k: 'gather', target: n, phase: 'seek', rtype: n.rtype }; best = type; }
      }
      if (order) { v.order(order); cnt[best]++; }
    }
  }

  nearestAnimal(x, y, maxD) {
    let best = null, bd = maxD;
    for (const u of G.units) {
      if (u.dead || !u.animal) continue;
      const d = Math.hypot(u.x - x, u.y - y);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }

  /* garante que toda construção inacabada tenha alguém trabalhando nela */
  assignBuilders(vils) {
    const working = new Set();
    for (const v of vils) if (v.task && v.task.k === 'build' && v.task.target) working.add(v.task.target.id);
    for (const b of this.mine()) {
      if (b.dead) continue;
      const needs = !b.built || (b.hp < b.maxHp * 0.5 && !b.def.wall);
      if (!needs || working.has(b.id)) continue;
      const v = this.pickBuilder(vils, b.x, b.y);
      if (v) { v.order({ k: 'build', target: b }); working.add(b.id); }
    }
  }

  pickBuilder(vils, x, y) {
    let best = null, bd = 1e9;
    for (const v of vils) {
      if (v.dead) continue;
      if (v.task && v.task.k === 'build') continue;
      if (v.task && v.task.k === 'attack') continue;
      const carrying = v.carry.amt > 5 ? 8 : 0;
      const d = Math.hypot(v.x - x, v.y - y) + (v.task ? 3 : 0) + carrying;
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  /* recurso cujo ponto de entrega mais próximo está longe demais */
  farResource(vils) {
    let worst = null, wd = 9;
    for (const v of vils) {
      if (!v.task || v.task.k !== 'gather' || !v.task.target || v.task.target.dead) continue;
      const n = v.task.target;
      if (n.kind === 'building') continue;
      const d = G.nearestDropoff(n.x, n.y, this.team);
      if (!d) continue;
      const dist = distToRect(n.x, n.y, d.rect);
      if (dist > wd) { wd = dist; worst = n; }
    }
    return worst;
  }

  /* procura um lugar livre para construir ao redor de (cx, cy) */
  findSpot(w, d, cx, cy, minR, maxR, gap, type) {
    const m = G.map;
    const cands = [];
    const R = Math.ceil(maxR) + 1;
    for (let j = Math.floor(cy) - R - d; j <= Math.floor(cy) + R; j++) {
      for (let i = Math.floor(cx) - R - w; i <= Math.floor(cx) + R; i++) {
        const dd = Math.hypot(i + w / 2 - cx, j + d / 2 - cy);
        if (dd < minR || dd > maxR + 1) continue;
        cands.push({ tx: i, ty: j, d: dd + Math.random() * 2.5 });
      }
    }
    cands.sort((a, b) => a.d - b.d);
    for (const c of cands) {
      let ok = true;
      for (let j = c.ty - gap; j < c.ty + d + gap && ok; j++) for (let i = c.tx - gap; i < c.tx + w + gap; i++) {
        if (!m.inb(i, j)) { ok = false; break; }
        const k = j * m.N + i;
        const inside = i >= c.tx && i < c.tx + w && j >= c.ty && j < c.ty + d;
        if (m.occ[k] || (m.terrain[k] < T_SAND)) { ok = false; break; }
        if (!inside && m.blk[k]) { ok = false; break; }
      }
      if (!ok) continue;
      // evita bloquear o caminho: precisa de pelo menos um vizinho livre
      return { tx: c.tx, ty: c.ty, x: c.tx + w / 2, y: c.ty + d / 2 };
    }
    return null;
  }

  /* ---------- exército ---------- */
  manageArmy(army, home) {
    const team = this.team;
    if (!army.length) { this.attacking = false; return; }
    // defesa: inimigos perto de qualquer construção
    let threat = null, td = 16;
    for (const u of G.units) {
      if (u.dead || u.animal || u.team === team || u.team < 0) continue;
      for (const b of this.mine()) {
        if (b.def.wall) continue;
        const d = Math.hypot(u.x - b.x, u.y - b.y);
        if (d < td) { td = d; threat = u; }
      }
    }
    if (threat && !this.attacking) {
      const idle = army.filter((u) => !u.task || (u.task.k === 'move'));
      for (const u of idle) u.order({ k: 'amove', x: threat.x, y: threat.y });
      return;
    }
    // ondas de ataque (o tamanho exigido tem teto; contra um inimigo sem exército basta um grupo pequeno)
    let need = Math.min(this.waveSize, 36);
    const foes = G.units.some((u) => !u.dead && !u.animal && u.team !== team && u.team >= 0 && u.def.military);
    if (!foes) need = Math.min(need, 6);
    if (!this.attacking && this.t >= this.nextWave && army.length >= need) {
      const target = this.pickTarget(home);
      if (target) {
        this.attacking = true; this.waves++;
        this.attackTarget = target;
        Cmd.move(army, target.x, target.y, false, true);
        this.nextWave = this.t + AI_CFG.waveInterval;
        this.waveSize += AI_CFG.waveGrowth;
        G.toast(`O ${TEAM_COLORS[team].name} está atacando!`, 'bad');
        window.Sfx && Sfx.play('alert');
      }
    } else if (this.attacking) {
      // quem está parado durante a ofensiva volta a atacar o alvo atual
      const idleNow = army.filter((u) => !u.task);
      if (idleNow.length) {
        const tgt = this.attackTarget && !this.attackTarget.dead ? this.attackTarget : this.pickTarget(home);
        if (tgt) Cmd.move(idleNow, tgt.x, tgt.y, false, true);
      }
      const busy = army.filter((u) => u.task);
      if (busy.length < Math.max(1, army.length * 0.15)) {
        // reagrupar e escolher novo alvo
        const target = this.pickTarget(home);
        if (target && army.length >= 4) { Cmd.move(army, target.x, target.y, false, true); this.attackTarget = target; }
        else { this.attacking = false; Cmd.move(army, home.x, home.y + 4, false, false); }
      }
    }
  }

  pickTarget(home) {
    let best = null, bd = 1e9;
    for (const b of G.buildings) {
      if (b.dead || b.team === this.team || b.team < 0 || b.def.wall || b.def.farm) continue;
      const d = Math.hypot(b.x - home.x, b.y - home.y) - (b.type === 'towncenter' ? 6 : 0);
      if (d < bd) { bd = d; best = b; }
    }
    if (best) return best;
    for (const u of G.units) if (!u.dead && !u.animal && u.team !== this.team && u.team >= 0) return u;
    return null;
  }
}
