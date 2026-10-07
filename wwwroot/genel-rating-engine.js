/* Genel rating engine — Excel TOPLAM mantığı (ΣL sonra tek M) */
window.GenelRating = (function () {
  let ROWS = [], POSITIONS = [], READY = false;
  const ORDER_NAME = { 0: 'normal', 1: 'defansif', 2: 'ofansif', 3: 'merkeze', 4: 'kanada' };
  const SEC_KEY = {
    'Left Defence': 'leftDefence',
    'Central Defence': 'centralDefence',
    'Right Defence': 'rightDefence',
    Midfield: 'midfield',
    'Left Attack': 'leftAttack',
    'Central Attack': 'centralAttack',
    'Right Attack': 'rightAttack'
  };
  const SECTORS = [
    'Left Defence', 'Central Defence', 'Right Defence',
    'Midfield', 'Left Attack', 'Central Attack', 'Right Attack'
  ];

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  function formF(f) {
    return 0.378 * Math.sqrt(Math.min(7, Math.max(0, num(f) - 1)));
  }
  function expPoly(e) {
    const x = Math.max(0, num(e) - 1);
    return -0.00000725 * Math.pow(x, 4) + 0.0005 * Math.pow(x, 3) - 0.01336 * Math.pow(x, 2) + 0.176 * x;
  }
  /* Excel: 1.02 - (koç<=0 ? koç*0.08/10 : koç*0.12/10) — 253n TOPLAM formülü */
  function coachR(l) {
    const c = num(l);
    return 1.02 - (c <= 0 ? c * 0.08 / 10 : c * 0.12 / 10);
  }
  function qRound(v) {
    return Math.round(v * 4) / 4;
  }
  function skill(p, s) {
    const m = {
      Goalkeeping: 'keeper', Defending: 'defending', Playmaking: 'playmaking',
      Passing: 'passing', Winger: 'winger', Scoring: 'scoring',
      SetPieces: 'setPieces', Stamina: 'stamina'
    };
    const k = m[s];
    return k && p ? num(p[k]) : null;
  }

  async function ensure() {
    if (READY) return;
    if (!window.GENEL_ALL_HEX) throw new Error('genel-all-data.js yüklenmedi');
    const h = window.GENEL_ALL_HEX;
    const b = new Uint8Array(h.length / 2);
    for (let i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16);
    const t = await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    const d = JSON.parse(t);
    ROWS = d.rows || [];
    POSITIONS = d.positions || [];
    READY = true;
  }

  function resolvePos(c, o) {
    if (c === 'GK') return 'GK';
    const n = ORDER_NAME[Number(o) || 0] || 'normal';
    const f = c + ' ' + n;
    if (POSITIONS.includes(f)) return f;
    if (POSITIONS.includes(c + ' normal')) return c + ' normal';
    return POSITIONS.find(p => p === c || p.startsWith(c + ' ')) || f;
  }

  /** Tek oyuncu: sektör bazında ΣL ve satır izi (M burada üretilmez) */
  function forPlayer(pos, p) {
    const rows = ROWS.filter(r => r.pos === pos);
    const bySec = {};
    const lineTrace = [];
    for (const r of rows) {
      const D = skill(p, r.sk);
      if (D == null) continue;
      const F = num(p.form), H = num(p.experience), loy = num(p.loyalty);
      const I = formF(F);
      const J = Math.max(0, D - 1) + loy;
      const N = num(r.n);
      const K = expPoly(H) * N;
      const E = num(r.k);
      const L = J * I * E + K;
      if (!bySec[r.sec]) bySec[r.sec] = { L: 0, ss: num(r.ss), V: num(r.v), contributions: [] };
      bySec[r.sec].L += L;
      bySec[r.sec].contributions.push({
        skill: r.sk, skillValue: D, kE: E, form: F, experience: H, loyalty: loy,
        formFactor: I, basePlusLoyalty: J, experiencePolynomial: expPoly(H), N,
        experienceContribution: K, skillContribution: J * I * E, lineContribution: L
      });
      lineTrace.push({ pos, sector: r.sec, skill: r.sk, D, E, F, H, I, J, K, L, N });
    }
    return { bySec, lineTrace };
  }

  /**
   * Excel 3-5-2 / formasyon TOPLAM mantığı:
   *  1) Tüm oyuncuların sektör L katkılarını topla
   *  2) Tek formül: M = ROUND( ((ΣL * R * ss)^V / 4 + 1) * 4, 0) / 4
   */
  async function rateLineup(map, coachLv) {
    await ensure();
    const R = coachR(coachLv);
    const secL = {};
    const secMeta = {};
    const detail = [];

    for (const [c, p] of map) {
      const pos = resolvePos(c, Number(p.order || 0));
      const o = forPlayer(pos, p);
      const playerSectorL = {};
      for (const [sec, v] of Object.entries(o.bySec)) {
        playerSectorL[sec] = v.L;
        secL[sec] = (secL[sec] || 0) + v.L;
        if (!secMeta[sec]) secMeta[sec] = { ss: v.ss, V: v.V };
      }
      detail.push({
        slot: c,
        pos,
        playerId: p.id,
        playerName: p.name,
        playerInputs: {
          keeper: num(p.keeper), defending: num(p.defending), playmaking: num(p.playmaking),
          passing: num(p.passing), winger: num(p.winger), scoring: num(p.scoring),
          setPieces: num(p.setPieces), stamina: num(p.stamina), form: num(p.form),
          experience: num(p.experience), loyalty: num(p.loyalty)
        },
        sectorL: playerSectorL,
        lineTrace: o.lineTrace
      });
    }

    const rating = {};
    const sectorTotals = {};
    for (const sec of SECTORS) {
      const L = secL[sec] || 0;
      const meta = secMeta[sec] || { ss: 1, V: 1.2 };
      const ss = meta.ss, V = meta.V;
      let M = 0;
      if (L > 0) {
        const raw = L * R * ss;
        M = qRound(Math.pow(raw, V) / 4 + 1);
      }
      const key = SEC_KEY[sec];
      rating[key] = M;
      sectorTotals[key] = { sumL: L, ss, V, coachR: R, rating: M };
    }

    return {
      rating,
      detail,
      coachR: R,
      rowCount: ROWS.length,
      formula: {
        formFactor: '0.378*sqrt(min(7,max(0,FORM-1)))',
        experiencePolynomial: '-0.00000725*x^4+0.0005*x^3-0.01336*x^2+0.176*x, x=max(0,EXP-1)',
        line: '(max(0,SKILL-1)+LOY)*FORM_FACTOR*K + EXP_POLY*N',
        sector: 'Excel TOPLAM: ROUND(((ΣL*CoachR*SS)^V/4+1)*4,0)/4  — önce tüm oyuncu L toplamı',
        quarterRound: 'round(value*4)/4',
        mode: 'excel-toplam-sumL-then-M'
      },
      sectorTotals
    };
  }

  return { ensure, rateLineup, coachR, resolvePos };
})();
