'use strict';
/* ============================================================
   AGEZIM — interface (DOM) e entrada do jogador
   ============================================================ */

const $ = (id) => document.getElementById(id);

const UI = {
  cmds: [], infoHtml: '', dirty: true, lastSlow: 0, toastIds: new Set(), minimap: null, miniBase: null,
  groups: {}, lastGroupKey: 0, lastGroupTime: 0,

  init() {
    this.el = {
      food: $('v-food'), wood: $('v-wood'), gold: $('v-gold'), stone: $('v-stone'),
      gfood: $('g-food'), gwood: $('g-wood'), ggold: $('g-gold'), gstone: $('g-stone'),
      pop: $('v-pop'), clock: $('clock'), idle: $('v-idle'), cmd: $('cmd'), info: $('info'), toasts: $('toasts'), tip: $('tip'),
      mini: $('mini'),
    };
    // ícones do topo
    for (const r of RES_TYPES) $('i-' + r).src = Icons.res(r);
    $('i-pop').src = Icons.res('pop'); $('i-idle').src = Icons.res('idle'); $('i-time').src = Icons.res('time');
    // grade de comandos
    this.slots = [];
    for (let i = 0; i < 15; i++) {
      const b = document.createElement('button');
      b.className = 'slot empty'; b.dataset.slot = i;
      b.innerHTML = '<img class="ic"><span class="hk"></span><span class="bd"></span><i class="pg"></i>';
      this.el.cmd.appendChild(b);
      this.slots.push(b);
      b.addEventListener('click', (ev) => this.clickSlot(i, ev));
      b.addEventListener('mouseenter', () => this.showTip(i));
      b.addEventListener('mouseleave', () => this.hideTip());
      b.addEventListener('contextmenu', (ev) => { ev.preventDefault(); this.rightClickSlot(i); });
    }
    // info (delegação)
    this.el.info.addEventListener('click', (ev) => {
      const q = ev.target.closest('[data-q]');
      if (q) { const b = G.sel[0]; if (b && b.kind === 'building') { G.cancelItem(b, +q.dataset.q); this.refresh(); } return; }
      const t = ev.target.closest('[data-id]');
      if (t) {
        const e = G.byId.get(+t.dataset.id);
        if (e && !e.dead) {
          if (ev.ctrlKey) Input.select(G.sel.filter((s) => s.type === e.type));
          else if (ev.shiftKey) Input.select(G.sel.filter((s) => s !== e));
          else Input.select([e]);
        }
      }
    });
    $('btnIdle').addEventListener('click', () => Input.cycleIdle());
    $('btnDesel').addEventListener('click', () => { Input.cancelPlace(); Input.setMode(null); Input.select([]); });
    $('placeOk').addEventListener('click', () => Input.confirmPlace());
    $('placeNo').addEventListener('click', () => { Input.cancelPlace(); });
    $('btnSound').addEventListener('click', () => { Sfx.init(); const on = Sfx.toggle(); $('btnSound').classList.toggle('off', !on); });
    $('btnHelp').addEventListener('click', () => this.toggleHelp());
    $('btnMenu').addEventListener('click', () => this.togglePause());
    $('helpClose').addEventListener('click', () => this.toggleHelp(false));
    this.initMinimap();
  },

  /* ---------- minimapa ---------- */
  initMinimap() {
    const cv = this.el.mini;
    this.mw = 300; this.mh = 150;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = this.mw * dpr; cv.height = this.mh * dpr;
    cv.style.width = this.mw + 'px'; cv.style.height = this.mh + 'px';
    this.mctx = cv.getContext('2d');
    this.mdpr = dpr;
    const down = (e, cmd) => {
      const r = cv.getBoundingClientRect();
      const mx = (e.clientX - r.left) / r.width * this.mw, my = (e.clientY - r.top) / r.height * this.mh;
      const [wx, wy] = this.miniToWorld(mx, my);
      if (cmd) Input.rightClickWorld(wx, wy, e.shiftKey);
      else Cam.centerOn(wx, wy);
    };
    let dragging = false;
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (e.button === 0 || e.pointerType === 'touch') { dragging = true; try { cv.setPointerCapture(e.pointerId); } catch (_) {} down(e, false); }
      else if (e.button === 2) down(e, true);
    });
    cv.addEventListener('pointermove', (e) => { if (dragging) down(e, false); });
    const endDrag = () => { dragging = false; };
    cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
  },
  bakeMinimap() { this.miniBase = G.map.bakeMinimap(this.mw * this.mdpr, this.mh * this.mdpr); },
  worldToMini(x, y) {
    const N = G.map.N;
    return [((x - y) / (2 * N) + 0.5) * this.mw, ((x + y) / (2 * N)) * this.mh];
  },
  miniToWorld(mx, my) {
    const N = G.map.N;
    const a = (mx / this.mw - 0.5) * 2 * N, b = (my / this.mh) * 2 * N;
    return [clamp((a + b) / 2, 0, N), clamp((b - a) / 2, 0, N)];
  },
  drawMinimap() {
    const c = this.mctx, w = this.mw, h = this.mh, N = G.map.N;
    c.setTransform(this.mdpr, 0, 0, this.mdpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#05080e'; c.fillRect(0, 0, w, h);
    if (this.miniBase) c.drawImage(this.miniBase, 0, 0, w, h);
    // recursos
    const exp = G.explored;
    for (const n of G.nodes) {
      if (n.dead || !exp[n.j * N + n.i]) continue;
      const p = this.worldToMini(n.x, n.y);
      c.fillStyle = n.gsub === 'tree' ? '#2c6a30' : n.gsub === 'bush' ? '#d4402f' : n.gsub === 'gold' ? '#ffd23a' : n.gsub === 'stone' ? '#b8bcc4' : '#9a5a3a';
      const s = n.gsub === 'tree' ? 1.5 : 2.4;
      c.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
    }
    // névoa
    c.save();
    const FS = Fog.FS, M = Fog.M;
    const a = w / (2 * N) / FS, b = h / (2 * N) / FS;
    c.transform(a, b, -a, b, w / 2, -2 * M * h / (2 * N));
    c.imageSmoothingEnabled = true;
    c.drawImage(Fog.fog, 0, 0);
    c.restore();
    // construções
    for (const bd of G.buildings) {
      if (bd.dead || (bd.def.wall && bd.team !== G.player && !G.isVisible(bd.x, bd.y))) continue;
      if (bd.team !== G.player && !G.isExplored(bd.x, bd.y)) continue;
      const p = this.worldToMini(bd.x, bd.y);
      const s = bd.def.wall ? 2 : Math.max(3.5, bd.w * 1.7);
      c.fillStyle = C.str(TEAM_COLORS[bd.team].main); c.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
      c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 0.8; c.strokeRect(p[0] - s / 2, p[1] - s / 2, s, s);
    }
    // unidades
    for (const u of G.units) {
      if (u.dead) continue;
      if (u.team !== G.player && !G.isVisible(u.x, u.y)) continue;
      const p = this.worldToMini(u.x, u.y);
      if (u.animal) { c.fillStyle = 'rgba(255,240,180,0.7)'; c.fillRect(p[0] - 0.7, p[1] - 0.7, 1.4, 1.4); continue; }
      c.fillStyle = u.team === G.player ? (u.selected ? '#9dff9d' : '#6cb0ff') : '#ff5a4a';
      c.fillRect(p[0] - 1.4, p[1] - 1.4, 2.8, 2.8);
    }
    // alertas
    for (const al of G.alerts) {
      const age = G.time - al.time;
      if (age > 4) continue;
      const p = this.worldToMini(al.x, al.y);
      const r = 4 + (age * 8) % 10;
      c.strokeStyle = `rgba(255,70,60,${1 - age / 4})`; c.lineWidth = 1.6;
      c.beginPath(); c.arc(p[0], p[1], r, 0, TAU); c.stroke();
    }
    // quadro da câmera
    const corners = [[0, 0], [Cam.W, 0], [Cam.W, Cam.H], [0, Cam.H]].map((q) => { const wc = Cam.s2w(q[0], q[1]); return this.worldToMini(clamp(wc[0], 0, N), clamp(wc[1], 0, N)); });
    c.beginPath(); c.moveTo(corners[0][0], corners[0][1]); for (let i = 1; i < 4; i++) c.lineTo(corners[i][0], corners[i][1]); c.closePath();
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1.4; c.stroke();
    // moldura
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1;
  },

  /* ---------- atualização ---------- */
  refresh() { this.dirty = true; },

  update(dt) {
    const r = G.res[G.player];
    const set = (el, v) => { if (el._v !== v) { el._v = v; el.textContent = v; } };
    set(this.el.food, Math.floor(r.food)); set(this.el.wood, Math.floor(r.wood)); set(this.el.gold, Math.floor(r.gold)); set(this.el.stone, Math.floor(r.stone));
    const used = G.popUsedV[G.player], cap = G.popCapV[G.player];
    set(this.el.pop, `${used}/${cap}`);
    this.el.pop.parentElement.classList.toggle('warn', used >= cap);
    set(this.el.clock, fmtTime(G.time));
    document.body.classList.toggle('hassel', G.sel.length > 0 || !!Input.placing);
    $('placeBar').classList.toggle('on', !!Input.placing && !!Input.touchPlaced);
    if (!Input.placing) Input.touchPlaced = false;
    this.slowTimer = (this.slowTimer || 0) - dt;
    if (this.slowTimer <= 0) {
      this.slowTimer = 0.2;
      // ociosos e coletores
      let idle = 0; const gc = { food: 0, wood: 0, gold: 0, stone: 0 };
      for (const u of G.units) {
        if (u.dead || u.team !== G.player || u.type !== 'villager') continue;
        if (!u.task) idle++;
        else if (u.task.k === 'gather' && u.task.rtype) gc[u.task.rtype]++;
        else if (u.task.k === 'attack' && u.task.hunt) gc.food++;
      }
      set(this.el.idle, idle);
      $('btnIdle').classList.toggle('has', idle > 0);
      set(this.el.gfood, gc.food); set(this.el.gwood, gc.wood); set(this.el.ggold, gc.gold); set(this.el.gstone, gc.stone);
      G.sel = G.sel.filter((e) => !e.dead);
      this.rebuildCommands();
      this.rebuildInfo();
    }
    // toasts
    const box = this.el.toasts;
    const ids = new Set(G.toasts.map((t) => t.id));
    for (const t of G.toasts) {
      if (!this.toastIds.has(t.id)) {
        this.toastIds.add(t.id);
        const d = document.createElement('div'); d.className = 'toast ' + t.type; d.dataset.id = t.id; d.textContent = t.msg;
        box.appendChild(d);
      }
    }
    for (const d of [...box.children]) { if (!ids.has(+d.dataset.id)) { d.classList.add('out'); setTimeout(() => d.remove(), 300); this.toastIds.delete(+d.dataset.id); } }
    this.drawMinimap();
  },

  /* ---------- comandos ---------- */
  buildCommands() {
    const cmds = new Array(15).fill(null);
    const sel = G.sel.filter((e) => !e.dead);
    const own = sel.filter((e) => e.team === G.player);
    if (!own.length) return cmds;
    const pl = G.player;
    const mk = (slot, o) => { cmds[slot] = { slot, hotkey: HOTKEY_GRID[slot], enabled: true, ...o }; };
    if (own[0].kind === 'unit') {
      const units = own.filter((e) => e.kind === 'unit');
      const hasVil = units.some((u) => u.type === 'villager');
      const hasMil = units.some((u) => u.def.military);
      if (hasVil) {
        for (const type in BUILD_DEFS) {
          const def = BUILD_DEFS[type];
          const ok = G.canAfford(pl, def.cost);
          mk(def.hotkeySlot, { icon: Icons.building(type, pl), name: def.name, cost: def.cost, desc: def.desc, size: `${def.w}×${def.d}`, enabled: ok, onClick: () => Input.startPlace(type) });
        }
      }
      if (hasMil) mk(hasVil ? 9 : 0, { icon: Icons.cmd('amove'), name: 'Atacar-mover', desc: 'Move e ataca inimigos pelo caminho.', onClick: () => Input.setMode('amove') });
      mk(10, { icon: Icons.cmd('stop'), name: 'Parar', desc: 'Cancela a ordem atual.', onClick: () => { for (const u of units) u.stop(); this.refresh(); } });
    } else if (own[0].kind === 'building' && own.length === 1) {
      const b = own[0];
      if (!b.built) {
        mk(14, { icon: Icons.cmd('cancel'), name: 'Cancelar construção', desc: 'Cancela e devolve os recursos proporcionais.', onClick: () => { G.demolish(b); this.refresh(); } });
      } else {
        const def = b.def;
        let slot = 0;
        (def.trains || []).forEach((id) => {
          const ud = UNIT_DEFS[id];
          const c = G.canQueue(b, 'unit', id);
          mk(slot++, { icon: Icons.unit(id, pl), name: ud.name, cost: ud.cost, desc: ud.desc + `  (${ud.time}s)`, enabled: c.ok || (c.msg === 'Recursos insuficientes' ? false : c.ok), why: c.msg, onClick: (sh) => { for (let i = 0; i < (sh ? 5 : 1); i++) if (!G.queueItem(b, 'unit', id)) break; this.refresh(); } });
        });
        if (def.techs) {
          def.techs.forEach((id, idx) => {
            const td = TECHS[id];
            const s = def.techs.length > 3 ? (idx < 3 ? idx : idx + 2) : slot + idx;
            const done = G.techs[pl].has(id);
            const c = G.canQueue(b, 'tech', id);
            if (done) return;
            mk(s, { icon: Icons.tech(td.icon), name: td.name, cost: td.cost, desc: td.desc + `  (${td.time}s)`, enabled: c.ok, why: c.msg, onClick: () => { G.queueItem(b, 'tech', id); this.refresh(); } });
          });
        }
        if (def.market) {
          ['food', 'wood', 'stone'].forEach((res, i) => {
            mk(i, { icon: Icons.res(res), badge: '▼', name: `Vender 100 ${RES_NAMES[res]}`, desc: `Receba ${G.tradePrice(res, 'sell')} de ouro.`, enabled: G.res[pl][res] >= 100, onClick: () => { G.trade(pl, res, 'sell'); } , price: G.tradePrice(res, 'sell'), priceCls: 'gain' });
            mk(5 + i, { icon: Icons.res(res), badge: '▲', name: `Comprar 100 ${RES_NAMES[res]}`, desc: `Custa ${G.tradePrice(res, 'buy')} de ouro.`, enabled: G.res[pl].gold >= G.tradePrice(res, 'buy'), onClick: () => { G.trade(pl, res, 'buy'); }, price: G.tradePrice(res, 'buy'), priceCls: 'cost' });
          });
        }
        if (def.trains) mk(13, { icon: Icons.cmd('flag'), name: 'Ponto de reunião', desc: 'Clique com o botão direito no mapa para definir o ponto de reunião.', onClick: () => Input.setMode('rally') });
        mk(14, { icon: Icons.cmd('demolish'), name: 'Demolir', desc: 'Destrói a construção (Del).', onClick: () => { G.demolish(b); this.refresh(); } });
      }
    }
    return cmds;
  },

  rebuildCommands() {
    const cmds = this.buildCommands();
    const key = cmds.map((c) => (c ? c.name + c.enabled + (c.price || '') : '-')).join('|');
    this.cmds = cmds;
    if (key === this.cmdKey) return;
    this.cmdKey = key;
    cmds.forEach((c, i) => {
      const b = this.slots[i];
      if (!c) { b.className = 'slot empty'; b.querySelector('.ic').removeAttribute('src'); b.querySelector('.hk').textContent = ''; b.querySelector('.bd').textContent = ''; return; }
      b.className = 'slot' + (c.enabled ? '' : ' disabled');
      const img = b.querySelector('.ic'); if (img.getAttribute('src') !== c.icon) img.src = c.icon;
      b.querySelector('.hk').textContent = c.hotkey.toUpperCase();
      const bd = b.querySelector('.bd');
      bd.textContent = c.price ? c.price : (c.badge || '');
      bd.className = 'bd' + (c.priceCls ? ' ' + c.priceCls : '');
    });
  },
  clickSlot(i, ev) {
    const c = this.cmds[i];
    if (!c) return;
    if (!c.enabled) { if (c.why) G.toast(c.why, 'warn'); else if (c.cost) G.toast('Recursos insuficientes', 'warn'); Sfx.play('error'); return; }
    Sfx.init(); Sfx.play('click');
    c.onClick(ev && ev.shiftKey);
    this.hideTip();
  },
  rightClickSlot(i) {
    const c = this.cmds[i];
    if (!c) return;
    // botão direito em fila/produção: nada por ora
  },
  pressHotkey(key) {
    const slot = HOTKEY_GRID.indexOf(key);
    if (slot < 0) return false;
    const c = this.cmds[slot];
    if (!c) return false;
    this.clickSlot(slot, { shiftKey: Input.shift });
    return true;
  },

  /* ---------- tooltips ---------- */
  showTip(i) {
    const c = this.cmds[i];
    if (!c) return;
    const tip = this.el.tip;
    let html = `<div class="tn">${c.name} <span class="thk">(${c.hotkey.toUpperCase()})</span></div>`;
    if (c.cost) {
      html += '<div class="tc">' + Object.keys(c.cost).map((k) => `<span class="${G.res[G.player][k] >= c.cost[k] ? '' : 'lack'}"><img src="${Icons.res(k)}">${c.cost[k]}</span>`).join('') + (c.size ? `<span class="sz">${c.size}</span>` : '') + '</div>';
    }
    html += `<div class="td">${c.desc || ''}</div>`;
    tip.innerHTML = html;
    tip.classList.add('on');
    if (IS_TOUCH) { clearTimeout(this._tipT); this._tipT = setTimeout(() => this.hideTip(), 2600); }
    const r = this.slots[i].getBoundingClientRect();
    tip.style.left = Math.min(window.innerWidth - 300, Math.max(8, r.left)) + 'px';
    tip.style.top = (r.top - tip.offsetHeight - 8) + 'px';
  },
  hideTip() { this.el.tip.classList.remove('on'); },

  /* ---------- painel de informações ---------- */
  taskText(u) {
    const t = u.task;
    if (u.animal) return u.aiState === 'flee' ? 'Fugindo' : 'Pastando';
    if (!t) return 'Ocioso';
    const cap = (s) => s;
    switch (t.k) {
      case 'move': return 'Movendo-se';
      case 'amove': return 'Atacando-mover';
      case 'build': return t.target && t.target.built ? 'Reparando' : 'Construindo';
      case 'attack': return t.hunt ? 'Caçando' : 'Atacando';
      case 'gather': {
        const n = t.target;
        const nm = { wood: 'madeira', food: 'comida', gold: 'ouro', stone: 'pedra' }[t.rtype || (n && n.rtype)] || 'recursos';
        if (t.phase === 'return') return `Entregando ${nm}`;
        if (n && n.gsub === 'farm') return 'Plantando';
        if (n && n.gsub === 'tree') return 'Cortando madeira';
        if (n && n.gsub === 'gold') return 'Minerando ouro';
        if (n && n.gsub === 'stone') return 'Minerando pedra';
        if (n && n.gsub === 'bush') return 'Colhendo frutas';
        if (n && n.gsub === 'carcass') return 'Coletando carne';
        return 'Coletando ' + nm;
      }
    }
    return '';
  },

  rebuildInfo() {
    const sel = G.sel.filter((e) => !e.dead);
    let html = '';
    const pl = G.player;
    const bar = (hp, max) => `<div class="hpbar"><div style="width:${Math.max(0, hp / max * 100).toFixed(0)}%" class="${hp / max > 0.6 ? 'g' : hp / max > 0.3 ? 'y' : 'r'}"></div><span>${Math.ceil(hp)}/${max}</span></div>`;
    if (!sel.length) {
      html = `<div class="idle-info"><div class="logo">AGEZIM</div><div class="hint">Clique para selecionar · arraste para selecionar em grupo<br>Botão direito: mover, coletar, construir, atacar<br><span class="dim">F1 — ajuda e controles</span></div></div>`;
    } else if (sel.length === 1) {
      const e = sel[0];
      const teamName = e.team >= 0 ? TEAM_COLORS[e.team].name : 'Natureza';
      if (e.kind === 'unit') {
        const d = e.def;
        const icon = Icons.unit(e.type, e.team >= 0 ? e.team : 0);
        let stats = '';
        if (!e.animal) {
          stats = `<span>Ataque <b>${G.atk(e)}</b></span><span>Armadura <b>${G.armor(e, 'melee')}/${G.armor(e, 'pierce')}</b></span>`;
          if (d.range > 1) stats += `<span>Alcance <b>${G.range(e).toFixed(1)}</b></span>`;
          stats += `<span>Velocidade <b>${d.speed.toFixed(1)}</b></span>`;
        } else stats = `<span>Comida <b>${d.food}</b></span>`;
        let extra = '';
        if (e.type === 'villager' && e.carry.amt >= 1) extra = `<div class="carry"><img src="${Icons.res(e.carry.type)}">${Math.floor(e.carry.amt)}</div>`;
        html = `<div class="portrait"><img src="${icon}"></div><div class="ibody"><div class="iname">${d.name} <em>${teamName}</em></div>${bar(e.hp, e.maxHp)}<div class="stats">${stats}</div><div class="task">${this.taskText(e)}</div>${extra}</div>`;
      } else if (e.kind === 'building') {
        const icon = Icons.building(e.type, e.team >= 0 ? e.team : 0);
        let body = '';
        if (!e.built) body = `<div class="task">Em construção — ${(e.progress * 100).toFixed(0)}%</div><div class="pbar"><div style="width:${(e.progress * 100).toFixed(0)}%"></div></div>`;
        else {
          if (e.def.pop) body += `<div class="stats"><span>População <b>+${e.def.pop}</b></span></div>`;
          if (e.def.attack) body += `<div class="stats"><span>Ataque <b>${e.def.attack.dmg}</b></span><span>Alcance <b>${e.def.attack.range}</b></span></div>`;
          if (e.def.farm) body += `<div class="stats"><span>Comida restante <b>${Math.ceil(e.amount)}</b></span><span>Fazendeiros <b>${e.workers || 0}/${e.def.maxWorkers}</b></span></div>`;
          if (e.def.market && e.team === pl) body += `<div class="stats"><span>Preços (ouro/100): ` + ['food', 'wood', 'stone'].map((r) => `<img class="mi" src="${Icons.res(r)}"><b>${G.market[r]}</b>`).join(' ') + `</span></div>`;
          if (e.queue.length) {
            const q0 = e.queue[0];
            const nm = q0.kind === 'unit' ? UNIT_DEFS[q0.id].name : TECHS[q0.id].name;
            body += `<div class="task">${q0.kind === 'unit' ? 'Treinando' : 'Pesquisando'} ${nm} — ${Math.floor((1 - q0.t / q0.total) * 100)}%</div>`;
            body += '<div class="queue">' + e.queue.map((q, i) => `<div class="qi" data-q="${i}" title="Cancelar"><img src="${q.kind === 'unit' ? Icons.unit(q.id, e.team) : Icons.tech(TECHS[q.id].icon)}">${i === 0 ? `<div class="qp" style="height:${((1 - q0.t / q0.total) * 100).toFixed(0)}%"></div>` : ''}</div>`).join('') + '</div>';
          } else if (e.team === pl && !body) body += `<div class="dim">${e.def.desc}</div>`;
        }
        html = `<div class="portrait"><img src="${icon}"></div><div class="ibody"><div class="iname">${e.def.name} <em>${teamName}</em></div>${bar(e.hp, e.maxHp)}${body}</div>`;
      } else {
        const rn = RES_NAMES[e.rtype];
        const icon = Icons.res(e.rtype);
        html = `<div class="portrait res"><img src="${icon}" class="big"></div><div class="ibody"><div class="iname">${e.def.name}</div><div class="stats"><span>${rn} restante <b>${Math.ceil(e.amount)}</b></span></div><div class="task">${e.workers ? `${e.workers} coletando` : 'Disponível'}</div></div>`;
      }
    } else {
      const counts = {};
      for (const e of sel) counts[e.type] = (counts[e.type] || 0) + 1;
      const summary = Object.keys(counts).map((k) => `${counts[k]}× ${UNIT_DEFS[k] ? UNIT_DEFS[k].name : k}`).join(' · ');
      html = `<div class="multi"><div class="msum">${sel.length} selecionados — ${summary}</div><div class="grid">` +
        sel.slice(0, 60).map((e) => `<div class="tile" data-id="${e.id}"><img src="${Icons.unit(e.type, e.team)}"><div class="tb"><i class="${e.hp / e.maxHp > 0.6 ? 'g' : e.hp / e.maxHp > 0.3 ? 'y' : 'r'}" style="width:${(e.hp / e.maxHp * 100).toFixed(0)}%"></i></div></div>`).join('') + '</div></div>';
    }
    if (html !== this.infoHtml) { this.infoHtml = html; this.el.info.innerHTML = html; }
  },

  /* ---------- menus ---------- */
  toggleHelp(force) {
    const el = $('help');
    const on = force != null ? force : !el.classList.contains('on');
    el.classList.toggle('on', on);
  },
  togglePause(force) {
    const el = $('pause');
    const on = force != null ? force : !el.classList.contains('on');
    el.classList.toggle('on', on);
    G.paused = on;
  },
  showEnd(win) {
    const el = $('end');
    $('endTitle').textContent = win ? 'VITÓRIA!' : 'DERROTA';
    $('endTitle').className = win ? 'win' : 'lose';
    $('endText').textContent = win ? 'O Reino Vermelho foi destruído. A ilha é sua!' : 'Seu reino caiu. A ilha pertence ao inimigo...';
    const s = G.stats[G.player];
    $('endStats').innerHTML = `Tempo: <b>${fmtTime(G.time)}</b> · Unidades criadas: <b>${s.made}</b> · Inimigos derrotados: <b>${s.killed}</b> · Perdas: <b>${s.lost}</b>`;
    el.classList.add('on');
  },

  /* ---------- sobreposições desenhadas no canvas ---------- */
  drawOverlay(ctx) {
    const z = Cam.zoom;
    const inp = Input;
    // ghost de construção
    if (inp.placing && inp.mouse.in) {
      const pl = inp.placing, def = BUILD_DEFS[pl.type];
      const diamond = (i, j, ok) => {
        const p = [Cam.w2s(i, j), Cam.w2s(i + 1, j), Cam.w2s(i + 1, j + 1), Cam.w2s(i, j + 1)];
        ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let k = 1; k < 4; k++) ctx.lineTo(p[k][0], p[k][1]); ctx.closePath();
        ctx.fillStyle = ok ? 'rgba(80,255,120,0.30)' : 'rgba(255,70,60,0.38)'; ctx.fill();
        ctx.strokeStyle = ok ? 'rgba(160,255,180,0.9)' : 'rgba(255,140,120,0.9)'; ctx.lineWidth = 1; ctx.stroke();
      };
      if (pl.segments) {
        for (const s of pl.segments) diamond(s.x, s.y, s.ok);
        for (const s of pl.segments) {
          if (!s.ok) continue;
          const p = Cam.w2s(s.x + 0.5, s.y + 0.5);
          ctx.globalAlpha = 0.7;
          blit(ctx, Buildings.get(pl.type, G.player, pl.type === 'gate' ? { axis: pl.axis } : { mask: 10 }), p[0], p[1], z);
          ctx.globalAlpha = 1;
        }
      } else {
        const chk = pl.chk;
        for (let j = pl.ty; j < pl.ty + def.d; j++) for (let i = pl.tx; i < pl.tx + def.w; i++) {
          const k = j * G.map.N + i;
          let ok = chk.ok;
          if (!ok && G.map.inb(i, j) && !G.map.occ[k] && G.map.terrain[k] >= T_SAND) ok = false;
          diamond(i, j, ok);
        }
        const p = Cam.w2s(pl.tx + def.w / 2, pl.ty + def.d / 2);
        ctx.globalAlpha = chk.ok ? 0.72 : 0.4;
        const opts = pl.type === 'gate' ? { axis: pl.axis } : pl.type === 'wall' ? { mask: 0 } : pl.type === 'farm' ? { stage: 2 } : {};
        blit(ctx, Buildings.get(pl.type, G.player, opts), p[0], p[1], z);
        ctx.globalAlpha = 1;
        if (!chk.ok && chk.why) {
          ctx.font = 'bold 13px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.fillStyle = '#ff9a8a';
          const q = Cam.w2s(pl.tx + def.w / 2, pl.ty + def.d / 2, 30);
          ctx.strokeText(chk.why, q[0], q[1] - 20 * z); ctx.fillText(chk.why, q[0], q[1] - 20 * z);
        }
      }
    }
    // caixa de seleção
    const d = inp.drag;
    if (d && d.active) {
      const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1), w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0);
      ctx.fillStyle = 'rgba(110,255,130,0.10)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(150,255,160,0.95)'; ctx.lineWidth = 1.4; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    }
    if (inp.mode === 'amove' && inp.mouse.in) {
      ctx.strokeStyle = 'rgba(255,90,70,0.95)'; ctx.lineWidth = 2;
      const { x, y } = inp.mouse;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.moveTo(x - 17, y); ctx.lineTo(x - 6, y); ctx.moveTo(x + 6, y); ctx.lineTo(x + 17, y); ctx.moveTo(x, y - 17); ctx.lineTo(x, y - 6); ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 17); ctx.stroke();
    }
    if (inp.mode === 'rally' && inp.mouse.in) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('Clique para definir o ponto de reunião', inp.mouse.x + 16, inp.mouse.y - 8);
    }
  },
};

/* ============================================================
   ENTRADA
   ============================================================ */
const Input = {
  mouse: { x: 0, y: 0, in: false },
  keys: new Set(), shift: false, ctrl: false,
  drag: null, mode: null, placing: null, pan: null, lastClick: { t: 0, id: 0 },

  init(canvas) {
    this.cv = canvas;
    canvas.addEventListener('mousedown', (e) => this.onDown(e));
    window.addEventListener('mousemove', (e) => this.onMove(e));
    window.addEventListener('mouseup', (e) => this.onUp(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); Cam.zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    canvas.addEventListener('mouseleave', () => { this.mouse.in = false; ui_hover = null; });
    canvas.addEventListener('mouseenter', () => { this.mouse.in = true; });
    this.initTouch(canvas);
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys.clear(); this.pan = null; });
  },

  /* ---------- toque ---------- */
  initTouch(canvas) {
    const opt = { passive: false };
    canvas.addEventListener('touchstart', (e) => this.tStart(e), opt);
    canvas.addEventListener('touchmove', (e) => this.tMove(e), opt);
    canvas.addEventListener('touchend', (e) => this.tEnd(e), opt);
    canvas.addEventListener('touchcancel', (e) => this.tEnd(e), opt);
    this.t = { mode: null };
  },
  tpos(t) { const r = this.cv.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; },
  tStart(e) {
    e.preventDefault(); Sfx.init();
    const T = this.t, ts = e.touches;
    if (ts.length >= 2) {
      clearTimeout(T.lp); this.drag = null;
      const a = this.tpos(ts[0]), b = this.tpos(ts[1]);
      Object.assign(T, { mode: 'pinch', d: Math.hypot(a[0] - b[0], a[1] - b[1]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 });
      return;
    }
    const [x, y] = this.tpos(ts[0]);
    Object.assign(T, { mode: 'down', x0: x, y0: y, x, y, lx: x, ly: y, moved: false });
    if (this.placing) { T.mode = 'place'; this.touchPlaceAt(x, y, true); return; }
    this.mouse.in = false;
    if (!this.mode) {
      T.lp = setTimeout(() => {
        if (T.mode === 'down' && !T.moved) {
          T.mode = 'box'; this.drag = { x0: T.x0, y0: T.y0, x1: T.x, y1: T.y, active: true, shift: false };
          if (navigator.vibrate) navigator.vibrate(15);
        }
      }, 420);
    }
  },
  tMove(e) {
    e.preventDefault();
    const T = this.t, ts = e.touches;
    if (T.mode === 'pinch' && ts.length >= 2) {
      const a = this.tpos(ts[0]), b = this.tpos(ts[1]);
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (T.d > 0) Cam.zoomAt(d / T.d, mx, my);
      this.panScreen(-(mx - T.mx), -(my - T.my));
      T.d = d; T.mx = mx; T.my = my;
      return;
    }
    if (ts.length !== 1) return;
    const [x, y] = this.tpos(ts[0]);
    T.x = x; T.y = y;
    if (T.mode === 'place') { this.touchPlaceAt(x, y, false); return; }
    if (T.mode === 'box') { this.drag.x1 = x; this.drag.y1 = y; return; }
    if (T.mode === 'down' && Math.hypot(x - T.x0, y - T.y0) > 10) { T.moved = true; clearTimeout(T.lp); T.mode = 'pan'; T.lx = T.x0; T.ly = T.y0; }
    if (T.mode === 'pan') { this.panScreen(-(x - T.lx), -(y - T.ly)); T.lx = x; T.ly = y; }
  },
  tEnd(e) {
    e.preventDefault();
    const T = this.t;
    clearTimeout(T.lp);
    if (e.touches.length > 0) { if (T.mode === 'pinch') T.mode = 'none'; return; }
    const mode = T.mode; T.mode = null;
    if (mode === 'box') { const d = this.drag; this.drag = null; if (d) this.boxSelect(d.x0, d.y0, d.x1, d.y1, false); return; }
    if (mode === 'place') { if (this.placing) this.touchPlaced = true; return; }
    if (mode === 'down') this.tap(T.x0, T.y0);
  },
  /* o fantasma fica acima do dedo para não ser coberto por ele */
  touchPlaceAt(x, y, start) {
    this.touchPlaced = false;
    this.mouse.x = x; this.mouse.y = y - 56; this.mouse.in = true;
    this.updatePlacing();
    const pl = this.placing;
    if (start && pl && BUILD_DEFS[pl.type].wall && !BUILD_DEFS[pl.type].gate) { pl.wallStart = { x: pl.tx, y: pl.ty }; this.updatePlacing(); }
  },
  confirmPlace() {
    const pl = this.placing;
    if (!pl) return;
    if (pl.wallStart && pl.segments) this.wallUp();
    else this.commitPlace(pl, [{ x: pl.tx, y: pl.ty }], false);
    this.touchPlaced = false;
  },
  /* toque simples: seleciona ou comanda, conforme a seleção atual */
  tap(x, y) {
    if (this.mode === 'amove') { this.finishAMove(x, y, false); return; }
    if (this.mode === 'rally') { this.setRally(x, y); return; }
    const ent = this.pickAt(x, y, 12), now = performance.now();
    const own = G.sel.filter((s) => s.team === G.player);
    const ownUnits = own.length && own[0].kind === 'unit' ? own.filter((s) => s.kind === 'unit') : [];
    if (ent && ent.team === G.player && this.lastClick.id === ent.id && now - this.lastClick.t < 380) {
      this.lastClick = { t: 0, id: 0 };
      if (ent.kind === 'unit') this.select(G.units.filter((u) => !u.dead && u.team === G.player && u.type === ent.type && Math.abs(Cam.w2s(u.x, u.y)[0] - Cam.W / 2) < Cam.W / 2 + 20 && Math.abs(Cam.w2s(u.x, u.y)[1] - Cam.H / 2) < Cam.H / 2 + 20));
      else if (ent.kind === 'building') this.select(G.buildings.filter((b) => !b.dead && b.team === G.player && b.type === ent.type));
      return;
    }
    this.lastClick = { t: now, id: ent ? ent.id : 0 };
    if (ownUnits.length) {
      if (ent && ent.team === G.player && ent.kind === 'unit') { this.select([ent]); return; }
      if (ent && ent.team === G.player && ent.kind === 'building') {
        const vil = ownUnits.some((u) => u.type === 'villager'), carrying = ownUnits.some((u) => u.carry.amt >= 1);
        const work = vil && (!ent.built || ent.hp < ent.maxHp - 1 || ent.def.farm || (ent.def.dropoff && carrying));
        if (!work) { this.select([ent]); return; }
      }
      const [wx, wy] = Cam.s2w(x, y);
      this.rightClickWorld(wx, wy, false, ent || null);
      return;
    }
    this.select(ent ? [ent] : []);
  },

  local(e) { const r = this.cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; },

  /* ---------- seleção ---------- */
  select(list, add = false) {
    if (!add) for (const e of G.sel) e.selected = false;
    let out = add ? G.sel.slice() : [];
    for (const e of list) if (!out.includes(e)) out.push(e);
    out = out.slice(0, 80);
    G.sel = out;
    for (const e of out) e.selected = true;
    UI.refresh();
    UI.slowTimer = 0;
    if (out.length) Sfx.play('select');
  },

  pickAt(sx, sy, pad = 0) {
    const z = Cam.zoom;
    let best = null, bd = -1e9;
    // unidades
    for (const u of G.units) {
      if (u.dead) continue;
      if (u.team !== G.player && !G.isVisible(u.x, u.y)) continue;
      const p = Cam.w2s(u.x, u.y);
      const hh = u.animal ? (u.type === 'horse' ? 34 : u.type === 'cow' ? 28 : 14) : 36;
      const hw = u.animal ? (u.type === 'horse' || u.type === 'cow' ? 16 : 9) : 10;
      if (Math.abs(sx - p[0]) <= hw * z + pad && sy >= p[1] - hh * z - pad && sy <= p[1] + 6 * z + pad) {
        const d = u.x + u.y;
        if (d > bd) { bd = d; best = u; }
      }
    }
    if (best) return best;
    // recursos e construções
    for (const n of G.nodes) {
      if (n.dead || !G.explored[n.j * G.map.N + n.i]) continue;
      const p = Cam.w2s(n.x, n.y);
      const tall = n.gsub === 'tree' ? 56 : n.gsub === 'carcass' ? 14 : 22;
      const hw = n.gsub === 'tree' ? 14 : 16;
      if (Math.abs(sx - p[0]) <= hw * z + pad && sy >= p[1] - tall * z - pad && sy <= p[1] + 8 * z + pad) {
        const d = n.x + n.y;
        if (d > bd) { bd = d; best = n; }
      }
    }
    const [wx, wy] = Cam.s2w(sx, sy);
    for (const b of G.buildings) {
      if (b.dead || !G.isExplored(b.x, b.y)) continue;
      const r = b.rect;
      const bh = (Buildings.hpx[b.type] || 20);
      let hit = false;
      if (b.def.farm) hit = wx >= r.x0 && wx <= r.x1 && wy >= r.y0 && wy <= r.y1;
      else {
        for (let zz = 0; zz <= bh && !hit; zz += 8) {
          const [qx, qy] = Cam.s2w(sx, sy + zz * z);
          if (qx >= r.x0 - 0.02 && qx <= r.x1 + 0.02 && qy >= r.y0 - 0.02 && qy <= r.y1 + 0.02) hit = true;
        }
      }
      if (hit) {
        const d = b.x + b.y + (b.def.farm ? -5 : 0.5);
        if (d > bd) { bd = d; best = b; }
      }
    }
    return best;
  },

  boxSelect(x0, y0, x1, y1, add) {
    const z = Cam.zoom;
    const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1);
    const list = [];
    for (const u of G.units) {
      if (u.dead || u.team !== G.player || u.animal) continue;
      const p = Cam.w2s(u.x, u.y);
      const cy = p[1] - 14 * z;
      if (p[0] >= xa - 4 && p[0] <= xb + 4 && cy >= ya - 6 && cy <= yb + 6) list.push(u);
    }
    if (list.length) {
      // prioriza militares se houver mistura? mantém tudo (como AoE)
      this.select(list, add);
    } else if (!add) { /* nada na caixa */ }
  },

  /* ---------- eventos do mouse ---------- */
  onDown(e) {
    Sfx.init();
    const [x, y] = this.local(e);
    this.mouse.x = x; this.mouse.y = y; this.mouse.in = true;
    this.shift = e.shiftKey; this.ctrl = e.ctrlKey;
    if (e.button === 1) { e.preventDefault(); this.pan = { x: e.clientX, y: e.clientY }; return; }
    if (e.button === 2) { this.onRightClick(x, y, e.shiftKey); return; }
    if (e.button !== 0) return;
    if (this.placing) { this.placeDown(x, y, e); return; }
    if (this.mode === 'amove') { this.finishAMove(x, y, e.shiftKey); return; }
    if (this.mode === 'rally') { this.setRally(x, y); return; }
    this.drag = { x0: x, y0: y, x1: x, y1: y, active: false, shift: e.shiftKey };
  },
  onMove(e) {
    const r = this.cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    this.mouse.x = x; this.mouse.y = y;
    this.mouse.in = x >= 0 && y >= 0 && x <= r.width && y <= r.height && e.target === this.cv;
    if (this.pan) {
      const dx = e.clientX - this.pan.x, dy = e.clientY - this.pan.y;
      this.pan.x = e.clientX; this.pan.y = e.clientY;
      Input.panScreen(-dx, -dy);
    }
    if (this.drag) {
      this.drag.x1 = x; this.drag.y1 = y;
      if (!this.drag.active && Math.hypot(x - this.drag.x0, y - this.drag.y0) > 6) this.drag.active = true;
    }
    if (this.placing) this.updatePlacing();
  },
  onUp(e) {
    if (e.button === 1) { this.pan = null; return; }
    if (e.button !== 0) return;
    const [x, y] = this.local(e);
    if (this.placing && this.placing.wallStart) { this.wallUp(); return; }
    const d = this.drag; this.drag = null;
    if (!d) return;
    if (d.active) { this.boxSelect(d.x0, d.y0, x, y, d.shift); return; }
    // clique simples
    const ent = this.pickAt(x, y);
    const now = performance.now();
    if (ent) {
      if (e.ctrlKey || (now - this.lastClick.t < 380 && this.lastClick.id === ent.id)) {
        // duplo clique: todos do mesmo tipo visíveis
        if (ent.kind === 'unit' && ent.team === G.player) {
          const same = G.units.filter((u) => !u.dead && u.team === G.player && u.type === ent.type && Math.abs(Cam.w2s(u.x, u.y)[0] - Cam.W / 2) < Cam.W / 2 + 20 && Math.abs(Cam.w2s(u.x, u.y)[1] - Cam.H / 2) < Cam.H / 2 + 20);
          this.select(same, e.shiftKey);
        } else if (ent.kind === 'building' && ent.team === G.player) {
          this.select(G.buildings.filter((b) => !b.dead && b.team === G.player && b.type === ent.type), e.shiftKey);
        } else this.select([ent]);
      } else if (e.shiftKey && ent.team === G.player && G.sel.every((s) => s.team === G.player)) {
        if (G.sel.includes(ent)) { ent.selected = false; this.select(G.sel.filter((s) => s !== ent)); }
        else this.select([ent], true);
      } else this.select([ent]);
      this.lastClick = { t: now, id: ent.id };
    } else if (!e.shiftKey) { this.select([]); }
  },

  /* ---------- clique direito ---------- */
  onRightClick(x, y, shift) {
    if (this.placing) { this.cancelPlace(); return; }
    if (this.mode) { this.setMode(null); return; }
    const [wx, wy] = Cam.s2w(x, y);
    const ent = this.pickAt(x, y);
    this.rightClickWorld(wx, wy, shift, ent);
  },
  rightClickWorld(wx, wy, shift, ent) {
    const own = G.sel.filter((e) => e.team === G.player);
    if (!own.length) return;
    const N = G.map.N;
    if (own[0].kind === 'unit') {
      const units = own.filter((e) => e.kind === 'unit' && !e.dead);
      if (ent === undefined) ent = null;
      if (ent) {
        Cmd.smart(units, ent, shift);
        const enemy = ent.team !== G.player && (ent.kind === 'building' || ent.kind === 'unit') && !(ent.kind === 'unit' && ent.animal && units.every((u) => u.type === 'villager'));
        FX.ping(ent.x, ent.y, enemy ? 'attack' : 'move');
        Sfx.play(enemy ? 'order' : 'order');
      } else {
        wx = clamp(wx, 0.5, N - 0.5); wy = clamp(wy, 0.5, N - 0.5);
        Cmd.move(units, wx, wy, shift, false);
        FX.ping(wx, wy, 'move'); Sfx.play('order');
      }
    } else if (own[0].kind === 'building' && own.length === 1 && own[0].def.trains && own[0].built) {
      const b = own[0];
      const target = ent && (ent.kind === 'node' || (ent.kind === 'building')) ? ent : null;
      b.rally = target ? { x: target.x, y: target.y, target } : { x: clamp(wx, 0.5, N - 0.5), y: clamp(wy, 0.5, N - 0.5) };
      FX.ping(b.rally.x, b.rally.y, 'move'); Sfx.play('order');
    }
  },

  setMode(m) {
    this.mode = m;
    this.cv.style.cursor = m === 'amove' ? 'crosshair' : m === 'rally' ? 'cell' : 'default';
    if (m) this.cancelPlace(true);
  },
  finishAMove(x, y, shift) {
    const [wx, wy] = Cam.s2w(x, y);
    const units = G.sel.filter((e) => e.kind === 'unit' && e.team === G.player && !e.dead && e.def.military);
    Cmd.move(units, clamp(wx, 0.5, G.map.N - 0.5), clamp(wy, 0.5, G.map.N - 0.5), shift, true);
    FX.ping(wx, wy, 'attack'); Sfx.play('order');
    if (!shift) this.setMode(null);
  },
  setRally(x, y) {
    const [wx, wy] = Cam.s2w(x, y);
    const ent = this.pickAt(x, y);
    this.rightClickWorld(wx, wy, false, ent);
    this.setMode(null);
  },

  /* ---------- construção ---------- */
  startPlace(type) {
    this.mode = null; this.drag = null;
    this.placing = { type, tx: 0, ty: 0, axis: 'x', chk: { ok: false }, segments: null, wallStart: null };
    this.cv.style.cursor = 'default';
    this.updatePlacing();
  },
  cancelPlace(silent) { if (this.placing) { this.placing = null; } },
  updatePlacing() {
    const pl = this.placing;
    if (!pl) return;
    const def = BUILD_DEFS[pl.type];
    const [wx, wy] = Cam.s2w(this.mouse.x, this.mouse.y);
    pl.tx = Math.floor(wx - def.w / 2 + 0.5); pl.ty = Math.floor(wy - def.d / 2 + 0.5);
    if (def.wall) {
      if (pl.wallStart && !def.gate) {
        // linha reta pelo eixo dominante
        const sx = pl.wallStart.x, sy = pl.wallStart.y;
        const cx = Math.floor(wx), cy = Math.floor(wy);
        const dx = cx - sx, dy = cy - sy;
        const segs = [];
        if (Math.abs(dx) >= Math.abs(dy)) { const st = dx >= 0 ? 1 : -1; for (let i = 0; i <= Math.abs(dx); i++) segs.push({ x: sx + i * st, y: sy }); }
        else { const st = dy >= 0 ? 1 : -1; for (let j = 0; j <= Math.abs(dy); j++) segs.push({ x: sx, y: sy + j * st }); }
        let cost = 0;
        pl.segments = segs.map((s) => { const c = G.canPlace(pl.type, s.x, s.y, G.player); return { ...s, ok: c.ok }; });
      } else {
        const c = G.canPlace(pl.type, pl.tx, pl.ty, G.player);
        pl.segments = [{ x: pl.tx, y: pl.ty, ok: c.ok }];
        pl.chk = c;
        if (pl.type === 'gate') {
          // orientação automática pelos vizinhos
          const m = G.map;
          const wallAt = (i, j) => { const e = G.byId.get(m.occ[j * m.N + i]); return e && e.kind === 'building' && e.def.wall; };
          if (!pl.axisManual) { const ew = wallAt(pl.tx - 1, pl.ty) || wallAt(pl.tx + 1, pl.ty); const ns = wallAt(pl.tx, pl.ty - 1) || wallAt(pl.tx, pl.ty + 1); pl.axis = ns && !ew ? 'y' : 'x'; }
        }
      }
    } else {
      pl.chk = G.canPlace(pl.type, pl.tx, pl.ty, G.player);
      pl.segments = null;
    }
  },
  placeDown(x, y, e) {
    const pl = this.placing;
    const def = BUILD_DEFS[pl.type];
    this.updatePlacing();
    if (def.wall && !def.gate) { pl.wallStart = { x: pl.tx, y: pl.ty }; this.updatePlacing(); return; }
    this.commitPlace(pl, [{ x: pl.tx, y: pl.ty }], e.shiftKey);
  },
  wallUp() {
    const pl = this.placing;
    if (!pl) return;
    const segs = (pl.segments || []).filter((s) => s.ok);
    pl.wallStart = null;
    if (segs.length) this.commitPlace(pl, segs, this.shift);
    this.updatePlacing();
  },
  commitPlace(pl, segs, shift) {
    const def = BUILD_DEFS[pl.type];
    const vils = G.sel.filter((u) => u.kind === 'unit' && u.type === 'villager' && u.team === G.player && !u.dead);
    let placed = 0;
    const made = [];
    for (const s of segs) {
      const chk = G.canPlace(pl.type, s.x, s.y, G.player);
      if (!chk.ok) { if (segs.length === 1) { G.toast(chk.why, 'warn'); Sfx.play('error'); } continue; }
      if (!G.canAfford(G.player, def.cost)) { G.toast('Recursos insuficientes', 'warn'); Sfx.play('error'); break; }
      G.spend(G.player, def.cost);
      const b = G.placeBuilding(pl.type, G.player, s.x, s.y, { axis: pl.axis });
      made.push(b); placed++;
    }
    if (!placed) return;
    Sfx.play('click');
    if (vils.length) {
      if (made.length === 1) for (const v of vils) v.order({ k: 'build', target: made[0] }, shift);
      else {
        // distribui os segmentos entre os aldeões
        vils.forEach((v, vi) => {
          let first = true;
          for (let k = vi; k < made.length; k += vils.length) { v.order({ k: 'build', target: made[k] }, shift || !first); first = false; }
        });
      }
    } else G.toast('Selecione aldeões para construir', 'warn');
    UI.refresh();
    if (!shift) this.cancelPlace();
    else this.updatePlacing();
  },

  /* ---------- câmera ---------- */
  panScreen(dx, dy) {
    const [a, b] = Cam.s2w(Cam.W / 2, Cam.H / 2), [c, d] = Cam.s2w(Cam.W / 2 + dx, Cam.H / 2 + dy);
    Cam.x += c - a; Cam.y += d - b; Cam.clamp();
  },
  update(dt) {
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k.has('ArrowLeft')) dx -= 1; if (k.has('ArrowRight')) dx += 1;
    if (k.has('ArrowUp')) dy -= 1; if (k.has('ArrowDown')) dy += 1;
    if (this.mouse.in && !this.pan && document.hasFocus()) {
      const m = 6, { x, y } = this.mouse;
      if (x <= m) dx -= 1; if (x >= Cam.W - m) dx += 1;
      if (y <= m) dy -= 1; if (y >= Cam.H - m) dy += 1;
    }
    if (dx || dy) {
      const sp = 1100 * dt;
      const l = Math.hypot(dx, dy);
      this.panScreen(dx / l * sp, dy / l * sp);
    }
    // hover
    if (this.mouse.in && !this.drag) {
      const e = this.pickAt(this.mouse.x, this.mouse.y);
      ui_hover = e;
      let cur = 'default';
      const own = G.sel.filter((s) => s.team === G.player && s.kind === 'unit');
      if (this.mode === 'amove') cur = 'crosshair';
      else if (this.placing) cur = 'default';
      else if (own.length && e) {
        if ((e.kind === 'unit' && e.team !== G.player) || (e.kind === 'building' && e.team !== G.player && e.team >= 0)) cur = 'crosshair';
        else if (e.kind === 'node' || (e.kind === 'unit' && e.animal) || (e.kind === 'building' && e.team === G.player)) cur = 'pointer';
      } else if (e) cur = 'pointer';
      if (this.cv.style.cursor !== cur) this.cv.style.cursor = cur;
    } else if (!this.mouse.in) ui_hover = null;
    if (this.placing) this.updatePlacing();
  },

  cycleIdle() {
    const idle = G.units.filter((u) => !u.dead && u.team === G.player && u.type === 'villager' && !u.task);
    if (!idle.length) { G.toast('Nenhum aldeão ocioso', 'info'); return; }
    this.idleIdx = ((this.idleIdx || 0) + 1) % idle.length;
    const u = idle[this.idleIdx];
    this.select([u]);
    Cam.centerOn(u.x, u.y);
  },

  /* ---------- teclado ---------- */
  onKey(e, down) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    this.shift = e.shiftKey; this.ctrl = e.ctrlKey;
    const key = e.key;
    if (down) this.keys.add(key); else this.keys.delete(key);
    if (!down) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'F1', 'Tab'].includes(key)) e.preventDefault();
    if (!G.map || !G.units.length) return;
    const lk = key.toLowerCase();
    if (key === 'Escape') {
      if ($('help').classList.contains('on')) UI.toggleHelp(false);
      else if (this.placing) this.cancelPlace();
      else if (this.mode) this.setMode(null);
      else if (G.sel.length) this.select([]);
      else UI.togglePause();
      return;
    }
    if (G.paused && !$('pause').classList.contains('on')) { /* sem pausa de menu */ }
    if (key === 'F1' || key === '?') { UI.toggleHelp(); return; }
    if (lk === 'p') { UI.togglePause(); return; }
    if (lk === 'm' && !e.ctrlKey) { Sfx.init(); const on = Sfx.toggle(); $('btnSound').classList.toggle('off', !on); return; }
    if (G.paused) return;
    if (key === 'Delete') {
      const bs = G.sel.filter((s) => s.kind === 'building' && s.team === G.player);
      for (const b of bs) G.demolish(b);
      if (bs.length) UI.refresh();
      return;
    }
    if (lk === 'r' && this.placing && BUILD_DEFS[this.placing.type].gate) { this.placing.axis = this.placing.axis === 'x' ? 'y' : 'x'; this.placing.axisManual = true; return; }
    if (key === '.' || key === ',') { this.cycleIdle(); return; }
    if (lk === 'h' && !e.ctrlKey) {
      const tc = G.buildings.find((b) => !b.dead && b.team === G.player && b.type === 'towncenter');
      if (tc) { Cam.centerOn(tc.x, tc.y); this.select([tc]); }
      return;
    }
    if (key === ' ') {
      const al = G.alerts[G.alerts.length - 1];
      if (al) Cam.centerOn(al.x, al.y);
      return;
    }
    if (/^[1-9]$/.test(key)) {
      const n = +key;
      if (e.ctrlKey) {
        e.preventDefault();
        UI.groups[n] = G.sel.filter((s) => s.team === G.player && s.kind !== 'node').map((s) => s.id);
        G.toast(`Grupo ${n} definido (${UI.groups[n].length})`, 'info');
      } else if (UI.groups[n]) {
        const list = UI.groups[n].map((id) => G.byId.get(id)).filter((s) => s && !s.dead);
        if (list.length) {
          this.select(list);
          const now = performance.now();
          if (UI.lastGroupKey === n && now - UI.lastGroupTime < 450) Cam.centerOn(list[0].x, list[0].y);
          UI.lastGroupKey = n; UI.lastGroupTime = now;
        }
      }
      return;
    }
    if (!e.ctrlKey && !e.altKey && !e.metaKey && lk.length === 1) { if (UI.pressHotkey(lk)) { e.preventDefault(); } }
  },
};
