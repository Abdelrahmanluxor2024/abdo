'use strict';
/* ================================================================
   Season Runner — obstacles & pickups
   All positions are world coordinates (px). y = feet level.
================================================================ */

function shadow(ctx, x, feetY, w, alpha = 0.18) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, feetY + 4, w / 2, 6, 0, 0, 6.283);
  ctx.fill();
}

/* ================= Obstacles ================= */

class Obstacle {
  constructor(x, season, g) {
    this.x = x; this.season = season; this.g = g;
    this.w = 40; this.h = 40; this.y = g.baseY;
    this.dead = false; this.passed = false;
    this.phase = 0;
  }
  rect() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  update(dt) { this.phase += dt; }
  draw(ctx) {}
  onTouch() {}
}

/* ---------- 🌸 Spring ---------- */

class Branch extends Obstacle {          // overhead: slide under it
  constructor(x, season, g) {
    super(x, season, g);
    this.w = 74; this.gap = 56;          // gap above ground when sliding
    this.h = g.baseY - g.baseY;          // from top
    this.y = 0;
    this.wob = U.rand(0, 6.28);
  }
  rect() { return { x: this.x - this.w / 2, y: -10, w: this.w, h: this.g.baseY - this.gap }; }
  draw(ctx) {
    const t = this.g.distPx / 160 + this.phase;
    shadow(ctx, this.x, this.g.baseY, this.w + 40, 0.1);
    // trunk hanging from top
    ctx.strokeStyle = '#7a4a2b'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(this.x - 6, -10);
    ctx.quadraticCurveTo(this.x + U.rand(-8, 8), this.g.baseY * 0.35, this.x + Math.sin(t * 0.8) * 4, this.g.baseY - this.gap + 18);
    ctx.stroke();
    // leaves cluster
    for (let i = 0; i < 9; i++) {
      const lx = this.x + Math.sin(i * 2.7 + this.wob) * 34;
      const ly = this.g.baseY - this.gap - 4 + Math.cos(i * 2.1) * 14 + 10;
      ctx.fillStyle = i % 3 === 0 ? '#5fae4e' : '#8fd464';
      ctx.beginPath(); ctx.ellipse(lx, ly, 11, 6.5, i * 0.7, 0, 6.283); ctx.fill();
    }
    // blossoms
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#ff9ec4';
      ctx.beginPath(); ctx.arc(this.x + Math.sin(i * 3.3) * 28, this.g.baseY - this.gap + 6 + Math.cos(i * 2.4) * 10, 4, 0, 6.283); ctx.fill();
    }
  }
}

class Bee extends Obstacle {             // flying sine wave
  constructor(x, season, g) {
    super(x, season, g);
    this.w = 30; this.h = 24;
    this.baseY = g.baseY - U.rand(92, 130);
    this.amp = U.rand(16, 30);
    this.freq = U.rand(2.4, 3.4);
    this.off = U.rand(0, 6.28);
    this.y = this.baseY;
  }
  rect() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }
  update(dt) {
    super.update(dt);
    this.y = this.baseY + Math.sin(this.phase * this.freq + this.off) * this.amp;
  }
  draw(ctx) {
    const y = this.y;
    // wings
    const flap = Math.sin(this.phase * 34);
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath(); ctx.ellipse(this.x - 9, y - 9, 7 + flap * 2, 5, -0.6, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.ellipse(this.x + 8, y - 9, 7 + flap * 2, 5, 0.6, 0, 6.283); ctx.fill();
    // body
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath(); ctx.ellipse(this.x, y, 11, 8.5, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#33281f';
    ctx.beginPath(); ctx.ellipse(this.x - 4, y, 3, 8.5, 0, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.ellipse(this.x + 5, y, 3, 8.5, 0, 0, 6.283); ctx.fill();
    // stinger
    ctx.fillStyle = '#33281f';
    ctx.beginPath(); ctx.moveTo(this.x + 11, y - 3); ctx.lineTo(this.x + 16, y); ctx.lineTo(this.x + 11, y + 3); ctx.fill();
    // trail
    ctx.strokeStyle = 'rgba(255,213,79,.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 1; i <= 5; i++) {
      const px = this.x - 12 - i * 7, py = y + Math.sin(this.phase * 8 - i) * 3;
      if (i === 1) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

class Mud extends Obstacle {             // soft hazard: slows you
  constructor(x, season, g) {
    super(x, season, g);
    this.w = 118; this.h = 16;
    this.slowT = 1.1;
  }
  rect() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  draw(ctx) {
    const drip = Math.sin(this.phase * 3) * 2;
    ctx.fillStyle = '#6b4a2b';
    ctx.beginPath(); ctx.ellipse(this.x, this.y - 4 + drip * 0.3, this.w / 2, 9, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#7d5834';
    ctx.beginPath(); ctx.ellipse(this.x - 16, this.y - 6, 14, 6, 0, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.ellipse(this.x + 22, this.y - 5, 11, 5, 0, 0, 6.283); ctx.fill();
    // sparkles of wetness
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.ellipse(this.x + 8, this.y - 9, 3, 1.6, 0, 0, 6.283); ctx.fill();
  }
}

class Flower extends Obstacle {          // explodes open/closed cycle
  constructor(x, season, g) {
    super(x, season, g);
    this.w = 58; this.h = 96;
    this.cycle = U.rand(0, 3);
  }
  rect() {
    if (this.openness < 0.45) return { x: this.x - 8, y: this.y - 8, w: 16, h: 8 };
    return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
  }
  update(dt) {
    super.update(dt);
    this.t = (this.phase + this.cycle) % 2.4;
    // closed 0..0.8, open 1.1..1.9, closing/opening transitions
    this.openness = U.clamp01((this.t - 0.8) / 0.3) * (this.t < 1.1 ? 1 : (1 - U.clamp01((this.t - 1.9) / 0.3)));
  }
  draw(ctx) {
    const o = this.openness;
    // stem
    ctx.strokeStyle = '#4e9e3f'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(this.x, this.y);
    ctx.quadraticCurveTo(this.x + 6, this.y - this.h * 0.5, this.x - 2, this.y - this.h + 8); ctx.stroke();
    // leaves on stem
    ctx.fillStyle = '#62b351';
    ctx.beginPath(); ctx.ellipse(this.x + 10, this.y - 46, 10, 5, 0.5, 0, 6.283); ctx.fill();
    // petals
    const pr = 12 + o * 18;
    ctx.fillStyle = '#ff7dab';
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * 6.283 + this.phase * (o > 0.5 ? 0.6 : 0);
      ctx.beginPath();
      ctx.ellipse(this.x - 2 + Math.cos(a) * pr, this.y - this.h + 6 + Math.sin(a) * pr * 0.9, 10, 14, a, 0, 6.283);
      ctx.fill();
    }
    // center
    ctx.fillStyle = o > 0.6 ? '#ff5d8f' : '#ffb3cb';
    ctx.beginPath(); ctx.arc(this.x - 2, this.y - this.h + 6, 9 + o * 3, 0, 6.283); ctx.fill();
    // danger glow when open
    if (o > 0.6) {
      ctx.strokeStyle = `rgba(255,93,143,${0.4 + Math.sin(this.phase * 10) * 0.2})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(this.x - 2, this.y - this.h + 6, 34 + Math.sin(this.phase * 10) * 3, 0, 6.283); ctx.stroke();
    }
  }
}

/* ---------- ☀️ Summer ---------- */

class Fire extends Obstacle {            // pillar erupts with telegraph
  constructor(x, season, g) {
    super(x, season, g);
    this.w = 56; this.h = 10;
    this.state = 'warn'; this.timer = U.rand(0.5, 0.75); this.maxH = U.rand(120, 160);
    this.burnT = U.rand(0.75, 1.0);
  }
  rect() {
    if (this.state !== 'burn') return { x: 0, y: 0, w: 0, h: 0 };
    return { x: this.x - this.w / 2, y: this.y - this.curH, w: this.w, h: this.curH };
  }
  update(dt) {
    super.update(dt);
    this.timer -= dt;
    if (this.state === 'warn' && this.timer <= 0) { this.state = 'burn'; this.timer = this.burnT; }
    else if (this.state === 'burn') {
      this.curH = this.maxH * (0.75 + Math.sin(this.phase * 22) * 0.25);
      if (this.timer <= 0) this.dead = true;
    }
  }
  draw(ctx) {
    const bx = this.x, by = this.y;
    // vent
    ctx.fillStyle = '#4a3a33';
    ctx.fillRect(bx - this.w / 2, by - 8, this.w, 8);
    ctx.fillStyle = '#6b5348';
    for (let i = 0; i < 4; i++) ctx.fillRect(bx - this.w / 2 + 4 + i * 13, by - 7, 7, 6);
    if (this.state === 'warn') {
      const blink = Math.sin(this.phase * 18) > 0 ? 1 : 0.35;
      ctx.globalAlpha = blink;
      ctx.fillStyle = '#ffd54f';
      ctx.font = '900 34px Cairo, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('⚠', bx, by - 34);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,160,40,.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by - 8, 22 + Math.sin(this.phase * 10) * 3, 0, 6.283); ctx.stroke();
    } else {
      // flame
      const h = this.curH;
      const g1 = ctx.createLinearGradient(0, by, 0, by - h);
      g1.addColorStop(0, '#ff9f1c'); g1.addColorStop(0.5, '#ff5e3a'); g1.addColorStop(1, 'rgba(255,94,58,0)');
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.moveTo(bx - this.w / 2, by - 6);
      ctx.quadraticCurveTo(bx - this.w / 2 - 8, by - h * 0.5, bx - this.w / 2 + 4, by - h);
      ctx.quadraticCurveTo(bx, by - h * 1.18, bx + this.w / 2 - 4, by - h);
      ctx.quadraticCurveTo(bx + this.w / 2 + 8, by - h * 0.5, bx + this.w / 2, by - 6);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,150,.8)';
      ctx.beginPath();
      ctx.moveTo(bx - 12, by - 6);
      ctx.quadraticCurveTo(bx - 6, by - h * 0.5, bx, by - h * 0.62);
      ctx.quadraticCurveTo(bx + 8, by - h * 0.45, bx + 12, by - 6);
      ctx.closePath(); ctx.fill();
      // embers
      if (Math.random() < 0.3) {
        SR.fx.spawn({ x: bx + U.rand(-18, 18), y: by - h * U.rand(0.3, 0.9), vx: U.rand(-20, 20), vy: U.rand(-90, -30), life: 0, maxLife: 0.5, size: U.rand(1.5, 3), color: '#ffcf5c', grav: -60, drag: 0.6, kind: 'dot' });
      }
    }
  }
}

class Cactus extends Obstacle {          // runs at you
  constructor(x, season, g) {
    super(x, season, g);
    this.w = 40; this.h = 88; this.vx = -(g.speed * 0.55 + 190);
  }
  rect() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  update(dt) {
    super.update(dt);
    this.x += this.vx * dt;
  }
  draw(ctx) {
    const b = Math.sin(this.phase * 16) * 3;
    shadow(ctx, this.x, this.y, 44, 0.2);
    ctx.fillStyle = '#3e9e4d';
    ctx.beginPath(); ctx.ellipse(this.x, this.y - 40 + b, 15, 34, 0, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.ellipse(this.x - 20, this.y - 44 + b, 9, 22, -0.5, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.ellipse(this.x + 20, this.y - 48 + b, 9, 20, 0.5, 0, 6.283); ctx.fill();
    // spikes
    ctx.strokeStyle = '#cfe8c0'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * 6.283 + 0.5;
      ctx.beginPath();
      ctx.moveTo(this.x + Math.cos(a) * 15, this.y - 40 + b + Math.sin(a) * 15);
      ctx.lineTo(this.x + Math.cos(a) * 22, this.y - 40 + b + Math.sin(a) * 22);
      ctx.stroke();
    }
    // face
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(this.x - 5, this.y - 42 + b, 3.4, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(this.x + 5, this.y - 42 + b, 3.4, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#123';
    ctx.beginPath(); ctx.arc(this.x - 5, this.y - 42 + b, 1.6, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(this.x + 5, this.y - 42 + b, 1.6, 0, 6.283); ctx.fill();
    // running feet
    ctx.fillStyle = '#2f7d3b';
    const ff = Math.sin(this.phase * 20) * 5;
    ctx.beginPath(); ctx.ellipse(this.x - 9, this.y - 2 + ff, 6, 4, 0, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.ellipse(this.x + 9, this.y - 2 - ff, 6, 4, 0, 0, 6.283); ctx.fill();
  }
}

class Lens extends Obstacle {            // sun lens burning a spot
  constructor(x, season, g) {
    super(x, season, g);
    this.w = 62; this.h = 60;
    this.lensY = g.baseY - 190;
    this.warnT = U.rand(0.55, 0.75); this.beamT = U.rand(0.85, 1.1);
    this.state = 'warn'; this.timer = this.warnT;
  }
  rect() {
    if (this.state === 'warn') return { x: 0, y: 0, w: 0, h: 0 };
    return { x: this.x - 30, y: this.y - this.curH, w: 60, h: this.curH };
  }
  update(dt) {
    super.update(dt);
    this.timer -= dt;
    if (this.state === 'warn' && this.timer <= 0) { this.state = 'burn'; this.timer = this.beamT; }
    else if (this.state === 'burn') {
      this.curH = this.lensY - this.y + this.h + 10;
      if (this.timer <= 0) this.dead = true;
    }
  }
  draw(ctx) {
    const bx = this.x, ly = this.lensY;
    // support arm
    ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(bx, ly + 26); ctx.lineTo(bx, ly + 44); ctx.stroke();
    // lens
    ctx.fillStyle = 'rgba(140,220,255,.35)';
    ctx.beginPath(); ctx.arc(bx, ly, 26, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(180,235,255,.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(bx, ly, 26, 0, 6.283); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.beginPath(); ctx.arc(bx - 8, ly - 8, 7, 0, 6.283); ctx.fill();
    // ground spot
    if (this.state === 'warn') {
      const blink = Math.sin(this.phase * 14) > 0 ? 1 : 0.4;
      ctx.globalAlpha = blink;
      ctx.strokeStyle = '#ff9f43'; ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.ellipse(bx, this.y - 6, 34, 8, 0, 0, 6.283); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    } else {
      // beam
      const g1 = ctx.createLinearGradient(0, ly, 0, this.y);
      g1.addColorStop(0, 'rgba(255,230,120,.85)');
      g1.addColorStop(1, 'rgba(255,140,40,.25)');
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.moveTo(bx - 26, ly);
      ctx.lineTo(bx - 30, this.y);
      ctx.lineTo(bx + 30, this.y);
      ctx.lineTo(bx + 26, ly);
      ctx.closePath(); ctx.fill();
      // hot spot
      ctx.fillStyle = `rgba(255,120,30,${0.5 + Math.sin(this.phase * 20) * 0.2})`;
      ctx.beginPath(); ctx.ellipse(bx, this.y - 4, 32, 7, 0, 0, 6.283); ctx.fill();
      if (Math.random() < 0.4) SR.fx.spawn({ x: bx + U.rand(-26, 26), y: this.y - 8, vx: U.rand(-14, 14), vy: U.rand(-80, -30), life: 0, maxLife: 0.45, size: 2.5, color: '#ffb74d', grav: -40, drag: 0.5, kind: 'dot' });
    }
  }
}

/* ---------- 🍂 Autumn ---------- */

class Pile extends Obstacle {            // leaf pile hiding a log
  constructor(x, season, g) {
    super(x, season, g);
    this.w = 100; this.h = 40;
    this.revealed = false; this.log = Math.random() < 0.55;
  }
  rect() {
    if (!this.revealed) return { x: 0, y: 0, w: 0, h: 0 };   // harmless until revealed
    if (!this.log) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: this.x - 40, y: this.y - 58, w: 80, h: 58 };
  }
  update(dt) {
    super.update(dt);
    if (!this.revealed && this.g.distPx + this.g.W * 0.8 > this.x) {
      this.revealed = true;
      SR.fx.burst(this.x, this.y - 20, ['#e07b39', '#c96a2e', '#a85028'], 18, 160, { vy: -80, grav: 300 });
      if (this.log) SR.audio.play('land');
    }
  }
  draw(ctx) {
    const wob = Math.sin(this.phase * 6) * 3;
    if (!this.revealed || !this.log) {
      shadow(ctx, this.x, this.y, 90, 0.14);
      ctx.fillStyle = '#c97b3d';
      ctx.beginPath(); ctx.ellipse(this.x, this.y - 8 + wob * 0.4, 46, 16, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#e08a45';
      ctx.beginPath(); ctx.ellipse(this.x + 12, this.y - 14 + wob * 0.5, 28, 11, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#b05c28';
      ctx.beginPath(); ctx.ellipse(this.x - 20, this.y - 6, 22, 9, 0, 0, 6.283); ctx.fill();
      // leaf details
      ctx.strokeStyle = '#8a4a1f'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * 6.283 + wob * 0.05;
        ctx.beginPath(); ctx.moveTo(this.x + Math.cos(a) * 30, this.y - 8 + Math.sin(a) * 8);
        ctx.lineTo(this.x + Math.cos(a) * 40, this.y - 8 + Math.sin(a) * 12); ctx.stroke();
      }
    } else {
      // revealed log
      shadow(ctx, this.x, this.y, 80, 0.2);
      ctx.fillStyle = '#7a4a2b';
      ctx.beginPath(); ctx.roundRect(this.x - 40, this.y - 56, 80, 56, 8); ctx.fill();
      ctx.fillStyle = '#8f5a33';
      ctx.beginPath(); ctx.roundRect(this.x - 40, this.y - 44, 80, 12, 6); ctx.fill();
      ctx.strokeStyle = '#5d371e'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(this.x - 24 + i * 22, this.y - 28, 8, 0, 6.283); ctx.stroke();
      }
    }
  }
}

class Whirl extends Obstacle {           // flings you
  constructor(x, season, g) {
    super(x, season, g);
    this.w = 74; this.h = 160;
    this.dir = Math.random() < 0.5 ? 1 : -1;
  }
  rect() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  onTouch() {
    const g = this.g;
    g.player.fling(-this.dir * 460, -920);
    SR.audio.play('whirl');
    SR.fx.ring(this.x, this.y - 80, '#d9d9d9', 70);
    SR.fx.shake(0.35);
    this.dead = true;
  }
  draw(ctx) {
    const bx = this.x, by = this.y;
    shadow(ctx, bx, by, 60, 0.08);
    const cols = ['rgba(200,190,180,.28)', 'rgba(235,225,210,.22)', 'rgba(170,160,150,.18)'];
    for (let i = 0; i < 5; i++) {
      const yOff = this.h * (0.22 + i * 0.16);
      const wob = Math.sin(this.phase * 8 + i * 1.3) * 10;
      const r = 30 - i * 4 + Math.sin(this.phase * 10 + i) * 3;
      ctx.fillStyle = cols[i % 3];
      ctx.beginPath();
      ctx.ellipse(bx + wob * this.dir, by - yOff, r * (1 + Math.sin(this.phase * 7 + i) * 0.15), 9, 0, 0, 6.283);
      ctx.fill();
    }
    // leaves spiraling
    if (Math.random() < 0.5) {
      SR.fx.spawn({
        x: bx + Math.sin(this.phase * 9 + this.x) * 20, y: by - U.rand(30, this.h - 20),
        vx: Math.cos(this.phase * 8) * 60, vy: -120 - U.rand(0, 60),
        life: 0, maxLife: 0.5, size: 4, color: '#e08a45', grav: 0, drag: 0.3, kind: 'star', tw: 8,
      });
    }
  }
}

class Mushroom extends Obstacle {        // explodes on proximity
  constructor(x, season, g) {
    super(x, season, g);
    this.w = 52; this.h = 70;
    this.state = 'idle'; this.timer = 0;
  }
  rect() {
    if (this.state === 'boom') return { x: 0, y: 0, w: 0, h: 0 };
    return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
  }
  update(dt) {
    super.update(dt);
    if (this.state === 'idle' && this.x - this.g.player.x < 150) {
      this.state = 'shake'; this.timer = 0.35;
    } else if (this.state === 'shake') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'boom'; this.timer = 0.25;
        SR.audio.play('explode');
        SR.fx.burst(this.x, this.y - 40, ['#c62828', '#8e24aa', '#ffb74d', '#4e342e'], 34, 320, { grav: 500 });
        SR.fx.ring(this.x, this.y - 40, '#ff8a80', 90, 0.4);
        SR.fx.shake(0.5); SR.fx.hitstop(0.06);
        // ground-level blast: jump over the mushroom to stay safe
        if (Math.abs(this.x - this.g.player.x) < 70 && this.g.player.y > this.y - 55) {
          this.g.damagePlayer(null);
        }
      }
    } else if (this.state === 'boom') {
      this.timer -= dt;
      if (this.timer <= 0) this.dead = true;
    }
  }
  draw(ctx) {
    const s = this.state === 'shake' ? Math.sin(this.phase * 60) * 3 : 0;
    const bx = this.x + s, by = this.y;
    shadow(ctx, bx, by, 46, 0.16);
    // stem
    ctx.fillStyle = '#f3e3c3';
    ctx.beginPath(); ctx.roundRect(bx - 10, by - 42, 20, 42, 6); ctx.fill();
    // cap
    const wob = this.state === 'boom' ? 0 : 1;
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath(); ctx.ellipse(bx, by - 46, 26 * wob, 20 * wob, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath(); ctx.arc(bx - 10, by - 50, 5, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 9, by - 44, 4, 0, 6.283); ctx.fill();
    // eyes
    if (this.state === 'idle' || this.state === 'shake') {
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(bx - 6, by - 52, 2.6, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(bx + 6, by - 52, 2.6, 0, 6.283); ctx.fill();
    }
    if (this.state === 'shake') {
      ctx.strokeStyle = 'rgba(255,200,50,.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx - 20, by - 70); ctx.lineTo(bx - 32, by - 84);
      ctx.moveTo(bx + 20, by - 70); ctx.lineTo(bx + 32, by - 84);
      ctx.moveTo(bx, by - 68); ctx.lineTo(bx, by - 86); ctx.stroke();
    }
  }
}

class Fox extends Obstacle {             // dashes across
  constructor(x, season, g) {
    super(x, season, g);
    this.w = 66; this.h = 42;
    this.vx = -(g.speed * 0.7 + 260);
    this.dir = -1;
  }
  rect() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  update(dt) {
    super.update(dt);
    this.x += this.vx * dt;
    if (this.x < -200) this.dead = true;
  }
  draw(ctx) {
    const run = Math.sin(this.phase * 26);
    const bx = this.x, by = this.y;
    shadow(ctx, bx, by, 60, 0.16);
    // body
    ctx.fillStyle = '#d97b35';
    ctx.beginPath(); ctx.ellipse(bx, by - 24 + Math.abs(run) * 2, 26, 14, 0, 0, 6.283); ctx.fill();
    // head
    ctx.fillStyle = '#e8914a';
    ctx.beginPath(); ctx.moveTo(bx - 34, by - 22);
    ctx.lineTo(bx - 46, by - 34); ctx.lineTo(bx - 30, by - 36);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(bx - 34, by - 28, 2.4, 0, 6.283); ctx.fill();
    // tail
    ctx.fillStyle = '#c96a2e';
    ctx.beginPath();
    ctx.moveTo(bx + 22, by - 26);
    ctx.quadraticCurveTo(bx + 42, by - 42 + run * 4, bx + 50, by - 30 + run * 6);
    ctx.quadraticCurveTo(bx + 44, by - 22, bx + 26, by - 18);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(bx + 46, by - 28 + run * 6, 4, 0, 6.283); ctx.fill();
    // legs
    ctx.fillStyle = '#b85f22';
    const l1 = run * 6, l2 = -run * 6;
    ctx.fillRect(bx - 14, by - 10 + l1, 5, 12 - l1);
    ctx.fillRect(bx + 4, by - 10 + l2, 5, 12 - l2);
  }
}

/* ---------- ❄️ Winter ---------- */

class Icefall extends Obstacle {         // block falls after shadow telegraph
  constructor(x, season, g) {
    super(x, season, g);
    this.w = 66; this.h = 66;
    this.state = 'warn'; this.timer = 0.9; this.speed = 0;
    this.blockY = -100;
  }
  rect() {
    if (this.state === 'warn' || this.state === 'done') return { x: 0, y: 0, w: 0, h: 0 };
    return { x: this.x - this.w / 2, y: this.blockY, w: this.w, h: this.h };
  }
  update(dt) {
    super.update(dt);
    if (this.state === 'warn') {
      this.timer -= dt;
      if (this.timer <= 0) { this.state = 'fall'; this.speed = 900; SR.audio.play('slide'); }
    } else if (this.state === 'fall') {
      this.speed += 2400 * dt;
      this.blockY += this.speed * dt;
      if (this.blockY + this.h >= this.y) {
        this.blockY = this.y - this.h;
        this.state = 'landed'; this.timer = 3.6;
        SR.audio.play('explode'); SR.fx.shake(0.4);
        SR.fx.burst(this.x, this.y, ['#dcecf7', '#ffffff'], 16, 220, { vy: -140 });
      }
    } else if (this.state === 'landed') {
      this.timer -= dt;
      if (this.timer <= 0) { this.state = 'done'; this.timer = 0.6; }
      // crack
      if (Math.random() < 0.1) SR.fx.sparkle(this.x + U.rand(-20, 20), this.y - this.h + U.rand(0, 40), '#bfe3f5', 1);
    } else if (this.state === 'done') {
      this.timer -= dt;
      if (this.timer <= 0) this.dead = true;
    }
  }
  draw(ctx) {
    const bx = this.x;
    if (this.state === 'warn') {
      const blink = Math.sin(this.phase * 12) > 0 ? 0.65 : 0.3;
      ctx.fillStyle = `rgba(30,60,90,${blink * 0.4})`;
      ctx.beginPath(); ctx.ellipse(bx, this.y - 4, this.w / 2 + 4, 7, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${blink})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(bx, this.y - 4, this.w / 2 + 4, 7, 0, 0, 6.283); ctx.stroke();
    } else if (this.state === 'fall' || this.state === 'landed' || this.state === 'done') {
      const by = this.state === 'warn' ? -100 : this.blockY;
      shadow(ctx, bx, this.y, this.w + 8, 0.16);
      const g1 = ctx.createLinearGradient(0, by, 0, by + this.h);
      g1.addColorStop(0, '#e8f6ff'); g1.addColorStop(1, '#b5d9ee');
      ctx.fillStyle = g1;
      ctx.beginPath(); ctx.roundRect(bx - this.w / 2, by, this.w, this.h, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(bx - this.w / 2, by, this.w, this.h, 10); ctx.stroke();
      ctx.strokeStyle = 'rgba(160,200,230,.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(bx - 16, by + 10); ctx.lineTo(bx - 4, by + 34);
      ctx.moveTo(bx + 14, by + 20); ctx.lineTo(bx + 6, by + 44);
      ctx.moveTo(bx - 2, by + 40); ctx.lineTo(bx + 10, by + 56);
      ctx.stroke();
      // sparkle
      if (this.state === 'landed' && Math.sin(this.phase * 8) > 0.6) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(bx + 12, by + 14, 3, 0, 6.283); ctx.fill();
      }
    }
  }
}

class Snowman extends Obstacle {         // patrols side to side
  constructor(x, season, g) {
    super(x, season, g);
    this.w = 78; this.h = 118;
    this.amp = U.rand(45, 60); this.speed = U.rand(0.7, 1.0); this.off = U.rand(0, 6.28);
    this.ox = x;
  }
  rect() {
    return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
  }
  update(dt) {
    super.update(dt);
    this.x = this.ox + Math.sin(this.phase * this.speed * 1.6 + this.off) * this.amp;
  }
  draw(ctx) {
    const bx = this.x, by = this.y;
    shadow(ctx, bx, by, 70, 0.18);
    const bob = Math.sin(this.phase * 3) * 1.5;
    // bottom & middle & head
    ctx.fillStyle = '#f4fbff';
    ctx.beginPath(); ctx.arc(bx, by - 22, 30, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(bx, by - 62 + bob, 21, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(bx, by - 92 + bob, 14, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(160,200,230,.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(bx, by - 22, 30, 0, 6.283); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx, by - 62 + bob, 21, 0, 6.283); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx, by - 92 + bob, 14, 0, 6.283); ctx.stroke();
    // hat
    ctx.fillStyle = '#3d5a73';
    ctx.fillRect(bx - 11, by - 118 + bob, 22, 12);
    ctx.fillRect(bx - 16, by - 108 + bob, 32, 5);
    // face
    ctx.fillStyle = '#1a2a38';
    ctx.beginPath(); ctx.arc(bx - 5, by - 94 + bob, 2, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 5, by - 94 + bob, 2, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#ff7d3d';
    ctx.beginPath(); ctx.moveTo(bx - 2, by - 90 + bob); ctx.lineTo(bx + 7, by - 88 + bob); ctx.lineTo(bx - 2, by - 85 + bob); ctx.closePath(); ctx.fill();
    // buttons
    ctx.fillStyle = '#3d5a73';
    ctx.beginPath(); ctx.arc(bx, by - 70 + bob, 2.2, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(bx, by - 58 + bob, 2.2, 0, 6.283); ctx.fill();
    // scarf
    ctx.strokeStyle = '#e05a5a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx - 12, by - 82 + bob); ctx.quadraticCurveTo(bx, by - 74 + bob, bx + 12, by - 82 + bob); ctx.stroke();
    // arms (twig)
    ctx.strokeStyle = '#7a4a2b'; ctx.lineWidth = 3;
    const sway = Math.sin(this.phase * 2.4) * 3;
    ctx.beginPath(); ctx.moveTo(bx - 26, by - 64 + bob); ctx.lineTo(bx - 44, by - 74 + bob + sway); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + 26, by - 64 + bob); ctx.lineTo(bx + 44, by - 74 + bob - sway); ctx.stroke();
  }
}

class Bear extends Obstacle {            // sleeping; chases if woken
  constructor(x, season, g) {
    super(x, season, g);
    this.w = 108; this.h = 76;
    this.state = 'sleep'; this.chaseT = 0; this.zzz = 0;
  }
  rect() {
    if (this.state === 'sleep') return { x: 0, y: 0, w: 0, h: 0 };   // harmless while sleeping
    return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
  }
  update(dt) {
    super.update(dt);
    if (this.state === 'sleep') {
      this.zzz += dt;
      if (this.x - this.g.player.x < 130 && this.x - this.g.player.x > -60) {
        this.state = 'chase'; this.chaseT = 5;
        SR.audio.play('roar'); SR.fx.shake(0.4);
        SR.toast(SR.t('toast.bear'));
      }
    } else if (this.state === 'chase') {
      this.chaseT -= dt;
      this.vx = this.g.speed * 0.5 + 300;
      this.x += this.vx * dt;
      if (this.chaseT <= 0) this.state = 'rest';
      if (Math.random() < 0.15) SR.audio.play('bearStep');
    } else {
      this.state = 'rest';
      this.chaseT -= dt;
      if (this.chaseT <= -2) this.dead = true;
    }
  }
  draw(ctx) {
    const bx = this.x, by = this.y;
    if (this.state === 'sleep') {
      shadow(ctx, bx, by, 100, 0.2);
      ctx.fillStyle = '#8a5a3b';
      ctx.beginPath(); ctx.ellipse(bx, by - 30, 48, 30, 0, 0, 6.283); ctx.fill();
      // head resting
      ctx.beginPath(); ctx.arc(bx - 40, by - 30, 20, 0, 6.283); ctx.fill();
      // ears
      ctx.beginPath(); ctx.arc(bx - 48, by - 44, 7, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(bx - 32, by - 46, 7, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#6e4529';
      ctx.beginPath(); ctx.arc(bx - 48, by - 44, 3.4, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(bx - 32, by - 46, 3.4, 0, 6.283); ctx.fill();
      // closed eye
      ctx.strokeStyle = '#3d2415'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(bx - 44, by - 32, 6, 0.3, 2.8); ctx.stroke();
      // breathing
      const b = Math.sin(this.phase * 2.4) * 2;
      ctx.strokeStyle = 'rgba(60,35,15,.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx + 8, by - 44 - b, 5, 0, 6.283); ctx.stroke();
      // Zzz
      if (this.zzz % 1.6 < 1.1) {
        const zt = (this.zzz % 1.6) / 1.1;
        ctx.font = '900 ' + (14 + zt * 8) + 'px Cairo, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255,255,255,${1 - zt})`;
        ctx.fillText('Z', bx + 46 + zt * 16, by - 52 - zt * 26);
      }
    } else {
      const run = Math.sin(this.phase * 18) * 4;
      shadow(ctx, bx, by, 100, 0.2);
      // body
      ctx.fillStyle = '#8a5a3b';
      ctx.beginPath(); ctx.ellipse(bx, by - 40 + Math.abs(run) * 2, 44, 30, 0, 0, 6.283); ctx.fill();
      // head
      ctx.beginPath(); ctx.arc(bx - 40, by - 44, 22, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(bx - 50, by - 60, 8, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(bx - 32, by - 62, 8, 0, 6.283); ctx.fill();
      // angry eye
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(bx - 46, by - 46, 5, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#1a0e05';
      ctx.beginPath(); ctx.arc(bx - 44, by - 46, 2.6, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#3d2415'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(bx - 54, by - 56); ctx.lineTo(bx - 38, by - 52); ctx.stroke();
      // mouth
      ctx.strokeStyle = '#3d2415'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx - 40, by - 38, 6, 0.3, 2.6); ctx.stroke();
      // legs
      ctx.fillStyle = '#6e4529';
      ctx.fillRect(bx - 26, by - 12 + run, 12, 14 - run);
      ctx.fillRect(bx + 8, by - 12 - run, 12, 14 + run);
      ctx.fillRect(bx - 2, by - 12 + run, 12, 14 - run);
      ctx.fillRect(bx + 22, by - 12 - run, 12, 14 + run);
      // dust
      if (Math.random() < 0.5) {
        SR.fx.spawn({ x: bx - 30, y: by - 4, vx: U.rand(-40, 10), vy: U.rand(-30, -10), life: 0, maxLife: 0.4, size: U.rand(3, 6), color: 'rgba(255,255,255,.7)', grav: 100, drag: 2, kind: 'dot' });
      }
    }
  }
}

/* ================= Pickups ================= */

class Pickup {
  constructor(x, y, type, g) {
    this.x = x; this.y = y; this.type = type; this.g = g;
    this.phase = U.rand(0, 6.28); this.dead = false;
  }
  update(dt) { this.phase += dt; }
}

class Coin extends Pickup {
  constructor(x, y, g) { super(x, y, 'coin', g); this.r = 13; }
  draw(ctx) {
    const bob = Math.sin(this.phase * 4.4) * 4;
    const y = this.y + bob;
    const sc = 1 + Math.sin(this.phase * 5) * 0.08;
    ctx.save();
    ctx.translate(this.x, y);
    ctx.scale(sc, sc);
    ctx.rotate(Math.sin(this.phase * 3) * 0.25);
    // glow
    ctx.fillStyle = 'rgba(140,220,120,.25)';
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, 6.283); ctx.fill();
    // leaf
    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.quadraticCurveTo(-11, 4, -7, -8);
    ctx.quadraticCurveTo(0, -11, 7, -8);
    ctx.quadraticCurveTo(11, 4, 0, 10);
    ctx.fill();
    ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -9); ctx.stroke();
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.ellipse(-3, -4, 2.6, 4, 0.6, 0, 6.283); ctx.fill();
    ctx.restore();
  }
}

class Gem extends Pickup {
  constructor(x, y, g) { super(x, y, 'gem', g); this.r = 16; }
  draw(ctx) {
    const bob = Math.sin(this.phase * 3.2) * 6;
    const y = this.y + bob;
    ctx.save();
    ctx.translate(this.x, y);
    ctx.rotate(Math.sin(this.phase * 2.2) * 0.2);
    // glow
    const gl = 0.3 + Math.sin(this.phase * 5) * 0.15;
    ctx.fillStyle = `rgba(150,120,255,${gl})`;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, 6.283); ctx.fill();
    // diamond
    ctx.fillStyle = '#9c7bff';
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.lineTo(13, -4); ctx.lineTo(0, 16); ctx.lineTo(-13, -4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c4b0ff';
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.lineTo(13, -4); ctx.lineTo(0, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a55e8';
    ctx.beginPath();
    ctx.moveTo(-13, -4); ctx.lineTo(0, 0); ctx.lineTo(0, 16);
    ctx.closePath(); ctx.fill();
    // sparkle
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-4, -6, 2.4, 0, 6.283); ctx.fill();
    if (Math.sin(this.phase * 6) > 0.5) {
      ctx.beginPath(); ctx.arc(5, 2, 1.6, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }
}

const POWER_INFO = {
  shield: { icon: '🛡️', color: '#4dd0c7', nameKey: 'pow.shield' },
  magnet: { icon: '🧲', color: '#ff9f43', nameKey: 'pow.magnet' },
  freeze: { icon: '⏳', color: '#4fc3f7', nameKey: 'pow.freeze' },
  eagle: { icon: '🦅', color: '#ffd54f', nameKey: 'pow.eagle' },
  lock: { icon: '🔒', color: '#b39cff', nameKey: 'pow.lock' },
  star: { icon: '⭐', color: '#ffe082', nameKey: 'pow.star' },
};

class PowerUp extends Pickup {
  constructor(x, y, type, g) { super(x, y, type, g); this.r = 19; }
  draw(ctx) {
    const info = POWER_INFO[this.type];
    const bob = Math.sin(this.phase * 3.6) * 6;
    const y = this.y + bob;
    ctx.save();
    ctx.translate(this.x, y);
    ctx.rotate(Math.sin(this.phase * 2) * 0.12);
    // ring glow
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + Math.sin(this.phase * 6) * 0.2})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, 6.283); ctx.stroke();
    // tile
    const g1 = ctx.createLinearGradient(0, -18, 0, 18);
    g1.addColorStop(0, '#ffffff'); g1.addColorStop(1, '#d8e6f0');
    ctx.fillStyle = g1;
    ctx.beginPath(); ctx.roundRect(-17, -17, 34, 34, 9); ctx.fill();
    ctx.strokeStyle = info.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-17, -17, 34, 34, 9); ctx.stroke();
    // icon
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(info.icon, 0, 1);
    ctx.restore();
    // ambient sparkles
    if (Math.random() < 0.12) SR.fx.sparkle(this.x + U.rand(-14, 14), y + U.rand(-14, 14), info.color, 1);
  }
}

SR.Obstacles = { Obstacle, Branch, Bee, Mud, Flower, Fire, Cactus, Lens, Pile, Whirl, Mushroom, Fox, Icefall, Snowman, Bear, Coin, Gem, PowerUp, POWER_INFO };
SR.obstacleClass = name => SR.Obstacles[name[0].toUpperCase() + name.slice(1)];
