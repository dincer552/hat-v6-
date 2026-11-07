// Formation Optimization Engine - JavaScript

import { 
  FORMATION_SLOTS, 
  ALLOWED_ORDERS,
  getSectorsForSlot,
  RegionalSector,
  createEmptySectorTotals,
  sumSectorTotals
} from '../shared/index.js';

import { getRatingEngine } from './rating-engine.js';
import { createPositionOptimizer } from './position-optimizer.js';

export class FormationOptimizer {
  constructor(positionOptimizer, ratingEngine) {
    this.positionOptimizer = positionOptimizer || createPositionOptimizer(ratingEngine);
    this.ratingEngine = ratingEngine || getRatingEngine();
  }
  
  async generateCandidates(players, coachLevel = 0, preferredFormation) {
    const playerMatrices = this.positionOptimizer.analyzeAllPlayers(players);
    const candidates = [];
    
    for (const [formationName, slotCodes] of Object.entries(FORMATION_SLOTS)) {
      const candidate = await this.evaluateFormation(formationName, slotCodes, playerMatrices, coachLevel);
      if (candidate) candidates.push(candidate);
    }
    
    candidates.sort((a, b) => b.structuralScore - a.structuralScore);
    
    let userPreferredFormation;
    if (preferredFormation) {
      userPreferredFormation = candidates.find(c => c.formation === preferredFormation);
    }
    
    return {
      candidates,
      bestFormation: candidates[0],
      userPreferredFormation
    };
  }
  
  async evaluateFormation(formationName, slotCodes, playerMatrices, coachLevel) {
    const eligiblePlayers = playerMatrices.filter(p => this.hasAnyValidRating(p, slotCodes));
    
    if (eligiblePlayers.length < slotCodes.length) return null;
    
    const assignment = this.findBestAssignment(slotCodes, eligiblePlayers);
    
    if (!assignment || assignment.length !== slotCodes.length) return null;
    
    const structuralScore = assignment.reduce((sum, a) => sum + a.positionRating, 0) / slotCodes.length;
    const sectorRatings = this.calculateSectorRatings(assignment, coachLevel);
    
    return {
      formation: formationName,
      slotCodes,
      structuralScore,
      bestAssignment: assignment,
      sectorRatings
    };
  }
  
  hasAnyValidRating(player, slotCodes) {
    for (const slotCode of slotCodes) {
      const rating = player.ratings.find(r => r.positionCode === slotCode && r.totalRating > 0);
      if (rating) return true;
    }
    return false;
  }
  
  findBestAssignment(slotCodes, players) {
    const usedPlayerIds = new Set();
    const assignment = [];
    
    const sortedSlots = [...slotCodes].sort((a, b) => {
      const countA = players.filter(p => !usedPlayerIds.has(p.playerId) && this.getBestRatingForSlot(p, a) > 0).length;
      const countB = players.filter(p => !usedPlayerIds.has(p.playerId) && this.getBestRatingForSlot(p, b) > 0).length;
      return countA - countB;
    });
    
    const success = this.backtrackAssign(sortedSlots, players, usedPlayerIds, assignment, 0);
    return success ? assignment : [];
  }
  
  backtrackAssign(slots, players, used, assignment, index) {
    if (index === slots.length) return true;
    
    const slotCode = slots[index];
    const allowedOrders = ALLOWED_ORDERS[slotCode] || [0];
    
    const eligible = players
      .filter(p => !used.has(p.playerId))
      .map(p => {
        let bestRating = 0;
        let bestOrder = 0;
        
        for (const order of allowedOrders) {
          const rating = this.getRatingForSlotAndOrder(p, slotCode, order);
          if (rating > bestRating) {
            bestRating = rating;
            bestOrder = order;
          }
        }
        
        return { player: p, rating: bestRating, order: bestOrder };
      })
      .filter(x => x.rating > 0)
      .sort((a, b) => b.rating - a.rating);
    
    for (const { player, rating, order } of eligible) {
      used.add(player.playerId);
      
      const sectorContributions = this.calculatePlayerSectorContributions(player, slotCode, order);
      
      assignment.push({
        slotCode,
        playerId: player.playerId,
        playerName: player.playerName,
        order,
        positionRating: rating,
        sectorContributions
      });
      
      if (this.backtrackAssign(slots, players, used, assignment, index + 1)) {
        return true;
      }
      
      assignment.pop();
      used.delete(player.playerId);
    }
    
    return false;
  }
  
  getBestRatingForSlot(player, slotCode) {
    const slotRatings = player.ratings.filter(r => r.positionCode === slotCode);
    if (slotRatings.length === 0) return 0;
    return Math.max(...slotRatings.map(r => r.totalRating));
  }
  
  getRatingForSlotAndOrder(player, slotCode, order) {
    const rating = player.ratings.find(r => r.positionCode === slotCode && r.order === order);
    return rating?.totalRating || 0;
  }
  
  calculatePlayerSectorContributions(player, slotCode, order) {
    const result = createEmptySectorTotals();
    
    if (this.ratingEngine.isReady()) {
      const positionCode = this.resolvePositionWithOrder(slotCode, order);
      const playerResult = this.ratingEngine.calculatePlayerRating(positionCode, this.matrixToPlayer(player), 0);
      
      for (const [sector, value] of Object.entries(playerResult.bySector)) {
        result[sector] = value;
      }
    } else {
      const rating = this.getRatingForSlotAndOrder(player, slotCode, order);
      const sectors = getSectorsForSlot(slotCode);
      const perSector = rating / sectors.length;
      
      for (const sector of sectors) {
        result[sector] = perSector;
      }
    }
    
    return result;
  }
  
  calculateSectorRatings(assignment, coachLevel) {
    const secL = createEmptySectorTotals();
    const secMeta = {};
    
    for (const a of assignment) {
      for (const [sector, value] of Object.entries(a.sectorContributions)) {
        secL[sector] += value;
        
        if (this.ratingEngine.isReady()) {
          const slotCode = a.slotCode;
          const positionCode = this.resolvePositionWithOrder(slotCode, a.order);
          const rows = this.ratingEngine.getRowsForPosition(positionCode);
          const metaRow = rows.find(r => r.sec === sector);
          if (metaRow) {
            secMeta[sector] = { ss: metaRow.ss, V: metaRow.v };
          }
        }
      }
    }
    
    const R = coachLevel <= 0 ? 1.02 - coachLevel * 0.008 : 1.02 - coachLevel * 0.012;
    
    const rating = {
      leftDefence: 0, centralDefence: 0, rightDefence: 0,
      midfield: 0, leftAttack: 0, centralAttack: 0, rightAttack: 0,
      displayLeftDefence: 0, displayCentralDefence: 0, displayRightDefence: 0,
      displayMidfield: 0, displayLeftAttack: 0, displayCentralAttack: 0, displayRightAttack: 0
    };
    
    const sectors = [
      RegionalSector.LeftDefence, RegionalSector.CentralDefence, RegionalSector.RightDefence,
      RegionalSector.Midfield, RegionalSector.LeftAttack, RegionalSector.CentralAttack, RegionalSector.RightAttack
    ];
    
    for (const sector of sectors) {
      const L = secL[sector] || 0;
      const meta = secMeta[sector] || { ss: 1.0, V: 1.2 };
      const ss = meta.ss;
      const V = meta.V;
      
      let M = 0;
      if (L > 0) {
        const raw = L * R * ss;
        M = Math.round(Math.pow(raw, V) / 4 + 1) * 4 / 4;
      }
      
      const key = `display${sector.charAt(0).toUpperCase() + sector.slice(1)}`;
      rating[sector] = M;
      rating[key] = Math.max(1, Math.min(20, M));
    }
    
    return rating;
  }
  
  matrixToPlayer(matrix) {
    return {
      id: matrix.playerId,
      name: matrix.playerName,
      keeper: 0, defending: 0, playmaking: 0, passing: 0,
      winger: 0, scoring: 0, setPieces: 0, stamina: 0,
      form: 5, experience: 5, loyalty: 0,
      specialty: 0
    };
  }
  
  resolvePositionWithOrder(slotCode, order) {
    if (slotCode === 'GK') return 'GK';
    
    const orderNames = { 0: 'normal', 1: 'defansif', 2: 'ofansif', 3: 'merkeze', 4: 'kanada' };
    return `${slotCode} ${orderNames[order] || 'normal'}`;
  }
}

export class GreedyFormationOptimizer extends FormationOptimizer {
  findBestAssignment(slotCodes, players) {
    const used = new Set();
    const assignment = [];
    
    const slotPriority = {
      'GK': 0,
      'DEF-C': 1, 'DEF-CL': 2, 'DEF-CR': 3, 'WB-L': 4, 'WB-R': 5,
      'IM-C': 6, 'IM-L': 7, 'IM-R': 8, 'W-L': 9, 'W-R': 10,
      'FW-C': 11, 'FW-L': 12, 'FW-R': 13
    };
    
    const sortedSlots = [...slotCodes].sort((a, b) => (slotPriority[a] || 99) - (slotPriority[b] || 99));
    
    for (const slotCode of sortedSlots) {
      const allowedOrders = ALLOWED_ORDERS[slotCode] || [0];
      let bestPlayer = null;
      let bestRating = 0;
      let bestOrder = 0;
      
      for (const player of players) {
        if (used.has(player.playerId)) continue;
        
        for (const order of allowedOrders) {
          const rating = this.getRatingForSlotAndOrder(player, slotCode, order);
          if (rating > bestRating) {
            bestRating = rating;
            bestPlayer = player;
            bestOrder = order;
          }
        }
      }
      
      if (bestPlayer) {
        used.add(bestPlayer.playerId);
        const sectorContributions = this.calculatePlayerSectorContributions(bestPlayer, slotCode, bestOrder);
        
        assignment.push({
          slotCode,
          playerId: bestPlayer.playerId,
          playerName: bestPlayer.playerName,
          order: bestOrder,
          positionRating: bestRating,
          sectorContributions
        });
      }
    }
    
    return assignment;
  }
}

export function createFormationOptimizer(positionOptimizer, ratingEngine) {
  return new FormationOptimizer(positionOptimizer, ratingEngine);
}

export function createGreedyFormationOptimizer(positionOptimizer, ratingEngine) {
  return new GreedyFormationOptimizer(positionOptimizer, ratingEngine);
}