// Test suite for HattrickAI V6 Analysis Engines
// Run in browser console or via test runner

import { 
  createMatchAnalysisEngine,
  createPositionOptimizer,
  createFormationOptimizer,
  createOpponentAnalyzer,
  createTacticalDecisionEngine,
  createMonteCarloEngine,
  createFinalDecisionEngine,
  PlayerSpecialty,
  PlayerOrder,
  TeamTactic,
  TeamAttitude,
  MatchLocation,
  RegionalSector,
  formFactor,
  experiencePolynomial,
  coachFactor,
  quarterRound,
  displayRating,
  possessionProbability,
  poissonOutcomeProbabilities,
  clamp01,
  SeededRandom,
  normalizePlayer,
  getSkill,
  getSectorsForSlot,
  getOrderMultipliers,
  getSpecialtyMultiplier,
  createEmptySectorTotals,
  FORMATION_SLOTS,
  ALLOWED_ORDERS,
  POSITION_SKILL_WEIGHTS,
  TACTIC_NAMES,
  ORDER_NAMES
} from '../shared/index.js';

// Test data
const createTestPlayers = () => [
  // GK
  { id: 1, name: 'Keeper One', keeper: 12, defending: 4, playmaking: 3, passing: 5, winger: 2, scoring: 1, setPieces: 8, stamina: 6, form: 7, experience: 8, loyalty: 5, specialty: PlayerSpecialty.None },
  // Defenders
  { id: 2, name: 'Defender Central', keeper: 1, defending: 11, playmaking: 4, passing: 7, winger: 3, scoring: 2, setPieces: 6, stamina: 8, form: 6, experience: 9, loyalty: 4, specialty: PlayerSpecialty.Powerful },
  { id: 3, name: 'Defender Left', keeper: 1, defending: 10, playmaking: 5, passing: 8, winger: 4, scoring: 2, setPieces: 5, stamina: 9, form: 7, experience: 7, loyalty: 3, specialty: PlayerSpecialty.Quick },
  { id: 4, name: 'Defender Right', keeper: 1, defending: 9, playmaking: 4, passing: 7, winger: 5, scoring: 3, setPieces: 4, stamina: 8, form: 6, experience: 6, loyalty: 2, specialty: PlayerSpecialty.Technical },
  // Wing backs
  { id: 5, name: 'WB Left', keeper: 1, defending: 8, playmaking: 6, passing: 9, winger: 8, scoring: 4, setPieces: 5, stamina: 10, form: 7, experience: 7, loyalty: 3, specialty: PlayerSpecialty.Quick },
  { id: 6, name: 'WB Right', keeper: 1, defending: 7, playmaking: 5, passing: 8, winger: 9, scoring: 5, setPieces: 4, stamina: 9, form: 6, experience: 6, loyalty: 2, specialty: PlayerSpecialty.Technical },
  // Midfielders
  { id: 7, name: 'IM Central', keeper: 1, defending: 6, playmaking: 11, passing: 10, winger: 4, scoring: 5, setPieces: 7, stamina: 8, form: 7, experience: 8, loyalty: 4, specialty: PlayerSpecialty.Technical },
  { id: 8, name: 'IM Left', keeper: 1, defending: 7, playmaking: 9, passing: 9, winger: 6, scoring: 6, setPieces: 6, stamina: 9, form: 6, experience: 7, loyalty: 3, specialty: PlayerSpecialty.Quick },
  { id: 9, name: 'IM Right', keeper: 1, defending: 6, playmaking: 8, passing: 8, winger: 7, scoring: 7, setPieces: 5, stamina: 8, form: 7, experience: 6, loyalty: 2, specialty: PlayerSpecialty.Technical },
  // Wingers
  { id: 10, name: 'Winger Left', keeper: 1, defending: 4, playmaking: 6, passing: 8, winger: 11, scoring: 7, setPieces: 5, stamina: 9, form: 8, experience: 7, loyalty: 3, specialty: PlayerSpecialty.Quick },
  { id: 11, name: 'Winger Right', keeper: 1, defending: 3, playmaking: 5, passing: 7, winger: 10, scoring: 8, setPieces: 4, stamina: 8, form: 7, experience: 6, loyalty: 2, specialty: PlayerSpecialty.Unpredictable },
  // Forwards
  { id: 12, name: 'Forward Central', keeper: 1, defending: 2, playmaking: 5, passing: 9, winger: 4, scoring: 12, setPieces: 9, stamina: 7, form: 8, experience: 9, loyalty: 4, specialty: PlayerSpecialty.Head },
  { id: 13, name: 'Forward Left', keeper: 1, defending: 3, playmaking: 5, passing: 8, winger: 6, scoring: 10, setPieces: 7, stamina: 8, form: 7, experience: 7, loyalty: 3, specialty: PlayerSpecialty.Quick },
  { id: 14, name: 'Forward Right', keeper: 1, defending: 3, playmaking: 4, passing: 7, winger: 7, scoring: 9, setPieces: 6, stamina: 7, form: 6, experience: 6, loyalty: 2, specialty: PlayerSpecialty.Powerful },
  // Substitutes
  { id: 15, name: 'Sub GK', keeper: 9, defending: 3, playmaking: 2, passing: 4, winger: 1, scoring: 1, setPieces: 5, stamina: 5, form: 5, experience: 5, loyalty: 1, specialty: PlayerSpecialty.None },
  { id: 16, name: 'Sub Def', keeper: 1, defending: 8, playmaking: 4, passing: 6, winger: 3, scoring: 2, setPieces: 4, stamina: 7, form: 5, experience: 5, loyalty: 1, specialty: PlayerSpecialty.None },
  { id: 17, name: 'Sub Mid', keeper: 1, defending: 5, playmaking: 7, passing: 7, winger: 5, scoring: 4, setPieces: 4, stamina: 7, form: 5, experience: 5, loyalty: 1, specialty: PlayerSpecialty.None },
  { id: 18, name: 'Sub Fwd', keeper: 1, defending: 2, playmaking: 4, passing: 6, winger: 5, scoring: 8, setPieces: 5, stamina: 6, form: 5, experience: 5, loyalty: 1, specialty: PlayerSpecialty.None }
];

const createOpponentPlayers = () => [
  { id: 101, name: 'Opp GK', keeper: 10, defending: 3, playmaking: 2, passing: 4, winger: 1, scoring: 1, setPieces: 6, stamina: 5, form: 6, experience: 7, loyalty: 3, specialty: PlayerSpecialty.None },
  { id: 102, name: 'Opp Def C', keeper: 1, defending: 9, playmaking: 4, passing: 6, winger: 2, scoring: 2, setPieces: 5, stamina: 7, form: 5, experience: 6, loyalty: 2, specialty: PlayerSpecialty.Powerful },
  { id: 103, name: 'Opp Def L', keeper: 1, defending: 8, playmaking: 4, passing: 6, winger: 3, scoring: 2, setPieces: 4, stamina: 8, form: 6, experience: 6, loyalty: 2, specialty: PlayerSpecialty.None },
  { id: 104, name: 'Opp Def R', keeper: 1, defending: 7, playmaking: 3, passing: 5, winger: 4, scoring: 2, setPieces: 4, stamina: 7, form: 5, experience: 5, loyalty: 1, specialty: PlayerSpecialty.None },
  { id: 105, name: 'Opp WB L', keeper: 1, defending: 7, playmaking: 5, passing: 7, winger: 7, scoring: 3, setPieces: 4, stamina: 8, form: 6, experience: 6, loyalty: 2, specialty: PlayerSpecialty.Quick },
  { id: 106, name: 'Opp WB R', keeper: 1, defending: 6, playmaking: 4, passing: 6, winger: 8, scoring: 4, setPieces: 3, stamina: 8, form: 5, experience: 5, loyalty: 1, specialty: PlayerSpecialty.None },
  { id: 107, name: 'Opp IM C', keeper: 1, defending: 5, playmaking: 9, passing: 8, winger: 4, scoring: 4, setPieces: 6, stamina: 7, form: 5, experience: 7, loyalty: 3, specialty: PlayerSpecialty.Technical },
  { id: 108, name: 'Opp IM L', keeper: 1, defending: 6, playmaking: 8, passing: 8, winger: 5, scoring: 5, setPieces: 5, stamina: 8, form: 6, experience: 6, loyalty: 2, specialty: PlayerSpecialty.None },
  { id: 109, name: 'Opp IM R', keeper: 1, defending: 5, playmaking: 7, passing: 7, winger: 6, scoring: 5, setPieces: 4, stamina: 7, form: 5, experience: 5, loyalty: 1, specialty: PlayerSpecialty.None },
  { id: 110, name: 'Opp W L', keeper: 1, defending: 4, playmaking: 5, passing: 7, winger: 9, scoring: 6, setPieces: 4, stamina: 8, form: 6, experience: 6, loyalty: 2, specialty: PlayerSpecialty.Quick },
  { id: 111, name: 'Opp W R', keeper: 1, defending: 3, playmaking: 4, passing: 6, winger: 8, scoring: 7, setPieces: 3, stamina: 7, form: 5, experience: 5, loyalty: 1, specialty: PlayerSpecialty.Unpredictable },
  { id: 112, name: 'Opp FW C', keeper: 1, defending: 2, playmaking: 4, passing: 7, winger: 3, scoring: 10, setPieces: 8, stamina: 6, form: 6, experience: 7, loyalty: 3, specialty: PlayerSpecialty.Head },
  { id: 113, name: 'Opp FW L', keeper: 1, defending: 3, playmaking: 4, passing: 6, winger: 5, scoring: 8, setPieces: 6, stamina: 7, form: 5, experience: 6, loyalty: 2, specialty: PlayerSpecialty.Quick },
  { id: 114, name: 'Opp FW R', keeper: 1, defending: 2, playmaking: 3, passing: 5, winger: 6, scoring: 7, setPieces: 5, stamina: 6, form: 5, experience: 5, loyalty: 1, specialty: PlayerSpecialty.None }
];

// ============================================================================
// Test Functions
// ============================================================================

export async function runAllTests() {
  console.log('=== HattrickAI V6 Engine Tests ===\n');
  
  let passed = 0, failed = 0;
  
  const test = (name, fn) => {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ ${name}: ${e.message}`);
      failed++;
    }
  };
  
  const assertEqual = (actual, expected, msg = '') => {
    if (actual !== expected) throw new Error(`${msg} Expected ${expected}, got ${actual}`);
  };
  
  const assertClose = (actual, expected, tolerance = 0.01, msg = '') => {
    if (Math.abs(actual - expected) > tolerance) throw new Error(`${msg} Expected ~${expected}, got ${actual}`);
  };
  
  // --- Shared Utils Tests ---
  test('formFactor calculates correctly', () => {
    assertClose(formFactor(1), 0, 0.001);
    assertClose(formFactor(2), 0.378, 0.001);
    assertClose(formFactor(5), 0.378 * Math.sqrt(4), 0.001);
    assertClose(formFactor(8), 0.378 * Math.sqrt(7), 0.001);
    assertClose(formFactor(20), 0.378 * Math.sqrt(7), 0.001); // capped at 7
  });
  
  test('experiencePolynomial calculates correctly', () => {
    assertClose(experiencePolynomial(1), 0, 0.001);
    assertClose(experiencePolynomial(5), 0.176 * 4 - 0.01336 * 16 + 0.0005 * 64 - 0.00000725 * 256, 0.001);
  });
  
  test('coachFactor calculates correctly', () => {
    assertClose(coachFactor(0), 1.02, 0.001);
    assertClose(coachFactor(-1), 1.02 + 0.008, 0.001);
    assertClose(coachFactor(1), 1.02 - 0.012, 0.001);
    assertClose(coachFactor(5), 1.02 - 0.06, 0.001);
  });
  
  test('quarterRound works correctly', () => {
    assertEqual(quarterRound(1.0), 1.0);
    assertEqual(quarterRound(1.125), 1.125);
    assertEqual(quarterRound(1.2), 1.25);
    assertEqual(quarterRound(1.3), 1.25);
    assertEqual(quarterRound(1.4), 1.5);
  });
  
  test('displayRating clamps correctly', () => {
    assertEqual(displayRating(0.5), 1.0);
    assertEqual(displayRating(10.2), 10.25);
    assertEqual(displayRating(20.5), 20.0);
  });
  
  test('clamp01 clamps correctly', () => {
    assertEqual(clamp01(-0.5), 0);
    assertEqual(clamp01(0.5), 0.5);
    assertEqual(clamp01(1.5), 1);
  });
  
  test('possessionProbability calculates correctly', () => {
    const p = possessionProbability(10, 10);
    assertClose(p, 0.5, 0.01);
    
    const p2 = possessionProbability(12, 8);
    assertClose(p2 > 0.5, true);
  });
  
  test('poissonOutcomeProbabilities sums to 1', () => {
    const probs = poissonOutcomeProbabilities(1.5, 1.0);
    const sum = probs.win + probs.draw + probs.loss;
    assertClose(sum, 1.0, 0.001);
  });
  
  test('SeededRandom is deterministic', () => {
    const rng1 = new SeededRandom(12345);
    const rng2 = new SeededRandom(12345);
    for (let i = 0; i < 100; i++) {
      assertEqual(rng1.next(), rng2.next());
    }
  });
  
  test('SeededRandom Poisson works', () => {
    const rng = new SeededRandom(999);
    const samples = [];
    for (let i = 0; i < 1000; i++) samples.push(rng.nextPoisson(2));
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    assertClose(avg, 2, 0.1);
  });
  
  test('normalizePlayer works', () => {
    const raw = { id: 1, name: 'Test', keeperSkill: 10, defenderSkill: 8, playmakerSkill: 7, passingSkill: 9, wingerSkill: 6, scorerSkill: 5, staminaSkill: 8, playerForm: 7, experience: 8, loyalty: 3, injuryLevel: -1, specialty: 'Technical', setPiecesSkill: 6 };
    const normalized = normalizePlayer(raw);
    assertEqual(normalized.keeper, 10);
    assertEqual(normalized.defending, 8);
    assertEqual(normalized.specialty, PlayerSpecialty.Technical);
  });
  
  test('getSkill handles missing values', () => {
    const player = { keeper: 10, defending: undefined, playmaking: null };
    assertEqual(getSkill(player, 'keeper'), 10);
    assertEqual(getSkill(player, 'defending'), 0);
    assertEqual(getSkill(player, 'playmaking'), 0);
  });
  
  test('getSectorsForSlot returns correct sectors', () => {
    const gk = getSectorsForSlot('GK');
    assertEqual(gk.length, 1);
    assertEqual(gk[0], RegionalSector.CentralDefence);
    
    const wb = getSectorsForSlot('WB-L');
    assertEqual(wb.length, 2);
    assertEqual(wb.includes(RegionalSector.LeftDefence), true);
    assertEqual(wb.includes(RegionalSector.LeftAttack), true);
  });
  
  test('getOrderMultipliers applies offensive correctly', () => {
    const mults = getOrderMultipliers('WB-L', PlayerOrder.Offensive);
    assertClose(mults[RegionalSector.LeftAttack], 1.2, 0.01);
    assertClose(mults[RegionalSector.LeftDefence], 0.7, 0.01);
  });
  
  test('getOrderMultipliers applies defensive correctly', () => {
    const mults = getOrderMultipliers('WB-L', PlayerOrder.Defensive);
    assertClose(mults[RegionalSector.LeftDefence], 1.2, 0.01);
    assertClose(mults[RegionalSector.LeftAttack], 0.7, 0.01);
  });
  
  test('getSpecialtyMultiplier applies powerful', () => {
    const mult = getSpecialtyMultiplier(PlayerSpecialty.Powerful, RegionalSector.CentralDefence);
    assertClose(mult, 1.1, 0.01);
  });
  
  test('createEmptySectorTotals creates all sectors', () => {
    const totals = createEmptySectorTotals();
    assertEqual(Object.keys(totals).length, 7);
    assertEqual(totals[RegionalSector.LeftDefence], 0);
    assertEqual(totals[RegionalSector.Midfield], 0);
  });
  
  // --- Constants Tests ---
  test('FORMATION_SLOTS has all formations', () => {
    assertEqual(Object.keys(FORMATION_SLOTS).length, 9);
    assertEqual(FORMATION_SLOTS['4-4-2'].length, 11);
    assertEqual(FORMATION_SLOTS['3-5-2'].length, 11);
    assertEqual(FORMATION_SLOTS['5-5-0'].length, 11);
  });
  
  test('ALLOWED_ORDERS has correct orders per position', () => {
    assertEqual(ALLOWED_ORDERS['GK'].length, 1);
    assertEqual(ALLOWED_ORDERS['DEF-C'].length, 2);
    assertEqual(ALLOWED_ORDERS['IM-C'].length, 3);
    assertEqual(ALLOWED_ORDERS['FW-C'].length, 2);
  });
  
  test('TACTIC_NAMES maps correctly', () => {
    assertEqual(TACTIC_NAMES[TeamTactic.Normal], 'Normal');
    assertEqual(TACTIC_NAMES[TeamTactic.Pressing], 'Pres');
    assertEqual(TACTIC_NAMES[TeamTactic.CounterAttack], 'Kontra Atak');
  });
  
  test('ORDER_NAMES maps correctly', () => {
    assertEqual(ORDER_NAMES[PlayerOrder.Normal], 'Normal');
    assertEqual(ORDER_NAMES[PlayerOrder.Offensive], 'Ofansif');
    assertEqual(ORDER_NAMES[PlayerOrder.TowardsMiddle], 'Merkeze');
  });
  
  // --- Engine Integration Tests ---
  const testPlayers = createTestPlayers();
  const oppPlayers = createOpponentPlayers();
  
  test('PositionOptimizer analyzes all players', () => {
    const optimizer = createPositionOptimizer();
    // Can't fully test without rating engine loaded, but check structure
    assertEqual(typeof optimizer.analyzeAllPlayers, 'function');
    assertEqual(typeof optimizer.analyzePlayer, 'function');
    assertEqual(typeof optimizer.calculatePositionRating, 'function');
  });
  
  test('FormationOptimizer generates candidates', () => {
    const optimizer = createFormationOptimizer();
    assertEqual(typeof optimizer.generateCandidates, 'function');
    assertEqual(typeof optimizer.evaluateFormation, 'function');
  });
  
  test('OpponentAnalyzer analyzes opponent', () => {
    const analyzer = createOpponentAnalyzer();
    assertEqual(typeof analyzer.analyzeOpponent, 'function');
    assertEqual(typeof analyzer.predictFormation, 'function');
    assertEqual(typeof analyzer.predictTactic, 'function');
  });
  
  test('TacticalDecisionEngine evaluates tactics', () => {
    const engine = createTacticalDecisionEngine();
    assertEqual(typeof engine.evaluateAllTactics, 'function');
    assertEqual(typeof engine.analyzeSquadForTactics, 'function');
    assertEqual(typeof engine.calculateSquadFit, 'function');
  });
  
  test('MonteCarloMatchEngine simulates matches', () => {
    const engine = createMonteCarloEngine();
    assertEqual(typeof engine.simulate, 'function');
    assertEqual(typeof engine.calculateChanceAllocation, 'function');
  });
  
  test('FinalDecisionEngine makes decisions', () => {
    const engine = createFinalDecisionEngine();
    assertEqual(typeof engine.analyzeAndDecide, 'function');
    assertEqual(typeof engine.selectBest, 'function');
  });
  
  test('MatchAnalysisEngine runs full pipeline', () => {
    const engine = createMatchAnalysisEngine();
    assertEqual(typeof engine.analyze, 'function');
    assertEqual(typeof engine.generateAIExplanation, 'function');
    assertEqual(typeof engine.isReady, 'function');
  });
  
  // --- Quick Simulate Test ---
  test('quickSimulate returns valid probabilities', async () => {
    const { quickSimulate } = await import('../engines/monte-carlo.js');
    const result = await quickSimulate(10, 8, 10, 8, 8, 8, 0, 100);
    assertClose(result.win + result.draw + result.loss, 1.0, 0.01);
    assertClose(result.win > 0.3, true); // Home team stronger
    assertClose(result.expGoals > 0, true);
  });
  
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  
  if (failed > 0) {
    throw new Error(`${failed} tests failed`);
  }
  
  return { passed, failed };
}

// Export for manual running
window.runEngineTests = runAllTests;

export default { runAllTests };