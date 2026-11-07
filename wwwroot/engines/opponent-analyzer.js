// Opponent Analysis Engine - JavaScript

import { 
  FORMATION_SLOTS, 
  ALLOWED_ORDERS, 
  TACTIC_NAMES,
  getSectorsForSlot,
  getPrimarySector,
  createEmptySectorTotals,
  clamp01
} from '../shared/index.js';

import { getRatingEngine } from './rating-engine.js';
import { createPositionOptimizer } from './position-optimizer.js';
import { createFormationOptimizer } from './formation-optimizer.js';

export class OpponentAnalyzer {
  constructor(ratingEngine, positionOptimizer, formationOptimizer) {
    this.ratingEngine = ratingEngine || getRatingEngine();
    this.positionOptimizer = positionOptimizer || createPositionOptimizer(this.ratingEngine);
    this.formationOptimizer = formationOptimizer || createFormationOptimizer(this.positionOptimizer, this.ratingEngine);
  }
  
  async analyzeOpponent(opponent, coachLevel = 0) {
    let regionalRatings = opponent.regionalRatings;
    
    if (!regionalRatings) {
      regionalRatings = await this.calculateOpponentRatings(opponent, coachLevel);
    }
    
    const strongestAttackSector = this.findStrongestAttackSector(regionalRatings);
    const weakestDefenceSector = this.findWeakestDefenceSector(regionalRatings);
    
    const midfieldStrength = regionalRatings.midfield;
    const leftAttackStrength = regionalRatings.leftAttack;
    const centralAttackStrength = regionalRatings.centralAttack;
    const rightAttackStrength = regionalRatings.rightAttack;
    const leftDefenceStrength = regionalRatings.leftDefence;
    const centralDefenceStrength = regionalRatings.centralDefence;
    const rightDefenceStrength = regionalRatings.rightDefence;
    
    const defenceValues = [leftDefenceStrength, centralDefenceStrength, rightDefenceStrength];
    const defenceAvg = defenceValues.reduce((a, b) => a + b, 0) / 3;
    const defenceVariance = defenceValues.reduce((sum, v) => sum + Math.pow(v - defenceAvg, 2), 0) / 3;
    const defenceBalance = 1 - Math.min(1, defenceVariance / 10);
    
    const predictedFormation = this.predictFormation(opponent);
    const predictedTactic = this.predictTactic(opponent, regionalRatings);
    
    const { advantages, disadvantages } = this.identifyMatchupFactors(regionalRatings);
    const missingData = this.findMissingData(opponent);
    
    return {
      teamName: opponent.teamName,
      regionalRatings,
      strongestAttackSector,
      weakestDefenceSector,
      midfieldStrength,
      leftAttackStrength,
      centralAttackStrength,
      rightAttackStrength,
      leftDefenceStrength,
      centralDefenceStrength,
      rightDefenceStrength,
      defenceBalance,
      predictedFormation,
      predictedTactic,
      advantages,
      disadvantages,
      missingData
    };
  }
  
  async calculateOpponentRatings(opponent, coachLevel) {
    if (opponent.lineup && opponent.players) {
      const slotAssignments = new Map();
      
      for (const slot of opponent.lineup.slots) {
        if (slot.playerId > 0) {
          const player = opponent.players.find(p => p.id === slot.playerId);
          if (player) {
            slotAssignments.set(slot.code, { player, order: slot.order });
          }
        }
      }
      
      if (slotAssignments.size > 0) {
        const result = this.ratingEngine.rateLineup(slotAssignments, coachLevel);
        return result.rating;
      }
    }
    
    if (opponent.players && opponent.players.length >= 11) {
      const formationResult = await this.formationOptimizer.generateCandidates(opponent.players, coachLevel);
      
      if (formationResult.bestFormation) {
        const slotAssignments = new Map();
        
        for (const assignment of formationResult.bestFormation.bestAssignment) {
          const player = opponent.players.find(p => p.id === assignment.playerId);
          if (player) {
            slotAssignments.set(assignment.slotCode, { player, order: assignment.order });
          }
        }
        
        const result = this.ratingEngine.rateLineup(slotAssignments, coachLevel);
        return result.rating;
      }
    }
    
    return this.estimateRatingsFromPlayers(opponent.players || []);
  }
  
  estimateRatingsFromPlayers(players) {
    const totals = createEmptySectorTotals();
    let count = 0;
    
    for (const player of players) {
      const bestPos = this.positionOptimizer.analyzePlayer(player).bestPosition;
      if (bestPos.rating > 0) {
        count++;
        totals.midfield += bestPos.rating * 0.3;
        totals.centralAttack += bestPos.rating * 0.2;
        totals.leftAttack += bestPos.rating * 0.15;
        totals.rightAttack += bestPos.rating * 0.15;
        totals.centralDefence += bestPos.rating * 0.1;
        totals.leftDefence += bestPos.rating * 0.05;
        totals.rightDefence += bestPos.rating * 0.05;
      }
    }
    
    if (count > 0) {
      for (const sector of Object.keys(totals)) {
        totals[sector] = totals[sector] / count * 10;
      }
    }
    
    return {
      leftDefence: totals.leftDefence,
      centralDefence: totals.centralDefence,
      rightDefence: totals.rightDefence,
      midfield: totals.midfield,
      leftAttack: totals.leftAttack,
      centralAttack: totals.centralAttack,
      rightAttack: totals.rightAttack,
      displayLeftDefence: totals.leftDefence,
      displayCentralDefence: totals.centralDefence,
      displayRightDefence: totals.rightDefence,
      displayMidfield: totals.midfield,
      displayLeftAttack: totals.leftAttack,
      displayCentralAttack: totals.centralAttack,
      displayRightAttack: totals.rightAttack
    };
  }
  
  findStrongestAttackSector(ratings) {
    const attackSectors = ['LeftAttack', 'CentralAttack', 'RightAttack'];
    return attackSectors.reduce((max, sector) => ratings[sector] > ratings[max] ? sector : max, 'CentralAttack');
  }
  
  findWeakestDefenceSector(ratings) {
    const defenceSectors = ['LeftDefence', 'CentralDefence', 'RightDefence'];
    return defenceSectors.reduce((min, sector) => ratings[sector] < ratings[min] ? sector : min, 'CentralDefence');
  }
  
  predictFormation(opponent) {
    if (opponent.knownFormation) return opponent.knownFormation;
    if (opponent.lineup) return opponent.lineup.formation;
    if (!opponent.players || opponent.players.length === 0) return undefined;
    
    const posCounts = {};
    for (const player of opponent.players) {
      const best = this.positionOptimizer.analyzePlayer(player).bestPosition;
      const basePos = best.positionCode.split(' ')[0];
      posCounts[basePos] = (posCounts[basePos] || 0) + 1;
    }
    
    let bestFormation = '4-4-2';
    let bestScore = -1;
    
    for (const [formation, slots] of Object.entries(FORMATION_SLOTS)) {
      let score = 0;
      for (const slot of slots) {
        const basePos = slot.split(' ')[0];
        score += posCounts[basePos] || 0;
      }
      if (score > bestScore) {
        bestScore = score;
        bestFormation = formation;
      }
    }
    
    return bestFormation;
  }
  
  predictTactic(opponent, ratings) {
    if (opponent.knownTactic) return opponent.knownTactic;
    
    let pressingScore = 0, counterScore = 0, attackMiddleScore = 0, attackWingsScore = 0, longShotsScore = 0, creativeScore = 0;
    
    if (opponent.players) {
      for (const player of opponent.players) {
        if (player.defending >= 10 && player.stamina >= 10) pressingScore += 2;
        if (player.defending >= 10 && player.passing >= 10) counterScore += 2;
        if (player.passing >= 10 && player.playmaking >= 10) attackMiddleScore += 2;
        if (player.winger >= 10) attackWingsScore += 2;
        if (player.scoring >= 10 && player.setPieces >= 8) longShotsScore += 2;
        if (player.passing >= 12 && player.experience >= 10) creativeScore += 2;
      }
    }
    
    const midfieldDominance = ratings.midfield / Math.max(1, (ratings.leftDefence + ratings.centralDefence + ratings.rightDefence) / 3);
    if (midfieldDominance > 1.3) { attackMiddleScore += 1; creativeScore += 1; }
    
    const wingStrength = (ratings.leftAttack + ratings.rightAttack) / 2;
    const centralStrength = ratings.centralAttack;
    if (wingStrength > centralStrength * 1.2) attackWingsScore += 1;
    
    const scores = {
      0: 0, 1: pressingScore, 2: counterScore, 3: attackMiddleScore, 4: attackWingsScore, 7: creativeScore, 8: longShotsScore
    };
    
    const best = Object.entries(scores).reduce((a, b) => b[1] > a[1] ? b : a);
    return best[1] > 0 ? parseInt(best[0]) : undefined;
  }
  
  identifyMatchupFactors(ratings) {
    const advantages = [];
    const disadvantages = [];
    
    if (ratings.leftAttack > ratings.rightDefence * 1.2) advantages.push('Sol hücum, rakip sağ savunmasından üstün');
    if (ratings.rightAttack > ratings.leftDefence * 1.2) advantages.push('Sağ hücum, rakip sol savunmasından üstün');
    if (ratings.centralAttack > ratings.centralDefence * 1.2) advantages.push('Merkez hücum, rakip merkez savunmasından üstün');
    
    if (ratings.leftDefence < ratings.rightAttack * 0.8) disadvantages.push('Sol savunma, rakip sağ hücumu karşı zayıf');
    if (ratings.rightDefence < ratings.leftAttack * 0.8) disadvantages.push('Sağ savunma, rakip sol hücumu karşı zayıf');
    if (ratings.centralDefence < ratings.centralAttack * 0.8) disadvantages.push('Merkez savunma, rakip merkez hücumu karşı zayıf');
    
    if (ratings.midfield > (ratings.leftAttack + ratings.centralAttack + ratings.rightAttack) / 3 * 1.2) {
      advantages.push('Orta saha rakip hücum ortalamasından güçlü');
    }
    if (ratings.midfield < (ratings.leftDefence + ratings.centralDefence + ratings.rightDefence) / 3 * 0.8) {
      disadvantages.push('Orta saha kendi savunma ortalamasından zayıf');
    }
    
    return { advantages, disadvantages };
  }
  
  findMissingData(opponent) {
    const missing = [];
    if (!opponent.lineup) missing.push('Maç dizilişi (lineup) bilinmiyor');
    if (!opponent.players || opponent.players.length === 0) missing.push('Oyuncu verisi tamamen eksik');
    else if (opponent.players.length < 11) missing.push(`Sadece ${opponent.players.length} oyuncu verisi var (11 gerekli)`);
    if (!opponent.regionalRatings) missing.push('Bölgesel ratingler hesaplanamadı');
    if (!opponent.knownFormation) missing.push('Formasyon tahmin edilmek zorunda');
    if (!opponent.knownTactic) missing.push('Taktik tahmin edilmek zorunda');
    if (opponent.players) {
      const hasGK = opponent.players.some(p => p.keeper > 0);
      if (!hasGK) missing.push('Kaleci verisi eksik');
    }
    return missing;
  }
  
  async quickAnalysis(opponent) {
    const analysis = await this.analyzeOpponent(opponent);
    
    const overallStrength = (
      analysis.midfieldStrength + analysis.leftAttackStrength + analysis.centralAttackStrength + analysis.rightAttackStrength +
      analysis.leftDefenceStrength + analysis.centralDefenceStrength + analysis.rightDefenceStrength
    ) / 7;
    
    return {
      strength: Math.round(overallStrength * 10) / 10,
      weakness: this.getWeaknessDescription(analysis.weakestDefenceSector),
      recommendedApproach: this.getRecommendedApproach(analysis)
    };
  }
  
  getWeaknessDescription(sector) {
    const names = {
      'LeftDefence': 'Sol savunma', 'CentralDefence': 'Merkez savunma', 'RightDefence': 'Sağ savunma',
      'Midfield': 'Orta saha', 'LeftAttack': 'Sol hücum', 'CentralAttack': 'Merkez hücum', 'RightAttack': 'Sağ hücum'
    };
    return `${names[sector]} en zayıf bölge`;
  }
  
  getRecommendedApproach(analysis) {
    if (analysis.weakestDefenceSector === 'LeftDefence') return 'Sağ kanattan atak (rakip sol savunması zayıf)';
    if (analysis.weakestDefenceSector === 'RightDefence') return 'Sol kanattan atak (rakip sağ savunması zayıf)';
    if (analysis.weakestDefenceSector === 'CentralDefence') return 'Orta saldırı (rakip merkez savunması zayıf)';
    if (analysis.midfieldStrength < 8) return 'Kontra atak (rakip orta sahası zayıf)';
    if (analysis.midfieldStrength > 12) return 'Pres (rakip orta sahası güçlü, topu almak zor)';
    return 'Dengeli oyun';
  }
}

export function createOpponentAnalyzer(ratingEngine, positionOptimizer, formationOptimizer) {
  return new OpponentAnalyzer(ratingEngine, positionOptimizer, formationOptimizer);
}