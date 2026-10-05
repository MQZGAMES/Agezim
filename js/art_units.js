'use strict';
/* ============================================================
   AGEZIM — arte das unidades humanas (esqueleto 3D -> sprite 2D)
   ============================================================ */

const HUMAN_STYLE = {
  villager: { skin: '#f0c496', pants: '#6a4e34', boots: '#3a2a1c', belt: '#33261a', hair: ['#4a2f1a', '#2c2017', '#8a5a2a', '#c8a05a'], tunicBase: null },
  archer:   { skin: '#ecbc8e', pants: '#4a3f2e', boots: '#33261a', belt: '#2a1e12', hair: ['#3a2616', '#6b4423', '#211810', '#b88a46'], tunic: '#5b8a43' },
  warrior:  { skin: '#e4b184', pants: '#45454e', boots: '#2b2725', belt: '#25201c', hair: ['#2a1c10', '#4a2f1a', '#1a1410', '#7a5530'], mail: '#8f969e' },
};

const ANIM_FRAMES = { idle: 1, walk: 8, chop: 8, mine: 8, farm: 8, build: 8, forage: 6, attack: 8, shoot: 8, dead: 5 };

/* pose da unidade para (anim, fase) ------------------------------------------------ */
function humanPose(o, t) {
  const p = {
    hipZ: 11, lean: 0, bob: 0,
    fL: [0, 2.4, 0], fR: [0, -2.4, 0],
    hL: [0.5, 5.6, 11.5], hR: [0.5, -5.6, 11.5],
    tool: null, toolAng: 0, twoHand: false, crouch: 0,
  };
  const s = Math.sin(t), c = Math.cos(t);
  const ph = t / TAU; // 0..1
  const ease = (x) => x * x * (3 - 2 * x);
  switch (o.anim) {
    case 'walk': {
      p.fL = [s * 5.2, 2.4, Math.max(0, c) * 2.8];
      p.fR = [-s * 5.2, -2.4, Math.max(0, -c) * 2.8];
      p.hL = [-s * 4.2, 5.6, 11.8 + c * 0.4];
      p.hR = [s * 4.2, -5.6, 11.8 - c * 0.4];
      p.bob = Math.abs(c) * 0.9;
      p.lean = 0.7;
      if (o.type === 'archer') { p.hL = [3, 5.4, 12]; }
      break;
    }
    case 'chop': case 'mine': case 'farm': {
      const heavy = o.anim === 'mine' ? 1.0 : o.anim === 'farm' ? 0.8 : 0.9;
      let ang, hz, ha;
      if (ph < 0.5) { const e = ease(ph / 0.5); ang = lerp(25, 118, e); hz = lerp(11, 29, e); ha = lerp(6, -1.5, e); p.lean = lerp(0, -1.2, e); }
      else if (ph < 0.64) { const e = (ph - 0.5) / 0.14; ang = lerp(118, -42, e); hz = lerp(29, 8.5, e); ha = lerp(-1.5, 8.5, e); p.lean = lerp(-1.2, 3.2, e) * heavy; }
      else { const e = ease((ph - 0.64) / 0.36); ang = lerp(-42, 25, e); hz = lerp(8.5, 11, e); ha = lerp(8.5, 6, e); p.lean = lerp(3.2, 0, e); }
      if (o.anim === 'farm') { p.crouch = 1.2; }
      p.hR = [ha, -3.4, hz];
      p.hL = [ha - 1.8, 3.4, hz - 3];
      p.twoHand = true;
      p.tool = o.anim === 'chop' ? 'axe' : o.anim === 'mine' ? 'pick' : 'hoe';
      p.toolAng = ang;
      p.fL = [2, 2.8, 0]; p.fR = [-2, -2.8, 0];
      break;
    }
    case 'build': {
      let ang, hz, ha;
      const k = (ph * 2) % 1;
      if (k < 0.55) { const e = ease(k / 0.55); ang = lerp(20, 95, e); hz = lerp(13, 21, e); ha = lerp(7, 3, e); }
      else { const e = (k - 0.55) / 0.45; ang = lerp(95, -10, e); hz = lerp(21, 12, e); ha = lerp(3, 8, e); }
      p.lean = 1.8; p.crouch = 0.6;
      p.hR = [ha, -4, hz];
      p.hL = [7.5, 4, 11];
      p.tool = 'hammer'; p.toolAng = ang;
      p.fL = [1.5, 3, 0]; p.fR = [-1.5, -3, 0];
      break;
    }
    case 'forage': {
      p.crouch = 3.5; p.lean = 5.5;
      const k = Math.sin(t * 1.0);
      p.hR = [8.5 + k * 1.5, -3.5, 3.5 + Math.max(0, Math.sin(t * 2)) * 2.5];
      p.hL = [8, 3.5, 3 + Math.max(0, Math.cos(t * 2)) * 2.5];
      p.fL = [1.5, 3, 0]; p.fR = [-1.5, -3, 0];
      break;
    }
    case 'attack': { // golpe corpo a corpo
      let ang, hz, ha;
      if (ph < 0.42) { const e = ease(ph / 0.42); ang = lerp(30, 115, e); hz = lerp(12, 26, e); ha = lerp(6, 0, e); p.lean = lerp(0, -1.5, e); }
      else if (ph < 0.58) { const e = (ph - 0.42) / 0.16; ang = lerp(115, -25, e); hz = lerp(26, 11, e); ha = lerp(0, 9, e); p.lean = lerp(-1.5, 3.5, e); }
      else { const e = ease((ph - 0.58) / 0.42); ang = lerp(-25, 30, e); hz = lerp(11, 12, e); ha = lerp(9, 6, e); p.lean = lerp(3.5, 0, e); }
      p.hR = [ha, -4.2, hz];
      p.hL = o.type === 'warrior' ? [4, 6.2, 13.5] : [2.5, 5.6, 11.5];
      p.tool = o.type === 'warrior' ? 'sword' : 'knife'; p.toolAng = ang;
      p.fL = [3.5, 2.8, 0]; p.fR = [-3.5, -2.8, 0];
      break;
    }
    case 'shoot': { // arco
      let draw;
      if (ph < 0.5) draw = ease(ph / 0.5); else if (ph < 0.58) draw = 1 - (ph - 0.5) / 0.08; else draw = 0;
      p.hL = [11.5, 2.5, 19.5];
      p.hR = [lerp(10.5, 3.2, draw), 0.5, 19.5];
      p.tool = 'bow'; p.toolAng = draw;
      p.lean = lerp(0, -1, draw);
      p.fL = [2.5, 3.6, 0]; p.fR = [-2.5, -2.4, 0];
      break;
    }
    default: { // idle
      p.bob = (Math.sin(t) * 0.25) + 0.25;
      if (o.type === 'warrior') { p.hL = [3, 6.2, 13.5]; p.hR = [1.5, -5.6, 10]; p.tool = 'sword'; p.toolAng = -75; }
      if (o.type === 'archer') { p.hL = [4, 5.8, 13]; p.hR = [0.5, -5.6, 11]; p.tool = 'bow'; p.toolAng = 0.0; p.idleBow = true; }
    }
  }
  return p;
}

/* ferramentas ----------------------------------------------------------------------- */
function drawTool(ctx, B, o, pose, handR, handL, parts) {
  const tool = pose.tool;
  if (!tool) return;
  const ang = pose.toolAng * Math.PI / 180;
  const dirv = [Math.cos(ang), 0, Math.sin(ang)];
  const pt = (h, d, k, side = 0) => B.P(h[0] + d[0] * k, h[1] + d[2] * 0 + side, h[2] + d[2] * k);
  const depth = handR[2] ? handR[2] : 0;
  const W = (name, fn) => parts.add(depth + 0.05, fn);
  const hw = [pose.hRw[0], pose.hRw[1], pose.hRw[2]]; // mão direita em coords locais
  switch (tool) {
    case 'axe': case 'pick': case 'hoe': case 'hammer': {
      const len = tool === 'hammer' ? 8.5 : tool === 'hoe' ? 14 : 12.5;
      const base = B.P(hw[0] - dirv[0] * 2.5, hw[1], hw[2] - dirv[2] * 2.5);
      const tip = B.P(hw[0] + dirv[0] * len, hw[1], hw[2] + dirv[2] * len);
      W('t', (g) => {
        line(g, base, tip, '#2d1d10', 2.6);
        line(g, base, tip, '#8a6238', 1.7);
        line(g, [base[0] - 0.3, base[1] - 0.4], [tip[0] - 0.3, tip[1] - 0.4], '#b58650', 0.6);
        if (tool === 'axe') {
          const hd = B.P(hw[0] + dirv[0] * (len - 1.5), hw[1], hw[2] + dirv[2] * (len - 1.5));
          const nx = [-dirv[2], dirv[0]];
          const e1 = B.P(hw[0] + dirv[0] * (len - 1.5) + nx[0] * 4.2 + dirv[0] * 1.5, hw[1], hw[2] + dirv[2] * (len - 1.5) + nx[1] * 4.2 + dirv[2] * 1.5);
          const e2 = B.P(hw[0] + dirv[0] * (len - 1.5) + nx[0] * 4.2 - dirv[0] * 2.5, hw[1], hw[2] + dirv[2] * (len - 1.5) + nx[1] * 4.2 - dirv[2] * 2.5);
          poly(g, [hd, e1, e2], '#c3cad2', '#3a3f46', 0.7);
          line(g, hd, e1, '#f2f6fa', 0.6);
        } else if (tool === 'pick') {
          const hd = tip;
          const nx = [-dirv[2], dirv[0]];
          const a = B.P(hw[0] + dirv[0] * len + nx[0] * 5.2, hw[1], hw[2] + dirv[2] * len + nx[1] * 5.2);
          const b = B.P(hw[0] + dirv[0] * len - nx[0] * 5.2, hw[1], hw[2] + dirv[2] * len - nx[1] * 5.2);
          line(g, a, b, '#2f3338', 2.4);
          line(g, a, b, '#b4bcc6', 1.4);
        } else if (tool === 'hoe') {
          const nx = [-dirv[2], dirv[0]];
          const a = B.P(hw[0] + dirv[0] * len, hw[1], hw[2] + dirv[2] * len);
          const b = B.P(hw[0] + dirv[0] * (len - 0.5) + nx[0] * 4.5, hw[1], hw[2] + dirv[2] * (len - 0.5) + nx[1] * 4.5);
          line(g, a, b, '#2f3338', 2.4);
          line(g, a, b, '#a9b0b8', 1.3);
        } else { // martelo
          const nx = [-dirv[2], dirv[0]];
          const a = B.P(hw[0] + dirv[0] * len + nx[0] * 2.4, hw[1], hw[2] + dirv[2] * len + nx[1] * 2.4);
          const b = B.P(hw[0] + dirv[0] * len - nx[0] * 2.4, hw[1], hw[2] + dirv[2] * len - nx[1] * 2.4);
          line(g, a, b, '#2f3338', 3.8);
          line(g, a, b, '#9aa2ab', 2.5);
        }
      });
      break;
    }
    case 'knife': case 'sword': {
      const len = tool === 'sword' ? 15 : 8;
      const base = B.P(hw[0] - dirv[0] * 1.5, hw[1], hw[2] - dirv[2] * 1.5);
      const tip = B.P(hw[0] + dirv[0] * len, hw[1], hw[2] + dirv[2] * len);
      W('t', (g) => {
        line(g, base, tip, '#20252b', tool === 'sword' ? 2.9 : 2.2);
        line(g, base, tip, '#d5dce4', tool === 'sword' ? 1.7 : 1.3);
        line(g, [base[0] - 0.2, base[1] - 0.4], [tip[0] - 0.2, tip[1] - 0.4], '#ffffff', 0.5);
        // guarda
        const nx = [-dirv[2], dirv[0]];
        const g1 = B.P(hw[0] + nx[0] * 2.8, hw[1], hw[2] + nx[1] * 2.8), g2 = B.P(hw[0] - nx[0] * 2.8, hw[1], hw[2] - nx[1] * 2.8);
        line(g, g1, g2, '#c9a24a', 1.6);
      });
      break;
    }
    case 'bow': {
      const draw = pose.idleBow ? 0 : pose.toolAng;
      const hl = pose.hLw;
      const grip = [hl[0], hl[1] - 0.2, hl[2]];
      const tipTop = B.P(grip[0] - 1.8, grip[1], grip[2] + 10.5), tipBot = B.P(grip[0] - 1.8, grip[1], grip[2] - 10.5);
      const belly = B.P(grip[0] + 3.2, grip[1], grip[2]);
      const nock = B.P(lerp(grip[0] - 1.8, pose.hRw[0], draw), pose.hRw[1] * 0.2 + grip[1] * 0.8, grip[2]);
      parts.add(depth + 0.04, (g) => {
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(tipTop[0], tipTop[1]); g.quadraticCurveTo(belly[0] + (belly[0] - tipTop[0]) * 0.1, belly[1] - 0.2, tipBot[0], tipBot[1]);
        g.strokeStyle = '#2b1a0e'; g.lineWidth = 3; g.stroke();
        g.strokeStyle = '#a06a34'; g.lineWidth = 1.8; g.stroke();
        g.beginPath(); g.moveTo(tipTop[0], tipTop[1]); g.lineTo(nock[0], nock[1]); g.lineTo(tipBot[0], tipBot[1]);
        g.strokeStyle = 'rgba(245,240,225,0.9)'; g.lineWidth = 0.55; g.stroke();
        if (!pose.idleBow && draw > 0.02) { // flecha encaixada
          const ah = B.P(grip[0] + 6, grip[1], grip[2]);
          line(g, nock, ah, '#d9c9a0', 0.9);
          line(g, ah, [ah[0] + (ah[0] - nock[0]) * 0.08, ah[1] + (ah[1] - nock[1]) * 0.08], '#9aa2ab', 1.4);
        }
      });
      break;
    }
  }
}

/* carga nas costas ------------------------------------------------------------------ */
function drawCarry(ctx, B, carry, parts, amt) {
  if (!carry) return;
  const c = B.P(-4.2, 0, 17.5);
  parts.add(c[2] - 0.2, (g) => {
    if (carry === 'wood') {
      for (let i = 0; i < 3; i++) {
        const a = B.P(-4.6, -3.5 + i * 3.5, 16 + (i === 1 ? 2.2 : 0)), b = B.P(-4.6, -3.5 + i * 3.5, 22 + (i === 1 ? 2.2 : 0));
        tube(g, a, b, 3.1, '#8b5e34');
        circle(g, b[0], b[1], 1.5, '#d8b07a', '#5a3a1c', 0.5);
      }
      const r1 = B.P(-4.9, 0, 18), r2 = B.P(-4.9, 0, 21);
      line(g, r1, r2, '#d8c9a0', 0.8);
    } else if (carry === 'food') {
      const p = B.P(-5.2, 0, 19);
      ellipse(g, p[0], p[1], 5.4, 4.7, '#7a5226');
      ellipse(g, p[0], p[1] - 0.4, 4.9, 4.1, '#a9783a');
      ellipse(g, p[0], p[1] - 2.2, 4.1, 2.2, '#c93b2c');
      circle(g, p[0] - 1.6, p[1] - 2.6, 1.0, '#ef6a52'); circle(g, p[0] + 1.4, p[1] - 2.4, 1.0, '#e84a3a'); circle(g, p[0], p[1] - 3.3, 1.0, '#f2c24b');
    } else if (carry === 'gold') {
      const p = B.P(-5, 0, 17.5);
      ellipse(g, p[0], p[1], 5.4, 5.2, '#7b6130');
      ellipse(g, p[0] - 0.4, p[1] - 0.4, 4.7, 4.5, '#a8883f');
      circle(g, p[0] - 1, p[1] - 3.2, 1.7, '#ffd34d', '#8a6a10', 0.5); circle(g, p[0] + 1.4, p[1] - 2.8, 1.5, '#ffe27a', '#8a6a10', 0.5);
    } else if (carry === 'stone') {
      const p = B.P(-5, 0, 17.5);
      ellipse(g, p[0], p[1], 5.4, 5.2, '#4e4a46');
      ellipse(g, p[0] - 0.4, p[1] - 0.4, 4.7, 4.5, '#6c6762');
      poly(g, [[p[0] - 3, p[1] - 2], [p[0], p[1] - 4.8], [p[0] + 3, p[1] - 2.4], [p[0] + 1, p[1] - 0.5]], '#9a968f', '#3c3936', 0.5);
    } else if (carry === 'meat') {
      const p = B.P(-5, 0, 18.5);
      ellipse(g, p[0], p[1], 5.6, 4.2, '#8e2b27');
      ellipse(g, p[0] - 0.5, p[1] - 0.6, 4.8, 3.3, '#cf4a42');
      circle(g, p[0] + 2.8, p[1] - 0.5, 1.5, '#f1e6d2', '#6a4a30', 0.5);
    }
  });
}

/* desenho completo de um humano ----------------------------------------------------- */
function drawHuman(ctx, o) {
  const B = makeBody(o.heading);
  const t = (o.ph || 0) * TAU;
  const tm = TEAM_COLORS[o.team];
  const S = HUMAN_STYLE[o.type];
  const pose = humanPose(o, t);
  const vr = o.v || 0;
  const hair = S.hair[vr % S.hair.length];
  const parts = new PartList();

  const hipZ = pose.hipZ - pose.crouch + pose.bob;
  const chestZ = hipZ + 9.2 - pose.crouch * 0.4;
  const leanA = pose.lean;
  const hip = B.P(0, 0, hipZ);
  const chest = B.P(leanA * 0.5, 0, chestZ);
  const headZ = chestZ + 6.8;
  const head = B.P(leanA, 0, headZ);

  // sombra
  shadowBlob(ctx, 11, 5.4, 0.34, 0.5, 0.5);

  // cores por tipo
  let tunic, tunicSleeve, legCol = S.pants;
  if (o.type === 'villager') { tunic = [tm.main[0], tm.main[1], tm.main[2]]; tunicSleeve = C.shade(tunic, 0.95); }
  else if (o.type === 'archer') { tunic = S.tunic; tunicSleeve = C.shade(S.tunic, 0.95); }
  else { tunic = S.mail; tunicSleeve = C.shade(S.mail, 0.95); }

  // pernas
  const mkLeg = (hipB, foot) => {
    const hp = B.P(0, hipB, hipZ - 0.5);
    const ft = B.P(foot[0], foot[1], foot[2] + 1.2);
    const kn = B.P(foot[0] * 0.5 + 2.4, hipB * 0.55 + foot[1] * 0.45, (hipZ + foot[2]) * 0.5 + 0.8);
    const d = (hp[2] + ft[2]) / 2;
    parts.add(d, (g) => {
      tube(g, hp, kn, 3.5, legCol);
      tube(g, kn, ft, 3.2, legCol);
      const toe = B.P(foot[0] + 2.4, foot[1], foot[2] + 0.9);
      tube(g, ft, toe, 3.6, S.boots);
      if (o.type === 'warrior') { // grevas
        tube(g, kn, ft, 3.0, '#6d737b');
      }
    });
  };
  mkLeg(2.4, pose.fL);
  mkLeg(-2.4, pose.fR);

  // tronco
  const torsoDepth = (hip[2] + chest[2]) / 2 + 0.01;
  parts.add(torsoDepth, (g) => {
    tube(g, hip, chest, 8.4, tunic);
    // cinto
    const b1 = B.P(leanA * 0.1, 0, hipZ + 1.4);
    const bl = B.P(0.2, 3.9, hipZ + 1.4), br = B.P(0.2, -3.9, hipZ + 1.4);
    line(g, bl, br, C.str(S.belt), 1.6, 'butt');
    circle(g, b1[0], b1[1] + 0.2, 0.9, '#c9a24a');
    if (o.type === 'warrior') {
      // tabardo da equipe sobre a cota de malha
      const tL = B.P(1.4 + leanA * 0.4, 0, chestZ - 1), tB = B.P(1.0, 0, hipZ - 1.2);
      if (B.facing > -0.3) tube(g, B.P(4.0 + leanA * 0.4, 0, chestZ - 0.5), B.P(4.2, 0, hipZ + 0.2), 4.4, tm.main);
      if (B.facing < 0.3) tube(g, B.P(-3.8 + leanA * 0.4, 0, chestZ - 0.5), B.P(-4.0, 0, hipZ + 0.2), 4.4, tm.main);
      // ombreiras
      const sl = B.P(leanA * 0.5, 4.8, chestZ + 1.8), sr = B.P(leanA * 0.5, -4.8, chestZ + 1.8);
      circle(g, sl[0], sl[1], 2.8, '#9ba3ac', '#3a3f46', 0.6);
      circle(g, sr[0], sr[1], 2.8, '#9ba3ac', '#3a3f46', 0.6);
    } else if (o.type === 'archer') {
      // capuz/cachecol da equipe
      const nk = B.P(leanA * 0.7, 0, chestZ + 2.6);
      tube(g, B.P(leanA * 0.6 - 0.5, 3, chestZ + 2.3), B.P(leanA * 0.6 - 0.5, -3, chestZ + 2.3), 3, tm.main);
    } else {
      // avental / detalhe da equipe na bainha
      const hm = B.P(0, 0, hipZ + 0.2);
      line(g, B.P(0, 4, hipZ + 0.2), B.P(0, -4, hipZ + 0.2), C.str(tm.dark), 1.3, 'butt');
    }
  });

  // aljava do arqueiro
  if (o.type === 'archer') {
    const q1 = B.P(-4.6 + leanA * 0.3, -1.5, chestZ - 2), q2 = B.P(-6.2 + leanA * 0.3, -1.5, chestZ + 5);
    parts.add((q1[2] + q2[2]) / 2 - 0.15, (g) => {
      tube(g, q1, q2, 3.6, '#6b4423');
      for (let i = 0; i < 3; i++) {
        const f = B.P(-6.4 + i * 0.6 + leanA * 0.3, -1.5 + (i - 1) * 0.9, chestZ + 6.2 + i * 0.4);
        circle(g, f[0], f[1], 0.85, C.str(tm.light), '#2a2a2a', 0.3);
      }
    });
  }

  // cabeça
  const headDepth = head[2] + 0.4;
  parts.add(headDepth, (g) => {
    const facingCam = B.facing > 0;
    const r = 4.5;
    if (o.type === 'warrior') {
      // cabeça + elmo
      circle(g, head[0], head[1], r, C.str(S.skin), '#3a2a1c', 0.6);
      if (facingCam) {
        const e1 = B.P(leanA + 3.4, 1.8, headZ + 0.4), e2 = B.P(leanA + 3.4, -1.8, headZ + 0.4);
        circle(g, e1[0], e1[1], 0.55, '#2a2018'); circle(g, e2[0], e2[1], 0.55, '#2a2018');
      }
      const hc = [head[0], head[1] - 1.1];
      g.beginPath(); g.arc(hc[0], hc[1], r + 0.9, Math.PI, TAU); g.lineTo(hc[0] + r + 0.9, hc[1] + 1.4); g.lineTo(hc[0] - r - 0.9, hc[1] + 1.4); g.closePath();
      const hg = g.createLinearGradient(hc[0] - r, 0, hc[0] + r, 0);
      hg.addColorStop(0, '#d5dbe2'); hg.addColorStop(0.5, '#9aa3ad'); hg.addColorStop(1, '#5d646d');
      g.fillStyle = hg; g.fill(); g.strokeStyle = '#2f343a'; g.lineWidth = 0.8; g.stroke();
      line(g, [hc[0] - r - 0.6, hc[1] + 1.3], [hc[0] + r + 0.6, hc[1] + 1.3], '#c9a24a', 1);
      // cimeira da equipe
      const pl1 = B.P(leanA - 0.5, 0, headZ + 4.4), pl2 = B.P(leanA - 5.5, 0, headZ + 2.4);
      g.beginPath(); g.moveTo(pl1[0], pl1[1]); g.quadraticCurveTo((pl1[0] + pl2[0]) / 2, pl1[1] - 4.2, pl2[0], pl2[1]);
      g.strokeStyle = C.str(tm.dark); g.lineWidth = 3.2; g.lineCap = 'round'; g.stroke();
      g.strokeStyle = C.str(tm.main); g.lineWidth = 2.1; g.stroke();
    } else {
      // cabelo atrás
      circle(g, head[0] - (facingCam ? 0 : 0), head[1] - 0.5, r + 0.45, hair);
      if (facingCam || B.facing > -0.55) circle(g, head[0], head[1] + 0.4, r - 0.15, C.str(S.skin), '#3a2a1c', 0.5);
      if (facingCam) {
        const e1 = B.P(leanA + 3.5, 1.9, headZ + 0.5), e2 = B.P(leanA + 3.5, -1.9, headZ + 0.5);
        circle(g, e1[0], e1[1], 0.55, '#2a2018'); circle(g, e2[0], e2[1], 0.55, '#2a2018');
        // franja
        g.beginPath(); g.arc(head[0], head[1] - 0.8, r + 0.3, Math.PI * 1.05, Math.PI * 1.95);
        g.strokeStyle = hair; g.lineWidth = 2.2; g.lineCap = 'round'; g.stroke();
      } else if (B.facing < -0.55) {
        circle(g, head[0], head[1] - 0.2, r + 0.1, hair);
      } else {
        g.beginPath(); g.arc(head[0], head[1] - 0.6, r + 0.2, Math.PI * 0.95, Math.PI * 2.05);
        g.strokeStyle = hair; g.lineWidth = 2.6; g.lineCap = 'round'; g.stroke();
      }
      if (o.type === 'archer') { // gorro de caça com pena
        const hc = [head[0], head[1] - 1.8];
        g.beginPath(); g.arc(hc[0], hc[1], r + 0.7, Math.PI * 0.95, TAU * 1.0 + 0.05); g.lineTo(hc[0], hc[1] + 1); g.closePath();
        g.fillStyle = C.str(C.shade(S.tunic, 0.85)); g.fill(); g.strokeStyle = '#1f2a14'; g.lineWidth = 0.7; g.stroke();
        const fe1 = B.P(leanA - 1, 2, headZ + 4), fe2 = B.P(leanA - 4, 3, headZ + 8);
        line(g, fe1, fe2, C.str(tm.light), 1.7);
      } else if (o.type === 'villager' && (vr === 1 || vr === 3)) { // chapéu de palha
        const hc = [head[0], head[1] - 2.4];
        ellipse(g, hc[0], hc[1] + 1.4, r + 2.4, 2.1, '#d9b75e');
        g.beginPath(); g.arc(hc[0], hc[1] + 0.8, r - 0.3, Math.PI, TAU); g.fillStyle = '#e8c870'; g.fill();
        line(g, [hc[0] - r + 0.6, hc[1] + 0.5], [hc[0] + r - 0.6, hc[1] + 0.5], C.str(tm.main), 1.2, 'butt');
      }
    }
  });

  // braços
  const sh = (b) => B.P(leanA * 0.5, b, chestZ + 1.2);
  const hRw = pose.hR, hLw = pose.hL;
  pose.hRw = hRw; pose.hLw = hLw;
  const mkArm = (b, hw) => {
    const s = sh(b), h = B.P(hw[0], hw[1], hw[2]);
    const el = B.P((leanA * 0.5 + hw[0]) * 0.5 - 1.0, b * 1.12 + (hw[1] - b) * 0.45, (chestZ + 1.2 + hw[2]) * 0.5 - 1.2);
    const d = (s[2] + h[2]) / 2;
    parts.add(d + 0.02, (g) => {
      tube(g, s, el, 3.3, tunicSleeve);
      tube(g, el, h, 2.8, o.type === 'warrior' ? '#8d949c' : S.skin);
      circle(g, h[0], h[1], 1.6, C.str(S.skin), '#3a2a1c', 0.4);
    });
    return h;
  };
  const hR = mkArm(-4.8, hRw);
  const hL = mkArm(4.8, hLw);

  // escudo do guerreiro (braço esquerdo)
  if (o.type === 'warrior') {
    const sc = [hLw[0] + 1.5, hLw[1] + 2, hLw[2] + 0.5];
    const pts = [];
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      pts.push(B.P(sc[0] + Math.cos(a) * 1.0, sc[1] + 1.5, sc[2] + Math.sin(a) * 7.2 + (Math.cos(a) < 0 ? 0 : 0)));
    }
    // disco no plano a-z deslocado para a esquerda do corpo (plano perpendicular a b)
    const pts2 = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      pts2.push(B.P(sc[0] + Math.cos(a) * 5.2, sc[1] + 1.5, sc[2] + Math.sin(a) * 6.6));
    }
    const sd = B.P(sc[0], sc[1] + 1.5, sc[2])[2];
    parts.add(sd + 0.08, (g) => {
      poly(g, pts2, C.str(tm.main), C.str(tm.dark), 1.0);
      const inner = [];
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU; inner.push(B.P(sc[0] + Math.cos(a) * 3.2, sc[1] + 1.8, sc[2] + Math.sin(a) * 4.0)); }
      poly(g, inner, C.str(tm.light, 0.5), null);
      const c = B.P(sc[0], sc[1] + 1.8, sc[2]);
      circle(g, c[0], c[1], 1.4, '#c9a24a', '#5a4410', 0.4);
      g.beginPath(); g.moveTo(pts2[0][0], pts2[0][1]);
      for (let i = 1; i < n; i++) g.lineTo(pts2[i][0], pts2[i][1]);
      g.closePath(); g.strokeStyle = '#b8bec6'; g.lineWidth = 0.9; g.stroke();
    });
  }

  // ferramenta
  drawTool(ctx, B, o, pose, [0, 0, hRw ? B.P(hRw[0], hRw[1], hRw[2])[2] : 0], null, parts);

  // carga
  const carryable = o.carry && (o.anim === 'idle' || o.anim === 'walk');
  if (carryable) drawCarry(ctx, B, o.carry, parts);

  parts.run(ctx);
}

/* ---------- cache de quadros ---------- */
const HumanSprites = {
  cache: new Map(),
  key(o, dir, frame) { return `${o.type}|${o.team}|${o.v | 0}|${dir}|${o.anim}|${frame}|${o.carry || ''}`; },
  get(type, team, v, dir, anim, frame, carry) {
    const k = `${type}|${team}|${v}|${dir}|${anim}|${frame}|${carry || ''}`;
    let s = this.cache.get(k);
    if (s) return s;
    const n = ANIM_FRAMES[anim] || 1;
    const heading = (dir / 8) * TAU;
    const o = { type, team, v, heading, anim: anim === 'dead' ? 'idle' : anim, ph: frame / n, carry };
    if (anim === 'dead') {
      // desenha em pé e tomba
      const base = bake(80, 80, 40, 56, (ctx) => drawHuman(ctx, o));
      const prog = frame / (n - 1);
      s = bake(80, 80, 40, 56, (ctx) => {
        ctx.save();
        const side = (Math.cos(heading) - Math.sin(heading)) >= 0 ? 1 : -1;
        const ang = prog * (Math.PI * 0.48) * side;
        ctx.rotate(ang);
        ctx.translate(0, prog * 1.5);
        ctx.scale(1, 1 - prog * 0.12);
        ctx.drawImage(base.cv, -40, -56, 80, 80);
        ctx.restore();
      });
    } else {
      s = bake(80, 80, 40, 56, (ctx) => drawHuman(ctx, o));
    }
    this.cache.set(k, s);
    return s;
  },
};
