'use strict';
/* ============================================================
   AGEZIM — arranque, laço principal e telas
   ============================================================ */

(function () {
  const params = new URLSearchParams(location.search);
  const state = { running: false, endShown: false, last: performance.now(), booted: false, booting: false };
  const canvas = $('view');

  const setLoad = (p, text) => {
    $('loadFill').style.width = Math.round(clamp(p, 0, 1) * 100) + '%';
    if (text) $('loadText').textContent = text;
  };

  async function boot(seed, aiOn) {
    if (state.booting) return;
    state.booting = true;
    $('startOpts').classList.add('hidden');
    $('loadWrap').classList.remove('hidden');
    Sfx.init();                                  // o clique do jogador libera o áudio
    setLoad(0.02, 'Gerando a ilha…');
    await yieldFrame();
    const map = new GameMap(seed);
    setLoad(0.06, 'Pintando o terreno…');
    await map.bakeTerrain((p) => setLoad(0.06 + p * 0.74, 'Pintando o terreno…'));
    setLoad(0.82, 'Preparando o mundo…');
    await yieldFrame();

    Render.init(canvas);
    G.init(map, { ai: aiOn });
    G.ai = new AI(1);
    FX.reset();
    UI.init();
    Input.init(canvas);
    UI.bakeMinimap();

    // câmera no início do jogador
    const s = map.starts[0];
    Cam.zoom = clamp(Math.min(Cam.H / 760, Cam.W / 640), 0.75, 1.35);
    Cam.centerOn(s.x, s.y + 1.5);

    // pré-aquece sprites comuns
    setLoad(0.86, 'Treinando aldeões…');
    await yieldFrame();
    const types = ['villager', 'archer', 'warrior'];
    let n = 0;
    for (const t of types) for (const team of [0, 1]) for (let d = 0; d < 8; d++) {
      HumanSprites.get(t, team, 0, d, 'idle', 0, null);
      for (let f = 0; f < 8; f += 2) HumanSprites.get(t, team, 0, d, 'walk', f, null);
      if (++n % 6 === 0) { setLoad(0.86 + 0.1 * (n / 48), 'Treinando aldeões…'); await yieldFrame(); }
    }
    for (const t of ['cow', 'horse', 'chicken', 'rabbit']) for (let d = 0; d < 8; d++) { AnimalSprites.get(t, 0, d, 'idle', 0); AnimalSprites.get(t, 0, d, 'walk', 0); }
    for (const b in BUILD_DEFS) for (const team of [0, 1]) { if (b === 'wall' || b === 'gate' || b === 'farm') continue; Buildings.get(b, team); }
    setLoad(1, 'Pronto!');
    state.booted = true;
    state.last = performance.now();
    requestAnimationFrame(frame);
    startGame();
  }

  function startGame() {
    if (state.running) return;
    $('start').classList.remove('on');
    state.running = true;
    state.last = performance.now();
    G.toast('Selecione seus aldeões e comece a coletar!', 'info');
    if (IS_TOUCH && innerHeight > innerWidth) setTimeout(() => G.toast('Dica: gire o aparelho para a horizontal', 'warn'), 1800);
  }

  function restart(seed) {
    const p = new URLSearchParams(location.search);
    p.set('seed', seed || Math.floor(Math.random() * 99999) + 1);
    p.set('auto', '1');
    if (!G.aiOn && G.ai) { /* mantém a escolha anterior */ }
    location.search = p.toString();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;
    if (!state.booted) return;
    if (state.running) {
      Input.update(dt);
      G.update(dt * G.speed);
    }
    UI.update(dt);
    Render.draw(now / 1000, UI);
    if (G.over && !state.endShown) {
      state.endShown = true; UI.showEnd(G.over.win);
      Sfx.play(G.over.win ? 'built' : 'alert');
    }
  }

  /* ---------- telas ---------- */
  const optSeed = $('optSeed');
  optSeed.value = +(params.get('seed') || Math.floor(Math.random() * 99999) + 1);
  $('optAI').checked = params.get('ia') !== '0' && params.get('ai') !== '0';
  $('btnRand').addEventListener('click', () => { optSeed.value = Math.floor(Math.random() * 99999) + 1; });
  $('btnStart').addEventListener('click', () => boot(Math.max(1, +optSeed.value || 1), $('optAI').checked));
  window.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !state.booting && e.target === document.body) $('btnStart').click(); });
  $('pResume').addEventListener('click', () => UI.togglePause(false));
  $('pHelp').addEventListener('click', () => UI.toggleHelp(true));
  $('pRestart').addEventListener('click', () => restart());
  $('eAgain').addEventListener('click', () => restart());
  $('eLook').addEventListener('click', () => { $('end').classList.remove('on'); G.over = null; G.aiOn = false; state.endShown = true; });
  window.addEventListener('resize', () => { if (Render.cv && state.booted) Render.resize(); });

  /* ---------- toque / tela cheia ---------- */
  if (IS_TOUCH) document.body.classList.add('touch');
  const fsEl = document.documentElement;
  if (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen) document.body.classList.add('canfs');
  const toggleFull = () => {
    const on = document.fullscreenElement || document.webkitFullscreenElement;
    if (on) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    const p = (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl);
    const lock = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (_) {} };
    if (p && p.then) p.then(lock).catch(() => {}); else lock();
  };
  $('btnFull').addEventListener('click', toggleFull);
  $('pFull').addEventListener('click', toggleFull);
  $('pSound').addEventListener('click', () => { Sfx.init(); const on = Sfx.toggle(); $('pSound').textContent = 'Som: ' + (on ? 'ligado' : 'desligado'); });
  window.addEventListener('orientationchange', () => setTimeout(() => { if (Render.cv && state.booted) Render.resize(); }, 250));

  // utilitário de desenvolvimento: grava o canvas em arquivo via devserver (POST /save)
  window.snap = async (name = 'snap', which = 'view') => {
    const cv = which === 'mini' ? $('mini') : canvas;
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    await fetch('/save?name=' + name + '.png', { method: 'POST', body: blob });
    return blob.size;
  };

  if (params.get('auto') === '1') boot(Math.max(1, +optSeed.value || 1), $('optAI').checked);
})();
