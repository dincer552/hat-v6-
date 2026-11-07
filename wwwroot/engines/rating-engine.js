// Rating Engine - JavaScript port of Excel TOPLAM logic

import { 
  formFactor, 
  experiencePolynomial, 
  coachFactor, 
  quarterRound, 
  displayRating,
  getSectorsForSlot,
  getPrimarySector,
  getOrderMultipliers,
  getSpecialtyMultiplier,
  createEmptySectorTotals,
  sumSectorTotals,
  getSkill
} from '../shared/index.js';

export class RatingEngine {
  constructor() {
    this.rows = [];
    this.positions = [];
    this.ready = false;
  }
  
  async loadFromData(data) {
    this.rows = (data.rows || []).map(r => ({
      pos: r.pos,
      sec: r.sec,
      sk: r.sk,
      k: Number(r.k),
      n: Number(r.n),
      ss: Number(r.ss),
      v: Number(r.v),
      o: Number(r.o),
      p: Number(r.p),
      q: Number(r.q)
    }));
    this.positions = data.positions || [];
    this.ready = true;
  }
  
  async loadFromGenelAllData(genelAllHex) {
    const binaryString = atob(genelAllHex);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const decompressed = await new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    ).text();
    
    const data = JSON.parse(decompressed);
    await this.loadFromData(data);
  }
  
  ensureReady() {
    if (!this.ready) {
      throw new Error('RatingEngine not initialized. Call loadFromData() first.');
    }
  }
  
  resolvePosition(slotCode, order) {
    if (slotCode === 'GK') return 'GK';
    
    const orderNames = {
      0: 'normal',
      1: 'defansif',
      2: 'ofansif',
      3: 'merkeze',
      4: 'kanada'
    };
    
    const orderName = orderNames[order] || 'normal';
    const fullPos = `${slotCode} ${orderName}`;
    
    if (this.positions.includes(fullPos)) return fullPos;
    if (this.positions.includes(`${slotCode} normal`)) return `${slotCode} normal`;
    
    const found = this.positions.find(p => p === slotCode || p.startsWith(`${slotCode} `));
    return found || fullPos;
  }
  
  calculatePlayerRating(positionCode, player, coachLevel = 0) {
    this.ensureReady();
    
    const rows = this.rows.filter(r => r.pos === positionCode);
    const bySector = createEmptySectorTotals();
    const lineTrace = [];
    
    const R = coachFactor(coachLevel);
    const F = getSkill(player, 'form');
    const H = getSkill(player, 'experience');
    const loy = getSkill(player, 'loyalty');
    const I = formFactor(F);
    const expPoly = experiencePolynomial(H);
    
    for (const r of rows) {
      const D = getSkill(player, r.sk);
      if (D == null || D <= 0) continue;
      
      const J = Math.max(0, D - 1) + loy;
      const N = r.n;
      const K = expPoly * N;
      const E = r.k;
      const L = J * I * E + K;
      
      const slotCode = positionCode.split(' ')[0];
      const order = this.parseOrderFromPosition(positionCode);
      const orderMults = getOrderMultipliers(slotCode, order);
      const specialtyMult = getSpecialtyMultiplier(player.specialty, r.sec);
      const adjustedL = L * orderMults[r.sec] * specialtyMult;
      
      bySector[r.sec] += adjustedL;
      
      lineTrace.push({
        pos: positionCode,
        sector: r.sec,
        skill: r.sk,
        D, E, F, H, I, J, K, L: adjustedL, N
      });
    }
    
    return { bySector, lineTrace };
  }
  
  parseOrderFromPosition(fullPos) {
    const parts = fullPos.split(' ');
    if (parts.length < 2) return 0;
    
    const orderStr = parts.slice(1).join(' ').toLocaleLowerCase('tr-TR');
    const orderMap = { 'normal': 0, 'defansif': 1, 'ofansif': 2, 'merkeze': 3, 'kanada': 4 };
    return orderMap[orderStr] || 0;
  }
  
  rateLineup(slotAssignments, coachLevel = 0) {
    this.ensureReady();
    
    const R = coachFactor(coachLevel);
    const secL = createEmptySectorTotals();
    const secMeta = {};
    const detail = [];
    
    for (const [slotCode, { player, order }] of slotAssignments) {
      const positionCode = this.resolvePosition(slotCode, order);
      const playerResult = this.calculatePlayerRating(positionCode, player, coachLevel);
      
      const playerSectorL = {};
      for (const [sector, L] of Object.entries(playerResult.bySector)) {
        playerSectorL[sector] = L;
        secL[sector] += L;
        
        if (!secMeta[sector]) {
          const metaRow = this.rows.find(r => r.pos === positionCode && r.sec === sector);
          secMeta[sector] = { ss: metaRow?.ss || 1.0, V: metaRow?.v || 1.2 };
        }
      }
      
      detail.push({
        slot: slotCode,
        pos: positionCode,
        playerId: player.id,
        playerName: player.name,
        playerInputs: {
          keeper: getSkill(player, 'keeper'),
          defending: getSkill(player, 'defending'),
          playmaking: getSkill(player, 'playmaking'),
          passing: getSkill(player, 'passing'),
          winger: getSkill(player, 'winger'),
          scoring: getSkill(player, 'scoring'),
          setPieces: getSkill(player, 'setPieces'),
          stamina: getSkill(player, 'stamina'),
          form: getSkill(player, 'form'),
          experience: getSkill(player, 'experience'),
          loyalty: getSkill(player, 'loyalty')
        },
        sectorL: playerSectorL,
        lineTrace: playerResult.lineTrace
      });
    }
    
    const rating = {
      leftDefence: 0, centralDefence: 0, rightDefence: 0,
      midfield: 0, leftAttack: 0, centralAttack: 0, rightAttack: 0,
      displayLeftDefence: 0, displayCentralDefence: 0, displayRightDefence: 0,
      displayMidfield: 0, displayLeftAttack: 0, displayCentralAttack: 0, displayRightAttack: 0
    };
    
    const sectorTotals = {};
    
    const sectors = [
      'LeftDefence', 'CentralDefence', 'RightDefence',
      'Midfield', 'LeftAttack', 'CentralAttack', 'RightAttack'
    ];
    
    for (const sector of sectors) {
      const L = secL[sector] || 0;
      const meta = secMeta[sector] || { ss: 1.0, V: 1.2 };
      const ss = meta.ss;
      const V = meta.V;
      
      let M = 0;
      if (L > 0) {
        const raw = L * R * ss;
        M = quarterRound(Math.pow(raw, V) / 4 + 1);
      }
      
      const key = sector.charAt(0).toLowerCase() + sector.slice(1);
      rating[key] = M;
      rating['display' + sector.charAt(0).toUpperCase() + sector.slice(1)] = displayRating(M);
      
      sectorTotals[key] = { sumL: L, ss, V, coachR: R, rating: M };
    }
    
    return {
      rating,
      detail,
      coachR: R,
      rowCount: this.rows.length,
      formula: {
        formFactor: '0.378*sqrt(min(7,max(0,FORM-1)))',
        experiencePolynomial: '-0.00000725*x^4+0.0005*x^3-0.01336*x^2+0.176*x, x=max(0,EXP-1)',
        line: '(max(0,SKILL-1)+LOY)*FORM_FACTOR*K + EXP_POLY*N',
        sector: 'Excel TOPLAM: ROUND(((ΣL*CoachR*SS)^V/4+1)*4,0)/4',
        quarterRound: 'round(value*4)/4',
        mode: 'excel-toplam-sumL-then-M'
      },
      sectorTotals
    };
  }
  
  getPositions() {
    return [...this.positions];
  }
  
  getRowsForPosition(position) {
    return this.rows.filter(r => r.pos === position);
  }
  
  isReady() {
    return this.ready;
  }
}

let engineInstance = null;

export function getRatingEngine() {
  if (!engineInstance) {
    engineInstance = new RatingEngine();
  }
  return engineInstance;
}

export function setRatingEngine(engine) {
  engineInstance = engine;
}