'use strict';
/* ================================================================
   Season Runner — FX: particles, floating text, shake, transitions
================================================================ */
SR.fx = (() => {
  const parts = [];
  const texts = [];
  let trauma = 0, hitstopT = 0;
  const MAXP = 420;

  function spawn(p) {
    if (parts.length >= MAXP) parts.shift();
    parts.push(p);
  }

  function burst(x, y, colors, n, spd, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = U.rand(spd * 0.25, spd);
      spawn({
        x, y, vx: Math.cos(a) * v + (opts.vx || 0), vy: Math.sin(a) * v + (opts.vy || 0),
        life: 0, maxLife: U.rand(0.35, 0.9), size: U.rand(2, opts.size || 6),
        color: colors[Math.floor(Math.random() * colors.length)],
        grav: opts.grav === undefined ? 500 : opts.grav, drag: opts.drag === undefined ? 1.6 : opts.drag,
        kind: 'dot',
      });
    }
  }

  function puff(x, y, color, n = 8, size = 7) {
    for (let i = 0; i < n; i++) {
      spawn({
        x: x + U.rand(-6, 6), y: y + U.rand(-4, 4),
        vx: U.rand(-40, 40), vy: U.rand(-70, -15),
        life: 0, maxLife: U.rand(0.3, 0.7), size: U.rand(size * 0.5, size),
        color, grav: -60, drag: 2.4, kind: 'dot', fadeIn: 0.06,
      });
    }
  }

  function ring(x, y, color, maxR = 60, dur = 0.45) {
    spawn({ x, y, life: 0, maxLife: dur, size: 6, color, kind: 'ring', maxR, grav: 0, drag: 0 });
  }

  function sparkle(x, y, color, n = 4) {
    for (let i = 0; i < n; i++) {
      spawn({
        x: x + U.rand(-10, 10), y: y + U.rand(-10, 10),
        vx: U.rand(-30, 30), vy: U.rand(-60, -10),
        life: 0, maxLife: U.rand(0.4, 0.8), size: U.rand(2, 4.5),
        color, grav: -100, drag: 1.2, kind: 'star', tw: U.rand(6, 14),
      });
    }
  }

  function confetti(x, y, colors, n = 40) {
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, Math.PI * 2);
      const v = U.rand(120, 380);
      spawn({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 150,
        life: 0, maxLife: U.rand(0.7, 1.4), size: U.rand(3, 7),
        color: colors[Math.floor(Math.random() * colors.length)],
        grav: 700, drag: 1.2, kind: 'rect', rot: U.rand(0, 6.28), vr: U.rand(-9, 9),
      });
    }
  }

  function text(x, y, str, color = '#fff', size = 22, life = 0.9) {
    texts.push({ x, y, str, color, size, life: 0, maxLife: life });
  }

  function shake(amount) { trauma = Math.min(1, trauma + amount); }
  function hitstop(t) { hitstopT = Math.max(hitstopT, t); }
  function update(dt) {
    hitstopT = Math.max(0, hitstopT - dt);
    trauma = Math.max(0, trauma - dt * 1.8);
    updateTrans(dt);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.maxLife) { parts.splice(i, 1); continue; }
      p.vx -= p.vx * p.drag * dt;
      p.vy += p.grav * dt - p.vy * p.drag * dt * 0.4;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.rot !== undefined) p.rot += p.vr * dt;
    }
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      t.life += dt;
      t.y -= 42 * dt;
      if (t.life >= t.maxLife) texts.splice(i, 1);
    }
  }

  function draw(ctx) {
    for (const p of parts) {
      const t = p.life / p.maxLife;
      const a = p.fadeIn && t < p.fadeIn ? t / p.fadeIn : (1 - t);
      ctx.globalAlpha = Math.max(0, a) * 0.95;
      ctx.fillStyle = p.color;
      if (p.kind === 'dot') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.4), 0, 6.283);
        ctx.fill();
      } else if (p.kind === 'rect') {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        ctx.restore();
      } else if (p.kind === 'star') {
        ctx.save();
        ctx.translate(p.x, p.y);
        const s = p.size * (0.5 + 0.5 * Math.sin(p.life * p.tw));
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.moveTo(0, 0); ctx.lineTo(s, -s * 0.3); ctx.lineTo(s * 2, 0); ctx.lineTo(s, s * 0.3);
        }
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * (1 - t);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.maxR * U.smooth(t), 0, 6.283);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    for (const t of texts) {
      const tt = t.life / t.maxLife;
      ctx.globalAlpha = tt < 0.15 ? tt / 0.15 : (tt > 0.6 ? 1 - (tt - 0.6) / 0.4 : 1);
      ctx.font = `900 ${t.size}px Cairo, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function shakeOffset() {
    if (trauma <= 0) return [0, 0];
    const t = trauma * trauma;
    return [Math.sin(performance.now() * 0.09) * 14 * t, Math.cos(performance.now() * 0.083) * 10 * t];
  }
  function isHitstop() { return hitstopT > 0; }

  /* ---------- season transition overlay ---------- */
  let transEl = null;
  let trans = null;              // { t, midAt, dur, midCalled, mid, done }
  function ensureEl() {
    if (transEl) return transEl;
    transEl = document.getElementById('transition');
    return transEl;
  }
  /* Game-time driven (deterministic): fx.update(dt) advances the wipe.
     mid() fires at the visual midpoint, done() when the wipe is over. */
  function transition(mid, done) {
    const el = ensureEl();
    el.innerHTML = '<div class="rip-in"></div><div class="rip-out"></div>';
    el.classList.remove('hidden'); el.classList.add('rip');
    trans = { t: 0, midAt: 0.42, dur: 1.1, midCalled: false, mid, done };
  }
  function updateTrans(dt) {
    if (!trans) return;
    trans.t += dt;
    if (!trans.midCalled && trans.t >= trans.midAt) {
      trans.midCalled = true;
      if (trans.mid) trans.mid();
    }
    if (trans.t >= trans.dur) {
      const el = ensureEl();
      el.classList.remove('rip');
      el.classList.add('hidden');
      el.innerHTML = '';
      const done = trans.done;
      trans = null;
      if (done) done();
    }
  }

  return { burst, puff, ring, sparkle, confetti, text, shake, hitstop, update, draw, shakeOffset, isHitstop, transition, updateTrans, spawn };
})();
