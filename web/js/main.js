'use strict';
/* ================================================================
   Season Runner — bootstrap & main loop

   Black-screen hardening (v1.0.2):
   • resize() never produces a 0×0 canvas (a 0-sized canvas is invisible
     and shows the page background = the "black screen" users reported).
   • viewport size is re-checked several times after boot and on every
     orientation / visibility change, because Android WebView often reports
     0 or stale dimensions until the first layout settles.
   • the loop never dies silently: exceptions are counted and, if they
     persist, a recovery overlay is shown instead of a dead black canvas.
   • a watchdog re-runs resize() + render() if frames stop arriving while
     the page is visible (GPU/WebView compositing stall).
================================================================ */
(function () {
  const W = SR.game.W, H = SR.game.H;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  /* ---------- viewport / canvas sizing ---------- */
  function viewport() {
    const de = document.documentElement;
    const vw = (de && de.clientWidth) || window.innerWidth || 0;
    const vh = (de && de.clientHeight) || window.innerHeight || 0;
    return [vw, vh];
  }

  function resize() {
    try {
      let [vw, vh] = viewport();
      // WebView may still be laying out — fall back to the design size
      // instead of collapsing the canvas to 0×0.
      if (!vw || !vh) { vw = vw || W; vh = vh || H; }
      const scale = Math.min(vw / W, vh / H);
      if (!isFinite(scale) || scale <= 0) return false;

      const w = Math.max(1, Math.floor(W * scale));
      const h = Math.max(1, Math.floor(H * scale));
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      const bw = Math.max(1, Math.floor(W * dpr));
      const bh = Math.max(1, Math.floor(H * dpr));
      if (canvas.width !== bw || canvas.height !== bh || !resize._tf) {
        canvas.width = bw;
        canvas.height = bh;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      resize._tf = true;
      return true;
    } catch (e) {
      SR.reportError && SR.reportError('resize', e);
      return false;
    }
  }

  function drawMenuNuro() {
    const cv = document.getElementById('menu-nuro');
    if (cv && SR.ui && SR.ui.drawNuroPreview) SR.ui.drawNuroPreview(cv, SR.skin().glow, SR.skin().body, 86);
  }
  // update menu nuro whenever the menu is shown
  const origShowScreen = SR.ui.showScreen;
  SR.ui.showScreen = function (name) {
    origShowScreen(name);
    if (name === 'menu') drawMenuNuro();
  };

  /* ---------- main loop ---------- */
  let last = 0;
  let lastFrameTs = 0;
  let loopErrors = 0;
  let running = true;

  function loop(ts) {
    if (!running) return;
    requestAnimationFrame(loop);
    let dt = (ts - last) / 1000;
    last = ts;
    if (!(dt > 0)) dt = 1 / 60;
    if (dt > 0.05) dt = 0.05;         // a long stall (backgrounded tab) must not teleport the world
    lastFrameTs = ts;
    try {
      SR.game.update(dt);
      SR.ui.tick(dt);
      SR.game.render();
    } catch (e) {
      loopErrors++;
      SR.reportError('loop', e, loopErrors);
      if (loopErrors >= 6) {
        running = false;
        SR.ui.showFatal(SR.t('fatal.msg'), String((e && e.message) || e));
      }
    }
  }

  /* ---------- watchdog: did frames stop while we're visible? ---------- */
  function startWatchdog() {
    setInterval(() => {
      if (!running) return;
      if (document.hidden) return;                 // rAF is legitimately paused
      const since = performance.now() - lastFrameTs;
      if (since > 2500) {
        resize();                                  // most common cause: 0×0 canvas
        try { SR.game.render(); } catch (e) {}
      }
      if (since > 9000) {
        running = false;
        SR.ui.showFatal(SR.t('fatal.msg'), 'no frames for ' + Math.round(since) + 'ms');
      }
    }, 1000);
  }

  function bindRecoveryUI() {
    const retry = document.getElementById('btn-fatal-retry');
    const menu = document.getElementById('btn-fatal-menu');
    const recover = () => {
      SR.ui.hideFatal();
      loopErrors = 0;
      resize();
      try { SR.game.exitToMenu(); } catch (e) {}
      try { SR.ui.showScreen('menu'); } catch (e) {}
      last = performance.now();
      lastFrameTs = performance.now();
      if (!running) { running = true; requestAnimationFrame(loop); }
    };
    if (retry) retry.addEventListener('click', () => { SR.audio.play('click'); recover(); });
    if (menu) menu.addEventListener('click', () => { SR.audio.play('click'); recover(); });
  }

  /* ---------- boot ---------- */
  function boot() {
    resize();
    // WebView layout settles late: re-measure a few times.
    [0, 120, 350, 900, 2000].forEach(ms => setTimeout(resize, ms));
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 250));
    window.addEventListener('pageshow', resize);
    window.addEventListener('load', resize);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        last = performance.now();
        lastFrameTs = performance.now();
        resize();
      }
    });
    if (window.ResizeObserver) {
      try { new ResizeObserver(resize).observe(document.documentElement); } catch (e) {}
    }

    // 2D canvas context can be lost on low-memory Android devices
    canvas.addEventListener('contextlost', e => {
      try { e.preventDefault(); } catch (_) {}
      resize._tf = false;
    });
    canvas.addEventListener('contextrestored', () => { resize._tf = false; resize(); });

    SR.game.init(canvas);
    SR.input.init(canvas);
    SR.ui.init();
    bindRecoveryUI();
    drawMenuNuro();
    last = performance.now();
    lastFrameTs = last;
    requestAnimationFrame(loop);
    startWatchdog();

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    document.fonts && document.fonts.load('900 20px Cairo').then(() => {}).catch(() => {});
  }

  window.addEventListener('error', e => SR.reportError && SR.reportError('window', e.error || e.message));
  window.addEventListener('unhandledrejection', e => SR.reportError && SR.reportError('promise', e.reason));

  function safeBoot() {
    try {
      boot();
    } catch (e) {
      SR.reportError && SR.reportError('boot', e);
      try { SR.ui.showFatal(SR.t('fatal.msg'), String((e && e.message) || e)); } catch (_) {}
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeBoot);
  else safeBoot();
})();
