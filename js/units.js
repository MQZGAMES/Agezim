'use strict';
/* ============================================================
   AGEZIM — comportamento das unidades (tarefas, movimento, combate)
   ============================================================ */

const REACH = { gather: 0.9, build: 1.0, drop: 1.05 };
const WORK_ANIM = { tree: 'chop', gold: 'mine', stone: 'mine', farm: 'farm', bush: 'forage', carcass: 'forage' };
const WORK_RATE = { chop: 1.15, mine: 1.0, farm: 0.9, forage: 0.9, build: 1.0 };

Object.assign(Unit.prototype, {
  isStationary() { return !this.moved; },

  /* ---------- ordens ---------- */
  order(task, queue = false) {
    if (queue && this.task) { this.queue.push(task); return; }
    this.queue.length = 0;
    this.setTask(task);
  },
  setTask(task) {
    this.task = task;
    this.goal = null; this.goalKey = null; this.path = null; this.needPath = false;
    this.pathFail = false; this.swing = null; this.workAcc = 0;
    if (task && task.k === 'gather') {
      const n = task.target;
      if (n && this.carry.type && this.carry.type !== n.rtype) { this.carry.amt = 0; this.carry.type = null; }
      if (n && n.kind === 'unit') { task.k = 'attack'; task.hunt = true; }
    }
    this.releaseSlot();
  },
  /* libera a vaga de trabalho em recursos/construções */
  releaseSlot() {
    if (this.slot) { this.slot.workers = Math.max(0, (this.slot.workers || 0) - 1); this.slot = null; }
  },
  takeSlot(n) {
    if (this.slot === n) return;
    this.releaseSlot();
    n.workers = (n.workers || 0) + 1; this.slot = n;
  },
  nextTask() {
    this.releaseSlot();
    if (this.queue.length) this.setTask(this.queue.shift());
    else { this.task = null; this.goal = null; this.path = null; this.swing = null; }
  },
  stop() { this.queue.length = 0; this.releaseSlot(); this.task = null; this.goal = null; this.path = null; this.swing = null; this.needPath = false; },

  nearRect(rect, reach) { return distToRect(this.x, this.y, rect) <= reach; },
  faceTo(x, y) { const dx = x - this.x, dy = y - this.y; if (dx * dx + dy * dy > 1e-6) this.th = Math.atan2(dy, dx); },
  faceRect(rect) {
    const cx = clamp(this.x, rect.x0, rect.x1), cy = clamp(this.y, rect.y0, rect.y1);
    if (Math.abs(cx - this.x) + Math.abs(cy - this.y) < 0.01) this.faceTo((rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2);
    else this.faceTo(cx, cy);
  },

  /* ---------- movimento ---------- */
  followGoal(goal, key, dt) {
    if (!this.goal || this.goalKey !== key) {
      this.goal = goal; this.goalKey = key; this.path = null; this.pi = 0;
      this.needPath = true; this.pathFail = false; this.pathPartial = false; this.stuckT = 0; this.repaths = 0;
      Path.enqueue(this);
    }
    if (this.needPath) return 'wait';
    if (this.pathFail) return 'fail';
    // caminho invalidado por mudanças na navegação?
    if (this.navVer !== G.map.version) {
      this.navVer = G.map.version;
      if (this.path && !this.pathStillValid()) { this.needPath = true; Path.enqueue(this); return 'wait'; }
    }
    if (!this.path) return this.pathPartial ? 'fail' : 'arrived';
    return this.moveAlong(dt);
  },
  pathStillValid() {
    const m = G.map, team = this.animal ? -1 : this.team;
    let px = this.x, py = this.y;
    for (let k = this.pi; k < Math.min(this.path.length, this.pi + 6); k++) {
      const p = this.path[k];
      if (!Path.los(px, py, p[0], p[1], team, 0.2)) return false;
      px = p[0]; py = p[1];
    }
    return true;
  },
  moveAlong(dt, speedMul = 1) {
    const p = this.path[this.pi];
    if (!p) { this.path = null; return this.pathPartial ? 'fail' : 'arrived'; }
    const dx = p[0] - this.x, dy = p[1] - this.y;
    const d = Math.hypot(dx, dy);
    const step = this.def.speed * speedMul * dt;
    this.anim = 'walk';
    this.moved = true;
    if (d <= step + 0.001) {
      this.x = p[0]; this.y = p[1];
      this.pi++;
      if (this.pi >= this.path.length) { this.path = null; return this.pathPartial ? 'fail' : 'arrived'; }
    } else {
      this.x += dx / d * step; this.y += dy / d * step;
      this.th = Math.atan2(dy, dx);
    }
    this.walkPh = (this.walkPh || 0) + dt * this.def.speed * speedMul * 0.62;
    // detecção de travamento
    this.stuckT += dt;
    if (this.stuckT >= 0.9) {
      const moved = Math.hypot(this.x - this.lastX, this.y - this.lastY);
      this.lastX = this.x; this.lastY = this.y; this.stuckT = 0;
      if (moved < this.def.speed * 0.9 * 0.3) {
        this.repaths = (this.repaths || 0) + 1;
        if (this.repaths > 3) { this.path = null; this.pathFail = true; return 'fail'; }
        this.needPath = true; Path.enqueue(this); return 'wait';
      }
    }
    return 'moving';
  },
  /* passo direto (sem caminho) em direção a um ponto, respeitando obstáculos */
  stepToward(x, y, dt, speedMul = 1) {
    const dx = x - this.x, dy = y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.001) return;
    const step = Math.min(d, this.def.speed * speedMul * dt);
    const nx = this.x + dx / d * step, ny = this.y + dy / d * step;
    const team = this.animal ? -1 : this.team;
    if (G.map.walkable(Math.floor(nx), Math.floor(ny), team)) { this.x = nx; this.y = ny; }
    else if (G.map.walkable(Math.floor(nx), Math.floor(this.y), team)) this.x = nx;
    else if (G.map.walkable(Math.floor(this.x), Math.floor(ny), team)) this.y = ny;
    this.th = Math.atan2(dy, dx);
    this.anim = 'walk'; this.moved = true;
    this.walkPh = (this.walkPh || 0) + dt * this.def.speed * speedMul * 0.62;
  },

  /* ---------- laço principal ---------- */
  update(dt) {
    if (this.dead) { this.deadT += dt; return; }
    this.cool = Math.max(0, this.cool - dt);
    if (this.hurtT > 0) this.hurtT -= dt;
    const ox = this.x, oy = this.y;
    this.moved = false;
    this.anim = 'idle';
    if (this.animal) this.updateAnimal(dt);
    else {
      const t = this.task;
      if (!t) this.updateIdle(dt);
      else switch (t.k) {
        case 'move': this.updateMove(dt); break;
        case 'amove': this.updateAMove(dt); break;
        case 'gather': this.updateGather(dt); break;
        case 'build': this.updateBuild(dt); break;
        case 'attack': this.updateAttack(dt); break;
        default: this.nextTask();
      }
    }
    // rotação suave
    if (this.th != null) {
      const dh = angDiff(this.heading, this.th);
      this.heading += clamp(dh, -dt * 13, dt * 13);
    }
    // fase da animação
    if (this.anim === 'walk') this.ph = (this.walkPh || 0) % 1;
    else if (this.anim === 'idle') this.ph = 0;
    this.animT += dt;
    // velocidade (usada para antecipar a mira das flechas)
    this.vx = lerp(this.vx || 0, (this.x - ox) / dt, 0.4);
    this.vy = lerp(this.vy || 0, (this.y - oy) / dt, 0.4);
  },

  /* ---------- ocioso ---------- */
  updateIdle(dt) {
    if (!this.def.military) return;
    this.acquireT -= dt;
    if (this.acquireT > 0) return;
    this.acquireT = 0.35;
    const t = this.acquire(Math.max(G.range(this) + 3, this.def.sight));
    if (t) this.setTask({ k: 'attack', target: t, auto: true, leashX: this.x, leashY: this.y });
  },

  acquire(range) {
    let best = null, bs = 1e9;
    const me = this;
    const needVis = me.team === G.player;
    G.queryUnits(this.x, this.y, range, (o) => {
      if (o.dead || o.animal || o.team === me.team || o.team < 0) return;
      const d = Math.hypot(o.x - me.x, o.y - me.y);
      if (d > range) return;
      if (needVis && !G.isVisible(o.x, o.y)) return;
      const s = d + (o.def.military ? 0 : 2.5);
      if (s < bs) { bs = s; best = o; }
    });
    if (best) return best;
    for (const b of G.buildings) {
      if (b.dead || b.team === me.team || b.team < 0 || b.def.wall || b.def.farm) continue;
      const d = distToRect(me.x, me.y, b.rect);
      if (d < range && d < bs) { bs = d; best = b; }
    }
    return best;
  },

  /* ---------- mover ---------- */
  updateMove(dt) {
    const t = this.task;
    const r = this.followGoal({ t: 'tile', x: t.x, y: t.y }, 'move', dt);
    if (r === 'arrived' || r === 'fail') this.nextTask();
  },

  updateAMove(dt) {
    const t = this.task;
    if (this.def.military) {
      this.acquireT -= dt;
      if (this.acquireT <= 0) {
        this.acquireT = 0.3;
        const e = this.acquire(Math.max(G.range(this) + 3, this.def.sight));
        if (e) {
          this.queue.unshift(t);
          this.setTask({ k: 'attack', target: e, auto: true, resume: true });
          return;
        }
      }
    }
    const r = this.followGoal({ t: 'tile', x: t.x, y: t.y }, 'amove', dt);
    if (r === 'arrived' || r === 'fail') this.nextTask();
  },

  /* ---------- coletar ---------- */
  updateGather(dt) {
    const t = this.task;
    let n = t.target;
    t.phase = t.phase || 'seek';
    if (t.phase === 'return') return this.updateReturn(dt);
    const gone = !n || n.dead || !(n.amount > 0.01);
    if (gone) {
      this.releaseSlot();
      const full = this.carry.amt >= 1 && this.carry.type;
      const alt = this.findAlternative(t);
      // ainda tem espaço na bolsa e há outro recurso por perto: continua a coletar
      if (alt && (!full || this.carry.amt < this.carryCapFor(alt) * 0.7)) { t.target = alt; t.phase = 'seek'; this.goal = null; return; }
      if (full) { t.phase = 'return'; return; }
      if (alt) { t.target = alt; t.phase = 'seek'; this.goal = null; return; }
      return this.nextTask();
    }
    t.lx = n.x; t.ly = n.y; t.rtype = n.rtype;
    const rect = rectOf(n);
    if (t.phase === 'seek') {
      if (this.nearRect(rect, REACH.gather)) return this.tryStartWork(t, n);
      const r = this.followGoal({ t: 'rect', ...rect }, 'g' + n.id, dt);
      if (r === 'arrived') {
        if (this.nearRect(rect, REACH.gather + 0.4)) this.tryStartWork(t, n);
        else { const alt = this.findAlternative(t, n); if (alt) t.target = alt; else this.nextTask(); }
      } else if (r === 'fail') {
        const alt = this.findAlternative(t, n);
        if (alt) { t.target = alt; this.goal = null; } else this.nextTask();
      }
      return;
    }
    // trabalhando
    if (!this.nearRect(rect, REACH.gather + 0.5)) { t.phase = 'seek'; this.releaseSlot(); return; }
    this.takeSlot(n);
    this.faceRect(rect);
    const anim = WORK_ANIM[n.gsub];
    this.anim = anim;
    const prev = this.workAcc || 0;
    this.workAcc = prev + dt * WORK_RATE[anim];
    this.ph = this.workAcc % 1;
    const gsub = n.gsub;
    const cap = G.carryCap(this, gsub);
    const per = GATHER[gsub].rate * G.gatherMult(this.team, gsub);
    const amt = Math.min(n.amount, per * dt);
    n.amount -= amt;
    this.carry.type = n.rtype; this.carry.amt += amt; this.carry.sub = gsub;
    this.lastNode = n;
    if (n.kind === 'building' && n.def.farm) this.updateFarmStage(n);
    // efeitos no momento do golpe
    if (Math.floor(this.workAcc + 0.4) > Math.floor(prev + 0.4)) FX.workStrike(this, n, anim);
    if (n.amount <= 0.01) {
      this.releaseSlot();
      if (n.kind === 'node') G.removeNode(n);
      else if (n.kind === 'building' && n.def.farm) G.farmDepleted(n);
    }
    if (this.carry.amt >= cap - 0.001) { t.phase = 'return'; this.releaseSlot(); }
  },
  carryCapFor(n) { return G.carryCap(this, n.gsub); },
  /* chegou ao recurso: começa a trabalhar, a menos que a vaga esteja lotada */
  tryStartWork(t, n) {
    if (this.slot !== n && (n.workers || 0) >= G.maxWorkers(n)) {
      const alt = G.nearestResource(this.x, this.y, n.rtype, this.team, 12, n);
      if (alt) { t.target = alt; this.goal = null; return; }
    }
    t.phase = 'work'; this.path = null; this.goal = null;
  },
  updateFarmStage(f) {
    const fr = f.amount / f.maxAmount;
    f.cropStage = fr > 0.66 ? 2 : fr > 0.33 ? 3 : 4;
  },

  findAlternative(t, exclude) {
    const rtype = t.rtype || (t.target && t.target.rtype);
    if (!rtype) return null;
    const x = t.lx != null ? t.lx : this.x, y = t.ly != null ? t.ly : this.y;
    let a = G.nearestResource(x, y, rtype, this.team, 14, exclude || t.target);
    if (!a) a = G.nearestResource(this.x, this.y, rtype, this.team, 25, exclude || t.target);
    return a;
  },

  updateReturn(dt) {
    const t = this.task;
    if (!this.carry.type || this.carry.amt < 0.5) { this.carry.amt = 0; this.carry.type = null; t.phase = 'seek'; return; }
    let d = t.drop;
    if (!d || d.dead || !d.built) { d = t.drop = G.nearestDropoff(this.x, this.y, this.team); }
    if (!d) { this.nextTask(); return; }
    const rect = rectOf(d);
    if (this.nearRect(rect, REACH.drop)) {
      const amt = Math.floor(this.carry.amt);
      if (amt > 0) {
        G.res[this.team][this.carry.type] += amt;
        if (this.team === G.player) FX.floatText(d.x, d.y, 30 + d.w * 6, `+${amt}`, this.carry.type);
        window.Sfx && Sfx.play('drop', this.x, this.y);
      }
      this.carry.amt = 0; this.carry.type = null;
      t.drop = null;
      // volta ao recurso
      const n = t.target;
      if (!n || n.dead || !(n.amount > 0.01)) {
        const alt = this.findAlternative(t);
        if (alt) { t.target = alt; } else return this.nextTask();
      }
      t.phase = 'seek'; this.goal = null;
      return;
    }
    const r = this.followGoal({ t: 'rect', ...rect }, 'd' + d.id, dt);
    if (r === 'fail') { t.drop = null; this.goal = null; if (!G.nearestDropoff(this.x, this.y, this.team)) this.nextTask(); }
  },

  /* ---------- construir / reparar ---------- */
  updateBuild(dt) {
    const t = this.task;
    const b = t.target;
    if (!b || b.dead) return this.nextTask();
    if (b.built && b.hp >= b.maxHp - 0.5) return this.afterBuild(b);
    const rect = b.rect;
    if (!this.nearRect(rect, REACH.build + (b.def.walkable ? 1 : 0))) {
      const r = this.followGoal({ t: 'rect', ...rect }, 'b' + b.id, dt);
      if (r === 'fail') this.nextTask();
      else if (r === 'arrived' && !this.nearRect(rect, REACH.build + 0.5)) this.nextTask();
      return;
    }
    this.path = null; this.goal = null;
    this.faceRect(rect);
    this.anim = 'build';
    const prev = this.workAcc || 0;
    this.workAcc = prev + dt * WORK_RATE.build;
    this.ph = this.workAcc % 1;
    if (Math.floor(this.workAcc * 2 + 0.45) > Math.floor(prev * 2 + 0.45)) FX.workStrike(this, b, 'build');
    if (b._bf !== G.frame) { b.builders = b._bn; b._bn = 0; b._bf = G.frame; }
    b._bn++;
    if (!b.built) {
      const n = Math.max(1, b.builders);
      const inc = dt / b.def.time * Math.pow(n, -0.3);
      b.progress = Math.min(1, b.progress + inc);
      b.hp = Math.max(b.hp, b.maxHp * b.progress);
      if (b.progress >= 1) { G.onBuilt(b); this.afterBuild(b); }
    } else {
      b.hp = Math.min(b.maxHp, b.hp + b.maxHp / b.def.time * 1.2 * dt);
    }
  },
  afterBuild(b) {
    this.releaseSlot();
    if (this.queue.length) return this.nextTask();
    if (b.def.farm && b.amount > 0) { return this.setTask({ k: 'gather', target: b, phase: 'seek', rtype: 'food' }); }
    if (b.def.dropoff && b.built) {
      const wants = [b.def.farm ? 'food' : null, 'wood', 'food', 'gold', 'stone'];
      let best = null, bd = 12;
      for (const r of ['wood', 'food', 'gold', 'stone']) {
        const n = G.nearestResource(b.x, b.y, r, this.team, 12);
        if (n) { const d = Math.hypot(n.x - b.x, n.y - b.y); if (d < bd) { bd = d; best = n; } }
      }
      if (best) return this.setTask({ k: 'gather', target: best, phase: 'seek', rtype: best.rtype });
    }
    this.nextTask();
  },

  /* ---------- combate ---------- */
  onHit(attacker) {
    if (this.dead) return;
    if (this.animal) {
      if (this.def.flee > 0 && this.hp > 0) {
        this.aiState = 'flee'; this.fleeT = this.def.fleeTime;
        this.fleeDir = Math.atan2(this.y - attacker.y, this.x - attacker.x) + (Math.random() - 0.5) * 0.8;
      }
      return;
    }
    if (this.def.military && attacker.kind === 'unit' && !attacker.dead && (!this.task || this.task.k === 'amove' || (this.task.auto && (!this.task.target || this.task.target.kind !== 'unit')))) {
      if (this.task && this.task.k === 'amove') this.queue.unshift(this.task);
      this.setTask({ k: 'attack', target: attacker, auto: true, resume: true });
    }
  },

  attackReach(e) {
    return G.range(this) + (e.kind === 'building' ? 0.4 : 0.25);
  },
  edgeDist(e) {
    return e.kind === 'building' ? distToRect(this.x, this.y, e.rect) : Math.hypot(e.x - this.x, e.y - this.y) - e.def.radius;
  },

  updateAttack(dt) {
    const t = this.task;
    const e = t.target;
    if (!e || e.dead || (e.kind === 'unit' && e.team === this.team)) return this.afterAttack();
    // auto-ataque preso à coleira
    if (t.auto && !t.resume && t.leashX != null && Math.hypot(this.x - t.leashX, this.y - t.leashY) > 16) return this.afterAttack(true);
    if (this.swing) return this.continueSwing(dt, e);
    const dist = this.edgeDist(e);
    const reach = this.attackReach(e);
    if (dist <= reach) {
      this.path = null; this.goal = null;
      if (e.kind === 'building') this.faceRect(e.rect); else this.faceTo(e.x, e.y);
      this.anim = 'idle';
      if (this.cool <= 0) this.startSwing(e);
      return;
    }
    // aproximação
    this.repathT -= dt;
    if (e.kind === 'unit' && dist < 16 && Path.los(this.x, this.y, e.x, e.y, this.team, 0.2)) {
      this.goal = null; this.path = null;
      const range = G.range(this);
      const stopAt = range > 1 ? reach - 0.4 : 0.1;
      const dd = Math.hypot(e.x - this.x, e.y - this.y);
      this.stepToward(e.x, e.y, dt);
      return;
    }
    let goal, key;
    if (e.kind === 'building') {
      goal = G.range(this) > 1 ? { t: 'range', x: e.x, y: e.y, r: G.range(this) + Math.max(e.w, e.d) / 2 } : { t: 'rect', ...e.rect };
      key = 'a' + e.id;
    } else {
      goal = G.range(this) > 1 ? { t: 'range', x: e.x, y: e.y, r: G.range(this) } : { t: 'tile', x: e.x, y: e.y };
      key = 'a' + e.id + ':' + Math.floor(e.x / 3) + ',' + Math.floor(e.y / 3);
    }
    const r = this.followGoal(goal, key, dt);
    if (r === 'fail' || (r === 'arrived' && this.edgeDist(e) > reach + 0.6)) {
      // bloqueado: ataca a construção mais próxima (muro etc.)
      if (!t.blockTried) {
        t.blockTried = true;
        const b = G.nearestEnemyBuilding(this, 5);
        if (b && b !== e) {
          this.queue.unshift({ ...t, blockTried: false });
          return this.setTask({ k: 'attack', target: b, auto: true, resume: true, blocker: true });
        }
      }
      this.afterAttack(true);
    }
  },

  afterAttack(giveUp) {
    const t = this.task;
    if (t && t.hunt && t.target && t.target.carcass && !t.target.carcass.dead && !giveUp) {
      return this.setTask({ k: 'gather', target: t.target.carcass, phase: 'seek', rtype: 'food' });
    }
    this.nextTask();
  },

  startSwing(e) {
    this.swing = { t: 0, dur: this.def.rof, hit: false, target: e };
    this.cool = this.def.rof;
  },
  continueSwing(dt, e) {
    const s = this.swing;
    if (!s) return;
    s.t += dt;
    const ranged = this.def.attackType === 'pierce' && this.def.range > 1;
    this.anim = ranged ? 'shoot' : 'attack';
    this.ph = clamp(s.t / s.dur, 0, 0.999);
    if (e && !e.dead) { if (e.kind === 'building') this.faceRect(e.rect); else this.faceTo(e.x, e.y); }
    const moment = ranged ? 0.58 : 0.55;
    if (!s.hit && s.t >= s.dur * moment) {
      s.hit = true;
      if (e && !e.dead) this.deliver(e, ranged);
    }
    if (s.t >= s.dur) this.swing = null;
  },
  deliver(e, ranged) {
    const dmg = G.atk(this);
    if (ranged) {
      FX.arrow(this.x, this.y, 16, e, dmg, this.def.attackType, this);
      window.Sfx && Sfx.play('arrow', this.x, this.y);
    } else {
      const d = this.edgeDist(e);
      if (d <= this.attackReach(e) + 0.8) {
        G.hit(this, e, dmg, this.def.attackType);
        window.Sfx && Sfx.play(e.kind === 'building' ? 'thud' : 'hit', e.x, e.y);
      }
    }
  },

  /* ---------- animais ---------- */
  updateAnimal(dt) {
    const d = this.def;
    this.moved = false;
    switch (this.aiState) {
      case 'flee': {
        this.fleeT -= dt;
        if (this.fleeT <= 0) { this.aiState = 'idle'; this.aiT = 1 + Math.random() * 2; break; }
        const dx = Math.cos(this.fleeDir), dy = Math.sin(this.fleeDir);
        const nx = this.x + dx * 0.4, ny = this.y + dy * 0.4;
        if (!G.map.walkable(Math.floor(nx), Math.floor(ny), -1)) { this.fleeDir += (Math.random() < 0.5 ? 1 : -1) * 0.9; break; }
        this.stepToward(this.x + dx, this.y + dy, dt, d.flee / d.speed);
        break;
      }
      case 'wander': {
        const dd = Math.hypot(this.tx - this.x, this.ty - this.y);
        if (dd < 0.15) { this.aiState = 'idle'; this.aiT = 2 + Math.random() * 5; break; }
        if (!Path.los(this.x, this.y, this.tx, this.ty, -1, 0.15)) { this.aiState = 'idle'; this.aiT = 0.5; break; }
        this.stepToward(this.tx, this.ty, dt);
        break;
      }
      default: {
        this.aiT -= dt;
        if (this.graze) { this.anim = 'graze'; this.ph = (this.animT * 0.45) % 1; this.graze -= dt; if (this.graze <= 0) this.graze = 0; }
        if (this.aiT <= 0) {
          this.graze = 0;
          if (Math.random() < 0.62) {
            const a = Math.random() * TAU, r = 1 + Math.random() * 4;
            const tx = this.home.x + Math.cos(a) * r, ty = this.home.y + Math.sin(a) * r;
            if (G.map.walkable(Math.floor(tx), Math.floor(ty), -1) && Path.los(this.x, this.y, tx, ty, -1, 0.15)) { this.tx = tx; this.ty = ty; this.aiState = 'wander'; }
            this.aiT = 1;
          } else { this.graze = 2 + Math.random() * 3; this.aiT = this.graze + 1; }
        }
      }
    }
    if (this.anim === 'walk') this.ph = (this.walkPh || 0) % 1;
  },
});

/* ============================================================
   comandos em grupo
   ============================================================ */
const Cmd = {
  /* tiles livres ao redor de (x,y) em espiral */
  spiral(x, y, count, team) {
    const m = G.map, out = [];
    const ci = Math.floor(x), cj = Math.floor(y);
    for (let r = 0; r < 12 && out.length < count; r++) {
      const ring = [];
      for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
        if (!m.walkable(i, j, team)) continue;
        ring.push([i + 0.5, j + 0.5, Math.hypot(i + 0.5 - x, j + 0.5 - y)]);
      }
      ring.sort((a, b) => a[2] - b[2]);
      for (const p of ring) { out.push(p); if (out.length >= count) break; }
    }
    return out;
  },

  move(units, x, y, queue = false, attackMove = false) {
    if (!units.length) return;
    const team = units[0].team;
    if (units.length === 1) {
      units[0].order({ k: attackMove ? 'amove' : 'move', x, y }, queue);
      return;
    }
    const spots = this.spiral(x, y, units.length, team);
    const sorted = units.slice().sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    sorted.forEach((u, i) => {
      const p = spots[i] || [x, y];
      u.order({ k: attackMove ? 'amove' : 'move', x: p[0], y: p[1] }, queue);
    });
  },

  /* comando contextual sobre uma entidade */
  smart(units, e, queue = false) {
    const mine = units.filter((u) => !u.dead);
    if (!mine.length) return;
    const team = mine[0].team;
    for (const u of mine) {
      const isVil = u.type === 'villager';
      if (e.kind === 'unit') {
        if (e.animal) {
          if (isVil) u.order({ k: 'attack', target: e, hunt: true }, queue);
          else if (u.def.military) u.order({ k: 'attack', target: e }, queue);
          else u.order({ k: 'move', x: e.x, y: e.y }, queue);
        } else if (e.team !== u.team) u.order({ k: 'attack', target: e }, queue);
        else u.order({ k: 'move', x: e.x, y: e.y }, queue);
      } else if (e.kind === 'node') {
        if (isVil) u.order({ k: 'gather', target: e, phase: 'seek', rtype: e.rtype }, queue);
        else u.order({ k: 'move', x: e.x, y: e.y }, queue);
      } else if (e.kind === 'building') {
        if (e.team === u.team) {
          if (isVil && (!e.built || e.hp < e.maxHp - 1)) u.order({ k: 'build', target: e }, queue);
          else if (isVil && e.def.farm && e.built) u.order({ k: 'gather', target: e, phase: 'seek', rtype: 'food' }, queue);
          else if (isVil && e.def.dropoff && e.built && u.carry.amt >= 1) u.order({ k: 'gather', target: u.lastNode && !u.lastNode.dead ? u.lastNode : null, phase: 'return', drop: e, rtype: u.carry.type, lx: u.lastNode ? u.lastNode.x : e.x, ly: u.lastNode ? u.lastNode.y : e.y }, queue);
          else u.order({ k: 'move', x: e.x, y: e.y + e.d / 2 + 0.7 }, queue);
        } else if (e.team >= 0) u.order({ k: 'attack', target: e }, queue);
      }
    }
  },
};
