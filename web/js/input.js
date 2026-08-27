'use strict';
/* ================================================================
   Season Runner — input: touch + keyboard
   tap = jump | tap mid-air = double jump | swipe down = slide
   swipe up while sliding = stand | hold = dash
================================================================ */
SR.input = (() => {
  let canvas = null;
  const state = {
    px0: 0, py0: 0, t0: 0, active: false, moved: false,
    swipeDir: null, holdT: 0, didAction: false,
  };

  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    const scX = SR.game.W / r.width, scY = SR.game.H / r.height;
    return [(e.clientX - r.left) * scX, (e.clientY - r.top) * scY];
  }

  function onDown(e) {
    e.preventDefault();
    if (e.target && e.target.closest('button, .btn, select')) return;
    SR.audio.init();
    SR.audio.unlock();
    const [x, y] = toLogical(e);
    state.px0 = x; state.py0 = y; state.t0 = performance.now();
    state.active = true; state.moved = false; state.swipeDir = null; state.holdT = 0; state.didAction = false;
  }

  function onMove(e) {
    if (!state.active) return;
    e.preventDefault();
    const [x, y] = toLogical(e);
    const dx = x - state.px0, dy = y - state.py0;
    const t = performance.now() - state.t0;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) state.moved = true;

    if (!state.didAction && t < 320 && Math.abs(dy) > 42 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      state.didAction = true;
      state.swipeDir = dy > 0 ? 'down' : 'up';
      const g = SR.game.S;
      if (state.swipeDir === 'down') {
        if (g.state === 'menu') { SR.game.start(); return; }
        if (g.state === 'running') {
          if (!g.player.airborne) g.player.slide();
          else g.player.slide(); // dive
        }
      } else {
        g.player.stand();
      }
      return;
    }

    // long press → dash
    if (!state.didAction && !state.moved && t > 360) {
      state.didAction = true;
      const g = SR.game.S;
      if (g.state === 'running' && !g.attract) g.player.dash();
    }
  }

  function onUp(e) {
    if (!state.active) return;
    e.preventDefault();
    const t = performance.now() - state.t0;
    const g = SR.game.S;
    if (!state.didAction && !state.moved && t < 280) {
      // tap!
      state.didAction = true;
      if (g.state === 'menu') { SR.game.start(); }
      else if (g.state === 'running' || g.state === 'countdown') {
        if (g.attract) return;
        g.player.jump();
      }
    }
    state.active = false;
  }

  function onKey(e) {
    const g = SR.game.S;
    const k = e.key;
    if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') {
      e.preventDefault();
      if (g.state === 'menu') SR.game.start();
      else if (g.state === 'running' && !g.attract) g.player.jump();
      else if (g.state === 'paused') SR.game.resume();
      else if (g.state === 'dead') { /* ignore */ }
    } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
      e.preventDefault();
      if (g.state === 'running') g.player.slide();
    } else if (k === 'd' || k === 'D' || k === 'Shift') {
      if (g.state === 'running') g.player.dash();
    } else if (k === 'p' || k === 'P' || k === 'Escape') {
      if (g.state === 'running') { SR.game.pause(); SR.ui.showScreen('pause'); }
      else if (g.state === 'paused') { SR.ui.closeScreens(); SR.game.resume(); }
    } else if (k === 'r' || k === 'R') {
      if (g.state === 'dead' || g.state === 'paused') SR.game.restart();
    }
  }

  function init(cv) {
    canvas = cv;
    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointermove', onMove, { passive: false });
    canvas.addEventListener('pointerup', onUp, { passive: false });
    canvas.addEventListener('pointercancel', () => { state.active = false; }, { passive: false });
    canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', onKey);
  }

  return { init };
})();
