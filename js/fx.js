'use strict';
/* ============================================================
   AGEZIM — efeitos: partículas, projéteis, textos flutuantes, som
   ============================================================ */

const RES_FX_COLOR = { food: '#ff9a7a', wood: '#d7a766', gold: '#ffd34d', stone: '#c3c8d0' };

const FX = {
  p: [],          // partículas
  arrows: [],     // projéteis
  pings: [],      // marcadores de comando

  reset() { this.p = []; this.arrows = []; this.pings = []; },

  add(o) { if (this.p.length < 1400) this.p.push(o); },

  update(dt) {
    const P = this.p;
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i];
      q.life -= dt;
      if (q.life <= 0) { P[i] = P[P.length - 1]; P.pop(); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.z += q.vz * dt;
      q.vz -= (q.g || 0) * dt;
      if (q.drag) { const k = Math.max(0, 1 - q.drag * dt); q.vx *= k; q.vy *= k; q.vz *= (q.type === 'smoke' ? k : 1); }
      if (q.z < 0 && q.g) { q.z = 0; q.vz *= -0.3; q.vx *= 0.6; q.vy *= 0.6; if (Math.abs(q.vz) < 5) q.vz = 0; }
      if (q.size1 != null) q.size += (q.size1 - q.size) * Math.min(1, dt * q.growRate);
    }
    // projéteis
    const A = this.arrows;
    for (let i = A.length - 1; i >= 0; i--) {
      const a = A[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.T);
      a.px = a.x; a.py = a.y; a.pz = a.z;
      a.x = a.sx + (a.tx - a.sx) * k; a.y = a.sy + (a.ty - a.sy) * k;
      a.z = a.sz + (a.tz - a.sz) * k + a.H * 4 * k * (1 - k);
      if (k >= 1) {
        a.stuck = true;
        this.arrowLand(a);
        A.splice(i, 1);
      }
    }
    for (let i = this.pings.length - 1; i >= 0; i--) { this.pings[i].t += dt; if (this.pings[i].t > 0.7) this.pings.splice(i, 1); }
  },

  /* ---------- projéteis ---------- */
  arrow(x, y, z, target, dmg, dtype, src) {
    if (!target || target.dead) return;
    const speed = 15;
    let tx = target.x, ty = target.y;
    if (target.kind === 'building') {
      // mira num ponto da borda mais próxima
      const r = target.rect;
      tx = clamp(x, r.x0 + 0.3, r.x1 - 0.3); ty = clamp(y, r.y0 + 0.3, r.y1 - 0.3);
    }
    let d = Math.hypot(tx - x, ty - y);
    let T = Math.max(0.12, d / speed);
    if (target.kind === 'unit' && target.moved) { // antecipa o movimento
      tx += (target.vx || 0) * T * 0.9; ty += (target.vy || 0) * T * 0.9;
      d = Math.hypot(tx - x, ty - y); T = Math.max(0.12, d / speed);
    }
    // dispersão leve
    const sp = Math.min(0.5, d * 0.035);
    tx += (Math.random() - 0.5) * sp; ty += (Math.random() - 0.5) * sp;
    this.arrows.push({
      x, y, z, sx: x, sy: y, sz: z, tx, ty, tz: target.kind === 'building' ? 14 : 10, t: 0, T,
      H: Math.min(26, 5 + d * 2.6), target, dmg, dtype, src, px: x, py: y, pz: z,
    });
  },
  arrowLand(a) {
    const t = a.target;
    let hit = false;
    if (t && !t.dead) {
      if (t.kind === 'building') hit = true;
      else if (Math.hypot(t.x - a.tx, t.y - a.ty) < 0.6 + t.def.radius) hit = true;
    }
    if (!hit) {
      // acerta qualquer inimigo muito próximo do ponto de queda
      let near = null;
      G.queryUnits(a.tx, a.ty, 0.8, (u) => {
        if (!near && !u.dead && u.team !== (a.src ? a.src.team : -9) && u.team >= 0 && !u.animal && Math.hypot(u.x - a.tx, u.y - a.ty) < 0.4 + u.def.radius) near = u;
      });
      if (near && a.src && near.team !== a.src.team) { G.hit(a.src, near, a.dmg, a.dtype); hit = true; }
    } else {
      G.hit(a.src, t, a.dmg, a.dtype);
    }
    if (!hit && !(a.src && a.src.kind === 'building')) this.add({ type: 'arrowstuck', x: a.tx, y: a.ty, z: 0, vx: 0, vy: 0, vz: 0, life: 4, max: 4, size: 1, ang: Math.atan2(a.ty - a.sy, a.tx - a.sx) });
    else if (!hit) this.add({ type: 'dust', x: a.tx, y: a.ty, z: 2, vx: 0, vy: 0, vz: 10, life: 0.4, max: 0.4, size: 3, size1: 6, growRate: 4, color: [200, 180, 140] });
  },

  /* ---------- partículas ---------- */
  puff(x, y, size, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, r = Math.random() * size * 0.5;
      this.add({ type: 'dust', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, z: Math.random() * 6, vx: Math.cos(a) * 0.5, vy: Math.sin(a) * 0.5, vz: 14 + Math.random() * 18, life: 0.9 + Math.random() * 0.6, max: 1.4, size: 6, size1: 18 + Math.random() * 10, growRate: 2, color: [214, 196, 160], drag: 1.2 });
    }
  },
  collapse(b) {
    const n = 16 + b.w * b.d * 3;
    for (let i = 0; i < n; i++) {
      const x = b.x + (Math.random() - 0.5) * b.w * 0.9, y = b.y + (Math.random() - 0.5) * b.d * 0.9;
      this.add({ type: 'dust', x, y, z: 10 + Math.random() * 40, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8, vz: 10 + Math.random() * 25, life: 1.6 + Math.random() * 1.2, max: 2.8, size: 10, size1: 34 + Math.random() * 20, growRate: 1.2, color: [150 + Math.random() * 50, 140 + Math.random() * 40, 120 + Math.random() * 30], drag: 0.7 });
    }
    for (let i = 0; i < 14 + b.w * 3; i++) {
      this.add({ type: 'debris', x: b.x + (Math.random() - 0.5) * b.w * 0.7, y: b.y + (Math.random() - 0.5) * b.d * 0.7, z: 20 + Math.random() * 30, vx: (Math.random() - 0.5) * 2.6, vy: (Math.random() - 0.5) * 2.6, vz: 50 + Math.random() * 70, g: 260, life: 1.4 + Math.random(), max: 2, size: 2 + Math.random() * 3.5, color: Math.random() < 0.5 ? [120, 116, 110] : [110, 76, 44] });
    }
  },
  hitSpark(x, y, z) {
    for (let i = 0; i < 4; i++) {
      this.add({ type: 'spark', x, y, z, vx: (Math.random() - 0.5) * 1.6, vy: (Math.random() - 0.5) * 1.6, vz: 30 + Math.random() * 40, g: 200, life: 0.25 + Math.random() * 0.2, max: 0.45, size: 1.6, color: [255, 236, 170] });
    }
  },
  smoke(b) {
    // deslocamento (mundo) e altura (px) da chaminé em relação ao centro da construção
    const o = { house: [0.39, -0.31, 56], towncenter: [0.2, -0.2, 98], blacksmith: [-0.66, -0.72, 70] }[b.type];
    if (!o) return;
    this.add({ type: 'smoke', x: b.x + o[0], y: b.y + o[1], z: o[2], vx: 0.12 + Math.random() * 0.1, vy: -0.05, vz: 16 + Math.random() * 8, life: 2.4 + Math.random(), max: 3.2, size: 3, size1: 14, growRate: 0.9, color: [210, 210, 214], drag: 0.2 });
  },
  flame(b) {
    const x = b.x + (Math.random() - 0.5) * b.w * 0.8, y = b.y + (Math.random() - 0.5) * b.d * 0.8;
    const z = 14 + Math.random() * Math.min(60, 20 + b.w * 12);
    this.add({ type: 'flame', x, y, z, vx: 0, vy: 0, vz: 24 + Math.random() * 20, life: 0.5 + Math.random() * 0.35, max: 0.8, size: 5 + Math.random() * 5, size1: 1, growRate: 2.2, color: [255, 150, 40] });
    if (Math.random() < 0.5) this.add({ type: 'smoke', x, y, z: z + 10, vx: 0.12, vy: -0.05, vz: 20, life: 2, max: 2.4, size: 4, size1: 16, growRate: 1, color: [60, 56, 56], drag: 0.2 });
  },
  floatText(x, y, z, text, rtype) {
    this.add({ type: 'text', x, y, z, vx: 0, vy: 0, vz: 22, life: 1.4, max: 1.4, text, color: RES_FX_COLOR[rtype] || '#fff', size: 12 });
  },
  workStrike(u, n, anim) {
    const vis = G.isVisible(u.x, u.y);
    if (anim === 'chop') {
      if (vis) for (let i = 0; i < 3; i++) this.add({ type: 'chip', x: n.x, y: n.y, z: 10 + Math.random() * 6, vx: (Math.random() - 0.5) * 1.4, vy: (Math.random() - 0.5) * 1.4, vz: 30 + Math.random() * 30, g: 220, life: 0.6, max: 0.6, size: 2, color: [190, 140, 80] });
      window.Sfx && Sfx.play('chop', u.x, u.y);
    } else if (anim === 'mine') {
      if (vis) for (let i = 0; i < 4; i++) this.add({ type: 'spark', x: n.x, y: n.y, z: 8, vx: (Math.random() - 0.5) * 1.8, vy: (Math.random() - 0.5) * 1.8, vz: 40 + Math.random() * 40, g: 240, life: 0.4, max: 0.4, size: 1.8, color: n.gsub === 'gold' ? [255, 226, 110] : [230, 235, 245] });
      window.Sfx && Sfx.play('mine', u.x, u.y);
    } else if (anim === 'farm') {
      if (vis) this.add({ type: 'dust', x: u.x + Math.cos(u.heading) * 0.4, y: u.y + Math.sin(u.heading) * 0.4, z: 3, vx: 0, vy: 0, vz: 10, life: 0.5, max: 0.5, size: 2, size1: 7, growRate: 4, color: [140, 104, 64] });
    } else if (anim === 'build') {
      if (vis) {
        const bx = u.x + Math.cos(u.heading) * 0.5, by = u.y + Math.sin(u.heading) * 0.5;
        for (let i = 0; i < 3; i++) this.add({ type: 'spark', x: bx, y: by, z: 10, vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2, vz: 30 + Math.random() * 30, g: 220, life: 0.3, max: 0.3, size: 1.5, color: [255, 220, 150] });
        if (Math.random() < 0.5) this.add({ type: 'dust', x: bx, y: by, z: 4, vx: 0, vy: 0, vz: 8, life: 0.7, max: 0.7, size: 3, size1: 10, growRate: 3, color: [200, 180, 140] });
      }
      window.Sfx && Sfx.play('hammer', u.x, u.y);
    }
  },
  ping(x, y, kind) { this.pings.push({ x, y, t: 0, kind }); },
};

/* ============================================================
   Som sintetizado (WebAudio)
   ============================================================ */
const Sfx = {
  ctx: null, enabled: true, master: null, last: {}, noiseBuf: null,

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const n = this.ctx.sampleRate * 1;
      this.noiseBuf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },
  toggle() { this.enabled = !this.enabled; if (this.master) this.master.gain.value = this.enabled ? 0.5 : 0; return this.enabled; },

  _tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },
  _noise(dur, vol = 0.2, f0 = 1000, f1 = 1000, type = 'bandpass', q = 1, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },

  play(name, x, y) {
    if (!this.ctx || !this.enabled) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = performance.now();
    const gap = { chop: 90, mine: 90, hammer: 90, hit: 60, thud: 70, arrow: 60, drop: 120, click: 30, die: 120, alert: 2500, coin: 60 }[name] || 80;
    if (this.last[name] && now - this.last[name] < gap) return;
    let v = 1;
    if (x != null && window.Cam) {
      const d = Math.hypot(x - Cam.x, y - Cam.y);
      v = clamp(1 - d / (34 / Math.max(0.5, Cam.zoom)), 0, 1);
      if (v < 0.06) return;
      v *= v;
    }
    this.last[name] = now;
    switch (name) {
      case 'click': this._tone(900, 0.05, 'triangle', 0.12); break;
      case 'chop': this._noise(0.07, 0.3 * v, 1800, 700, 'bandpass', 2); this._tone(150, 0.08, 'sine', 0.18 * v, -60); break;
      case 'mine': this._tone(2100 + Math.random() * 300, 0.12, 'triangle', 0.1 * v, -400); this._noise(0.04, 0.2 * v, 3500, 2500, 'highpass'); break;
      case 'hammer': this._noise(0.05, 0.22 * v, 900, 400, 'bandpass', 1.5); this._tone(220, 0.06, 'square', 0.07 * v, -80); break;
      case 'hit': this._noise(0.09, 0.3 * v, 700, 260, 'bandpass', 1.2); this._tone(120, 0.1, 'sine', 0.2 * v, -50); break;
      case 'thud': this._noise(0.12, 0.34 * v, 400, 120, 'lowpass', 1); this._tone(80, 0.14, 'sine', 0.25 * v, -30); break;
      case 'arrow': this._noise(0.14, 0.14 * v, 1200, 5200, 'highpass', 0.8); break;
      case 'drop': this._noise(0.06, 0.14 * v, 600, 300, 'lowpass'); this._tone(660, 0.07, 'triangle', 0.07 * v); break;
      case 'coin': this._tone(1320, 0.09, 'triangle', 0.12); this._tone(1760, 0.14, 'triangle', 0.1, 0, 0.07); break;
      case 'die': this._tone(260, 0.3, 'sawtooth', 0.1 * v, -190); this._noise(0.12, 0.12 * v, 500, 200, 'lowpass'); break;
      case 'built': [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.12, 0, i * 0.09)); break;
      case 'ready': this._tone(784, 0.12, 'triangle', 0.1); this._tone(1046, 0.2, 'triangle', 0.1, 0, 0.1); break;
      case 'tech': [659, 880, 1175].forEach((f, i) => this._tone(f, 0.25, 'sine', 0.12, 0, i * 0.1)); break;
      case 'alert': this._tone(196, 0.5, 'sawtooth', 0.13, 0); this._tone(262, 0.5, 'sawtooth', 0.1, 0, 0.18); break;
      case 'collapse': this._noise(0.8, 0.45 * v, 500, 60, 'lowpass', 0.8); this._tone(70, 0.6, 'sine', 0.3 * v, -40); break;
      case 'select': this._tone(1200, 0.035, 'triangle', 0.06); break;
      case 'order': this._tone(520, 0.05, 'triangle', 0.08); break;
      case 'error': this._tone(160, 0.14, 'square', 0.1); break;
    }
  },
};
