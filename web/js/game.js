'use strict';
/* ================================================================
   Season Runner — core game engine
================================================================ */
SR.game = (() => {
  const W = 960, H = 540, BASEY = 430;
  const SEASON_DUR = 40;
  const BASE_SPEED = 330;

  const S = {
    canvas: null, ctx: null,
    state: 'menu',          // menu | countdown | running | paused | dying | dead
    attract: true,          // menu attract mode
    timeScale: 1,
    t: 0,

    distPx: 0, distM: 0,
    leaves: 0, gems: 0, bonus: 0,
    combo: 1, comboT: 0,

    speed: 330,
    baseSpeed: BASE_SPEED,

    seasonIdx: 0, season: SR.SEASONS[0],
    rotation: [0],
    seasonTimer: SEASON_DUR,
    seasonDur: SEASON_DUR,
    palFrom: null, palTo: null, palT: 1,

    freezeT: 0, lockT: 0,
    slowDebuffT: 0,

    obstacles: [], pickups: [], decos: [],
    spawnX: 0, noObstacleUntil: 0,
    nextPowerAt: 0, nextGemAt: 0, nextStormAt: 0,
    stormT: 0, stormType: null,

    player: null,
    countdownT: 0, countdownStep: -1,
    flash: 0,
    deathT: 0,
    revived: false,
    runCount: 0,
    lastObKind: null,
    attractT: 0,
    elapsedRun: 0,
    runBest: { dist: 0, score: 0 },
  };

  function paletteOf(season) {
    return {
      skyTop: season.skyTop, skyMid: season.skyMid, skyBottom: season.skyBottom,
      mountFar: season.mountFar, mountMid: season.mountMid,
      groundTop: season.groundTop, groundDeep: season.groundDeep, groundEdge: season.groundEdge,
      tileColor: season.tileColor, sunColor: season.sun.color,
      accent: season.color,
    };
  }

  /* ---------- init ---------- */
  function init(canvas) {
    S.canvas = canvas;
    S.ctx = canvas.getContext('2d');
    S.baseY = BASEY;
    S.W = W;
    S.H = H;
    S.hitPlayer = hitPlayer;
    S.damagePlayer = damagePlayer;
    S.player = new SR.player(S);
    S.palFrom = paletteOf(S.season);
    S.palTo = paletteOf(S.season);
    S.palT = 1;
    resetWorld();
    buildDecos();
  }

  function resetWorld() {
    S.distPx = 0; S.distM = 0;
    S.timeScale = 1;
    S.leaves = 0; S.gems = 0; S.bonus = 0;
    S.combo = 1; S.comboT = 0;
    S.obstacles.length = 0;
    S.pickups.length = 0;
    S.freezeT = 0; S.lockT = 0; S.slowDebuffT = 0;
    S.stormT = 0; S.flash = 0; S.deathT = 0;
    S.spawnX = 700;
    S.nextPowerAt = 900;
    S.nextStormAt = 2400;
    S.revived = false;
    S.elapsedRun = 0;
    S.countdownT = 0; S.countdownStep = -1;
    S.player.reset();
    S.player.x = 210;
  }

  /* ---------- flow control ---------- */
  function refreshRotation() {
    const n = SR.unlockedSeasons(SR.save.progress);
    S.rotation = [0, 1, 2, 3].slice(0, n);
    if (S.rotation.indexOf(S.seasonIdx) === -1) S.seasonIdx = 0;
  }

  /* ---------- run start ----------
     Everything risky (audio, DOM) is wrapped so a single failure can never
     leave the game stuck on an empty "countdown" screen. The countdown itself
     is driven by game time (see update()), not by setTimeout chains: timers get
     throttled to ~1/s in a backgrounded WebView, which used to freeze the
     run start until the user tapped again. */
  const COUNTDOWN_DUR = 3.1;

  function safe(fn, label) {
    try { fn(); } catch (e) {
      try { console.warn('[SeasonRunner] ' + (label || 'error'), e); } catch (_) {}
      if (typeof SR.reportError === 'function') SR.reportError(label || 'error', e);
    }
  }

  function prepareRun() {
    safe(() => { if (SR.ui && SR.ui.closeScreens) SR.ui.closeScreens(); }, 'closeScreens');
    S.attract = false;
    resetWorld();
    refreshRotation();
    S.season = SR.getSeason(0);
    S.seasonIdx = 0;
    S.palFrom = paletteOf(S.season);
    S.palTo = paletteOf(S.season);
    S.palT = 1;
    S.countdownT = COUNTDOWN_DUR;
    S.countdownStep = -1;
    S.state = 'countdown';
    const cd = document.getElementById('countdown');
    if (cd) { cd.classList.remove('hidden'); cd.textContent = ''; }
    safe(() => { SR.audio.init(); SR.audio.unlock(); }, 'audio.init');
    safe(() => SR.audio.startMusic(S.season), 'audio.startMusic');
    // HUD must be visible even if something below fails
    safe(() => { if (SR.ui && SR.ui.onRunStart) SR.ui.onRunStart(); }, 'onRunStart');
  }

  function start() {
    if (S.state === 'running' || S.state === 'countdown') return;
    safe(prepareRun, 'start');
  }

  function restart() {
    safe(prepareRun, 'restart');
    // restart is also triggered from the pause screen; make sure it un-pauses
    if (S.state === 'countdown' && S.countdownT <= 0) S.countdownT = COUNTDOWN_DUR;
  }

  /* Called from update() when the countdown finishes. */
  function beginRunning() {
    safe(() => { S.state = 'running'; }, 'beginRunning');
    const cd = document.getElementById('countdown');
    if (cd) {
      cd.textContent = SR.t('go.go');
      setTimeout(() => cd.classList.add('hidden'), 700);
    }
    safe(() => SR.audio.play('go'), 'audio.go');
    safe(() => { if (SR.ui && SR.ui.onRunStart) SR.ui.onRunStart(); }, 'onRunStart');
  }

  function pause() {
    if (S.state !== 'running') return;
    S.state = 'paused';
    SR.audio.play('click');
  }
  function resume() {
    if (S.state !== 'paused') return;
    S.state = 'running';
    SR.audio.play('click');
  }
  function exitToMenu() {
    S.state = 'menu';
    S.attract = true;
    SR.audio.stopMusic();
    resetWorld();
    S.season = SR.SEASONS[0]; S.seasonIdx = 0;
    S.palFrom = paletteOf(S.season); S.palTo = paletteOf(S.season); S.palT = 1;
    buildDecos();
  }

  function revive() {
    if (S.revived) return;
    S.revived = true;
    if (SR.ui && SR.ui.closeScreens) SR.ui.closeScreens();
    S.state = 'running';
    S.player.invulnT = 2.2;
    S.deathT = 0;
    // clear nearby obstacles
    for (let i = S.obstacles.length - 1; i >= 0; i--) {
      if (S.obstacles[i].x - S.distPx < 520) S.obstacles.splice(i, 1);
    }
    SR.audio.startMusic(S.season);
    SR.toast(SR.t('toast.revive'));
    SR.fx.ring(S.player.x, S.player.y - 30, '#8effc1', 80, 0.5);
    SR.ui.onRunStart();
  }

  /* ---------- helpers ---------- */
  function addLeaves(n) {
    S.leaves += n;
    S.comboT = 2;
  }
  function addBonus(n) { S.bonus += n; }
  function score() {
    return Math.floor(S.distM * 2) + S.leaves * 25 + S.gems * 500 + S.bonus;
  }

  function applyPower(type) {
    const p = S.player;
    SR.audio.play('power');
    SR.fx.ring(p.x, p.y - 30, '#ffd54f', 70, 0.45);
    SR.fx.confetti(p.x, p.y - 40, ['#ffd54f', '#8effc1', '#b39cff', '#ff9f43'], 26);
    S.combo = Math.max(S.combo, 1);
    switch (type) {
      case 'shield': p.shield = true; break;
      case 'magnet': p.magnetT = 10; break;
      case 'freeze': S.freezeT = 5; break;
      case 'eagle': p.eagleT = 7; p.invulnT = 7; break;
      case 'lock': S.lockT = 20; break;
      case 'star': p.starT = 8; break;
    }
    SR.notify(type);
    SR.audio.play(type === 'freeze' ? 'freeze' : 'power');
    SR.ui.refreshPowerChips();
  }

  /* Central damage pipeline: respects eagle/invuln/star/shield.
     Returns true if the player actually died. */
  function damagePlayer(ob) {
    const p = S.player;
    if (S.state !== 'running') return false;
    if (p.eagleT > 0 || p.invulnT > 0 || p.dashT > 0) return false;
    if (p.starT > 0) {
      if (ob) {
        ob.dead = true;
        S.bonus += 30;
        SR.audio.play('starHit');
        SR.fx.burst(ob.x, ob.y - ob.h / 2, ['#ffe082', '#ffd54f', '#ffffff'], 14, 260, { grav: 300 });
        SR.fx.text(ob.x, ob.y - ob.h - 20, '+30', '#ffe082', 18);
      }
      return false;
    }
    if (p.shield) {
      p.shield = false;
      p.invulnT = 1.5;
      if (ob) ob.dead = true;
      SR.audio.play('shieldBreak');
      SR.fx.burst(p.x, p.y - 26, ['#4dd0c7', '#ffffff'], 16, 300, { grav: 200 });
      SR.fx.ring(p.x, p.y - 26, '#4dd0c7', 60, 0.4);
      SR.ui.refreshPowerChips();
      return false;
    }
    hitPlayer();
    return true;
  }

  function hitPlayer() {
    if (S.state !== 'running') return;
    S.state = 'dying';
    S.deathT = 0;
    S.timeScale = 0.3;
    S.player.state = 'dead';
    SR.audio.play('hit');
    SR.audio.stopMusic();
    SR.fx.burst(S.player.x, S.player.y - 24, ['#8effc1', '#ffffff', '#ffd54f', '#5ce8a0'], 30, 380, { grav: 600 });
    SR.fx.ring(S.player.x, S.player.y - 24, '#ffffff', 90, 0.5);
    SR.fx.shake(0.9);
    SR.fx.hitstop(0.09);
    S.flash = 1;
    setTimeout(() => { if (navigator.vibrate && SR.save.progress.vibrate) navigator.vibrate(220); }, 30);
  }

  /* ---------- spawning ---------- */
  function spawnPattern() {
    const g = S;
    const season = g.season;
    const diff = Math.min(1, g.distM / 1600);
    const speedK = g.speed / g.baseSpeed;

    const roll = Math.random();
    const powerReady = g.distPx > g.nextPowerAt;
    const gemReady = g.distPx > g.nextGemAt;
    const branchZone = g.noObstacleUntil > g.spawnX;   // keep branches isolated

    if (gemReady && roll < 0.12 && g.distM > 300) {
      spawnGem();
      g.nextGemAt = g.distPx + U.rand(2600, 4200) + U.rand(0, 1000);
      g.spawnX += 240;
      return;
    }
    if (powerReady && roll < 0.22) {
      spawnPower();
      g.nextPowerAt = g.distPx + U.rand(1000, 1600);
      g.spawnX += 220;
      return;
    }

    const r2 = Math.random();
    if (branchZone) {
      // safe zone after a branch: only coins & gems, no obstacles
      if (r2 < 0.55) spawnCoins();
    } else if (r2 < 0.3) { spawnCoins(); }
    else if (r2 < 0.62) { spawnObstacle(false); }
    else if (r2 < 0.8) { spawnObstacle(true); }
    else if (r2 < 0.88) { spawnObstacle(false); spawnCoinsOver(); }
    else { spawnCoins(); spawnObstacle(false); }

    const timeGap = U.rand(0.78, 1.32) - diff * 0.22;
    g.spawnX += Math.max(230, timeGap * g.speed * speedK);
  }

  function pickObstacleType(season, allowBranch, allowBear) {
    const pool = season.obstaclePool.slice();
    if (!allowBranch || S.lastObKind === 'branch') {
      const i = pool.indexOf('branch'); if (i > -1) pool.splice(i, 1);
    }
    if (!allowBear) {
      const i = pool.indexOf('bear'); if (i > -1) pool.splice(i, 1);
    }
    const t = U.choice(pool);
    S.lastObKind = t;
    return t;
  }

  function spawnObstacle(second) {
    const g = S;
    const season = g.season;
    let x = g.spawnX + (second ? U.rand(210, 300) : 0);
    let tries = 0;
    while (x < g.spawnX + 130 && tries++ < 5) x += 130;
    // branches & bears never appear as the second obstacle of a double
    const cls = SR.obstacleClass(pickObstacleType(season, !second, !second));
    if (cls === SR.Obstacles.Branch) {
      // isolate the branch: no obstacles near it
      g.noObstacleUntil = x + 430;
    }
    if (cls === SR.Obstacles.Pile) {
      const p = new cls(x, season, g);
      p.gapAfter = 0;
      g.obstacles.push(p);
    } else if (cls === SR.Obstacles.Mud) {
      const m = new cls(x, season, g);
      m.soft = true;
      g.obstacles.push(m);
    } else if (cls === SR.Obstacles.Whirl || cls === SR.Obstacles.Icefall || cls === SR.Obstacles.Mushroom) {
      const w = new cls(x, season, g);
      w.hazard = true;
      g.obstacles.push(w);
    } else {
      g.obstacles.push(new cls(x, season, g));
    }
  }

  function spawnCoins() {
    const g = S;
    const base = g.baseY - U.rand(42, 84);
    const n = U.randInt(6, 10);
    const arc = Math.random() < 0.5;
    const cx = g.spawnX;
    for (let i = 0; i < n; i++) {
      let y = base;
      if (arc) y = base - Math.sin((i / (n - 1)) * Math.PI) * 90;
      g.pickups.push(new SR.Obstacles.Coin(cx + i * 34, y, g));
    }
    g.spawnX += n * 34 + 60;
  }
  function spawnCoinsOver() {
    const g = S;
    const n = U.randInt(5, 7);
    for (let i = 0; i < n; i++) {
      g.pickups.push(new SR.Obstacles.Coin(g.spawnX + 60 + i * 34, g.baseY - 92 - Math.sin((i / n) * Math.PI) * 40, g));
    }
  }
  function spawnPower() {
    const g = S;
    const types = ['shield', 'shield', 'magnet', 'magnet', 'freeze', 'freeze', 'eagle', 'lock', 'star'];
    const t = U.choice(types);
    g.pickups.push(new SR.Obstacles.PowerUp(g.spawnX + 40, g.baseY - 66, t, g));
  }
  function spawnGem() {
    const g = S;
    g.pickups.push(new SR.Obstacles.Gem(g.spawnX + 40, g.baseY - 80, g));
    g.nextGemAt = g.distPx + 9000; // one guaranteed gem per run
  }

  /* ---------- season switch ---------- */
  function seasonSwitch() {
    if (S.state !== 'running' || S.attract) return;
    if (S.lockT > 0) { S.seasonTimer = S.seasonDur; return; }
    const old = S.season;
    S.seasonIdx = (S.seasonIdx + 1) % S.rotation.length;
    const nxt = SR.getSeason(S.rotation[S.seasonIdx]);
    S.palFrom = paletteOf(old);
    S.palTo = paletteOf(nxt);
    S.palT = 0;
    SR.fx.transition(() => {
      S.season = nxt;
      SR.audio.play('season');
      SR.audio.startMusic(nxt);
      SR.fx.confetti(W / 2, H / 2 - 40, [nxt.color, '#ffffff', '#ffd54f'], 44);
      S.obstacles.length = 0;
      S.spawnX = S.distPx + 760;
      SR.ui.refreshSeasonPill();
    });
    S.seasonTimer = S.seasonDur;
  }

  /* ---------- update ---------- */
  function update(dt) {
    S.t += dt;
    // transitions / lerps
    if (S.palT < 1) S.palT = Math.min(1, S.palT + dt / 1.1);
    S.flash = Math.max(0, S.flash - dt * 2.6);

    const g = S;
    if (g.state === 'paused' || g.state === 'dead') return;
    if (g.state === 'dying') {
      g.deathT += dt;
      g.timeScale = g.deathT < 0.5 ? 0.35 : 1;
      if (g.deathT > 1.25) {
        g.state = 'dead';
        SR.fx.hitstop(0);
        SR.audio.play('over');
        SR.ui.onRunEnd();
        return;
      }
    }

    /* countdown: advanced by game time so throttled/backgrounded timers
       can never strand the player on a frozen pre-run screen */
    if (g.state === 'countdown' && !g.attract) {
      g.countdownT -= dt;
      const step = Math.max(1, Math.ceil(g.countdownT));
      if (step !== g.countdownStep && g.countdownT > 0) {
        g.countdownStep = step;
        const cd = document.getElementById('countdown');
        if (cd) cd.textContent = step;
        safe(() => SR.audio.play('count'), 'audio.count');
      }
      if (g.countdownT <= 0) { beginRunning(); return; }
    }

    const sdt = dt * g.timeScale;
    if (g.state === 'running' || g.state === 'countdown' || g.attract) {
      g.elapsedRun += sdt;

      /* speed */
      const p = g.player;
      let spd = g.baseSpeed * g.season.speedMul * (1 + Math.min(0.85, g.distM / 3200));
      if (g.freezeT > 0) spd *= 0.34;
      if (p.dashT > 0) spd *= 2.25;
      if (g.slowDebuffT > 0) spd *= 0.62;
      if (g.attract) spd = 300;
      if (g.state === 'countdown') spd = 0;
      g.speed = spd;
      g.gravity = g.season.gravity;
      g.jumpV = g.season.jumpV;

      if (g.state === 'running' && !g.attract) {
        g.distPx += spd * sdt;
        g.distM = g.distPx / 60;
        g.seasonTimer -= sdt;
        g.freezeT = Math.max(0, g.freezeT - sdt);
        g.lockT = Math.max(0, g.lockT - sdt);
        g.slowDebuffT = Math.max(0, g.slowDebuffT - sdt);
        g.comboT -= sdt;
        if (g.comboT <= 0) g.combo = 1;

        if (g.seasonTimer <= 0) seasonSwitch();

        /* storms */
        if (g.distPx > g.nextStormAt && g.season.storm && !g.attract) {
          g.stormT = 4.2;
          g.stormType = g.season.storm;
          g.nextStormAt = g.distPx + U.rand(2400, 4200);
        }
        g.stormT = Math.max(0, g.stormT - sdt);
        if (g.stormT <= 0) g.stormType = null;
      }

      /* spawn */
      while (g.spawnX < g.distPx + W + 420) {
        if (g.attract) { spawnCoins(); }
        else spawnPattern();
      }

      /* player */
      p.update(sdt);

      /* pickups */
      for (let i = g.pickups.length - 1; i >= 0; i--) {
        const pu = g.pickups[i];
        pu.update(sdt);
        const dx = pu.x - g.distPx;
        if (dx < -120) { g.pickups.splice(i, 1); continue; }

        // eagle: auto-collect on screen
        if (p.eagleT > 0 && dx < W * 0.9 && dx > -60) {
          collectPickup(pu, i);
          continue;
        }
        // magnet pull
        if (p.magnetT > 0) {
          const pdx = p.x - pu.x, pdy = (p.y - 30) - pu.y;
          const d2 = pdx * pdx + pdy * pdy;
          if (d2 < 260 * 260) {
            pu.x += pdx * sdt * 10;
            pu.y += pdy * sdt * 10;
          }
        }
        const px = p.x, py = p.y - 30;
        const rr = pu.r + 24;
        if (U.dist2(px, py, pu.x, pu.y) < rr * rr) collectPickup(pu, i);
      }

      /* obstacles */
      const pRect = p.rect;
      for (let i = g.obstacles.length - 1; i >= 0; i--) {
        const ob = g.obstacles[i];
        ob.update(sdt);
        if (ob.dead) { g.obstacles.splice(i, 1); continue; }
        if (ob.x - g.distPx < -220) { g.obstacles.splice(i, 1); continue; }

        if (g.state === 'running' && !g.attract) {
          const r = ob.rect();
          const ox = r.x, ow = r.w;
          if (ow > 0) {
            // closest distance for near-miss
            const cdx = Math.max(0, Math.max(pRect.x - (ox + ow), ox - (pRect.x + pRect.w)));
            const cdy = Math.max(0, Math.max(pRect.y - (r.y + r.h), r.y - (pRect.y + pRect.h)));
            ob.closest = Math.min(ob.closest === undefined ? 999 : ob.closest, Math.hypot(cdx, cdy));

            const hit = pRect.x < ox + ow - 5 && pRect.x + pRect.w > ox + 5 &&
                        pRect.y < r.y + r.h - 5 && pRect.y + pRect.h > r.y + 5;
            if (hit) {
              if (p.eagleT > 0) { /* flying over */ }
              else if (ob.soft) {
                g.slowDebuffT = 1.15;
                SR.audio.play('splash');
                SR.toast(SR.t('toast.slow'));
                SR.fx.burst(ob.x, ob.y - 8, ['#7d5834', '#6b4a2b', '#a5784c'], 12, 180, { vy: -60 });
                ob.dead = true;
              }
              else if (ob.hazard && ob.onTouch) { ob.onTouch(); }
              else { damagePlayer(ob); if (S.state === 'dying') break; }
            }
            // near miss
            if (!ob.passed && ob.x < p.x - 30 && !ob.dead) {
              ob.passed = true;
              if (ob.closest !== undefined && ob.closest < 34) {
                g.bonus += 50;
                SR.fx.text(p.x + 40, p.y - 66, SR.tf('notif.near', { n: 50 }), '#b3e5fc', 16);
              }
            }
          }
        }
      }

      /* ambient deco & fx */
      SR.fx.update(sdt);
      updateAmbient(sdt);
    }
  }

  function collectPickup(pu, idx) {
    const g = S;
    if (pu.type === 'coin') {
      const val = g.combo;
      g.leaves += val;
      SR.audio.play('coin', Math.min(g.leaves, 8));
      SR.fx.sparkle(pu.x, pu.y, '#a5d6a7', 3);
      if (g.comboT > 0) g.combo = Math.min(8, g.combo + 1); else g.combo = 1;
      g.comboT = 2;
      if (g.combo >= 3) SR.fx.text(pu.x, pu.y - 22, SR.tf('notif.combo', { n: g.combo }), '#ffd54f', 15);
      SR.ui.onHud();
    } else if (pu.type === 'gem') {
      g.gems++;
      SR.audio.play('gem');
      SR.fx.ring(pu.x, pu.y, '#b39cff', 80, 0.55);
      SR.fx.confetti(pu.x, pu.y, ['#b39cff', '#c4b0ff', '#ffffff'], 30);
      SR.fx.text(pu.x, pu.y - 30, SR.t('toast.gem'), '#c4b0ff', 20);
      SR.ui.onHud();
      SR.save.onGemCollected();
    } else {
      applyPower(pu.type);
      SR.fx.text(pu.x, pu.y - 24, SR.t('toast.power'), '#ffd54f', 16);
      SR.ui.onHud();
    }
    g.pickups.splice(idx, 1);
  }

  /* ---------- ambient particles ---------- */
  const amb = [];
  function updateAmbient(dt) {
    const g = S;
    const type = g.season.ambient;
    // spawn
    if (Math.random() < dt * 6) {
      const isSnow = type === 'snow';
      const isLeaves = type === 'leaves';
      const isPetals = type === 'petals';
      const isHeat = type === 'heat';
      amb.push({
        kind: type,
        x: U.rand(-40, W + 40),
        y: isHeat ? U.rand(80, H) : -20,
        vx: U.rand(-30, 20) + (isLeaves ? -60 : 0) + (isPetals ? 14 : 0),
        vy: isSnow ? U.rand(30, 90) : isLeaves ? U.rand(50, 110) : isPetals ? U.rand(24, 60) : U.rand(6, 22),
        rot: U.rand(0, 6.28), vr: U.rand(-2, 2),
        size: isSnow ? U.rand(2, 5) : U.rand(4, 8),
        sway: U.rand(0, 6.28), life: 0, maxLife: 16,
        col: U.choice(g.season.particles),
      });
    }
    for (let i = amb.length - 1; i >= 0; i--) {
      const a = amb[i];
      a.life += dt;
      a.x += a.vx * dt + Math.sin(a.life * 2 + a.sway) * (a.kind === 'heat' ? 0 : 26 * dt);
      a.y += a.vy * dt;
      a.rot += a.vr * dt;
      if (a.y > H + 30 || a.x < -60 || a.x > W + 60 || a.life > a.maxLife) amb.splice(i, 1);
    }
  }

  /* ============ RENDER ============ */
  function curPal() {
    if (S.palT >= 1) return S.palTo;
    const a = S.palFrom, b = S.palTo, t = U.smooth(S.palT);
    const p = {};
    for (const k in a) p[k] = k === 'accent' || k === 'sunColor' ? U.mix(a[k], b[k], t) : U.mix(a[k], b[k], t);
    return p;
  }

  function drawSky(ctx, pal) {
    const grd = ctx.createLinearGradient(0, 0, 0, BASEY);
    grd.addColorStop(0, pal.skyTop);
    grd.addColorStop(0.6, pal.skyMid);
    grd.addColorStop(1, pal.skyBottom);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    // sun
    const sun = S.season.sun;
    const sx = sun.x, sy = sun.y;
    ctx.fillStyle = pal.sunColor;
    ctx.globalAlpha = 0.28;
    ctx.beginPath(); ctx.arc(sx, sy, sun.r * 1.9, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(sx, sy, sun.r * 1.35, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.sunColor;
    ctx.beginPath(); ctx.arc(sx, sy, sun.r, 0, 6.283); ctx.fill();
    // winter: faint moon glow ring
    if (S.season.id === 'winter') {
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, sun.r * 1.7, 0, 6.283); ctx.stroke();
    }
  }

  const clouds = [];
  function drawClouds(ctx) {
    const offset = (S.distPx * 0.06) % 1400;
    for (let i = 0; i < 6; i++) {
      const h = U.hash(i * 3 + 7);
      const x = ((i * 233 + 50 - offset + 1400 * 2) % 1400) - 220;
      const y = 40 + h * 120;
      const s = 0.7 + h * 0.7;
      ctx.fillStyle = S.season.id === 'autumn' ? 'rgba(255,220,190,.6)' : 'rgba(255,255,255,.55)';
      ctx.beginPath();
      ctx.ellipse(x, y, 46 * s, 16 * s, 0, 0, 6.283);
      ctx.ellipse(x + 30 * s, y - 10 * s, 30 * s, 14 * s, 0, 0, 6.283);
      ctx.ellipse(x - 32 * s, y - 6 * s, 26 * s, 12 * s, 0, 0, 6.283);
      ctx.fill();
    }
  }

  function drawMountains(ctx, pal) {
    const offF = (S.distPx * 0.15) % (W * 2);
    const offM = (S.distPx * 0.28) % (W * 2);
    ctx.fillStyle = pal.mountFar;
    ctx.beginPath();
    ctx.moveTo(0, BASEY);
    for (let x = -offF - 100; x < W + 200; x += 240) {
      const h = 90 + U.hash(x) * 70;
      ctx.lineTo(x, BASEY - h);
      ctx.lineTo(x + 120, BASEY - h - 34 - U.hash(x + 3) * 30);
      ctx.lineTo(x + 240, BASEY - 20);
    }
    ctx.lineTo(W, BASEY); ctx.closePath(); ctx.fill();
    // snow caps on far peaks (winter)
    if (S.season.id === 'winter') {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let x = -offF - 100; x < W + 200; x += 240) {
        const h = 90 + U.hash(x) * 70;
        ctx.beginPath();
        ctx.moveTo(x + 100, BASEY - h - 26 - U.hash(x + 3) * 30 + 26);
        ctx.lineTo(x + 120, BASEY - h - 34 - U.hash(x + 3) * 30);
        ctx.lineTo(x + 140, BASEY - h - 26 - U.hash(x + 3) * 30 + 26);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.fillStyle = pal.mountMid;
    ctx.beginPath();
    ctx.moveTo(0, BASEY);
    for (let x = -offM - 100; x < W + 200; x += 180) {
      const h = 50 + U.hash(x + 9) * 55;
      ctx.lineTo(x, BASEY - h);
      ctx.lineTo(x + 90, BASEY - h - 26 - U.hash(x + 13) * 22);
      ctx.lineTo(x + 180, BASEY - 16);
    }
    ctx.lineTo(W, BASEY); ctx.closePath(); ctx.fill();
  }

  function drawDecoLayer(ctx, pal) {
    const par = 0.4;
    const period = 420;
    const offset = (S.distPx * par) % period;
    for (let i = 0; i < 6; i++) {
      const x = ((i * period + 60 - offset + period * 3) % (W + period * 2)) - period;
      const h = U.hash(i * 31 + 5);
      const kind = S.season.deco[(i + Math.floor(S.distPx * par / period)) % S.season.deco.length];
      drawDeco(ctx, kind, x, h);
    }
  }

  function drawDeco(ctx, kind, x, h) {
    const by = BASEY;
    switch (kind) {
      case 'sakura':
        ctx.fillStyle = '#7a4a2b';
        ctx.fillRect(x - 5, by - 60 * (0.7 + h * 0.3), 10, 60 * (0.7 + h * 0.3));
        ctx.fillStyle = '#ffb7d5';
        ctx.beginPath(); ctx.arc(x, by - 62 * (0.7 + h * 0.3), 34, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#ff9ec4';
        ctx.beginPath(); ctx.arc(x - 20, by - 48 * (0.7 + h * 0.3), 20, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 22, by - 40 * (0.7 + h * 0.3), 18, 0, 6.283); ctx.fill();
        break;
      case 'bush':
        ctx.fillStyle = '#5fae4e';
        ctx.beginPath(); ctx.ellipse(x, by - 14, 34, 20, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#8fd464';
        ctx.beginPath(); ctx.ellipse(x + 14, by - 20, 20, 14, 0, 0, 6.283); ctx.fill();
        break;
      case 'flower2':
        ctx.fillStyle = '#ff9ec4';
        ctx.beginPath(); ctx.arc(x, by - 12, 8, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#ffd54f';
        ctx.beginPath(); ctx.arc(x, by - 12, 3.4, 0, 6.283); ctx.fill();
        break;
      case 'cactus':
        ctx.fillStyle = '#4a9e55';
        ctx.fillRect(x - 9, by - 70, 18, 70);
        ctx.fillRect(x - 24, by - 52, 10, 26);
        ctx.fillRect(x + 14, by - 60, 10, 30);
        break;
      case 'rock':
        ctx.fillStyle = S.season.id === 'winter' ? '#b9ccd9' : '#a0875e';
        ctx.beginPath(); ctx.ellipse(x, by - 10, 24, 14, 0, 0, 6.283); ctx.fill();
        break;
      case 'dune':
        ctx.fillStyle = '#e8c078';
        ctx.beginPath(); ctx.ellipse(x, by, 60, 18, 0, Math.PI, 0); ctx.fill();
        break;
      case 'oaktree':
        ctx.fillStyle = '#6e4529';
        ctx.fillRect(x - 6, by - 66, 12, 66);
        ctx.fillStyle = '#d97b35';
        ctx.beginPath(); ctx.arc(x, by - 76, 32, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#c96a2e';
        ctx.beginPath(); ctx.arc(x - 22, by - 62, 20, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 24, by - 58, 18, 0, 6.283); ctx.fill();
        break;
      case 'stump':
        ctx.fillStyle = '#7a4a2b';
        ctx.fillRect(x - 12, by - 30, 24, 30);
        ctx.fillStyle = '#8f5a33';
        ctx.beginPath(); ctx.ellipse(x, by - 30, 13, 6, 0, 0, 6.283); ctx.fill();
        break;
      case 'pine':
        ctx.fillStyle = '#4a6e4e';
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(x - 22 - k * 5, by - 26 - k * 26);
          ctx.lineTo(x, by - 58 - k * 28);
          ctx.lineTo(x + 22 + k * 5, by - 26 - k * 26);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = '#5d3a20';
        ctx.fillRect(x - 4, by - 18, 8, 18);
        break;
      case 'snowbush':
        ctx.fillStyle = '#dcecf7';
        ctx.beginPath(); ctx.ellipse(x, by - 12, 22, 14, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(x + 8, by - 18, 12, 9, 0, 0, 6.283); ctx.fill();
        break;
    }
  }

  function drawGround(ctx, pal) {
    const g1 = ctx.createLinearGradient(0, BASEY, 0, H);
    g1.addColorStop(0, pal.groundTop);
    g1.addColorStop(1, pal.groundDeep);
    ctx.fillStyle = g1;
    ctx.fillRect(0, BASEY, W, H - BASEY);
    // top edge
    ctx.fillStyle = pal.groundEdge;
    ctx.fillRect(0, BASEY - 3, W, 6);
    // tiles
    const tileW = 90;
    const off = (S.distPx % tileW);
    ctx.save();
    for (let i = -1; i < W / tileW + 1; i++) {
      const tx = i * tileW - off;
      const ti = Math.floor((S.distPx + tx) / tileW);
      const h = U.hash(ti);
      if (S.season.tile === 'grass') {
        if (h < 0.5) { // grass tuft
          ctx.strokeStyle = 'rgba(40,110,40,.45)'; ctx.lineWidth = 2.4;
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.moveTo(tx + 20 + k * 14 + h * 30, BASEY + 6);
            ctx.lineTo(tx + 18 + k * 14 + h * 30 - 4, BASEY - 5 - h * 8);
            ctx.stroke();
          }
        }
        if (h > 0.8) { // tiny flower
          ctx.fillStyle = h > 0.92 ? '#ff9ec4' : '#ffe082';
          ctx.beginPath(); ctx.arc(tx + 40 + h * 40, BASEY + 8 + h * 12, 4, 0, 6.283); ctx.fill();
        }
      } else if (S.season.tile === 'sand') {
        ctx.strokeStyle = 'rgba(180,130,70,.35)'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx + 10, BASEY + 20 + h * 30);
        ctx.quadraticCurveTo(tx + 30, BASEY + 16 + h * 30, tx + 50, BASEY + 22 + h * 30);
        ctx.stroke();
        if (h > 0.85) { // pebble
          ctx.fillStyle = 'rgba(160,120,70,.5)';
          ctx.beginPath(); ctx.ellipse(tx + 60 + h * 20, BASEY + 26, 6, 3.5, 0, 0, 6.283); ctx.fill();
        }
      } else if (S.season.tile === 'leaves') {
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = k === 0 ? '#c96a2e' : k === 1 ? '#a85028' : '#e08a45';
          ctx.beginPath(); ctx.ellipse(tx + 15 + k * 26 + h * 20, BASEY + 10 + h * 24 + (k % 2) * 6, 8, 4.5, U.hash(ti + k) * 2, 0, 6.283); ctx.fill();
        }
      } else { // snow
        if (h < 0.55) { // drift
          ctx.fillStyle = 'rgba(255,255,255,.5)';
          ctx.beginPath(); ctx.ellipse(tx + 45 + h * 40, BASEY + 12, 30, 7, 0, 0, 6.283); ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        ctx.beginPath(); ctx.arc(tx + 20 + h * 60, BASEY + 8, 2.6, 0, 6.283); ctx.fill();
      }
    }
    ctx.restore();
    // deep ground fade at bottom
    const g2 = ctx.createLinearGradient(0, BASEY + 60, 0, H);
    g2.addColorStop(0, 'rgba(0,0,0,0)');
    g2.addColorStop(1, 'rgba(0,0,0,.22)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, BASEY + 60, W, H - BASEY - 60);
  }

  function drawAmbient(ctx) {
    for (const a of amb) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      if (a.kind === 'snow') {
        ctx.fillStyle = `rgba(255,255,255,${0.75 + Math.sin(a.life * 3) * 0.2})`;
        ctx.beginPath(); ctx.arc(0, 0, a.size, 0, 6.283); ctx.fill();
      } else if (a.kind === 'petals' || a.kind === 'leaves') {
        ctx.fillStyle = a.col;
        ctx.beginPath();
        ctx.ellipse(0, 0, a.size, a.size * 0.55, 0, 0, 6.283);
        ctx.fill();
      } else if (a.kind === 'heat') {
        ctx.strokeStyle = 'rgba(255,255,255,.4)';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(0, 0, 6 + Math.sin(a.life * 8 + a.sway) * 3, 0, 2.2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawStorm(ctx) {
    const t = S.stormT;
    if (t <= 0) return;
    const a = Math.min(0.4, t * 0.5);
    const isSand = S.stormType === 'sand';
    ctx.fillStyle = isSand ? `rgba(255,170,70,${a})` : `rgba(230,242,255,${a})`;
    ctx.fillRect(0, 0, W, H);
    // wind streaks
    ctx.strokeStyle = isSand ? `rgba(255,210,130,${a * 1.2})` : `rgba(255,255,255,${a * 1.4})`;
    ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const y = (i * 47 + (S.t * (40 + i * 12)) % 90) % H;
      const x = W - ((S.t * (300 + i * 50) + i * 130) % (W + 200));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 80 - (i % 3) * 40, y + Math.sin(i) * 14);
      ctx.stroke();
    }
  }

  function drawFreezeTint(ctx) {
    const t = S.freezeT;
    if (t <= 0) return;
    ctx.fillStyle = `rgba(120,200,255,${Math.min(0.22, t * 0.12)})`;
    ctx.fillRect(0, 0, W, H);
    // clock
    const cx = 60, cy = 200;
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 20, 0, 6.283); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 11); ctx.moveTo(cx, cy); ctx.lineTo(cx + 8, cy - 4); ctx.stroke();
  }

  function render() {
    const ctx = S.ctx;
    if (!ctx) return;
    const [shx, shy] = SR.fx.shakeOffset();
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    const pal = curPal();
    drawSky(ctx, pal);
    drawClouds(ctx);
    drawMountains(ctx, pal);
    drawDecoLayer(ctx, pal);
    drawAmbient(ctx);

    ctx.translate(shx, shy);

    drawGround(ctx, pal);

    // entities drawn with simple world->screen translation
    for (const ob of S.obstacles) {
      ctx.save();
      ctx.translate(-S.distPx, 0);
      ob.draw(ctx);
      ctx.restore();
    }
    for (const pu of S.pickups) {
      ctx.save();
      ctx.translate(-S.distPx, 0);
      pu.draw(ctx);
      ctx.restore();
    }

    // player
    ctx.save();
    ctx.translate(-S.distPx, 0);
    S.player.draw(ctx);
    ctx.restore();

    SR.fx.draw(ctx);
    ctx.restore();

    drawStorm(ctx);
    drawFreezeTint(ctx);

    // flash
    if (S.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${S.flash * 0.85})`;
      ctx.fillRect(0, 0, W, H);
    }

    // countdown handled by DOM
  }

  /* ---------- deco cache ---------- */
  function buildDecos() {}

  return {
    W, H, BASEY, SEASON_DUR, BASE_SPEED, S,
    init, start, restart, pause, resume, exitToMenu, revive,
    update, render,
    applyPower, hitPlayer, addBonus, addLeaves, score,
    curPal,
    refreshRotation,
  };
})();
