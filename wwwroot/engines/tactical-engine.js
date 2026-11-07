// Tactical Decision Engine - JavaScript

import { 
  TeamTactic, 
  RegionalSector,
  FORMATION_SLOTS, 
  ALLOWED_ORDERS, 
  TACTIC_NAMES,
  getSectorsForSlot,
  clamp01
} from '../shared/index.js';

import { getRatingEngine } from './rating-engine.js';
import { createPositionOptimizer } from './position-optimizer.js';
import { createFormationOptimizer } from './formation-optimizer.js';
import { createOpponentAnalyzer } from './opponent-analyzer.js';

export class TacticalDecisionEngine {
  constructor(ratingEngine, positionOptimizer, formationOptimizer, opponentAnalyzer) {
    this.ratingEngine = ratingEngine || getRatingEngine();
    this.positionOptimizer = positionOptimizer || createPositionOptimizer(this.ratingEngine);
    this.formationOptimizer = formationOptimizer || createFormationOptimizer(this.positionOptimizer, this.ratingEngine);
    this.opponentAnalyzer = opponentAnalyzer || createOpponentAnalyzer(this.ratingEngine, this.positionOptimizer, this.formationOptimizer);
  }
  
  async evaluateAllTactics(ownPlayers, ownFormation, ownLineup, opponent, coachLevel = 0, preferredTactic) {
    const evaluations = [];
    const tactics = [TeamTactic.Normal, TeamTactic.Pressing, TeamTactic.CounterAttack, TeamTactic.AttackMiddle, TeamTactic.AttackWings, TeamTactic.LongShots];
    
    const baselineRatings = this.calculateTacticRatings(ownLineup, TeamTactic.Normal, coachLevel);
    const squadAnalysis = this.analyzeSquadForTactics(ownPlayers);
    
    for (const tactic of tactics) {
      const evaluation = await this.evaluateTactic(tactic, ownPlayers, ownFormation, ownLineup, opponent, baselineRatings, squadAnalysis, coachLevel);
      evaluations.push(evaluation);
    }
    
    evaluations.sort((a, b) => b.overallScore - a.overallScore);
    
    const bestTactic = evaluations[0];
    let userPreferredTactic;
    if (preferredTactic) {
      userPreferredTactic = evaluations.find(e => e.tactic === preferredTactic);
    }
    
    const comparison = await this.generateTacticComparisons(evaluations, ownLineup, opponent, coachLevel);
    
    return { evaluations, bestTactic, userPreferredTactic, comparison };
  }
  
  async evaluateTactic(tactic, ownPlayers, ownFormation, ownLineup, opponent, baselineRatings, squadAnalysis, coachLevel) {
    const tacticRatings = this.calculateTacticRatings(ownLineup, tactic, coachLevel);
    const squadFitScore = this.calculateSquadFit(tactic, ownPlayers, squadAnalysis);
    const matchupScore = this.calculateMatchupScore(tactic, tacticRatings, opponent.regionalRatings, opponent.predictedTactic);
    const opportunityCost = this.calculateOpportunityCost(tactic, tacticRatings, baselineRatings);
    const tacticalSignal = this.calculateTacticalSignal(tactic, ownPlayers);
    const primaryScore = this.calculatePrimaryScore(tactic, tacticRatings, opponent.regionalRatings, squadFitScore);
    const overallScore = this.calculateOverallScore(squadFitScore, matchupScore, opportunityCost, tacticalSignal, primaryScore);
    const explanation = this.generateExplanation(tactic, squadFitScore, matchupScore, opportunityCost, tacticalSignal, primaryScore);
    const riskFactors = this.identifyRiskFactors(tactic, opportunityCost, matchupScore);
    const recommendedFor = this.determineRecommendedFor(tactic, matchupScore, opportunityCost);
    
    return { tactic, tacticName: TACTIC_NAMES[tactic], squadFitScore, matchupScore, opportunityCost, tacticalSignal, primaryScore, overallScore, explanation, riskFactors, recommendedFor };
  }
  
  calculateTacticRatings(lineup, tactic, coachLevel) {
    const baseResult = this.ratingEngine.rateLineup(lineup, coachLevel);
    const baseRatings = baseResult.rating;
    const modified = { ...baseRatings };
    
    const midfieldMod = this.getMidfieldModifier(tactic);
    const attackMod = this.getAttackModifier(tactic);
    const defenceMod = this.getDefenceModifier(tactic);
    
    modified.midfield *= midfieldMod;
    modified.leftAttack *= attackMod.left;
    modified.centralAttack *= attackMod.centre;
    modified.rightAttack *= attackMod.right;
    modified.leftDefence *= defenceMod.left;
    modified.centralDefence *= defenceMod.centre;
    modified.rightDefence *= defenceMod.right;
    
    modified.displayMidfield = Math.max(1, Math.min(20, Math.round(modified.midfield * 4) / 4));
    modified.displayLeftAttack = Math.max(1, Math.min(20, Math.round(modified.leftAttack * 4) / 4));
    modified.displayCentralAttack = Math.max(1, Math.min(20, Math.round(modified.centralAttack * 4) / 4));
    modified.displayRightAttack = Math.max(1, Math.min(20, Math.round(modified.rightAttack * 4) / 4));
    modified.displayLeftDefence = Math.max(1, Math.min(20, Math.round(modified.leftDefence * 4) / 4));
    modified.displayCentralDefence = Math.max(1, Math.min(20, Math.round(modified.centralDefence * 4) / 4));
    modified.displayRightDefence = Math.max(1, Math.min(20, Math.round(modified.rightDefence * 4) / 4));
    
    return modified;
  }
  
  getMidfieldModifier(tactic) {
    switch (tactic) {
      case TeamTactic.Pressing: return 0.95;
      case TeamTactic.CounterAttack: return 0.90;
      case TeamTactic.AttackMiddle: return 1.05;
      case TeamTactic.AttackWings: return 1.0;
      case TeamTactic.LongShots: return 1.0;
      case TeamTactic.Creative: return 1.08;
      default: return 1.0;
    }
  }
  
  getAttackModifier(tactic) {
    switch (tactic) {
      case TeamTactic.AttackMiddle: return { left: 0.85, centre: 1.25, right: 0.85 };
      case TeamTactic.AttackWings: return { left: 1.2, centre: 0.8, right: 1.2 };
      case TeamTactic.CounterAttack: return { left: 1.1, centre: 1.0, right: 1.1 };
      case TeamTactic.LongShots: return { left: 1.05, centre: 1.1, right: 1.05 };
      case TeamTactic.Creative: return { left: 1.1, centre: 1.15, right: 1.1 };
      case TeamTactic.Pressing: return { left: 0.95, centre: 0.95, right: 0.95 };
      default: return { left: 1.0, centre: 1.0, right: 1.0 };
    }
  }
  
  getDefenceModifier(tactic) {
    switch (tactic) {
      case TeamTactic.Pressing: return { left: 1.1, centre: 1.15, right: 1.1 };
      case TeamTactic.CounterAttack: return { left: 1.05, centre: 1.1, right: 1.05 };
      case TeamTactic.AttackMiddle: return { left: 0.95, centre: 0.9, right: 0.95 };
      case TeamTactic.AttackWings: return { left: 0.9, centre: 0.95, right: 0.9 };
      case TeamTactic.LongShots: return { left: 1.0, centre: 1.0, right: 1.0 };
      case TeamTactic.Creative: return { left: 0.95, centre: 0.95, right: 0.95 };
      default: return { left: 1.0, centre: 1.0, right: 1.0 };
    }
  }
  
  analyzeSquadForTactics(players) {
    let totalDefending = 0, totalStamina = 0, totalPassing = 0, totalPlaymaking = 0;
    let totalScoring = 0, totalWinger = 0, totalExperience = 0;
    let powerfulDefenders = 0, quickPlayers = 0, technicalPlayers = 0, headPlayers = 0, outfieldCount = 0;
    
    for (const p of players) {
      if (p.keeper > 0) continue;
      outfieldCount++;
      totalDefending += p.defending;
      totalStamina += p.stamina;
      totalPassing += p.passing;
      totalPlaymaking += p.playmaking;
      totalScoring += p.scoring;
      totalWinger += p.winger;
      totalExperience += p.experience;
      
      if (p.specialty === 3) { if (p.defending > 0) powerfulDefenders++; }
      if (p.specialty === 2) quickPlayers++;
      if (p.specialty === 1) technicalPlayers++;
      if (p.specialty === 5) headPlayers++;
    }
    
    return {
      avgDefending: outfieldCount > 0 ? totalDefending / outfieldCount : 0,
      avgStamina: outfieldCount > 0 ? totalStamina / outfieldCount : 0,
      avgPassing: outfieldCount > 0 ? totalPassing / outfieldCount : 0,
      avgPlaymaking: outfieldCount > 0 ? totalPlaymaking / outfieldCount : 0,
      avgScoring: outfieldCount > 0 ? totalScoring / outfieldCount : 0,
      avgWinger: outfieldCount > 0 ? totalWinger / outfieldCount : 0,
      avgExperience: outfieldCount > 0 ? totalExperience / outfieldCount : 0,
      powerfulDefenders, quickPlayers, technicalPlayers, headPlayers, outfieldCount
    };
  }
  
  calculateSquadFit(tactic, players, analysis) {
    switch (tactic) {
      case TeamTactic.Pressing:
        return clamp01(0.42 * clamp01(analysis.avgDefending / 10) + 0.33 * clamp01(analysis.avgStamina / 10) + 0.15 * clamp01(analysis.avgExperience / 10) + 0.10 * clamp01(analysis.powerfulDefenders / 3));
      case TeamTactic.CounterAttack:
        return clamp01(0.5 * clamp01(analysis.avgDefending / 10) + 0.3 * clamp01(analysis.avgPassing / 10) + 0.2 * clamp01(analysis.quickPlayers / 3));
      case TeamTactic.AttackMiddle:
        return clamp01(0.5 * clamp01(analysis.avgPassing / 10) + 0.3 * clamp01(analysis.avgPlaymaking / 10) + 0.2 * clamp01(analysis.technicalPlayers / 3));
      case TeamTactic.AttackWings:
        return clamp01(0.5 * clamp01(analysis.avgWinger / 10) + 0.3 * clamp01(analysis.avgPassing / 10) + 0.2 * clamp01(analysis.quickPlayers / 3));
      case TeamTactic.LongShots:
        return clamp01(0.6 * clamp01(analysis.avgScoring / 10) + 0.4 * clamp01(analysis.headPlayers / 2));
      case TeamTactic.Creative:
        return clamp01(0.6 * clamp01((4 * analysis.avgPassing + analysis.avgExperience) / 50) + 0.4 * clamp01(analysis.technicalPlayers / 3));
      default: return 0.5;
    }
  }
  
  calculateMatchupScore(tactic, ownRatings, opponentRatings, opponentTactic) {
    const leftAttackAdv = ownRatings.leftAttack / Math.max(1, opponentRatings.rightDefence);
    const rightAttackAdv = ownRatings.rightAttack / Math.max(1, opponentRatings.leftDefence);
    const centralAttackAdv = ownRatings.centralAttack / Math.max(1, opponentRatings.centralDefence);
    
    let score = 0;
    switch (tactic) {
      case TeamTactic.AttackMiddle: score = centralAttackAdv; break;
      case TeamTactic.AttackWings: score = (leftAttackAdv + rightAttackAdv) / 2; break;
      case TeamTactic.CounterAttack:
        const opponentAttackAvg = (opponentRatings.leftAttack + opponentRatings.centralAttack + opponentRatings.rightAttack) / 3;
        score = clamp01(opponentAttackAvg / 10); break;
      case TeamTactic.Pressing:
        const opponentAttackAvg2 = (opponentRatings.leftAttack + opponentRatings.centralAttack + opponentRatings.rightAttack) / 3;
        score = clamp01(1 - opponentAttackAvg2 / 15); break;
      case TeamTactic.LongShots:
        const opponentDefAvg = (opponentRatings.leftDefence + opponentRatings.centralDefence + opponentRatings.rightDefence) / 3;
        score = clamp01(opponentDefAvg / 12); break;
      default: score = 0.5;
    }
    return clamp01(score);
  }
  
  calculateOpportunityCost(tactic, tacticRatings, baselineRatings) {
    if (tactic === TeamTactic.Normal) return 0;
    
    const midfieldLoss = Math.max(0, baselineRatings.midfield - tacticRatings.midfield) / Math.max(1, baselineRatings.midfield);
    const attackLoss = Math.max(0, 
      (baselineRatings.leftAttack + baselineRatings.centralAttack + baselineRatings.rightAttack) / 3 -
      (tacticRatings.leftAttack + tacticRatings.centralAttack + tacticRatings.rightAttack) / 3
    ) / Math.max(1, (baselineRatings.leftAttack + baselineRatings.centralAttack + baselineRatings.rightAttack) / 3);
    const defenceLoss = Math.max(0,
      (baselineRatings.leftDefence + baselineRatings.centralDefence + baselineRatings.rightDefence) / 3 -
      (tacticRatings.leftDefence + tacticRatings.centralDefence + tacticRatings.rightDefence) / 3
    ) / Math.max(1, (baselineRatings.leftDefence + baselineRatings.centralDefence + baselineRatings.rightDefence) / 3);
    
    return clamp01(0.4 * midfieldLoss + 0.35 * attackLoss + 0.25 * defenceLoss);
  }
  
  calculateTacticalSignal(tactic, players) {
    let relevantSkill = 0, count = 0;
    for (const p of players) {
      if (p.keeper > 0) continue;
      count++;
      switch (tactic) {
        case TeamTactic.Pressing: relevantSkill += (p.defending + p.stamina) / 2; break;
        case TeamTactic.CounterAttack: relevantSkill += (p.defending + 2 * p.passing) / 3; break;
        case TeamTactic.AttackMiddle:
        case TeamTactic.AttackWings: relevantSkill += p.passing; break;
        case TeamTactic.LongShots: relevantSkill += (3 * p.scoring + p.passing) / 4; break;
        case TeamTactic.Creative: relevantSkill += (4 * p.passing + p.experience) / 5; break;
      }
    }
    const avg = count > 0 ? relevantSkill / count : 0;
    return clamp01(avg / 10);
  }
  
  calculatePrimaryScore(tactic, ownRatings, opponentRatings, squadFit) {
    let score = 0;
    switch (tactic) {
      case TeamTactic.Pressing:
        const oppAttackAvg = (opponentRatings.leftAttack + opponentRatings.centralAttack + opponentRatings.rightAttack) / 3;
        const ourAttackAvg = (ownRatings.leftAttack + ownRatings.centralAttack + ownRatings.rightAttack) / 3;
        score = 0.55 * clamp01(1 - oppAttackAvg / 15) + 0.25 * squadFit + 0.2 * clamp01(ownRatings.midfield / 10); break;
      case TeamTactic.CounterAttack:
        score = 0.5 * clamp01(opponentRatings.midfield / 12) + 0.3 * squadFit + 0.2 * clamp01(ownRatings.midfield / 10); break;
      default:
        score = 0.5 * squadFit + 0.5 * this.calculateMatchupScore(tactic, ownRatings, opponentRatings);
    }
    return clamp01(score);
  }
  
  calculateOverallScore(squadFit, matchup, opportunityCost, tacticalSignal, primary) {
    return clamp01(0.40 * primary + 0.25 * squadFit + 0.20 * matchup + 0.15 * tacticalSignal - 0.25 * opportunityCost);
  }
  
  generateExplanation(tactic, squadFit, matchup, opportunityCost, tacticalSignal, primary) {
    const tacticName = TACTIC_NAMES[tactic];
    const fitDesc = squadFit > 0.7 ? 'çok uygun' : squadFit > 0.5 ? 'uygun' : squadFit > 0.3 ? 'orta' : 'zayıf';
    const matchupDesc = matchup > 0.7 ? 'rakibe karşı çok etkili' : matchup > 0.5 ? 'rakibe karşı etkili' : 'rakibe karşı orta';
    const costDesc = opportunityCost > 0.3 ? 'yüksek maliyetli' : opportunityCost > 0.15 ? 'orta maliyetli' : 'düşük maliyetli';
    return `${tacticName}: Takım uyumu ${fitDesc} (${(squadFit*100).toFixed(0)}%), ${matchupDesc} (${(matchup*100).toFixed(0)}%), fırsat maliyeti ${costDesc} (${(opportunityCost*100).toFixed(0)}%). Birincil skor: ${(primary*100).toFixed(0)}%.`;
  }
  
  identifyRiskFactors(tactic, opportunityCost, matchupScore) {
    const risks = [];
    if (opportunityCost > 0.3) risks.push('Normal taktiğe göre önemli avantaj kaybı');
    
    switch (tactic) {
      case TeamTactic.Pressing:
        risks.push('Stamina düşerse ikinci yarı performans düşebilir');
        risks.push('Rakip uzun toplarla arkadan gelebilir'); break;
      case TeamTactic.CounterAttack:
        risks.push('Orta saha kontrolü kaybedilirse fırsat üretilemez');
        risks.push('Liderlik/karakter zayıfsa kontra atako organize olmaz'); break;
      case TeamTactic.AttackMiddle: risks.push('Kanat savunmaları boşalabilir'); break;
      case TeamTactic.AttackWings: risks.push('Orta hücum zayıflayabilir'); break;
      case TeamTactic.LongShots: risks.push('Düşük olasılıklı, gol beklentisi sınırlı'); break;
    }
    if (matchupScore < 0.3) risks.push('Rakip bu taktiğe karşı iyi hazırlıklı olabilir');
    return risks;
  }
  
  determineRecommendedFor(tactic, matchup, opportunityCost) {
    if (tactic === TeamTactic.Pressing && matchup > 0.6) return 'win';
    if (tactic === TeamTactic.CounterAttack && opportunityCost < 0.2) return 'win';
    if (tactic === TeamTactic.AttackMiddle || tactic === TeamTactic.AttackWings) return 'attack';
    if (tactic === TeamTactic.LongShots) return 'attack';
    if (tactic === TeamTactic.CounterAttack) return 'draw';
    return 'win';
  }
  
  async generateTacticComparisons(evaluations, ownLineup, opponent, coachLevel) {
    const comparisons = [];
    for (const eval_ of evaluations) {
      const ownAttack = eval_.matchupScore > 0.6 ? 1.5 + eval_.matchupScore * 1.5 : 1.0 + eval_.overallScore * 1.0;
      const oppAttack = 1.2;
      const probs = this.estimateProbabilities(ownAttack, oppAttack);
      
      comparisons.push({
        tactic: eval_.tactic,
        winProbability: probs.win, drawProbability: probs.draw, lossProbability: probs.loss,
        expectedGoals: ownAttack, expectedGoalsAgainst: oppAttack,
        expectedPoints: 3 * probs.win + probs.draw,
        ratingImpact: this.getRatingImpact(eval_.tactic)
      });
    }
    return comparisons;
  }
  
  estimateProbabilities(ownExp, oppExp) {
    const maxG = 10;
    let win = 0, draw = 0, loss = 0;
    for (let og = 0; og <= maxG; og++) {
      for (let oppg = 0; oppg <= maxG; oppg++) {
        const pOwn = Math.exp(-ownExp) * Math.pow(ownExp, og) / this.factorial(og);
        const pOpp = Math.exp(-oppExp) * Math.pow(oppExp, oppg) / this.factorial(oppg);
        const p = pOwn * pOpp;
        if (og > oppg) win += p; else if (og === oppg) draw += p; else loss += p;
      }
    }
    const total = win + draw + loss;
    return { win: win/total, draw: draw/total, loss: loss/total };
  }
  
  factorial(n) { if (n <= 1) return 1; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
  
  getRatingImpact(tactic) {
    const mod = {
      0: { mid: 1.0, att: 1.0, def: 1.0 }, 1: { mid: 0.95, att: 0.95, def: 1.1 }, 2: { mid: 0.9, att: 1.05, def: 1.05 },
      3: { mid: 1.05, att: 1.1, def: 0.95 }, 4: { mid: 1.0, att: 1.08, def: 0.93 }, 8: { mid: 1.0, att: 1.05, def: 1.0 }, 7: { mid: 1.08, att: 1.12, def: 0.95 }
    };
    const m = mod[tactic] || mod[0];
    return { leftDefence: m.def, centralDefence: m.def, rightDefence: m.def, midfield: m.mid, leftAttack: m.att, centralAttack: m.att, rightAttack: m.att, displayLeftDefence: m.def, displayCentralDefence: m.def, displayRightDefence: m.def, displayMidfield: m.mid, displayLeftAttack: m.att, displayCentralAttack: m.att, displayRightAttack: m.att };
  }
}

export function createTacticalDecisionEngine(ratingEngine, positionOptimizer, formationOptimizer, opponentAnalyzer) {
  return new TacticalDecisionEngine(ratingEngine, positionOptimizer, formationOptimizer, opponentAnalyzer);
}