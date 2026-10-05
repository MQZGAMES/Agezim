'use strict';
/* ============================================================
   AGEZIM — ícones procedurais da interface
   ============================================================ */

const Icons = {
  cache: new Map(),

  _make(key, w, h, fn) {
    let u = this.cache.get(key);
    if (u) return u;
    const S = 2;
    const cv = makeCanvas(w * S, h * S);
    const ctx = cv.getContext('2d');
    ctx.scale(S, S);
    fn(ctx, w, h);
    u = cv.toDataURL('image/png');
    this.cache.set(key, u);
    return u;
  },

  /* fundo "pedra" dos botões */
  _bg(ctx, w, h, c0 = '#6a6e74', c1 = '#3a3d42') {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const r = new RNG(5);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,255,255,${r.range(0.02, 0.06)})`; ctx.fillRect(r.range(0, w), r.range(0, h), r.range(1, 4), 1); }
  },

  building(type, team = 0) {
    return this._make(`b|${type}|${team}`, 64, 64, (ctx, w, h) => {
      this._bg(ctx, w, h, '#8a9a6a', '#4e6a40');
      const spr = Buildings.get(type, team, type === 'wall' ? { mask: 10 } : type === 'gate' ? { axis: 'x' } : type === 'farm' ? { stage: 2 } : {});
      // área útil do sprite: usa o tamanho do footprint
      const def = BUILD_DEFS[type];
      const bh = spr.bh || 40;
      const spanX = (def.w + def.d) * HW + 8, spanY = (def.w + def.d) * HH + bh + 6;
      const k = Math.min((w - 6) / spanX, (h - 4) / spanY);
      const cx = w / 2, cy = h - 6 - (def.w + def.d) * 8 * k - (type === 'wall' || type === 'gate' ? 4 : 0);
      ctx.drawImage(spr.cv, cx - spr.ax * k, cy - spr.ay * k + ((def.w + def.d) * 8 + 8) * k * 0.0, spr.w * k, spr.h * k);
    });
  },

  unit(type, team = 0) {
    return this._make(`u|${type}|${team}`, 64, 64, (ctx, w, h) => {
      this._bg(ctx, w, h, '#7a8aa0', '#3e4a5e');
      if (UNIT_DEFS[type].animal) {
        const spr = AnimalSprites.get(type, 0, 1, 'idle', 0);
        const k = type === 'chicken' || type === 'rabbit' ? 1.9 : 1.15;
        ctx.drawImage(spr.cv, w / 2 - spr.ax * k, h - 14 - spr.ay * k + 6, spr.w * k, spr.h * k);
      } else {
        const spr = HumanSprites.get(type, team, 1, 1, 'idle', 0, null);
        const k = 1.5;
        ctx.drawImage(spr.cv, w / 2 - spr.ax * k, h - 8 - spr.ay * k + 0, spr.w * k, spr.h * k);
      }
    });
  },

  res(type) {
    return this._make(`r|${type}`, 28, 28, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2 + 1);
      if (type === 'wood') {
        for (let i = 0; i < 3; i++) {
          const y = 5 - i * 6.5, x0 = -9 + (i % 2) * 2;
          tube(ctx, [x0, y], [x0 + 15, y], 6, [140, 94, 54]);
          circle(ctx, x0 + 15, y, 3, '#d8b07a', '#5a3a1c', 0.7);
          circle(ctx, x0 + 15, y, 1.4, 'rgba(120,80,40,0.7)');
        }
      } else if (type === 'food') {
        // maçã + espiga
        circle(ctx, -2, 2, 8.2, '#c92c22', '#5a1008', 1);
        circle(ctx, -4.5, -1, 2.6, 'rgba(255,255,255,0.45)');
        line(ctx, [-2, -5], [-1, -9], '#4a2a10', 1.6);
        ctx.fillStyle = '#4a9a2c'; ctx.beginPath(); ctx.ellipse(2, -8, 4, 2, -0.4, 0, TAU); ctx.fill();
      } else if (type === 'gold') {
        poly(ctx, [[-10, 6], [-6, -5], [3, -9], [10, -2], [8, 7]], '#f4c430', '#6a4a06', 1);
        poly(ctx, [[-6, -5], [3, -9], [10, -2], [1, -1]], '#ffe27a');
        poly(ctx, [[-10, 6], [-6, -5], [1, -1], [0, 7]], '#d4a017');
        circle(ctx, -3, -3, 1.4, '#fff7c0');
      } else if (type === 'stone') {
        poly(ctx, [[-10, 5], [-8, -4], [-1, -9], [7, -6], [10, 2], [5, 8], [-4, 8]], '#9a9ea6', '#2e3036', 1);
        poly(ctx, [[-8, -4], [-1, -9], [7, -6], [0, -2]], '#d0d4da');
        poly(ctx, [[10, 2], [5, 8], [-4, 8], [0, -2]], '#6a6e76');
      } else if (type === 'pop') {
        circle(ctx, 0, -5, 4.4, '#f0c496', '#3a2a1c', 1);
        ctx.fillStyle = '#e8c463'; ctx.beginPath(); ctx.moveTo(-8, 9); ctx.quadraticCurveTo(-8, -1, 0, -1); ctx.quadraticCurveTo(8, -1, 8, 9); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#6a4a10'; ctx.lineWidth = 1; ctx.stroke();
      } else if (type === 'idle') {
        circle(ctx, 0, -5, 4.4, '#f0c496', '#3a2a1c', 1);
        ctx.fillStyle = '#6aa0ff'; ctx.beginPath(); ctx.moveTo(-8, 9); ctx.quadraticCurveTo(-8, -1, 0, -1); ctx.quadraticCurveTo(8, -1, 8, 9); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#1a3a7a'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.fillText('z', 5, -6);
      } else if (type === 'time') {
        circle(ctx, 0, 0, 9, '#e8d9a8', '#5a4210', 1.4);
        line(ctx, [0, 0], [0, -6], '#3a2a10', 1.6); line(ctx, [0, 0], [5, 2], '#3a2a10', 1.6);
      }
    });
  },

  cmd(name, color) {
    return this._make(`c|${name}`, 64, 64, (ctx, w, h) => {
      this._bg(ctx, w, h, '#7a7e84', '#3e4146');
      ctx.translate(w / 2, h / 2);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (name === 'stop') {
        poly(ctx, [[-14, -14], [14, -14], [14, 14], [-14, 14]], '#d8402f', '#4a0e08', 2.4);
        poly(ctx, [[-14, -14], [14, -14], [14, -4], [-14, -4]], 'rgba(255,255,255,0.22)');
      } else if (name === 'amove') {
        line(ctx, [-14, 14], [10, -10], '#2a2d33', 6); line(ctx, [-14, 14], [10, -10], '#e4e9ef', 3.4);
        line(ctx, [14, 14], [-10, -10], '#2a2d33', 6); line(ctx, [14, 14], [-10, -10], '#e4e9ef', 3.4);
        line(ctx, [-9, 9], [-15, 15], '#8a6238', 4); line(ctx, [9, 9], [15, 15], '#8a6238', 4);
        circle(ctx, 0, 0, 20, null, 'rgba(255,80,60,0.9)', 2);
      } else if (name === 'demolish') {
        line(ctx, [-12, 10], [10, -12], '#2a2d33', 7); line(ctx, [-12, 10], [10, -12], '#8a6238', 4);
        poly(ctx, [[2, -16], [16, -2], [8, 4], [-6, -10]], '#9aa2ac', '#22252b', 2);
        for (let i = 0; i < 4; i++) circle(ctx, -14 + i * 8, 16 - (i % 2) * 3, 2.5, '#6a645c');
      } else if (name === 'cancel') {
        line(ctx, [-12, -12], [12, 12], '#e8463a', 6); line(ctx, [12, -12], [-12, 12], '#e8463a', 6);
      } else if (name === 'buy') {
        poly(ctx, [[-14, 0], [2, 0], [2, -9], [16, 3], [2, 15], [2, 6], [-14, 6]], '#4fc86a', '#0e4a1c', 2);
      } else if (name === 'sell') {
        poly(ctx, [[14, 0], [-2, 0], [-2, -9], [-16, 3], [-2, 15], [-2, 6], [14, 6]], '#e8a23a', '#5a3a08', 2);
      } else if (name === 'flag') {
        line(ctx, [-8, 16], [-8, -16], '#3a2a1a', 3);
        poly(ctx, [[-8, -16], [14, -10], [-8, -2]], '#e8463a', '#5a0e08', 1.6);
      }
    });
  },

  tech(id) {
    return this._make(`t|${id}`, 64, 64, (ctx, w, h) => {
      this._bg(ctx, w, h, '#8a7a5a', '#4a3e28');
      ctx.translate(w / 2, h / 2);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const star = (n) => { for (let i = 0; i < n; i++) { circle(ctx, -8 + i * 8, 22, 2.6, '#ffd34d', '#6a4a06', 1); } };
      const sword = (x, ang, col = '#e4e9ef') => {
        ctx.save(); ctx.translate(x, 2); ctx.rotate(ang);
        line(ctx, [0, 14], [0, -20], '#22252b', 6); line(ctx, [0, 14], [0, -20], col, 3.2);
        line(ctx, [-6, 8], [6, 8], '#c9a24a', 3.4);
        line(ctx, [0, 8], [0, 15], '#6a4a2a', 4);
        ctx.restore();
      };
      switch (id) {
        case 'sword': sword(0, 0.5); break;
        case 'sword2': sword(-6, -0.45); sword(6, 0.45); star(1); break;
        case 'bow': case 'bow2': {
          ctx.beginPath(); ctx.moveTo(-6, -20); ctx.quadraticCurveTo(14, 0, -6, 20);
          ctx.strokeStyle = '#2a190c'; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#a06a34'; ctx.lineWidth = 3.6; ctx.stroke();
          line(ctx, [-6, -20], [-6, 20], '#f4efe0', 1.2);
          line(ctx, [-12, 0], [18, 0], '#d8c9a0', 2.2); poly(ctx, [[18, -3], [24, 0], [18, 3]], '#c9d0d8');
          if (id === 'bow2') star(1);
          break;
        }
        case 'shield': case 'shield2': {
          ctx.beginPath(); ctx.moveTo(-15, -16); ctx.lineTo(15, -16); ctx.lineTo(15, 2); ctx.quadraticCurveTo(15, 16, 0, 22); ctx.quadraticCurveTo(-15, 16, -15, 2); ctx.closePath();
          ctx.fillStyle = '#4a7ad8'; ctx.fill(); ctx.strokeStyle = '#d8dee6'; ctx.lineWidth = 3; ctx.stroke();
          line(ctx, [0, -16], [0, 21], '#d8dee6', 2.4); line(ctx, [-15, -2], [15, -2], '#d8dee6', 2.4);
          if (id === 'shield2') star(1);
          break;
        }
        case 'axe':
          line(ctx, [-10, 16], [8, -14], '#2a190c', 6); line(ctx, [-10, 16], [8, -14], '#9a6a38', 3.6);
          poly(ctx, [[4, -16], [18, -10], [14, 2], [4, -4]], '#c9d0d8', '#2a2d33', 2);
          break;
        case 'plow':
          line(ctx, [-16, 10], [16, 10], '#2a190c', 6); line(ctx, [-16, 10], [16, 10], '#8a5a2a', 3.6);
          for (let i = -2; i <= 2; i++) { line(ctx, [i * 7, 10], [i * 7, -8], '#e2c24a', 3); circle(ctx, i * 7, -11, 2.4, '#f2d96a'); }
          break;
        case 'pick':
          line(ctx, [-10, 16], [8, -14], '#2a190c', 6); line(ctx, [-10, 16], [8, -14], '#9a6a38', 3.6);
          ctx.beginPath(); ctx.moveTo(-8, -16); ctx.quadraticCurveTo(10, -22, 22, -4); ctx.strokeStyle = '#22252b'; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#c9d0d8'; ctx.lineWidth = 3.2; ctx.stroke();
          break;
        case 'wheel':
          circle(ctx, 0, 6, 12, null, '#22252b', 6); circle(ctx, 0, 6, 12, null, '#9a6a38', 3.4);
          for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; line(ctx, [0, 6], [Math.cos(a) * 12, 6 + Math.sin(a) * 12], '#9a6a38', 2); }
          circle(ctx, 0, 6, 3, '#c9a24a');
          poly(ctx, [[-14, -4], [14, -4], [10, -16], [-10, -16]], '#8a5a2a', '#2a190c', 2);
          break;
      }
    });
  },
};
