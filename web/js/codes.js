'use strict';
/* ================================================================
   Season Runner — secret redemption codes
   Offline, client-side. Codes are stored as hashes so the plain
   strings don't show up when grepping the source.
   Each code can be redeemed once per saved game.
================================================================ */
SR.codes = (() => {

  /* hash → reward.  Regenerate with the same fnv1a() below. */
  const LIST = [
    { hash: 'k1xizuk4', leaves: 500,  gems: 1 },   // SEASON2024
    { hash: 'kbjygrj',  leaves: 300,  gems: 0 },   // NOROGIFT
    { hash: 'k1j6akb5', leaves: 0,    gems: 3 },   // GEMS2024
    { hash: 'kh6muvn',  leaves: 1000, gems: 2 },   // ABDO2024
  ];

  /* FNV-1a 32-bit, base36 — tiny, dependency-free, stable across browsers */
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return 'k' + h.toString(36);
  }

  /* Trim, drop spaces, unify Arabic/Extended-Arabic digits, uppercase */
  function normalize(raw) {
    return String(raw == null ? '' : raw)
      .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0))
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  function usedCodes() {
    const p = SR.save.progress;
    if (!Array.isArray(p.usedCodes)) p.usedCodes = [];
    return p.usedCodes;
  }

  /**
   * Redeem a code.
   * @returns {{ok:boolean, reason?:string, leaves?:number, gems?:number, label?:string}}
   */
  function redeem(raw) {
    const code = normalize(raw);
    if (!code) return { ok: false, reason: 'empty' };

    const entry = LIST.find(c => c.hash === fnv1a(code));
    if (!entry) return { ok: false, reason: 'bad' };

    const used = usedCodes();
    if (used.indexOf(code) !== -1) return { ok: false, reason: 'used' };

    const p = SR.save.progress;
    used.push(code);
    p.leaves = (p.leaves || 0) + entry.leaves;
    SR.save.addGems(entry.gems);       // also fires season-unlock toasts
    SR.save.save();

    try {
      SR.game.refreshRotation();
      if (SR.ui && SR.ui.refreshStory) SR.ui.refreshStory();
      if (SR.ui && SR.ui.refreshSkinsGrid) SR.ui.refreshSkinsGrid();
    } catch (e) { /* never let UI refresh break a redemption */ }

    return { ok: true, leaves: entry.leaves, gems: entry.gems, label: code };
  }

  return { redeem, normalize, count: LIST.length };
})();
