// Monte Carlo Match Simulation Engine - JavaScript

import { 
  M8_CONSTANTS, 
  M9_EVENT_CONSTANTS, 
  M9_SIMULATION_CONSTANTS, 
  DEFAULT_SIMULATION_CONFIG,
  possessionProbability,
  linearPossession,
  poissonOutcomeProbabilities,
  clamp01,
  quarterRound
} from '../shared/index.js';

import { SeededRandom } from '../shared/index.js';

export class MonteCarloMatchEngine {
  constructor(seed = M9_SIMULATION_CONSTANTS.DEFAULT_SEED) {
    this.rng = new SeededRandom(seed);
  }
  
  async simulate(ownRatings, opponentRatings, ownTactic = 0, opponentTactic = 0, location = 0, config = {}, ownPlayers, opponentPlayers) {
    const finalConfig = {
      ...DEFAULT_SIMULATION_CONFIG,
      ...config,
      simulationCount: Math.min(Math.max(config.simulationCount || DEFAULT_SIMULATION_CONFIG.simulationCount, M9_SIMULATION_CONSTANTS.MIN_SIMULATION_COUNT), M9_SIMULATION_CONSTANTS.MAX_SIMULATION_COUNT)
    };
    
    this.rng.reset(finalConfig.seed);
    
    const chanceAllocation = this.calculateChanceAllocation(ownRatings.midfield, opponentRatings.midfield, ownTactic, opponentTactic);
    const ownEvents = this.calculateEventGoals(ownRatings, opponentRatings, chanceAllocation, ownTactic, ownPlayers);
    const opponentEvents = this.calculateEventGoals(opponentRatings, ownRatings, this.flipChanceAllocation(chanceAllocation), opponentTactic, opponentPlayers);
    
    const ownExpectedGoals = this.calculateExpectedGoals(chanceAllocation, ownEvents, opponentEvents.pressingSuppressionSignal, location === 1);
    const opponentExpectedGoals = this.calculateExpectedGoals(this.flipChanceAllocation(chanceAllocation), opponentEvents, ownEvents.pressingSuppressionSignal, location === -1);
    
    const { scoreFrequencies, outcomeProbs, scenarioResults, records } = this.runSimulations(
      ownExpectedGoals, opponentExpectedGoals, ownEvents, opponentEvents, finalConfig, location
    );
    
    const mostLikelyScore = scoreFrequencies[0]?.score || '0-0';
    const mostLikelyScoreProb = scoreFrequencies[0]?.probability || 0;
    
    return {
      config: finalConfig,
      winProbability: outcomeProbs.win,
      drawProbability: outcomeProbs.draw,
      lossProbability: outcomeProbs.loss,
      expectedHomeGoals: ownExpectedGoals,
      expectedAwayGoals: opponentExpectedGoals,
      expectedGoalDifference: ownExpectedGoals - opponentExpectedGoals,
      mostLikelyScore,
      mostLikelyScoreProbability: mostLikelyScoreProb,
      scoreFrequencies,
      outcomeProbabilities: outcomeProbs,
      scenarioResults: finalConfig.includeScenarios ? scenarioResults : undefined,
      simulationRecords: records
    };
  }
  
  calculateChanceAllocation(ownMidfield, opponentMidfield, ownTactic, opponentTactic) {
    const effectiveOwnMidfield = ownTactic === 2 ? Math.max(0, ownMidfield * (1 - M8_CONSTANTS.COUNTER_ATTACK_MIDFIELD_PENALTY)) : ownMidfield;
    const possession = possessionProbability(effectiveOwnMidfield, opponentMidfield);
    const pressingSuppression = ownTactic === 1 ? this.calculateTacticConversionRate(ownTactic, 5.0) : 0;
    const normalVolumeFactor = 1 - pressingSuppression;
    
    const ownExpected = M8_CONSTANTS.PAPER_EXPECTED_REGULAR_SECTOR_CHANCES * possession * normalVolumeFactor;
    const opponentExpected = M8_CONSTANTS.PAPER_EXPECTED_REGULAR_SECTOR_CHANCES * (1 - possession) * normalVolumeFactor;
    
    const sectorShares = this.calculateSectorShares(ownTactic, 5.0);
    const appliedConversion = this.calculateTacticConversionRate(ownTactic, 5.0);
    
    return {
      ownExclusive: M8_CONSTANTS.EXCLUSIVE_CHANCES_PER_TEAM,
      opponentExclusive: M8_CONSTANTS.EXCLUSIVE_CHANCES_PER_TEAM,
      openChancePool: M8_CONSTANTS.OPEN_CHANCE_POOL,
      ownOpenExpected: M8_CONSTANTS.OPEN_CHANCE_POOL * possession * normalVolumeFactor,
      opponentOpenExpected: M8_CONSTANTS.OPEN_CHANCE_POOL * (1 - possession) * normalVolumeFactor,
      ownRegularChanceExpected: ownExpected,
      opponentRegularChanceExpected: opponentExpected,
      mechanism: `PDF Eq1+Eq2+Eq3; tactic=${Object.keys({0:'Normal',1:'Pressing',2:'CounterAttack',3:'AttackMiddle',4:'AttackWings',8:'LongShots'})[ownTactic]}; TCR=${(appliedConversion*100).toFixed(1)}%`,
      possessionProbability: possession,
      effectiveOwnMidfield,
      pressingSuppression,
      tacticConversionRate: appliedConversion,
      longShotConversionRate: ownTactic === 8 ? appliedConversion : 0,
      counterAttackConversionRate: ownTactic === 2 ? appliedConversion : 0,
      counterAttackEligible: ownTactic === 2 && ownMidfield < opponentMidfield,
      sectorLeftShare: sectorShares.leftShare,
      sectorCentreShare: sectorShares.centreShare,
      sectorRightShare: sectorShares.rightShare,
      sectorSetPieceShare: sectorShares.setPieceShare
    };
  }
  
  flipChanceAllocation(allocation) {
    return {
      ...allocation,
      ownOpenExpected: allocation.opponentOpenExpected,
      opponentOpenExpected: allocation.ownOpenExpected,
      ownRegularChanceExpected: allocation.opponentRegularChanceExpected,
      opponentRegularChanceExpected: allocation.ownRegularChanceExpected,
      possessionProbability: 1 - allocation.possessionProbability
    };
  }
  
  calculateSectorShares(tactic, tacticStrength) {
    let left = M8_CONSTANTS.PAPER_LEFT_ATTACK_SHARE;
    let centre = M8_CONSTANTS.PAPER_CENTRE_ATTACK_SHARE;
    let right = M8_CONSTANTS.PAPER_RIGHT_ATTACK_SHARE;
    const setPiece = M8_CONSTANTS.PAPER_DIRECT_FREE_KICK_SHARE + M8_CONSTANTS.PAPER_INDIRECT_FREE_KICK_SHARE + M8_CONSTANTS.PAPER_PENALTY_KICK_SHARE;
    
    const conversion = this.calculateTacticConversionRate(tactic, tacticStrength);
    const strength = Math.max(0, tacticStrength);
    
    switch (tactic) {
      case 3: // AttackMiddle
        const movedMiddle = (left + right) * conversion;
        left -= (left / (left + right)) * movedMiddle;
        right -= (right / (left + right)) * movedMiddle;
        centre += movedMiddle; break;
      case 4: // AttackWings
        const movedWings = centre * conversion;
        centre -= movedWings;
        left += movedWings / 2;
        right += movedWings / 2; break;
    }
    
    const sum = left + centre + right + setPiece;
    
    return {
      leftShare: sum > 0 ? left / sum : M8_CONSTANTS.PAPER_LEFT_ATTACK_SHARE,
      centreShare: sum > 0 ? centre / sum : M8_CONSTANTS.PAPER_CENTRE_ATTACK_SHARE,
      rightShare: sum > 0 ? right / sum : M8_CONSTANTS.PAPER_RIGHT_ATTACK_SHARE,
      setPieceShare: sum > 0 ? setPiece / sum : 0.1255,
      mechanism: 'PDF Eq3 base + tactic migration',
      aiMWingToCentreRate: tactic === 3 ? conversion : 0,
      aoWCentreToWingRate: tactic === 4 ? conversion : 0,
      longShotConversionRate: tactic === 8 ? conversion : 0,
      pressingSuppressionRate: tactic === 1 ? conversion : 0,
      counterAttackConversionRate: tactic === 2 ? conversion : 0,
      counterAttackEligible: tactic === 2,
      creativeEventMultiplier: tactic === 7 ? 2.37 + ((3.80 - 2.37) * strength / 10) : 1.0
    };
  }
  
  calculateTacticConversionRate(tactic, rt) {
    const tacticRt = Math.max(0, rt);
    let raw = 0;
    
    switch (tactic) {
      case 2: raw = -0.617941717072569 + 0.104274398 * tacticRt - 0.00358354796 * tacticRt * tacticRt + 0.0000434356 * tacticRt * tacticRt * tacticRt; break;
      case 3: raw = -0.00036765 * tacticRt * tacticRt + 0.02180462 * tacticRt + 0.0705084; break;
      case 4: raw = -0.00046569 * tacticRt * tacticRt + 0.02894608 * tacticRt + 0.10514706; break;
      case 8: raw = 0.00761935 * tacticRt + 0.07520052; break;
      case 1: raw = -0.00780421 * tacticRt * tacticRt + 0.471402 * tacticRt - 1.10735; break;
      default: raw = 0;
    }
    
    return clamp01(raw);
  }
  
  calculateEventGoals(ownRatings, opponentRatings, chanceAllocation, tactic, players) {
    const ownNormalChanceVolume = chanceAllocation.ownRegularChanceExpected;
    const opponentNormalChanceVolume = chanceAllocation.opponentRegularChanceExpected;
    
    const ownAttackAvg = (ownRatings.leftAttack + ownRatings.centralAttack + ownRatings.rightAttack) / 3;
    const opponentDefAvg = (opponentRatings.leftDefence + opponentRatings.centralDefence + opponentRatings.rightDefence) / 3;
    const ownNormalGoalProb = clamp01(ownAttackAvg / (ownAttackAvg + opponentDefAvg + 1));
    
    const opponentAttackAvg = (opponentRatings.leftAttack + opponentRatings.centralAttack + opponentRatings.rightAttack) / 3;
    const ownDefAvg = (ownRatings.leftDefence + ownRatings.centralDefence + ownRatings.rightDefence) / 3;
    const opponentNormalGoalProb = clamp01(opponentAttackAvg / (opponentAttackAvg + ownDefAvg + 1));
    
    let playerSpecialGoals = 0, teamSpecialGoals = 0, ownGoalExpected = 0;
    let counterAttackGoals = 0, longShotGoals = 0, powerfulNormalForwardGoals = 0, pressingSuppressionSignal = 0;
    const contributions = [];
    
    const creativeMultiplier = tactic === 7 ? 2.37 + (1.43 * 0.5) : 1.0;
    
    const wingerRate = M9_EVENT_CONSTANTS.WINGER_ANY_RATE * creativeMultiplier;
    const wingerGoals = ownNormalChanceVolume * 0.1 * wingerRate * M9_EVENT_CONSTANTS.WINGER_ANY_GOAL_RATE;
    playerSpecialGoals += wingerGoals;
    contributions.push({ event: 'Winger', expectedEvents: ownNormalChanceVolume * 0.1 * wingerRate, goalProbability: M9_EVENT_CONSTANTS.WINGER_ANY_GOAL_RATE, expectedGoals: wingerGoals });
    
    const cornerRate = M9_EVENT_CONSTANTS.CORNER_RATE * creativeMultiplier;
    const cornerGoals = ownNormalChanceVolume * 0.05 * cornerRate * M9_EVENT_CONSTANTS.CORNER_ANYONE_GOAL_RATE;
    teamSpecialGoals += cornerGoals;
    contributions.push({ event: 'Corner', expectedEvents: ownNormalChanceVolume * 0.05 * cornerRate, goalProbability: M9_EVENT_CONSTANTS.CORNER_ANYONE_GOAL_RATE, expectedGoals: cornerGoals });
    
    if (tactic === 2) {
      counterAttackGoals = chanceAllocation.counterAttackConversionRate * chanceAllocation.ownRegularChanceExpected * ownNormalGoalProb;
      contributions.push({ event: 'CounterAttack', expectedEvents: chanceAllocation.counterAttackConversionRate * chanceAllocation.ownRegularChanceExpected, goalProbability: ownNormalGoalProb, expectedGoals: counterAttackGoals });
    }
    
    if (tactic === 8) {
      longShotGoals = chanceAllocation.longShotConversionRate * chanceAllocation.ownRegularChanceExpected * ownNormalGoalProb;
      contributions.push({ event: 'LongShots', expectedEvents: chanceAllocation.longShotConversionRate * chanceAllocation.ownRegularChanceExpected, goalProbability: ownNormalGoalProb, expectedGoals: longShotGoals });
    }
    
    if (tactic === 1) pressingSuppressionSignal = chanceAllocation.pressingSuppression;
    
    const setPieceChances = 10 * M8_CONSTANTS.PAPER_SET_PIECE_SHARE * chanceAllocation.possessionProbability;
    const setPieceGoals = setPieceChances * M8_CONSTANTS.SET_PIECE_NEUTRAL_CONVERSION;
    
    return {
      playerBasedSpecialEventGoals: playerSpecialGoals,
      teamBasedSpecialEventGoals: teamSpecialGoals,
      expectedGoalsConcededFromOwnGoalEvents: ownGoalExpected,
      counterAttackGoals,
      longShotGoals,
      powerfulNormalForwardGoals,
      pressingSuppressionSignal,
      expectedPlayerBasedEvents: contributions.filter(c => c.event !== 'Corner').reduce((sum, c) => sum + c.expectedEvents, 0),
      expectedTeamBasedEvents: contributions.filter(c => c.event === 'Corner').reduce((sum, c) => sum + c.expectedEvents, 0),
      technicalCounterAttackOpportunityRate: 0,
      contributions,
      calibrationStatus: 'Simplified model - full M9EventGoalEngine pending',
      notes: 'Player specialty analysis not implemented in this version',
      setPieceTakerPlayerId: undefined, setPieceTakerSkill: 0,
      netSpecialEventGoalContribution: playerSpecialGoals + teamSpecialGoals + powerfulNormalForwardGoals + counterAttackGoals + longShotGoals - ownGoalExpected
    };
  }
  
  calculateExpectedGoals(chanceAllocation, events, opponentPressingSuppression, isHome) {
    const normalVolumeAfterPressing = chanceAllocation.ownRegularChanceExpected * (1 - opponentPressingSuppression);
    const ownNormalGoalProb = 0.4;
    
    const ownNormalGoals = normalVolumeAfterPressing * ownNormalGoalProb;
    const ownCounterAttackGoals = events.counterAttackGoals;
    const ownSetPieceGoals = 10 * M8_CONSTANTS.PAPER_SET_PIECE_SHARE * chanceAllocation.possessionProbability * M8_CONSTANTS.SET_PIECE_NEUTRAL_CONVERSION;
    const ownSpecialGoals = events.netSpecialEventGoalContribution;
    
    let total = ownNormalGoals + ownCounterAttackGoals + ownSetPieceGoals + ownSpecialGoals;
    if (isHome) total *= 1.05;
    
    return Math.max(0.05, Math.min(M8_CONSTANTS.MAX_GOALS, total));
  }
  
  runSimulations(ownExpected, opponentExpected, ownEvents, opponentEvents, config, location) {
    const scenarios = M9_SIMULATION_CONSTANTS.SCENARIOS;
    const scenarioResults = scenarios.map(s => new ScenarioSummary(s.name));
    const records = [];
    const scoreCounts = new Map();
    let win = 0, draw = 0, loss = 0;
    
    for (let i = 0; i < config.simulationCount; i++) {
      const scenario = scenarios[i % scenarios.length];
      const homeFactor = location === 1 ? scenario.homeFactor : 1.0;
      
      const ownExp = Math.max(0.05, Math.min(M8_CONSTANTS.MAX_GOALS, ownExpected * scenario.chanceVolumeFactor * homeFactor));
      const oppExp = Math.max(0.05, Math.min(M8_CONSTANTS.MAX_GOALS, opponentExpected * scenario.opponentFactor));
      
      const ownEventMean = Math.max(0, ownEvents.netSpecialEventGoalContribution * scenario.chanceVolumeFactor);
      const oppEventMean = Math.max(0, opponentEvents.netSpecialEventGoalContribution * scenario.opponentFactor);
      
      const ownNormalMean = Math.max(0, ownExp - ownEventMean);
      const oppNormalMean = Math.max(0, oppExp - oppEventMean);
      
      let ownGoals = 0, opponentGoals = 0;
      
      for (let tick = 0; tick < config.matchTicks; tick++) {
        ownGoals += this.rng.nextPoisson(ownNormalMean / config.matchTicks);
        opponentGoals += this.rng.nextPoisson(oppNormalMean / config.matchTicks);
        ownGoals += this.simulateEventGoalsForTick(ownEvents, scenario.chanceVolumeFactor, config.matchTicks);
        opponentGoals += this.simulateEventGoalsForTick(opponentEvents, scenario.opponentFactor, config.matchTicks);
      }
      
      const outcome = ownGoals > opponentGoals ? 'Galibiyet' : ownGoals === opponentGoals ? 'Beraberlik' : 'Rakip Galibiyeti';
      if (outcome === 'Galibiyet') win++; else if (outcome === 'Beraberlik') draw++; else loss++;
      
      const scoreKey = `${ownGoals}-${opponentGoals}`;
      scoreCounts.set(scoreKey, (scoreCounts.get(scoreKey) || 0) + 1);
      
      const record = { iteration: i + 1, scenario: scenario.name, ownExpectedGoals: ownExp, opponentExpectedGoals: oppExp, ownGoals, opponentGoals, outcome };
      records.push(record);
      scenarioResults.find(s => s.scenario === scenario.name)?.add(record);
    }
    
    const scoreFrequencies = Array.from(scoreCounts.entries())
      .map(([score, count]) => ({ score, count, probability: count / config.simulationCount }))
      .sort((a, b) => b.count - a.count || a.score.localeCompare(b.score));
    
    const total = config.simulationCount;
    const outcomeProbs = { win: win / total, draw: draw / total, loss: loss / total };
    
    const finalScenarioResults = scenarioResults.map(s => ({
      name: s.scenario, winProbability: s.winProbability, drawProbability: s.drawProbability,
      lossProbability: s.lossProbability, mostLikelyScore: s.mostLikelyScore, count: s.count
    }));
    
    return { scoreFrequencies, outcomeProbs, scenarioResults: finalScenarioResults, records };
  }
  
  simulateEventGoalsForTick(events, multiplier, matchTicks) {
    let goals = 0;
    for (const contrib of events.contributions) {
      const expectedEvents = Math.max(0, contrib.expectedEvents * multiplier / matchTicks);
      if (expectedEvents <= 0 || contrib.goalProbability <= 0) continue;
      const eventCount = this.rng.nextPoisson(expectedEvents);
      for (let i = 0; i < eventCount; i++) {
        if (this.rng.next() < contrib.goalProbability) goals++;
      }
    }
    return goals;
  }
}

class ScenarioSummary {
  constructor(scenario) { this.scenario = scenario; this._records = []; }
  get count() { return this._records.length; }
  get winProbability() { return this._records.filter(r => r.outcome === 'Galibiyet').length / Math.max(1, this._records.length); }
  get drawProbability() { return this._records.filter(r => r.outcome === 'Beraberlik').length / Math.max(1, this._records.length); }
  get lossProbability() { return this._records.filter(r => r.outcome === 'Rakip Galibiyeti').length / Math.max(1, this._records.length); }
  get mostLikelyScore() {
    if (this._records.length === 0) return '0-0';
    const scoreCounts = new Map();
    for (const r of this._records) {
      const key = `${r.ownGoals}-${r.opponentGoals}`;
      scoreCounts.set(key, (scoreCounts.get(key) || 0) + 1);
    }
    return Array.from(scoreCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  }
  add(record) { this._records.push(record); }
}

export async function quickSimulate(ownMidfield, opponentMidfield, ownAttack, opponentDefence, opponentAttack, ownDefence, ownTactic = 0, simulations = 1000) {
  const engine = new MonteCarloMatchEngine();
  
  const ownRatings = { leftDefence: ownDefence * 0.9, centralDefence: ownDefence, rightDefence: ownDefence * 0.9, midfield: ownMidfield, leftAttack: ownAttack * 0.9, centralAttack: ownAttack, rightAttack: ownAttack * 0.9, displayLeftDefence: 0, displayCentralDefence: 0, displayRightDefence: 0, displayMidfield: 0, displayLeftAttack: 0, displayCentralAttack: 0, displayRightAttack: 0 };
  const opponentRatings = { leftDefence: opponentDefence * 0.9, centralDefence: opponentDefence, rightDefence: opponentDefence * 0.9, midfield: opponentMidfield, leftAttack: opponentAttack * 0.9, centralAttack: opponentAttack, rightAttack: opponentAttack * 0.9, displayLeftDefence: 0, displayCentralDefence: 0, displayRightDefence: 0, displayMidfield: 0, displayLeftAttack: 0, displayCentralAttack: 0, displayRightAttack: 0 };
  
  const result = await engine.simulate(ownRatings, opponentRatings, ownTactic, 0, 0, { simulationCount: simulations });
  
  return { win: result.winProbability, draw: result.drawProbability, loss: result.lossProbability, expGoals: result.expectedHomeGoals, expGoalsAgainst: result.expectedAwayGoals };
}

export function createMonteCarloEngine(seed) {
  return new MonteCarloMatchEngine(seed);
}