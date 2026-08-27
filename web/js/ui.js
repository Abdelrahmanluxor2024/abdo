'use strict';
/* ================================================================
   Season Runner — UI: screens, HUD, persistence, i18n
================================================================ */

/* ---------------- Save / progress ---------------- */
SR.save = (() => {
  const KEY = 'season_runner_v1';
  const DEFAULT = {
    leaves: 0, gems: 0,
    bestDist: 0, bestScore: 0, bestStreak: 0,
    runs: 0, totalLeaves: 0, totalGems: 0, runCount: 0,
    skins: ['nuro'], skin: 'nuro',
    lang: 'ar', sound: true, music: true, vibrate: true,
    leaderboard: [],
    seenHowto: false,
    usedCodes: [],
  };
  let progress = Object.assign({}, DEFAULT);

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) progress = Object.assign({}, DEFAULT, JSON.parse(raw));
    } catch (e) {}
    return progress;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) {}
  }
  function reset() {
    progress = Object.assign({}, DEFAULT);
    save();
  }

  /* Credit one gem shard to the wallet and announce any season it unlocks.
     NOTE: gems used to be counted but never actually added to `progress.gems`,
     which is why seasons/story never unlocked. */
  function onGemCollected(quiet) {
    const before = SR.unlockedSeasons(progress);
    progress.gems = (progress.gems || 0) + 1;
    const after = SR.unlockedSeasons(progress);
    save();
    if (after > before) {
      const map = { 2: 'toast.unlockSummer', 3: 'toast.unlockAutumn', 4: 'toast.unlockWinter' };
      if (!quiet) {
        for (let n = before + 1; n <= after; n++) {
          if (map[n]) setTimeout(msg => SR.toast(SR.t(msg)), 700, map[n]);
        }
      }
      try { SR.game.refreshRotation(); } catch (e) {}
    }
    if (typeof SR.ui !== 'undefined' && SR.ui.refreshStory) SR.ui.refreshStory();
    return after > before;
  }

  /* used by the secret-code redeemer */
  function addGems(n) {
    for (let i = 0; i < (n || 0); i++) onGemCollected();
    save();
  }

  function finishRun(stats) {
    progress.runs++;
    progress.runCount++;
    progress.totalLeaves += stats.leaves;
    progress.totalGems += stats.gems;
    // the spendable wallet used by the shop (was never credited before)
    progress.leaves = (progress.leaves || 0) + (stats.leaves || 0);
    const newBestDist = stats.dist > progress.bestDist;
    const newBestScore = stats.score > progress.bestScore;
    if (newBestDist) progress.bestDist = stats.dist;
    if (newBestScore) progress.bestScore = stats.score;
    progress.bestStreak = Math.max(progress.bestStreak, stats.dist);
    progress.leaderboard.push({ d: stats.dist, s: stats.score });
    progress.leaderboard.sort((a, b) => b.d - a.d);
    progress.leaderboard = progress.leaderboard.slice(0, 5);
    save();
    return { newBestDist, newBestScore };
  }

  return {
    get progress() { return progress; },   // live reference (load() reassigns)
    load, save, reset, onGemCollected, addGems, finishRun,
  };
})();

SR.skin = () => {
  const p = SR.save.progress;
  return SR.SKINS.find(s => s.id === p.skin) || SR.SKINS[0];
};

/* ---------------- toasts & notifications ---------------- */
SR.toast = msg => {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), 2200);
  setTimeout(() => el.remove(), 2550);
};

SR.notify = type => {
  const info = SR.Obstacles.POWER_INFO[type];
  if (info) SR.toast(`${info.icon} ${SR.t(info.nameKey)}`);
  SR.ui && SR.ui.refreshPowerChips();
};

/* ---------------- UI module ---------------- */
SR.ui = (() => {
  let hudDirty = true;
  let lastPowerState = '';

  function $(id) { return document.getElementById(id); }

  function init() {
    SR.save.load();
    const p = SR.save.progress;
    wireMenu();
    wireStats();
    wireSkins();
    wireSettings();
    wireStory();
    wireHowto();
    wirePause();
    wireDeath();
    wireAd();
    applyLang();
    refreshSkinsGrid();
    refreshStory();
    buildHowto();
    if (!p.seenHowto) {
      p.seenHowto = true;
      SR.save.save();
      setTimeout(() => showScreen('howto'), 600);
    }
    // audio settings
    SR.audio.setSfx(p.sound);
    SR.audio.setMusic(p.music);
  }

  /* ---------- language ---------- */
  function applyLang() {
    const lang = SR.save.progress.lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = SR.t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.placeholder = SR.t(el.getAttribute('data-i18n-ph'));
    });
    document.title = lang === 'ar' ? 'Season Runner — مغامرة الفصول' : 'Season Runner — Seasons Adventure';
    const sel = $('set-lang');
    if (sel) sel.value = lang;
    $('about-text').textContent = SR.t('settings.about');
    $('story-prologue').textContent = SR.t('story.prologue');
    $('story-epilogue').textContent = SR.t('story.epilogue');
    refreshSkinsGrid();
    refreshStory();
    buildHowto();
    refreshSeasonPill();
    hudDirty = true;
  }

  function toggleLang() {
    SR.save.progress.lang = SR.save.progress.lang === 'ar' ? 'en' : 'ar';
    SR.save.save();
    applyLang();
  }

  /* ---------- screens ---------- */
  function closeScreens() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('hud').classList.remove('hidden');
  }
  function showScreen(name) {
    const game = SR.game.S;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = $(`screen-${name}`);
    if (el) el.classList.add('active');
    const inGame = ['pause', 'death'].indexOf(name) > -1;
    $('hud').classList.toggle('hidden', !inGame || name === 'death' || game.attract);
    if (name === 'menu') $('hud').classList.add('hidden');
    if (name === 'stats') refreshStats();
    if (name === 'skins') refreshSkinsGrid();
    if (name === 'story') refreshStory();
    if (name === 'death') refreshDeath();
    if (name === 'settings') refreshSettingsUI();
  }

  /* ---------- crash / black-screen recovery ----------
     Shown instead of a dead black canvas when the render loop dies. */
  function showFatal(msg, detail) {
    const ov = $('fatal-overlay');
    if (!ov) return;
    const box = $('fatal-msg');
    if (box) box.textContent = msg || SR.t('fatal.msg');
    const det = $('fatal-detail');
    if (det) det.textContent = detail || '';
    ov.classList.remove('hidden');
  }
  function hideFatal() {
    const ov = $('fatal-overlay');
    if (ov) ov.classList.add('hidden');
  }

  /* ---------- menu ---------- */
  function wireMenu() {
    $('btn-play').addEventListener('click', () => {
      SR.audio.play('click');
      SR.game.start();
    });
    $('btn-stats').addEventListener('click', () => { SR.audio.play('click'); showScreen('stats'); });
    $('btn-skins').addEventListener('click', () => { SR.audio.play('click'); showScreen('skins'); });
    $('btn-settings').addEventListener('click', () => { SR.audio.play('click'); showScreen('settings'); });
    $('btn-story').addEventListener('click', () => { SR.audio.play('click'); showScreen('story'); });
    $('btn-howto').addEventListener('click', () => { SR.audio.play('click'); showScreen('howto'); });
    $('btn-lang').addEventListener('click', toggleLang);
    $('btn-sound-menu').addEventListener('click', e => {
      const p = SR.save.progress;
      p.sound = !p.sound;
      SR.save.save();
      SR.audio.setSfx(p.sound);
      e.currentTarget.textContent = p.sound ? '🔊' : '🔇';
      SR.audio.play('click');
    });
  }

  /* ---------- stats ---------- */
  function wireStats() {
    $('btn-stats-back').addEventListener('click', () => { SR.audio.play('click'); showScreen('menu'); });
  }
  function refreshStats() {
    const p = SR.save.progress;
    $('st-dist').textContent = Math.round(p.bestDist) + 'م';
    $('st-score').textContent = U.fmt(p.bestScore);
    $('st-streak').textContent = Math.round(p.bestStreak) + 'م';
    $('st-runs').textContent = p.runs;
    $('st-leaves').textContent = U.fmt(p.totalLeaves);
    $('st-gems').textContent = p.totalGems;
    const ol = $('leaderboard');
    ol.innerHTML = '';
    if (!p.leaderboard.length) {
      const li = document.createElement('li');
      li.className = 'lb-empty';
      li.textContent = SR.t('stats.empty');
      ol.appendChild(li);
    } else {
      p.leaderboard.forEach((r, i) => {
        const li = document.createElement('li');
        const pos = document.createElement('span');
        pos.textContent = `#${i + 1}`;
        const d = document.createElement('span');
        d.className = 'lb-dist';
        d.textContent = Math.round(r.d) + 'م';
        const s = document.createElement('span');
        s.textContent = U.fmt(r.s) + ' 🏅';
        li.append(pos, d, s);
        ol.appendChild(li);
      });
    }
  }

  /* ---------- skins ---------- */
  function wireSkins() {
    $('btn-skins-back').addEventListener('click', () => { SR.audio.play('click'); showScreen('menu'); });
  }
  function drawNuroPreview(cv, glow, body, size) {
    const dpr = 2;
    cv.width = size * dpr; cv.height = size * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    const c = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 14;
    const g1 = ctx.createLinearGradient(0, c - 14, 0, c + 14);
    g1.addColorStop(0, '#ffffff');
    g1.addColorStop(0.45, body);
    g1.addColorStop(1, body);
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.moveTo(c - 13, c - 14);
    ctx.bezierCurveTo(c - 19, c - 2, c - 18, c + 10, c - 13, c + 14);
    ctx.quadraticCurveTo(c, c + 10, c + 13, c + 14);
    ctx.bezierCurveTo(c + 18, c + 10, c + 19, c - 2, c + 13, c - 14);
    ctx.quadraticCurveTo(c, c - 19, c - 13, c - 14);
    ctx.fill();
    ctx.shadowBlur = 0;
    // eyes
    ctx.fillStyle = '#173042';
    ctx.beginPath(); ctx.arc(c - 5, c - 2, 3.4, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(c + 5, c - 2, 3.4, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(c - 6, c - 3, 1.1, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(c + 4, c - 3, 1.1, 0, 6.283); ctx.fill();
    // cheeks
    ctx.fillStyle = 'rgba(255,140,170,.55)';
    ctx.beginPath(); ctx.arc(c - 11, c + 3, 2.6, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(c + 11, c + 3, 2.6, 0, 6.283); ctx.fill();
    // mouth
    ctx.strokeStyle = '#173042'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(c, c + 5, 3, 0.2, 2.7); ctx.stroke();
    // sprout
    ctx.fillStyle = '#5fae4e';
    ctx.beginPath(); ctx.ellipse(c + 5, c - 18, 4.5, 2.6, -0.6, 0, 6.283); ctx.fill();
  }
  function refreshSkinsGrid() {
    const p = SR.save.progress;
    const grid = $('skins-grid');
    if (!grid) return;
    grid.innerHTML = '';
    SR.SKINS.forEach(skin => {
      const card = document.createElement('div');
      card.className = 'skin-card' + (p.skin === skin.id ? ' selected' : '') + (p.skins.indexOf(skin.id) === -1 ? ' locked' : '');
      if (p.skins.indexOf(skin.id) === -1) {
        const cost = document.createElement('div');
        cost.className = 'skin-cost';
        cost.textContent = '🍃 ' + skin.cost;
        card.appendChild(cost);
      }
      const cv = document.createElement('canvas');
      cv.className = 'skin-preview';
      drawNuroPreview(cv, skin.glow, skin.body, 60);
      card.appendChild(cv);
      const name = document.createElement('div');
      name.className = 'skin-name';
      name.textContent = skin.name[p.lang];
      card.appendChild(name);
      const status = document.createElement('div');
      status.className = 'skin-status';
      if (p.skins.indexOf(skin.id) === -1) status.textContent = SR.t('skins.buy');
      else if (p.skin === skin.id) status.textContent = SR.t('skins.selected');
      else status.textContent = SR.t('skins.owned');
      card.appendChild(status);
      card.addEventListener('click', () => {
        SR.audio.play('click');
        if (p.skins.indexOf(skin.id) === -1) {
          if (p.leaves >= skin.cost) {
            p.leaves -= skin.cost;
            p.skins.push(skin.id);
            p.skin = skin.id;
            SR.save.save();
            SR.audio.play('power');
            SR.toast(`🎨 ${skin.name[p.lang]}!`);
          } else {
            $('skin-msg').textContent = SR.t('skins.notEnough');
            return;
          }
        } else {
          p.skin = skin.id;
          SR.save.save();
        }
        $('skin-msg').textContent = '';
        refreshSkinsGrid();
        hudDirty = true;
      });
      grid.appendChild(card);
    });
  }

  /* ---------- settings ---------- */
  function wireSettings() {
    $('btn-settings-back').addEventListener('click', () => {
      SR.audio.play('click');
      const g = SR.game.S;
      if (g.state === 'paused') showScreen('pause');
      else showScreen('menu');
    });
    $('set-sound').addEventListener('change', e => {
      SR.save.progress.sound = e.target.checked;
      SR.save.save();
      SR.audio.setSfx(e.target.checked);
      SR.audio.play('click');
    });
    $('set-music').addEventListener('change', e => {
      SR.save.progress.music = e.target.checked;
      SR.save.save();
      SR.audio.setMusic(e.target.checked);
      SR.audio.play('click');
    });
    $('set-vibrate').addEventListener('change', e => {
      SR.save.progress.vibrate = e.target.checked;
      SR.save.save();
    });
    $('set-lang').addEventListener('change', e => {
      SR.save.progress.lang = e.target.value;
      SR.save.save();
      applyLang();
    });
    wireCode();
    $('btn-reset').addEventListener('click', e => {
      if (e.currentTarget.dataset.confirm) {
        SR.save.reset();
        SR.toast(SR.t('toast.saved'));
        SR.game.exitToMenu();
        showScreen('menu');
        refreshSettingsUI();
        refreshSkinsGrid();
      } else {
        e.currentTarget.dataset.confirm = '1';
        e.currentTarget.textContent = SR.t('settings.resetConfirm').slice(0, 22) + '!';
        setTimeout(() => {
          delete e.currentTarget.dataset.confirm;
          e.currentTarget.textContent = SR.t('settings.resetBtn');
        }, 2500);
      }
    });
  }
  /* ---------- secret code ---------- */
  function wireCode() {
    const input = $('set-code');
    const btn = $('btn-code');
    if (!input || !btn) return;
    const submit = () => {
      const res = SR.codes.redeem(input.value);
      const msg = $('code-msg');
      SR.audio.play(res.ok ? 'power' : 'click');
      if (res.ok) {
        input.value = '';
        if (msg) {
          msg.className = 'code-msg ok';
          msg.textContent = SR.tf('codes.ok', { leaves: U.fmt(res.leaves), gems: res.gems });
        }
        SR.toast(SR.tf('codes.ok', { leaves: U.fmt(res.leaves), gems: res.gems }));
      } else if (msg) {
        msg.className = 'code-msg bad';
        msg.textContent = res.reason === 'used' ? SR.t('codes.used') : SR.t('codes.bad');
      }
      refreshSettingsUI();
    };
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      e.stopPropagation();   // don't let the game's keyboard handler steal keys
    });
    input.addEventListener('keyup', e => e.stopPropagation());
  }
  function refreshCodeUI() {
    const p = SR.save.progress;
    const el = $('code-used');
    if (!el) return;
    const n = Array.isArray(p.usedCodes) ? p.usedCodes.length : 0;
    el.textContent = n ? SR.tf('codes.usedCount', { n }) : '';
  }

  function refreshSettingsUI() {
    const p = SR.save.progress;
    $('set-sound').checked = p.sound;
    $('set-music').checked = p.music;
    $('set-vibrate').checked = p.vibrate;
    $('set-lang').value = p.lang;
    refreshCodeUI();
  }

  /* ---------- story ---------- */
  function wireStory() {
    $('btn-story-back').addEventListener('click', () => { SR.audio.play('click'); showScreen('menu'); });
  }
  function refreshStory() {
    const p = SR.save.progress;
    const pro = $('story-prologue');
    if (pro) pro.textContent = SR.t('story.prologue');
    const epi = $('story-epilogue');
    if (epi) {
      epi.style.display = p.gems >= 5 ? 'block' : 'none';
      epi.textContent = SR.t('story.epilogue');
    }
    const wrap = $('story-chapters');
    if (!wrap) return;
    wrap.innerHTML = '';
    const unlocked = SR.unlockedSeasons(p);
    SR.SEASONS.forEach((se, i) => {
      const div = document.createElement('div');
      div.className = 'story-ch' + (i < unlocked ? '' : ' locked');
      const h = document.createElement('h4');
      h.textContent = se.emoji + ' ' + SR.t(`story.ch${i + 1}t`);
      div.appendChild(h);
      const txt = document.createElement('p');
      txt.textContent = SR.t(`story.ch${i + 1}`);
      div.appendChild(txt);
      const tag = document.createElement('span');
      tag.className = 'lock-tag';
      tag.textContent = i < unlocked ? SR.t('story.unlocked') : SR.tf('story.locked', { n: se.unlockGems });
      div.appendChild(tag);
      wrap.appendChild(div);
    });
  }

  /* ---------- howto ---------- */
  function buildHowto() {
    const grid = $('howto-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const items = [
      ['howto.tap', 'howto.tapD'], ['howto.dtap', 'howto.dtapD'],
      ['howto.swipe', 'howto.swipeD'], ['howto.long', 'howto.longD'],
      ['howto.swipeUp', 'howto.swipeUpD'], ['howto.seasons', 'howto.tip'],
    ];
    items.forEach(([k1, k2], i) => {
      const div = document.createElement('div');
      div.className = 'howto-item';
      const k = document.createElement('span');
      k.className = 'k';
      k.textContent = SR.t(k1);
      div.appendChild(k);
      const d = document.createElement('span');
      d.textContent = SR.t(k2);
      div.appendChild(d);
      grid.appendChild(div);
    });
  }
  function wireHowto() {
    $('btn-howto-play').addEventListener('click', () => {
      SR.audio.play('click');
      const g = SR.game.S;
      if (g.state === 'paused') showScreen('pause');
      else { showScreen('menu'); SR.game.start(); }
    });
  }

  /* ---------- pause ---------- */
  function wirePause() {
    $('btn-pause').addEventListener('click', () => {
      if (SR.game.S.state === 'running') {
        SR.game.pause();
        showScreen('pause');
      }
    });
    $('btn-resume').addEventListener('click', () => { SR.audio.play('click'); closeScreens(); SR.game.resume(); });
    $('btn-restart').addEventListener('click', () => {
      SR.audio.play('click');
      showScreen('menu');
      SR.game.restart();
    });
    $('btn-pause-settings').addEventListener('click', () => { SR.audio.play('click'); showScreen('settings'); });
    $('btn-exit').addEventListener('click', () => {
      SR.audio.play('click');
      SR.game.exitToMenu();
      showScreen('menu');
    });
  }

  /* ---------- death ---------- */
  function wireDeath() {
    $('btn-retry').addEventListener('click', () => {
      SR.audio.play('click');
      showScreen('menu');
      SR.game.restart();
    });
    $('btn-death-menu').addEventListener('click', () => {
      SR.audio.play('click');
      showScreen('menu');
    });
    $('btn-death-share').addEventListener('click', shareResult);
    $('btn-revive').addEventListener('click', () => {
      SR.audio.play('click');
      showAd(() => SR.game.revive());
    });
  }
  let lastRun = null;
  function refreshDeath() {
    if (!lastRun) return;
    $('dt-dist').textContent = Math.round(lastRun.dist) + 'م';
    $('dt-score').textContent = U.fmt(lastRun.score);
    $('dt-leaves').textContent = '+' + lastRun.leaves;
    $('dt-gems').textContent = '+' + lastRun.gems;
    $('best-line').textContent = SR.tf('death.best', { n: Math.round(lastRun.bestDist) });
    $('newbest').classList.toggle('hidden', !lastRun.newBestDist);
    const reviveBtn = $('btn-revive');
    reviveBtn.classList.toggle('hidden', SR.game.S.revived);
    reviveBtn.textContent = SR.t('death.revive');
  }
  function shareResult() {
    const txt = SR.tf('death.shareText', { d: Math.round(lastRun.dist), s: lastRun.score });
    if (navigator.share) {
      navigator.share({ title: 'Season Runner', text: txt }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(() => SR.toast(SR.t('toast.saved'))).catch(() => SR.toast(SR.t('toast.shareFail')));
    } else {
      SR.toast(SR.t('toast.shareFail'));
    }
  }

  /* ---------- fake ad ---------- */
  function wireAd() {
    const ov = $('ad-overlay');
    ov.addEventListener('pointerdown', e => e.preventDefault());
  }
  function showAd(done) {
    const ov = $('ad-overlay');
    ov.classList.remove('hidden');
    const count = $('ad-count');
    const fill = $('ad-bar-fill');
    let n = 3;
    count.textContent = n;
    fill.style.width = '0%';
    SR.audio.stopMusic();
    const iv = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(iv);
        ov.classList.add('hidden');
        SR.audio.play('go');
        done();
      } else {
        count.textContent = n;
        fill.style.width = ((3 - n) / 3 * 100) + '%';
        SR.audio.play('count');
      }
    }, 800);
  }

  /* ---------- HUD ---------- */
  function refreshSeasonPill() {
    const se = SR.game.S.season;
    $('season-emoji').textContent = se.emoji;
    $('season-name').textContent = se.name[SR.save.progress.lang];
    $('season-pill').style.borderColor = se.color;
    hudDirty = true;
  }

  function powerStateStr() {
    const g = SR.game.S, p = g.player;
    return [p.shield ? 1 : 0, p.magnetT > 0 ? p.magnetT | 0 : 0, g.freezeT > 0 ? g.freezeT | 0 : 0,
            p.eagleT > 0 ? p.eagleT | 0 : 0, g.lockT > 0 ? g.lockT | 0 : 0, p.starT > 0 ? p.starT | 0 : 0].join(',');
  }
  function refreshPowerChips() {
    const g = SR.game.S, p = g.player;
    const wrap = $('power-chips');
    if (!wrap) return;
    wrap.innerHTML = '';
    const acts = [];
    if (p.shield) acts.push({ id: 'shield', t: Infinity });
    if (p.magnetT > 0) acts.push({ id: 'magnet', t: p.magnetT });
    if (g.freezeT > 0) acts.push({ id: 'freeze', t: g.freezeT });
    if (p.eagleT > 0) acts.push({ id: 'eagle', t: p.eagleT });
    if (g.lockT > 0) acts.push({ id: 'lock', t: g.lockT });
    if (p.starT > 0) acts.push({ id: 'star', t: p.starT });
    acts.forEach(a => {
      const info = SR.Obstacles.POWER_INFO[a.id];
      const chip = document.createElement('div');
      chip.className = 'power-chip';
      chip.style.color = info.color;
      chip.innerHTML = `<span>${info.icon} ${SR.t(info.nameKey)}</span>`;
      if (a.t !== Infinity) {
        chip.innerHTML += `<span class="pw-bar"><i style="width:100%"></i></span>`;
      }
      wrap.appendChild(chip);
    });
  }
  function refreshPowerBars() {
    const g = SR.game.S, p = g.player;
    const wrap = $('power-chips');
    if (!wrap) return;
    const bars = wrap.querySelectorAll('.pw-bar i');
    const ts = [p.magnetT, g.freezeT, p.eagleT, g.lockT, p.starT].filter(t => t > 0);
    const maxes = [10, 5, 7, 20, 8];
    let bi = 0;
    for (let k = 0; k < ts.length; k++) {
      if (bars[bi]) { bars[bi].style.width = Math.max(0, ts[k] / maxes[k] * 100) + '%'; bi++; }
    }
  }
  function onHud() {
    const g = SR.game.S;
    if (g.state === 'menu' || g.attract) return;
    $('hud-leaves').textContent = g.leaves;
    $('hud-gems').textContent = g.gems;
    $('hud-dist').textContent = Math.round(g.distM);
    $('hud-score').textContent = U.fmt(SR.game.score());
    // season bar
    if (g.lockT > 0) {
      $('season-bar-fill').style.width = '100%';
      $('season-name').textContent = SR.t('pow.lock') + ' 🔒';
    } else {
      $('season-bar-fill').style.width = (g.seasonTimer / g.seasonDur * 100) + '%';
      const se = g.season;
      $('season-name').textContent = se.name[SR.save.progress.lang];
      $('season-emoji').textContent = se.emoji;
    }
    // dash cooldown ring
    const p = g.player;
    const ring = $('dash-ring-fg');
    const cdTxt = $('dash-cd');
    if (p.dashCd > 0) {
      const frac = 1 - p.dashCd / 7;
      ring.style.strokeDashoffset = 125.6 * frac;
      cdTxt.textContent = Math.ceil(p.dashCd);
      cdTxt.classList.remove('hidden');
    } else {
      ring.style.strokeDashoffset = 0;
      cdTxt.classList.add('hidden');
    }
    const ps = powerStateStr();
    if (ps !== lastPowerState) { lastPowerState = ps; refreshPowerChips(); }
    else refreshPowerBars();
  }

  /* ---------- run flow ---------- */
  function onRunStart() {
    $('hud').classList.remove('hidden');
    hudDirty = true;
    refreshSeasonPill();
    lastPowerState = '';
    const hint = $('hint');
    hint.classList.remove('hidden');
    hint.textContent = SR.t('hud.hint');
    setTimeout(() => {
      if (SR.game.S.state === 'running') {
        hint.textContent = SR.t('hud.hint2');
        setTimeout(() => hint.classList.add('hidden'), 3200);
      }
    }, 3200);
  }
  function onRunEnd() {
    const g = SR.game.S;
    lastRun = {
      dist: g.distM,
      score: SR.game.score(),
      leaves: g.leaves,
      gems: g.gems,
      bestDist: Math.max(SR.save.progress.bestDist, g.distM),
    };
    const res = SR.save.finishRun({
      dist: Math.round(g.distM),
      score: SR.game.score(),
      leaves: g.leaves,
      gems: g.gems,
    });
    lastRun.newBestDist = res.newBestDist;
    if (res.newBestDist) SR.audio.play('fanfare');
    setTimeout(() => showScreen('death'), 350);
  }

  /* ---------- loop hook ---------- */
  let hudTimer = 0;
  function tick(dt) {
    hudTimer += dt;
    if (hudTimer > 0.12) {
      hudTimer = 0;
      const g = SR.game.S;
      if (g.state === 'running' || g.state === 'paused' || g.state === 'dying') onHud();
    }
  }

  return {
    init, applyLang, showScreen, closeScreens, onRunStart, onRunEnd, onHud,
    showFatal, hideFatal,
    refreshPowerChips, refreshSeasonPill, refreshStory, refreshSkinsGrid, tick,
    drawNuroPreview,
  };
})();
