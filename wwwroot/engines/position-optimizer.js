// Position Optimization Engine - JavaScript

import { 
  FORMATION_SLOTS, 
  ALLOWED_ORDERS, 
  POSITION_SKILL_WEIGHTS,
  getSectorsForSlot,
  getSkill,
  formFactor,
  experiencePolynomial,
  getOrderMultipliers,
  getSpecialtyMultiplier
} from '../shared/index.js';

import { getRatingEngine } from './rating-engine.js';

export class PositionOptimizer {
  constructor(ratingEngine) {
    this.ratingEngine = ratingEngine || getRatingEngine();
  }
  
  analyzeAllPlayers(players) {
    const results = [];
    
    for (const player of players) {
      const matrix = this.analyzePlayer(player);
      results.push(matrix);
    }
    
    return results.sort((a, b) => b.bestPosition.rating - a.bestPosition.rating);
  }
  
  analyzePlayer(player) {
    const ratings = [];
    let bestRating = 0;
    let bestPosition = 'GK';
    let bestOrder = 0;
    
    const allSlots = new Set();
    for (const slots of Object.values(FORMATION_SLOTS)) {
      for (const slot of slots) allSlots.add(slot);
    }
    
    for (const slotCode of allSlots) {
      const allowedOrders = ALLOWED_ORDERS[slotCode] || [0];
      
      for (const order of allowedOrders) {
        const rating = this.calculatePositionRating(player, slotCode, order);
        ratings.push(rating);
        
        if (rating.totalRating > bestRating) {
          bestRating = rating.totalRating;
          bestPosition = rating.positionCode;
          bestOrder = order;
        }
      }
    }
    
    return {
      playerId: player.id,
      playerName: player.name,
      ratings,
      bestPosition: {
        positionCode: bestPosition,
        order: bestOrder,
        rating: bestRating
      }
    };
  }
  
  calculatePositionRating(player, slotCode, order) {
    const positionCode = this.resolvePositionWithOrder(slotCode, order);
    
    if (this.ratingEngine.isReady()) {
      const result = this.ratingEngine.calculatePlayerRating(positionCode, player, 0);
      
      let totalRating = 0;
      for (const sectorContribution of Object.values(result.bySector)) {
        totalRating += sectorContribution;
      }
      
      const displayTotal = Math.round(totalRating * 4) / 4;
      
      return {
        positionCode: slotCode,
        order,
        sectorContributions: result.bySector,
        totalRating: displayTotal
      };
    }
    
    return this.heuristicPositionRating(player, slotCode, order);
  }
  
  heuristicPositionRating(player, slotCode, order) {
    const weights = POSITION_SKILL_WEIGHTS[slotCode] || {};
    const sectors = getSectorsForSlot(slotCode);
    const orderMults = getOrderMultipliers(slotCode, order);
    
    const sectorContributions = {};
    let totalRating = 0;
    
    for (const sector of sectors) {
      let sectorScore = 0;
      let totalWeight = 0;
      
      for (const [skill, weight] of Object.entries(weights)) {
        const skillValue = getSkill(player, skill);
        if (skillValue > 0 && weight > 0) {
          const form = getSkill(player, 'form');
          const formFact = formFactor(form);
          
          const exp = getSkill(player, 'experience');
          const expPoly = experiencePolynomial(exp);
          
          const loy = getSkill(player, 'loyalty');
          
          const base = Math.max(0, skillValue - 1) + loy;
          const contribution = base * formFact * weight + expPoly * 0.1;
          
          sectorScore += contribution;
          totalWeight += weight;
        }
      }
      
      const orderMult = orderMults[sector] || 1.0;
      const specMult = getSpecialtyMultiplier(player.specialty, sector) || 1.0;
      sectorScore *= orderMult * specMult;
      
      sectorContributions[sector] = sectorScore;
      totalRating += sectorScore;
    }
    
    const normalizedTotal = Math.max(1, Math.min(20, totalRating / 10));
    const displayTotal = Math.round(normalizedTotal * 4) / 4;
    
    return {
      positionCode: slotCode,
      order,
      sectorContributions,
      totalRating: displayTotal
    };
  }
  
  resolvePositionWithOrder(slotCode, order) {
    if (slotCode === 'GK') return 'GK';
    
    const orderNames = { 0: 'normal', 1: 'defansif', 2: 'ofansif', 3: 'merkeze', 4: 'kanada' };
    const orderName = orderNames[order] || 'normal';
    return `${slotCode} ${orderName}`;
  }
  
  getBestPlayersForSlot(players, slotCode, order = 0, topN = 5) {
    return players
      .filter(p => {
        const rating = p.ratings.find(r => r.positionCode === slotCode && r.order === order);
        return rating && rating.totalRating > 0;
      })
      .sort((a, b) => {
        const ra = a.ratings.find(r => r.positionCode === slotCode && r.order === order)?.totalRating || 0;
        const rb = b.ratings.find(r => r.positionCode === slotCode && r.order === order)?.totalRating || 0;
        return rb - ra;
      })
      .slice(0, topN);
  }
  
  getFormationRecommendations(players, formation) {
    const slots = FORMATION_SLOTS[formation] || [];
    const recommendations = new Map();
    
    for (const slotCode of slots) {
      const allowedOrders = ALLOWED_ORDERS[slotCode] || [0];
      const slotRecs = [];
      
      for (const order of allowedOrders) {
        const best = this.getBestPlayersForSlot(players, slotCode, order, 3);
        slotRecs.push(...best);
      }
      
      const unique = new Map();
      for (const p of slotRecs) {
        const existing = unique.get(p.playerId);
        const bestRating = p.ratings.find(r => r.positionCode === slotCode)?.totalRating || 0;
        const existingRating = existing?.ratings.find(r => r.positionCode === slotCode)?.totalRating || 0;
        
        if (!existing || bestRating > existingRating) {
          unique.set(p.playerId, p);
        }
      }
      
      recommendations.set(slotCode, Array.from(unique.values())
        .sort((a, b) => {
          const ra = a.ratings.find(r => r.positionCode === slotCode)?.totalRating || 0;
          const rb = b.ratings.find(r => r.positionCode === slotCode)?.totalRating || 0;
          return rb - ra;
        })
        .slice(0, 5));
    }
    
    return recommendations;
  }
}

export function createPositionOptimizer(ratingEngine) {
  return new PositionOptimizer(ratingEngine);
}