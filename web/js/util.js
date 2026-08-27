'use strict';
/* ---- Canvas roundRect polyfill (older WebViews) ---- */
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (typeof r === 'number') r = Math.min(r, w / 2, h / 2);
    else r = 6;
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

/* ---- Shared math / helpers ---- */
const U = {
  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(U.rand(a, b + 1)); },
  choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
  lerp(a, b, t) { return a + (b - a) * t; },
  dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
  hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
  rgb(r, g, b, a = 1) { return `rgba(${r | 0},${g | 0},${b | 0},${a})`; },
  hex(r, g, b) {
    const h = n => ('0' + Math.round(U.clamp(n, 0, 255)).toString(16)).slice(-2);
    return '#' + h(r) + h(g) + h(b);
  },
  mix(c1, c2, t) {
    const a = U.hexToRgb(c1), b = U.hexToRgb(c2);
    return U.hex(U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t));
  },
  mixA(c1, c2, t, a) {
    const a1 = U.hexToRgb(c1), b1 = U.hexToRgb(c2);
    return U.rgb(U.lerp(a1[0], b1[0], t), U.lerp(a1[1], b1[1], t), U.lerp(a1[2], b1[2], t), a);
  },
  /* deterministic pseudo-random per tile index */
  hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); },
  fmt(n) { return n >= 1000 ? ((n / 1000).toFixed(1).replace(/\.0$/, '') + 'k') : '' + Math.round(n); },
  pad(n, l) { n = '' + n; while (n.length < l) n = '0' + n; return n; },
  clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); },
  smooth(t) { t = U.clamp01(t); return t * t * (3 - 2 * t); },
};

/* ---- Error reporting hook ----------------------------------------------
   Attached to SR in data.js (SR is created there). Used by game.js/main.js
   so a rendering failure surfaces in the recovery overlay instead of
   leaving the player staring at a black screen.
---------------------------------------------------------------------- */
function __srReportError(label, err, extra) {
  try {
    const rec = {
      label: label || 'error',
      msg: String((err && err.message) || err || ''),
      extra: extra === undefined ? null : extra,
      at: Date.now(),
    };
    if (typeof SR !== 'undefined' && SR) {
      SR.lastError = rec;
      if (!SR.errors) SR.errors = [];
      SR.errors.push(rec);
      if (SR.errors.length > 20) SR.errors.shift();
    }
    if (typeof console !== 'undefined' && console.warn) console.warn('[SeasonRunner] ' + rec.label, err);
  } catch (e) { /* reporting must never throw */ }
}
