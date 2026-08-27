'use strict';
/* ================================================================
   Season Runner — bootstrap & main loop
================================================================ */
(function () {
  const W = SR.game.W, H = SR.game.H;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.min(vw / W, vh / H);
    const w = Math.floor(W * scale), h = Math.floor(H * scale);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

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

  let last = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    let dt = (ts - last) / 1000;
    last = ts;
    if (dt > 0.05) dt = 0.05;
    if (dt <= 0) return;
    SR.game.update(dt);
    SR.ui.tick(dt);
    SR.game.render();
  }

  function boot() {
    resize();
    SR.game.init(canvas);
    SR.input.init(canvas);
    SR.ui.init();
    drawMenuNuro();
    requestAnimationFrame(loop);
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    document.fonts && document.fonts.load('900 20px Cairo').then(() => {}).catch(() => {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
