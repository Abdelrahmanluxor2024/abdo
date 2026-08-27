'use strict';
/* ================================================================
   Season Runner — Nuro the nature spirit
================================================================ */
SR.player = class Player {
  constructor(g) {
    this.g = g;
    this.x = 210;
    this.y = g.baseY;
    this.vy = 0;
    this.w = 30;
    this.h = 46;
    this.state = 'run';       // run | jump | slide | fly | fling | dead
    this.onGround = true;
    this.jumps = 0;
    this.coyote = 0;
    this.buffer = 0;
    this.invulnT = 0;
    this.shield = false;
    this.starT = 0;
    this.eagleT = 0;
    this.magnetT = 0;
    this.slowT = 0;
    this.dashT = 0;
    this.dashCd = 0;
    this.slideT = 0;
    this.flingVx = 0;
    this.squash = 0;          // squash factor for landing
    this.stretch = 0;
    this.runT = 0;
    this.blinkT = U.rand(2, 5);
    this.eyeBlink = 0;
    this.flip = false;        // face direction
  }

  get rect() {
    const h = this.state === 'slide' ? 26 : 46;
    return { x: this.x - this.w / 2, y: this.y - h, w: this.w, h };
  }

  get airborne() { return !this.onGround; }

  reset() {
    this.y = this.g.baseY; this.vy = 0; this.state = 'run'; this.onGround = true;
    this.jumps = 0; this.invulnT = 0; this.shield = false; this.starT = 0;
    this.eagleT = 0; this.magnetT = 0; this.slowT = 0; this.dashT = 0; this.dashCd = 0;
    this.slideT = 0; this.squash = 0; this.stretch = 0;
  }

  /* ---------- actions ---------- */
  jump() {
    const g = this.g;
    if (g.state !== 'running') return;
    if (this.onGround || this.coyote > 0) {
      this.doJump(g.jumpV);
      this.jumps = 1;
      return;
    }
    if (this.jumps < 2) {
      this.jumps++;
      this.doJump(g.jumpV * 0.96);
      SR.audio.play('jump2');
    }
  }
  doJump(v) {
    this.vy = -v;
    this.onGround = false;
    this.coyote = 0;
    this.state = 'jump';
    this.stretch = 1;
    SR.audio.play(this.jumps > 0 ? 'jump2' : 'jump');
    SR.fx.puff(this.x, this.y, 'rgba(255,255,255,.75)', 6, 5);
  }
  slide() {
    if (this.g.state !== 'running') return;
    if (this.onGround) {
      this.state = 'slide';
      this.slideT = 0.6;
      SR.audio.play('slide');
      SR.fx.puff(this.x - 6, this.y, 'rgba(255,255,255,.7)', 5, 4);
    } else if (!this.onGround && this.state !== 'slide') {
      // dive: fast-fall
      this.vy = Math.max(this.vy, 500);
      this.state = 'slide'; this.slideT = 0.3;
      SR.audio.play('slide');
    }
  }
  stand() {
    if (this.state === 'slide') { this.state = 'jump'; this.slideT = 0; }
  }
  dash() {
    if (this.g.state !== 'running' || this.dashCd > 0) return;
    this.dashT = 0.42;
    this.dashCd = 7;
    this.invulnT = Math.max(this.invulnT, 0.45);
    SR.audio.play('dash');
    SR.fx.shake(0.12);
    this.g.addBonus(10);
    SR.fx.text(this.x, this.y - 70, SR.t('notif.dash'), '#ffd54f', 24);
  }
  fling(vx, vy) {
    this.state = 'fling';
    this.flingVx = vx;
    this.vy = vy;
    this.onGround = false;
    this.invulnT = Math.max(this.invulnT, 1.1);
    this.jumps = 2;
  }

  /* ---------- update ---------- */
  update(dt) {
    const g = this.g;
    this.runT += dt;
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.eyeBlink = 0.14; this.blinkT = U.rand(2, 5); }
    this.eyeBlink = Math.max(0, this.eyeBlink - dt);
    this.invulnT = Math.max(0, this.invulnT - dt);
    this.starT = Math.max(0, this.starT - dt);
    this.eagleT = Math.max(0, this.eagleT - dt);
    this.magnetT = Math.max(0, this.magnetT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.squash = Math.max(0, this.squash - dt * 3);
    this.stretch = Math.max(0, this.stretch - dt * 3);

    if (this.state === 'dead') return;

    this.coyote = this.onGround ? 0.09 : Math.max(0, this.coyote - dt);
    this.buffer = Math.max(0, this.buffer - dt);

    if (this.eagleT > 0) {
      const target = g.baseY - 232;
      this.y += (target - this.y) * Math.min(1, dt * 5);
      this.vy = 0; this.state = 'fly'; this.onGround = false;
      if (Math.random() < 0.4) {
        SR.fx.spawn({ x: this.x - 10, y: this.y - 20, vx: -80, vy: U.rand(-40, 20), life: 0, maxLife: 0.5, size: U.rand(2, 4), color: 'rgba(255,255,255,.8)', grav: -40, drag: 1, kind: 'dot' });
      }
      return;
    }

    if (this.state === 'fling') {
      this.vy += g.gravity * dt;
      this.x += this.flingVx * dt;
      this.y += this.vy * dt;
      if (this.y >= g.baseY) {
        this.y = g.baseY; this.state = 'run'; this.onGround = true; this.squash = 1;
        SR.audio.play('land');
        SR.fx.puff(this.x, this.y, 'rgba(255,255,255,.7)', 8, 6);
      }
      return;
    }

    // normal physics
    this.vy += g.gravity * dt;
    this.y += this.vy * dt;

    if (this.y >= g.baseY) {
      if (!this.onGround) {
        this.squash = 1;
        SR.audio.play('land');
        SR.fx.puff(this.x, this.y, 'rgba(255,255,255,.6)', 5, 4);
      }
      this.y = g.baseY;
      this.vy = 0;
      this.onGround = true;
      this.jumps = 0;
      if (this.state === 'jump' || this.state === 'slide') {
        this.state = this.state === 'slide' ? 'slide' : 'run';
        if (this.state === 'slide' && this.slideT <= 0) this.state = 'run';
      }
    }

    if (this.state === 'slide') {
      this.slideT -= dt;
      if (this.slideT <= 0) this.state = 'run';
    }

    // stay glued to the camera (except during flings)
    if (this.state !== 'fling' && this.state !== 'dead') {
      this.x += (g.distPx + 210 - this.x) * Math.min(1, dt * 6);
    }

    if (this.dashT > 0) {
      this.dashT -= dt;
      // afterimage
      if (Math.random() < 0.7) {
        SR.fx.spawn({ x: this.x + U.rand(-8, 8), y: this.y - U.rand(10, 34), vx: 0, vy: 0, life: 0, maxLife: 0.28, size: U.rand(4, 8), color: 'rgba(255,255,255,.35)', grav: 0, drag: 0, kind: 'dot' });
      }
    }

    // run dust
    if (this.onGround && this.state === 'run' && Math.random() < 0.25) {
      SR.fx.spawn({ x: this.x - 16, y: this.y - 2, vx: -40 - g.speed * 0.08, vy: U.rand(-30, -8), life: 0, maxLife: 0.35, size: U.rand(2.5, 5), color: 'rgba(255,255,255,.5)', grav: 60, drag: 2, kind: 'dot' });
    }
  }

  /* ---------- drawing ---------- */
  draw(ctx) {
    const g = this.g;
    if (this.state === 'dead') return;
    const skin = SR.skin();
    const season = g.season;
    const tintT = 0.32;
    const bodyCol = U.mix(skin.body, season.color, tintT);
    const glowCol = U.mix(skin.glow, season.color, 0.55);
    const blink = this.invulnT > 0 && Math.sin(performance.now() * 0.045) > 0;

    if (this.shield) {
      ctx.strokeStyle = 'rgba(77,208,199,.65)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(this.x, this.y - 26, 34 + Math.sin(performance.now() * 0.008) * 2, 0, 6.283); ctx.stroke();
      ctx.fillStyle = 'rgba(77,208,199,.1)';
      ctx.fill();
    }
    if (this.starT > 0) {
      ctx.strokeStyle = 'rgba(255,213,79,.8)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(this.x, this.y - 26, 30 + Math.sin(performance.now() * 0.012) * 4, 0, 6.283); ctx.stroke();
    }

    if (blink) return;

    const run = Math.sin(this.runT * 16);
    let bx = this.x, by = this.y;
    const fly = this.state === 'fly';
    const slide = this.state === 'slide';

    // glow
    ctx.save();
    ctx.shadowColor = glowCol;
    ctx.shadowBlur = 24 + Math.sin(this.runT * 8) * 6;

    let sw = 1, sh = 1;
    if (slide) { sh = 0.62; sw = 1.22; }
    else if (this.squash > 0) { sh = 1 - 0.22 * this.squash; sw = 1 + 0.18 * this.squash; }
    else if (this.stretch > 0) { sh = 1 + 0.24 * this.stretch; sw = 1 - 0.12 * this.stretch; }
    else if (fly) { sh = 1.12 + Math.sin(this.runT * 10) * 0.05; sw = 0.92; }
    else if (!this.onGround) { sh = 1.14; sw = 0.9; }
    else { sh = 1 + run * 0.045; sw = 1 - run * 0.035; }

    ctx.translate(bx, by);
    ctx.scale(sw, sh);
    ctx.translate(-bx, -by);

    const bodyH = slide ? 26 : 38;
    const cy = by - bodyH / 2 - (slide ? 2 : 0);

    // body — wavy spirit tail
    const g1 = ctx.createLinearGradient(0, cy - bodyH / 2, 0, cy + bodyH / 2);
    g1.addColorStop(0, U.mix('#ffffff', glowCol, 0.55));
    g1.addColorStop(0.45, bodyCol);
    g1.addColorStop(1, U.mix(bodyCol, '#000000', 0.18));
    ctx.fillStyle = g1;
    ctx.beginPath();
    if (slide) {
      ctx.roundRect(bx - 17, cy - 13, 34, 26, 12);
    } else {
      const wb = Math.sin(this.runT * 16) * (this.onGround ? 3 : 0);
      ctx.moveTo(bx - 15, cy - 18);
      ctx.bezierCurveTo(bx - 22, cy - 6, bx - 20, cy + 6, bx - 15 + wb, cy + 18);
      ctx.quadraticCurveTo(bx, cy + 14, bx + 15 + wb, cy + 18);
      ctx.bezierCurveTo(bx + 20, cy + 6, bx + 22, cy - 6, bx + 15, cy - 18);
      ctx.quadraticCurveTo(bx, cy - 24, bx - 15, cy - 18);
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    // highlight
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath();
    ctx.ellipse(bx - 6, cy - 8, 5, 9, -0.35, 0, 6.283);
    ctx.fill();

    // ears / sprout
    if (!slide) {
      ctx.fillStyle = bodyCol;
      ctx.beginPath(); ctx.ellipse(bx - 11, cy - 20, 5, 7, -0.3, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.ellipse(bx + 11, cy - 20, 5, 7, 0.3, 0, 6.283); ctx.fill();
      // little leaf sprout on head
      ctx.fillStyle = '#5fae4e';
      ctx.beginPath(); ctx.ellipse(bx + 6, cy - 26, 5.5, 3.2, -0.6, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#8fd464';
      ctx.beginPath(); ctx.ellipse(bx + 9, cy - 24, 4.5, 2.6, 0.7, 0, 6.283); ctx.fill();
    }

    // face
    const eyeY = cy - 3 + (slide ? 1 : 0);
    const eyeDX = 6;
    const eyeW = this.eyeBlink > 0 ? 0.15 : 1;
    ctx.fillStyle = '#173042';
    ctx.save();
    ctx.translate(bx - eyeDX, eyeY);
    ctx.scale(eyeW, 1);
    ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, 6.283); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(bx + eyeDX, eyeY);
    ctx.scale(eyeW, 1);
    ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, 6.283); ctx.fill();
    ctx.restore();
    // sparkle in eyes
    if (this.eyeBlink <= 0) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(bx - eyeDX - 1.2, eyeY - 1.2, 1.2, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(bx + eyeDX - 1.2, eyeY - 1.2, 1.2, 0, 6.283); ctx.fill();
    }
    // cheeks
    ctx.fillStyle = 'rgba(255,140,170,.5)';
    ctx.beginPath(); ctx.arc(bx - 13, cy + 4, 3, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 13, cy + 4, 3, 0, 6.283); ctx.fill();
    // mouth
    ctx.strokeStyle = '#173042'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    if (fly) {
      ctx.beginPath(); ctx.arc(bx, cy + 8, 4, 0.15, 2.9); ctx.stroke();
    } else if (this.state === 'fling' || this.stretch > 0.5) {
      ctx.beginPath(); ctx.arc(bx, cy + 8, 3.4, 0.1, 3); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(bx, cy + 5, 3.6, 0.2, 2.7); ctx.stroke();
    }
    ctx.restore();

    // slide speed lines
    if (slide) {
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(bx - 30 - i * 12, cy - 2 + i * 5);
        ctx.lineTo(bx - 16 - i * 10, cy - 2 + i * 5);
        ctx.stroke();
      }
    }
    // eagle wings
    if (fly) {
      const flap = Math.sin(this.runT * 22) * 7;
      ctx.fillStyle = 'rgba(255,224,130,.9)';
      ctx.beginPath();
      ctx.moveTo(bx - 14, cy - 8);
      ctx.quadraticCurveTo(bx - 34, cy - 20 + flap, bx - 40, cy - 4 + flap * 2);
      ctx.quadraticCurveTo(bx - 28, cy - 2, bx - 12, cy + 2);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bx + 14, cy - 8);
      ctx.quadraticCurveTo(bx + 34, cy - 20 - flap, bx + 40, cy - 4 - flap * 2);
      ctx.quadraticCurveTo(bx + 28, cy - 2, bx + 12, cy + 2);
      ctx.closePath(); ctx.fill();
    }
  }
};
