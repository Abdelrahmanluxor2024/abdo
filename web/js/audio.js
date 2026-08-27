'use strict';
/* ================================================================
   Season Runner — WebAudio engine: procedural music + SFX
   No audio files: everything is synthesized at runtime.
================================================================ */
SR.audio = (() => {
  let ctx = null, master = null, musicBus = null, sfxBus = null;
  let track = null;           // active music track
  let sfxEnabled = true, musicEnabled = true;
  const TRACK_LEN = 32;       // 32 eighth-notes = 4 bars

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = musicEnabled ? 0.85 : 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxEnabled ? 1 : 0; sfxBus.connect(master);
    startScheduler();
  }

  /* ---------- generic note helper ---------- */
  function tone(opts) {
    if (!ctx) return;
    const { type = 'sine', freq = 440, freqEnd, dur = 0.2, vol = 0.2, attack = 0.005, when = 0, bus = sfxBus, curve = 'exp' } = opts;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    else g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(bus);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  function noise(opts) {
    if (!ctx) return;
    const { dur = 0.2, vol = 0.2, freq = 1200, freqEnd, type = 'highpass', when = 0, bus = sfxBus } = opts;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  const midi = m => 440 * Math.pow(2, (m - 69) / 12);

  /* ============ Music sequencer ============ */
  function startTrack(season, fadeIn) {
    stopTrack(fadeIn === undefined ? 0.6 : fadeIn);
    const cfg = season.music;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.connect(musicBus);
    track = {
      cfg, gain, step: 0, nextTime: ctx.currentTime + 0.12, bar: 0,
      schedule() {
        while (this.nextTime < ctx.currentTime + 0.3) {
          this.stepEvents(this.step, this.nextTime);
          this.step = (this.step + 1) % TRACK_LEN;
          if (this.step === 0) this.bar++;
          this.nextTime += 60 / cfg.bpm / 2;   // eighth note
        }
      },
      stop() {
        try {
          gain.gain.cancelScheduledValues(ctx.currentTime);
          gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
        } catch (e) {}
        setTimeout(() => { try { gain.disconnect(); } catch (e) {} }, 1200);
      },
    };
    if (fadeIn) {
      gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + fadeIn);
    } else {
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
    }
  }

  function stopTrack(fade) {
    if (track) { track.stop(); track = null; }
  }

  const BASS_PATTERNS = {
    four: s => s % 8 === 0,
    eight: s => s % 4 === 0,
    two: s => s % 16 === 0,
    off: s => s % 4 === 2,
  };

  function stepEvents(step, t, self) {
    const cfg = self.cfg;
    const bpm = cfg.bpm;
    const bar = self.bar;
    const chord = cfg.chords[bar % cfg.chords.length];
    const scale = cfg.scale;
    const isBarStart = step % 16 === 0;
    const isBarHalf = step % 16 === 8;

    /* kick */
    if (cfg.kick && (step % 8 === 0)) {
      tone({ type: 'sine', freq: 150, freqEnd: 42, dur: 0.18, vol: 0.5, when: t - ctx.currentTime, bus: musicBus });
    }
    /* hat */
    if (cfg.hat && step % 2 === 1) {
      noise({ dur: 0.05, vol: step % 4 === 3 ? 0.05 : 0.028, freq: 8000, type: 'highpass', when: t - ctx.currentTime, bus: musicBus });
    }
    /* bass */
    const bPat = cfg.bpm >= 120 ? 'eight' : (cfg.pad ? 'four' : 'two');
    if (BASS_PATTERNS[bPat](step)) {
      const root = chord[0] - 12;
      tone({ type: cfg.bassWave, freq: midi(root), dur: bPat === 'eight' ? 0.11 : 0.42, vol: 0.16, when: t - ctx.currentTime, bus: musicBus });
    }
    /* arp (eighths) */
    if (cfg.arp && !cfg.pad) {
      const idx = [0, 1, 2, 1][step % 4];
      const n = chord[idx] + (idx === 2 ? 12 : 0);
      tone({ type: cfg.leadWave, freq: midi(n), dur: 0.09, vol: 0.07, when: t - ctx.currentTime, bus: musicBus });
    }
    /* pad: sustained chord each bar */
    if (cfg.pad && isBarStart) {
      chord.forEach(n => {
        tone({ type: 'sawtooth', freq: midi(n - 12), dur: 60 / bpm * 3.6, vol: 0.028, attack: 0.6, when: t - ctx.currentTime, bus: musicBus });
        tone({ type: 'sawtooth', freq: midi(n - 12 + 0.35), dur: 60 / bpm * 3.6, vol: 0.02, attack: 0.6, when: t - ctx.currentTime, bus: musicBus });
      });
    }
    /* lead motif: every 2nd & 4th bar */
    if (isBarStart && (bar % 4 === 1 || bar % 4 === 3)) {
      const root = chord[0];
      const motif = [0, 2, 4, 2, 5, 4, 2, 0];
      for (let i = 0; i < 4; i++) {
        const deg = motif[(bar * 4 + i) % motif.length];
        tone({ type: cfg.leadWave, freq: midi(root + 12 + scale[deg % scale.length]), dur: 0.14, vol: 0.065, when: t - ctx.currentTime + i * (60 / bpm / 2) * 2, bus: musicBus });
      }
    }
  }

  function startScheduler() {
    setInterval(() => { if (track) track.schedule(); }, 30);
  }

  /* ============ SFX ============ */
  const SFX = {
    click() { tone({ type: 'triangle', freq: 620, freqEnd: 880, dur: 0.07, vol: 0.12 }); },
    jump() { tone({ type: 'square', freq: 300, freqEnd: 640, dur: 0.13, vol: 0.08 }); },
    jump2() { tone({ type: 'square', freq: 420, freqEnd: 900, dur: 0.13, vol: 0.08 }); },
    land() { noise({ dur: 0.08, vol: 0.08, freq: 500, freqEnd: 200, type: 'lowpass' }); },
    slide() { noise({ dur: 0.35, vol: 0.06, freq: 900, freqEnd: 300, type: 'bandpass' }); },
    dash() { noise({ dur: 0.3, vol: 0.14, freq: 600, freqEnd: 3200, type: 'bandpass' }); tone({ type: 'sawtooth', freq: 200, freqEnd: 800, dur: 0.3, vol: 0.05 }); },
    coin(i = 0) { tone({ type: 'triangle', freq: 880 + i * 60, dur: 0.09, vol: 0.09 }); tone({ type: 'triangle', freq: 1320 + i * 60, dur: 0.14, vol: 0.07, when: 0.05 }); },
    gem() { [0, 4, 7, 12].forEach((s, i) => tone({ type: 'sine', freq: 1046 * Math.pow(2, s / 12), dur: 0.5, vol: 0.12, when: i * 0.07 })); },
    hit() { tone({ type: 'sawtooth', freq: 240, freqEnd: 60, dur: 0.35, vol: 0.25 }); noise({ dur: 0.3, vol: 0.2, freq: 800, freqEnd: 100, type: 'lowpass' }); },
    power() { [0, 4, 7, 12, 16].forEach((s, i) => tone({ type: 'square', freq: 523 * Math.pow(2, s / 12), dur: 0.12, vol: 0.07, when: i * 0.06 })); },
    shieldBreak() { noise({ dur: 0.25, vol: 0.2, freq: 3000, type: 'highpass' }); tone({ type: 'triangle', freq: 1200, freqEnd: 200, dur: 0.25, vol: 0.1 }); },
    starHit() { noise({ dur: 0.15, vol: 0.12, freq: 2000, freqEnd: 400, type: 'bandpass' }); tone({ type: 'square', freq: 700, freqEnd: 1400, dur: 0.1, vol: 0.06 }); },
    season() { [0, 3, 7, 12, 19].forEach((s, i) => tone({ type: 'sine', freq: 660 * Math.pow(2, s / 12), dur: 0.6, vol: 0.1, when: i * 0.09 })); noise({ dur: 1.2, vol: 0.04, freq: 4000, freqEnd: 1200, type: 'bandpass', when: 0.4 }); },
    explode() { noise({ dur: 0.4, vol: 0.22, freq: 500, freqEnd: 80, type: 'lowpass' }); tone({ type: 'sawtooth', freq: 160, freqEnd: 40, dur: 0.35, vol: 0.15 }); },
    whirl() { tone({ type: 'sine', freq: 200, freqEnd: 1200, dur: 0.4, vol: 0.12 }); noise({ dur: 0.4, vol: 0.1, freq: 600, freqEnd: 3000, type: 'bandpass' }); },
    splash() { noise({ dur: 0.3, vol: 0.12, freq: 800, freqEnd: 200, type: 'lowpass' }); },
    roar() { tone({ type: 'sawtooth', freq: 130, freqEnd: 70, dur: 0.5, vol: 0.2 }); tone({ type: 'square', freq: 90, freqEnd: 55, dur: 0.5, vol: 0.1, when: 0.05 }); },
    freeze() { [0, 7, 12].forEach((s, i) => tone({ type: 'sine', freq: 1568 * Math.pow(2, s / 12), dur: 0.5, vol: 0.06, when: i * 0.05 })); },
    over() { [0, -2, -4, -7].forEach((s, i) => tone({ type: 'triangle', freq: 523 * Math.pow(2, s / 12), dur: 0.35, vol: 0.12, when: i * 0.18 })); },
    fanfare() { [0, 4, 7, 12, 16, 19].forEach((s, i) => tone({ type: 'square', freq: 523 * Math.pow(2, s / 12), dur: 0.22, vol: 0.08, when: i * 0.11 })); },
    count() { tone({ type: 'square', freq: 660, dur: 0.12, vol: 0.1 }); },
    go() { tone({ type: 'square', freq: 880, dur: 0.25, vol: 0.12 }); tone({ type: 'square', freq: 1320, dur: 0.35, vol: 0.1, when: 0.1 }); },
    bearStep() { noise({ dur: 0.06, vol: 0.1, freq: 250, freqEnd: 120, type: 'lowpass' }); },
  };

  function play(name, arg) { if (!ctx || !sfxEnabled) return; try { SFX[name] && SFX[name](arg); } catch (e) {} }

  /* ---------- public API ---------- */
  return {
    init, play,
    unlock() { ctx && ctx.resume && ctx.resume(); },
    setSfx(v) { sfxEnabled = v; if (sfxBus && ctx) sfxBus.gain.setValueAtTime(v ? 1 : 0, ctx.currentTime); },
    setMusic(v) { musicEnabled = v; if (musicBus && ctx) musicBus.gain.setValueAtTime(v ? 0.85 : 0, ctx.currentTime); },
    startMusic(season) { if (!ctx) return; startTrack(season, 1.2); },
    stopMusic() { stopTrack(0.5); },
    isReady() { return !!ctx; },
  };
})();
