// Shared types and constants for HattrickAI V6 Analysis Engines

// ============================================================================
// Enums
// ============================================================================

export const PlayerSpecialty = {
  None: 0,
  Technical: 1,
  Quick: 2,
  Powerful: 3,
  Unpredictable: 4,
  Head: 5
};

export const PlayerOrder = {
  Normal: 0,
  Defensive: 1,
  Offensive: 2,
  TowardsMiddle: 3,
  TowardsWing: 4
};

export const TeamTactic = {
  Normal: 0,
  Pressing: 1,
  CounterAttack: 2,
  AttackMiddle: 3,
  AttackWings: 4,
  Creative: 7,
  LongShots: 8
};

export const AdvancedTactic = {
  Normal: 0,
  Pressing: 1,
  CounterAttack: 2,
  AttackMiddle: 3,
  AttackWings: 4,
  LongShots: 5,
  Creative: 6
};

export const TeamAttitude = {
  PlayItCool: -1,
  Normal: 0,
  MatchOfTheSeason: 1
};

export const MatchLocation = {
  Away: -1,
  Neutral: 0,
  Home: 1
};

export const RegionalSector = {
  LeftDefence: 'LeftDefence',
  CentralDefence: 'CentralDefence',
  RightDefence: 'RightDefence',
  Midfield: 'Midfield',
  LeftAttack: 'LeftAttack',
  CentralAttack: 'CentralAttack',
  RightAttack: 'RightAttack'
};

// ============================================================================
// Constants
// ============================================================================

export const FORM_FACTOR_COEFFICIENT = 0.378;
export const FORM_FACTOR_MAX_FORM = 7;

export const EXP_POLY_COEFFS = {
  x4: -0.00000725,
  x3: 0.0005,
  x2: -0.01336,
  x1: 0.176,
  x0: 0
};

export const COACH_BASE = 1.02;
export const COACH_NEG_FACTOR = 0.08 / 10;
export const COACH_POS_FACTOR = 0.12 / 10;

export const QUARTER_ROUND_MULTIPLIER = 4;
export const RATING_MIN = 1.0;
export const RATING_MAX = 20.0;

export const DEFAULT_SS = 1.0;
export const DEFAULT_V = 1.2;

export const LOYALTY_BONUS_PER_LEVEL = 1.0;
export const MIN_SKILL_FOR_CONTRIBUTION = 1;

export const M8_CONSTANTS = {
  EXCLUSIVE_CHANCES_PER_TEAM: 5,
  OPEN_CHANCE_POOL: 5,
  PAPER_LEFT_ATTACK_SHARE: 0.2565,
  PAPER_CENTRE_ATTACK_SHARE: 0.3615,
  PAPER_RIGHT_ATTACK_SHARE: 0.2565,
  PAPER_DIRECT_FREE_KICK_SHARE: 0.0586,
  PAPER_INDIRECT_FREE_KICK_SHARE: 0.0418,
  PAPER_PENALTY_KICK_SHARE: 0.0251,
  PAPER_EXPECTED_NORMAL_ATTACKS: 10.0,
  PAPER_EXPECTED_REGULAR_SECTOR_CHANCES: 8.745,
  AIM_MIN_WING_CONVERSION: 0.20,
  AIM_MAX_WING_CONVERSION: 0.35,
  AOW_MIN_CENTRE_CONVERSION: 0.34,
  AOW_MAX_CENTRE_CONVERSION: 0.52,
  LONG_SHOTS_MIN_CONVERSION: 0.06,
  LONG_SHOTS_MAX_CONVERSION: 0.43,
  PRESSING_MIN_SUPPRESSION: 0.05,
  PRESSING_MAX_SUPPRESSION: 0.41,
  COUNTER_ATTACK_MIN_CONVERSION: 0.04,
  COUNTER_ATTACK_MAX_CONVERSION: 0.45,
  COUNTER_ATTACK_MIDFIELD_PENALTY: 0.07,
  CALIBRATED_TOTAL_REGULAR_CHANCES: 8.8,
  CALIBRATED_OWNERSHIP_INTERCEPT: -0.4380926172,
  CALIBRATED_OWNERSHIP_MIDFIELD_SLOPE: 1.9561688498,
  PAPER_SET_PIECE_SHARE: 0.1255,
  SET_PIECE_NEUTRAL_CONVERSION: 0.5,
  MAX_GOALS: 5.0,
  POISSON_GOAL_CUTOFF: 20
};

export const TACTIC_CONVERSION_POLYNOMIALS = {
  [TeamTactic.Pressing]: (rt) => -0.00780421 * rt * rt + 0.471402 * rt - 1.10735,
  [TeamTactic.CounterAttack]: (rt) => -0.617941717072569 + 0.104274398 * rt - 0.00358354796 * rt * rt + 0.0000434356 * rt * rt * rt,
  [TeamTactic.AttackMiddle]: (rt) => -0.00036765 * rt * rt + 0.02180462 * rt + 0.0705084,
  [TeamTactic.AttackWings]: (rt) => -0.00046569 * rt * rt + 0.02894608 * rt + 0.10514706,
  [TeamTactic.LongShots]: (rt) => 0.00761935 * rt + 0.07520052,
  [TeamTactic.Creative]: (rt) => 0
};

export const M9_EVENT_CONSTANTS = {
  PLAYER_EVENT_RATE_PER_MATCH: 0.8410,
  TEAM_EVENT_RATE_PER_MATCH: 0.3720,
  PLAYER_TEAM_OWNERSHIP_FALLBACK: 0.5,
  WINGER_ANY_RATE: 0.2163,
  WINGER_ANY_GOAL_RATE: 0.4951,
  TECHNICAL_OVER_HEAD_RATE: 0.1277,
  TECHNICAL_OVER_HEAD_GOAL_RATE: 0.2937,
  QUICK_RUSH_RATE: 0.1286,
  QUICK_RUSH_GOAL_RATE: 0.3670,
  QUICK_PASS_RATE: 0.1219,
  QUICK_PASS_GOAL_RATE: 0.4387,
  UNPREDICTABLE_LONG_PASS_RATE: 0.0687,
  UNPREDICTABLE_LONG_PASS_GOAL_RATE: 0.4090,
  UNPREDICTABLE_SCORE_OWN_RATE: 0.0536,
  UNPREDICTABLE_SCORE_OWN_GOAL_RATE: 0.5822,
  UNPREDICTABLE_SPECIAL_ACTION_RATE: 0.0560,
  UNPREDICTABLE_SPECIAL_ACTION_GOAL_RATE: 0.4241,
  UNPREDICTABLE_MISTAKE_RATE: 0.0290,
  UNPREDICTABLE_MISTAKE_GOAL_RATE: 0.1816,
  UNPREDICTABLE_OWN_GOAL_RATE: 0.0392,
  UNPREDICTABLE_OWN_GOAL_PROBABILITY: 0.1725,
  EXPERIENCED_FORWARD_RATE: 0.0400,
  EXPERIENCED_FORWARD_GOAL_RATE: 0.3704,
  INEXPERIENCED_DEFENDER_RATE: 0.0392,
  INEXPERIENCED_DEFENDER_GOAL_RATE: 0.1050,
  TIRED_DEFENDER_RATE: 0.0004,
  TIRED_DEFENDER_GOAL_RATE: 0.3432,
  CORNER_RATE: 0.2922,
  CORNER_ANYONE_GOAL_RATE: 0.4849,
  CORNER_HEAD_GOAL_RATE: 0.5503,
  TECHNICAL_CA_RATE: { 4: 0.0311, 3: 0.0100, 2: 0.0084 },
  PDIM_SUPPRESSION_PER_PLAYER: 0.065,
  PNF_CONVERSION: {
    1: { 0: 0.096, 1: 0.069, 2: 0.033, 3: 0.020 },
    2: { 0: 0.117, 1: 0.096, 2: 0.052, 3: 0.031 },
    '3+': 0.066
  },
  SET_PIECE_PROB_COEFFS: {
    d3: -0.0000380429,
    d2: 0.0000226846,
    d1: 0.0366246,
    d0: 0.45515
  },
  LONG_SHOT_SHOOTER_COEFFS: {
    scoring_pow: 2.3808,
    setpieces_pow: 2.7720,
    coeff: 0.0643
  },
  LONG_SHOT_KEEPER_COEFFS: {
    gk_pow: 0.9,
    gk_coeff: 1977.4524,
    sp_pow: 2.3262,
    sp_coeff: 31.4827
  }
};

export const M9_SIMULATION_CONSTANTS = {
  DEFAULT_SIMULATION_COUNT: 10000,
  DEFAULT_MATCH_TICKS: 18,
  DEFAULT_SEED: 9051,
  MIN_SIMULATION_COUNT: 100,
  MAX_SIMULATION_COUNT: 50000,
  SCENARIOS: [
    { name: 'Base', chanceVolumeFactor: 1.00, opponentFactor: 1.00, homeFactor: 1.00 },
    { name: 'Sol kanat', chanceVolumeFactor: 1.00, opponentFactor: 1.00, homeFactor: 1.01 },
    { name: 'Sağ kanat', chanceVolumeFactor: 1.00, opponentFactor: 1.00, homeFactor: 1.01 },
    { name: 'Düşük şans', chanceVolumeFactor: 0.96, opponentFactor: 1.02, homeFactor: 0.99 },
    { name: 'Yüksek şans', chanceVolumeFactor: 1.04, opponentFactor: 0.96, homeFactor: 1.02 }
  ]
};

export const M10_CONSTANTS = {
  REQUIRED_FORMATION_DEPTH: 3,
  DEFAULT_TACTICAL_WEIGHT: 0.55,
  DEFAULT_PREDICTION_WEIGHT: 0.30,
  DEFAULT_STRUCTURAL_WEIGHT: 0.15,
  TACTICAL_SIGMOID_SCALE: 1.0,
  TACTICAL_SIGMOID_CLAMP: 20.0
};

export const DEFAULT_SIMULATION_CONFIG = {
  simulationCount: M9_SIMULATION_CONSTANTS.DEFAULT_SIMULATION_COUNT,
  matchTicks: M9_SIMULATION_CONSTANTS.DEFAULT_MATCH_TICKS,
  seed: M9_SIMULATION_CONSTANTS.DEFAULT_SEED,
  includeScenarios: true
};

export const SECTORS = [
  RegionalSector.LeftDefence,
  RegionalSector.CentralDefence,
  RegionalSector.RightDefence,
  RegionalSector.Midfield,
  RegionalSector.LeftAttack,
  RegionalSector.CentralAttack,
  RegionalSector.RightAttack
];

export const SECTOR_DISPLAY_NAMES = {
  [RegionalSector.LeftDefence]: 'Sol Savunma',
  [RegionalSector.CentralDefence]: 'Merkez Savunma',
  [RegionalSector.RightDefence]: 'Sağ Savunma',
  [RegionalSector.Midfield]: 'Orta Saha',
  [RegionalSector.LeftAttack]: 'Sol Hücum',
  [RegionalSector.CentralAttack]: 'Merkez Hücum',
  [RegionalSector.RightAttack]: 'Sağ Hücum'
};

export const TACTIC_NAMES = {
  [TeamTactic.Normal]: 'Normal',
  [TeamTactic.Pressing]: 'Pres',
  [TeamTactic.CounterAttack]: 'Kontra Atak',
  [TeamTactic.AttackMiddle]: 'Orta Saldırı',
  [TeamTactic.AttackWings]: 'Kanatlardan Atak',
  [TeamTactic.Creative]: 'Yaratıcı',
  [TeamTactic.LongShots]: 'Uzun Şutlar'
};

export const ORDER_NAMES = {
  [PlayerOrder.Normal]: 'Normal',
  [PlayerOrder.Defensive]: 'Defansif',
  [PlayerOrder.Offensive]: 'Ofansif',
  [PlayerOrder.TowardsMiddle]: 'Merkeze',
  [PlayerOrder.TowardsWing]: 'Kanada'
};

export const FORMATION_SLOTS = {
  '3-5-2': ['GK', 'DEF-CL', 'DEF-C', 'DEF-CR', 'W-L', 'IM-L', 'IM-C', 'IM-R', 'W-R', 'FW-L', 'FW-R'],
  '3-4-3': ['GK', 'DEF-CL', 'DEF-C', 'DEF-CR', 'W-L', 'IM-L', 'IM-R', 'W-R', 'FW-L', 'FW-C', 'FW-R'],
  '4-4-2': ['GK', 'WB-L', 'DEF-CL', 'DEF-CR', 'WB-R', 'W-L', 'IM-L', 'IM-R', 'W-R', 'FW-L', 'FW-R'],
  '4-5-1': ['GK', 'WB-L', 'DEF-CL', 'DEF-CR', 'WB-R', 'W-L', 'IM-L', 'IM-C', 'IM-R', 'W-R', 'FW-C'],
  '2-5-3': ['GK', 'WB-L', 'WB-R', 'W-L', 'IM-L', 'IM-C', 'IM-R', 'W-R', 'FW-L', 'FW-C', 'FW-R'],
  '5-3-2': ['GK', 'WB-L', 'DEF-CL', 'DEF-C', 'DEF-CR', 'WB-R', 'IM-L', 'IM-C', 'IM-R', 'FW-L', 'FW-R'],
  '5-4-1': ['GK', 'WB-L', 'DEF-CL', 'DEF-C', 'DEF-CR', 'WB-R', 'W-L', 'IM-L', 'IM-R', 'W-R', 'FW-C'],
  '5-5-0': ['GK', 'WB-L', 'DEF-CL', 'DEF-C', 'DEF-CR', 'WB-R', 'W-L', 'IM-L', 'IM-C', 'IM-R', 'W-R']
};

export const SLOT_POSITION_MAP = {
  'GK': [RegionalSector.CentralDefence],
  'WB-L': [RegionalSector.LeftDefence, RegionalSector.LeftAttack],
  'WB-R': [RegionalSector.RightDefence, RegionalSector.RightAttack],
  'DEF-CL': [RegionalSector.LeftDefence, RegionalSector.CentralDefence],
  'DEF-C': [RegionalSector.CentralDefence],
  'DEF-CR': [RegionalSector.RightDefence, RegionalSector.CentralDefence],
  'DEF-L': [RegionalSector.LeftDefence, RegionalSector.CentralDefence],
  'DEF-R': [RegionalSector.RightDefence, RegionalSector.CentralDefence],
  'W-L': [RegionalSector.LeftAttack, RegionalSector.Midfield, RegionalSector.LeftDefence],
  'W-R': [RegionalSector.RightAttack, RegionalSector.Midfield, RegionalSector.RightDefence],
  'IM-L': [RegionalSector.Midfield, RegionalSector.LeftAttack, RegionalSector.LeftDefence],
  'IM-C': [RegionalSector.Midfield, RegionalSector.CentralAttack, RegionalSector.CentralDefence],
  'IM-R': [RegionalSector.Midfield, RegionalSector.RightAttack, RegionalSector.RightDefence],
  'FW-L': [RegionalSector.LeftAttack, RegionalSector.Midfield],
  'FW-C': [RegionalSector.CentralAttack, RegionalSector.Midfield],
  'FW-R': [RegionalSector.RightAttack, RegionalSector.Midfield]
};

export const ALLOWED_ORDERS = {
  'GK': [PlayerOrder.Normal],
  'DEF-L': [PlayerOrder.Normal, PlayerOrder.Offensive, PlayerOrder.Defensive, PlayerOrder.TowardsMiddle],
  'DEF-R': [PlayerOrder.Normal, PlayerOrder.Offensive, PlayerOrder.Defensive, PlayerOrder.TowardsMiddle],
  'DEF-CL': [PlayerOrder.Normal, PlayerOrder.Offensive, PlayerOrder.TowardsWing],
  'DEF-CR': [PlayerOrder.Normal, PlayerOrder.Offensive, PlayerOrder.TowardsWing],
  'DEF-C': [PlayerOrder.Normal, PlayerOrder.Offensive],
  'WB-L': [PlayerOrder.Normal, PlayerOrder.Offensive, PlayerOrder.Defensive, PlayerOrder.TowardsMiddle],
  'WB-R': [PlayerOrder.Normal, PlayerOrder.Offensive, PlayerOrder.Defensive, PlayerOrder.TowardsMiddle],
  'W-L': [PlayerOrder.Normal, PlayerOrder.Offensive, PlayerOrder.Defensive, PlayerOrder.TowardsMiddle],
  'W-R': [PlayerOrder.Normal, PlayerOrder.Offensive, PlayerOrder.Defensive, PlayerOrder.TowardsMiddle],
  'IM-L': [PlayerOrder.Normal, PlayerOrder.Offensive, PlayerOrder.Defensive, PlayerOrder.TowardsWing],
  'IM-R': [PlayerOrder.Normal, PlayerOrder.Offensive, PlayerOrder.Defensive, PlayerOrder.TowardsWing],
  'IM-C': [PlayerOrder.Normal, PlayerOrder.Offensive, PlayerOrder.Defensive],
  'FW-L': [PlayerOrder.Normal, PlayerOrder.Defensive, PlayerOrder.TowardsWing],
  'FW-R': [PlayerOrder.Normal, PlayerOrder.Defensive, PlayerOrder.TowardsWing],
  'FW-C': [PlayerOrder.Normal, PlayerOrder.Defensive]
};

export const POSITION_SKILL_WEIGHTS = {
  'GK': { keeper: 1.0, defending: 0.1, playmaking: 0.05, passing: 0.05, winger: 0, scoring: 0, setPieces: 0.15, stamina: 0.05, form: 0.1, experience: 0.1, loyalty: 0.05 },
  'DEF-C': { keeper: 0, defending: 1.0, playmaking: 0.1, passing: 0.15, winger: 0.05, scoring: 0.02, setPieces: 0.1, stamina: 0.08, form: 0.1, experience: 0.12, loyalty: 0.05 },
  'DEF-CL': { keeper: 0, defending: 0.9, playmaking: 0.1, passing: 0.2, winger: 0.1, scoring: 0.02, setPieces: 0.08, stamina: 0.1, form: 0.1, experience: 0.1, loyalty: 0.05 },
  'DEF-CR': { keeper: 0, defending: 0.9, playmaking: 0.1, passing: 0.2, winger: 0.1, scoring: 0.02, setPieces: 0.08, stamina: 0.1, form: 0.1, experience: 0.1, loyalty: 0.05 },
  'WB-L': { keeper: 0, defending: 0.7, playmaking: 0.15, passing: 0.25, winger: 0.3, scoring: 0.05, setPieces: 0.05, stamina: 0.15, form: 0.1, experience: 0.08, loyalty: 0.05 },
  'WB-R': { keeper: 0, defending: 0.7, playmaking: 0.15, passing: 0.25, winger: 0.3, scoring: 0.05, setPieces: 0.05, stamina: 0.15, form: 0.1, experience: 0.08, loyalty: 0.05 },
  'W-L': { keeper: 0, defending: 0.15, playmaking: 0.2, passing: 0.3, winger: 0.8, scoring: 0.2, setPieces: 0.05, stamina: 0.12, form: 0.1, experience: 0.08, loyalty: 0.05 },
  'W-R': { keeper: 0, defending: 0.15, playmaking: 0.2, passing: 0.3, winger: 0.8, scoring: 0.2, setPieces: 0.05, stamina: 0.12, form: 0.1, experience: 0.08, loyalty: 0.05 },
  'IM-L': { keeper: 0, defending: 0.25, playmaking: 0.6, passing: 0.5, winger: 0.2, scoring: 0.15, setPieces: 0.1, stamina: 0.1, form: 0.1, experience: 0.1, loyalty: 0.05 },
  'IM-R': { keeper: 0, defending: 0.25, playmaking: 0.6, passing: 0.5, winger: 0.2, scoring: 0.15, setPieces: 0.1, stamina: 0.1, form: 0.1, experience: 0.1, loyalty: 0.05 },
  'IM-C': { keeper: 0, defending: 0.2, playmaking: 0.8, passing: 0.6, winger: 0.1, scoring: 0.1, setPieces: 0.12, stamina: 0.1, form: 0.1, experience: 0.12, loyalty: 0.05 },
  'FW-L': { keeper: 0, defending: 0.05, playmaking: 0.15, passing: 0.35, winger: 0.2, scoring: 0.9, setPieces: 0.15, stamina: 0.08, form: 0.1, experience: 0.1, loyalty: 0.05 },
  'FW-C': { keeper: 0, defending: 0.05, playmaking: 0.2, passing: 0.4, winger: 0.1, scoring: 1.0, setPieces: 0.2, stamina: 0.08, form: 0.1, experience: 0.12, loyalty: 0.05 },
  'FW-R': { keeper: 0, defending: 0.05, playmaking: 0.15, passing: 0.35, winger: 0.2, scoring: 0.9, setPieces: 0.15, stamina: 0.08, form: 0.1, experience: 0.1, loyalty: 0.05 }
};

// ============================================================================
// Helper Functions
// ============================================================================

export function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function quarterRound(value) {
  return Math.round(value * QUARTER_ROUND_MULTIPLIER) / QUARTER_ROUND_MULTIPLIER;
}

export function displayRating(raw) {
  return clamp(quarterRound(raw), RATING_MIN, RATING_MAX);
}

export function formFactor(form) {
  const f = clamp(form, 1, 20);
  return FORM_FACTOR_COEFFICIENT * Math.sqrt(Math.min(FORM_FACTOR_MAX_FORM, Math.max(0, f - 1)));
}

export function experiencePolynomial(exp) {
  const x = Math.max(0, exp - 1);
  return EXP_POLY_COEFFS.x4 * Math.pow(x, 4) + 
         EXP_POLY_COEFFS.x3 * Math.pow(x, 3) + 
         EXP_POLY_COEFFS.x2 * Math.pow(x, 2) + 
         EXP_POLY_COEFFS.x1 * x;
}

export function coachFactor(coachLevel) {
  const c = coachLevel;
  return COACH_BASE - (c <= 0 ? c * COACH_NEG_FACTOR : c * COACH_POS_FACTOR);
}

export function possessionProbability(ownMidfield, opponentMidfield) {
  const own = Math.max(0, ownMidfield) * 4 - 3;
  const opp = Math.max(0, opponentMidfield) * 4 - 3;
  const ownPower = Math.pow(Math.max(0, own), 3);
  const oppPower = Math.pow(Math.max(0, opp), 3);
  const total = ownPower + oppPower;
  return total <= 0 ? 0.5 : clamp(ownPower / total, 0, 1);
}

export function linearPossession(ownMidfield, opponentMidfield) {
  const own = Math.max(0, ownMidfield) * 4 - 3;
  const opp = Math.max(0, opponentMidfield) * 4 - 3;
  const total = Math.max(0, own) + Math.max(0, opp);
  return total <= 0 ? 0.5 : clamp(Math.max(0, own) / total, 0, 1);
}

export function poissonOutcomeProbabilities(ownExpected, opponentExpected) {
  const own = Math.max(0.05, Math.min(M8_CONSTANTS.MAX_GOALS, ownExpected));
  const opp = Math.max(0.05, Math.min(M8_CONSTANTS.MAX_GOALS, opponentExpected));
  const maxGoals = M8_CONSTANTS.POISSON_GOAL_CUTOFF;
  
  const ownDist = new Array(maxGoals + 1);
  const oppDist = new Array(maxGoals + 1);
  
  ownDist[0] = Math.exp(-own);
  oppDist[0] = Math.exp(-opp);
  
  for (let g = 1; g <= maxGoals; g++) {
    ownDist[g] = ownDist[g - 1] * own / g;
    oppDist[g] = oppDist[g - 1] * opp / g;
  }
  
  let win = 0, draw = 0, loss = 0;
  for (let og = 0; og <= maxGoals; og++) {
    for (let oppg = 0; oppg <= maxGoals; oppg++) {
      const prob = ownDist[og] * oppDist[oppg];
      if (og > oppg) win += prob;
      else if (og === oppg) draw += prob;
      else loss += prob;
    }
  }
  
  const total = Math.max(1e-12, win + draw + loss);
  return { win: win / total, draw: draw / total, loss: loss / total };
}

export function getSkill(player, skill) {
  const value = player[skill];
  return typeof value === 'number' && isFinite(value) ? value : 0;
}

export function getSkillSafe(player, skill) {
  if (!player) return 0;
  return getSkill(player, skill);
}

export function resolvePositionCode(slotCode, order) {
  if (slotCode === 'GK') return 'GK';
  
  const orderNames = {
    [PlayerOrder.Normal]: 'normal',
    [PlayerOrder.Defensive]: 'defansif',
    [PlayerOrder.Offensive]: 'ofansif',
    [PlayerOrder.TowardsMiddle]: 'merkeze',
    [PlayerOrder.TowardsWing]: 'kanada'
  };
  
  const orderName = orderNames[order] || 'normal';
  return `${slotCode} ${orderName}`;
}

export function getSectorsForSlot(slotCode) {
  return SLOT_POSITION_MAP[slotCode] || [];
}

export function getPrimarySector(slotCode) {
  const sectors = getSectorsForSlot(slotCode);
  return sectors[0] || RegionalSector.CentralDefence;
}

export function getOrderMultipliers(slotCode, order) {
  const baseSectors = getSectorsForSlot(slotCode);
  const multipliers = {
    [RegionalSector.LeftDefence]: 1.0,
    [RegionalSector.CentralDefence]: 1.0,
    [RegionalSector.RightDefence]: 1.0,
    [RegionalSector.Midfield]: 1.0,
    [RegionalSector.LeftAttack]: 1.0,
    [RegionalSector.CentralAttack]: 1.0,
    [RegionalSector.RightAttack]: 1.0
  };
  
  if (order === PlayerOrder.Normal) return multipliers;
  
  switch (order) {
    case PlayerOrder.Offensive:
      baseSectors.forEach(sector => {
        if (sector === RegionalSector.LeftAttack || sector === RegionalSector.CentralAttack || sector === RegionalSector.RightAttack) {
          multipliers[sector] = 1.2;
        } else if (sector === RegionalSector.LeftDefence || sector === RegionalSector.CentralDefence || sector === RegionalSector.RightDefence) {
          multipliers[sector] = 0.7;
        } else {
          multipliers[sector] = 1.05;
        }
      });
      break;
    case PlayerOrder.Defensive:
      baseSectors.forEach(sector => {
        if (sector === RegionalSector.LeftDefence || sector === RegionalSector.CentralDefence || sector === RegionalSector.RightDefence) {
          multipliers[sector] = 1.2;
        } else if (sector === RegionalSector.LeftAttack || sector === RegionalSector.CentralAttack || sector === RegionalSector.RightAttack) {
          multipliers[sector] = 0.7;
        } else {
          multipliers[sector] = 0.95;
        }
      });
      break;
    case PlayerOrder.TowardsMiddle:
      multipliers[RegionalSector.CentralDefence] *= 1.15;
      multipliers[RegionalSector.Midfield] *= 1.1;
      multipliers[RegionalSector.CentralAttack] *= 1.15;
      multipliers[RegionalSector.LeftDefence] *= 0.9;
      multipliers[RegionalSector.RightDefence] *= 0.9;
      multipliers[RegionalSector.LeftAttack] *= 0.9;
      multipliers[RegionalSector.RightAttack] *= 0.9;
      break;
    case PlayerOrder.TowardsWing:
      multipliers[RegionalSector.LeftDefence] *= 1.1;
      multipliers[RegionalSector.RightDefence] *= 1.1;
      multipliers[RegionalSector.LeftAttack] *= 1.1;
      multipliers[RegionalSector.RightAttack] *= 1.1;
      multipliers[RegionalSector.CentralDefence] *= 0.9;
      multipliers[RegionalSector.Midfield] *= 0.95;
      multipliers[RegionalSector.CentralAttack] *= 0.9;
      break;
  }
  
  return multipliers;
}

export function getSpecialtyMultiplier(specialty, sector) {
  switch (specialty) {
    case PlayerSpecialty.Powerful:
      if (sector === RegionalSector.LeftDefence || sector === RegionalSector.CentralDefence || sector === RegionalSector.RightDefence) return 1.1;
      return 1.0;
    case PlayerSpecialty.Quick:
      if (sector === RegionalSector.LeftAttack || sector === RegionalSector.RightAttack || sector === RegionalSector.Midfield) return 1.05;
      return 1.0;
    case PlayerSpecialty.Technical:
      if (sector === RegionalSector.Midfield || sector === RegionalSector.CentralAttack) return 1.05;
      return 1.0;
    case PlayerSpecialty.Head:
      if (sector === RegionalSector.CentralAttack || sector === RegionalSector.CentralDefence) return 1.08;
      return 1.0;
    case PlayerSpecialty.Unpredictable:
      if (sector === RegionalSector.LeftAttack || sector === RegionalSector.CentralAttack || sector === RegionalSector.RightAttack) return 1.03;
      return 1.0;
    default:
      return 1.0;
  }
}

export function normalizePlayer(raw) {
  return {
    id: Number(raw.id || raw.playerId || 0),
    name: raw.name || [raw.firstName, raw.lastName].filter(Boolean).join(' ') || '#' + (raw.id || ''),
    keeper: Number(raw.keeper ?? raw.goalkeeping ?? 0),
    defending: Number(raw.defending ?? 0),
    playmaking: Number(raw.playmaking ?? 0),
    passing: Number(raw.passing ?? 0),
    winger: Number(raw.winger ?? 0),
    scoring: Number(raw.scoring ?? 0),
    setPieces: Number(raw.setPieces ?? 0),
    stamina: Number(raw.stamina ?? 0),
    form: Number(raw.form ?? 0),
    experience: Number(raw.experience ?? 0),
    loyalty: Number(raw.loyalty ?? 0),
    specialty: raw.specialty ? parseSpecialty(raw.specialty) : PlayerSpecialty.None,
    age: raw.age ? Number(raw.age) : undefined,
    ageDays: raw.ageDays ? Number(raw.ageDays) : undefined,
    tsi: raw.tsi ? Number(raw.tsi) : undefined,
    salary: raw.salary ? Number(raw.salary) : undefined,
    leadership: raw.leadership ? Number(raw.leadership) : undefined,
    shirtNumber: raw.shirtNumber ? Number(raw.shirtNumber) : undefined,
    cards: raw.cards ? Number(raw.cards) : undefined,
    lastMatchDate: raw.lastMatchDate,
    lastMatchRating: raw.lastMatchRating ? Number(raw.lastMatchRating) : undefined,
    arrivalDate: raw.arrivalDate,
    bestPosition: raw.bestPosition,
    nationality: raw.nationality,
    firstName: raw.firstName,
    lastName: raw.lastName,
    injuryLevel: raw.injuryLevel ? Number(raw.injuryLevel) : -1
  };
}

function parseSpecialty(value) {
  if (typeof value === 'number') return value;
  const upper = value.toUpperCase();
  const map = { 'TECHNICAL': PlayerSpecialty.Technical, 'QUICK': PlayerSpecialty.Quick, 'POWERFUL': PlayerSpecialty.Powerful, 'UNPREDICTABLE': PlayerSpecialty.Unpredictable, 'HEAD': PlayerSpecialty.Head, 'NONE': PlayerSpecialty.None };
  return map[upper] || PlayerSpecialty.None;
}

export function createEmptySectorTotals() {
  return {
    [RegionalSector.LeftDefence]: 0,
    [RegionalSector.CentralDefence]: 0,
    [RegionalSector.RightDefence]: 0,
    [RegionalSector.Midfield]: 0,
    [RegionalSector.LeftAttack]: 0,
    [RegionalSector.CentralAttack]: 0,
    [RegionalSector.RightAttack]: 0
  };
}

export function sumSectorTotals(...totals) {
  const result = createEmptySectorTotals();
  for (const t of totals) {
    for (const sector of Object.keys(result)) {
      result[sector] += t[sector] || 0;
    }
  }
  return result;
}

export class PerformanceTimer {
  constructor() {
    this.startTime = performance.now();
    this.marks = new Map();
  }
  
  mark(name) {
    const now = performance.now();
    this.marks.set(name, now);
    return now;
  }
  
  measure(name, since) {
    const end = performance.now();
    const start = since ? (this.marks.get(since) || this.startTime) : this.startTime;
    return end - start;
  }
  
  getTotal() {
    return performance.now() - this.startTime;
  }
  
  getMarks() {
    const result = {};
    for (const [key, value] of this.marks) {
      result[key] = value - this.startTime;
    }
    return result;
  }
}

export class SeededRandom {
  constructor(seed = Date.now()) {
    this.seed = Math.floor(seed) % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
  
  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  
  nextInt(max) {
    return Math.floor(this.next() * max);
  }
  
  nextRange(min, max) {
    return min + this.nextInt(max - min + 1);
  }
  
  nextGaussian() {
    const u1 = Math.max(1e-12, this.next());
    const u2 = Math.max(1e-12, this.next());
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }
  
  nextPoisson(lambda) {
    if (lambda <= 0) return 0;
    if (lambda > 20) {
      const normal = lambda + Math.sqrt(lambda) * this.nextGaussian();
      return Math.max(0, Math.round(normal));
    }
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1.0;
    do {
      k++;
      p *= this.next();
    } while (p > L && k < 100);
    return Math.max(0, k - 1);
  }
  
  reset(seed) {
    if (seed !== undefined) {
      this.seed = Math.floor(seed) % 2147483647;
      if (this.seed <= 0) this.seed += 2147483646;
    }
  }
  
  getSeed() {
    return this.seed;
  }
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function groupBy(array, keyFn) {
  const map = new Map();
  for (const item of array) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

export function sortBy(array, keyFn, descending = true) {
  return [...array].sort((a, b) => {
    const diff = keyFn(b) - keyFn(a);
    return descending ? diff : -diff;
  });
}

export function maxBy(array, keyFn) {
  if (array.length === 0) return undefined;
  let max = array[0];
  let maxVal = keyFn(max);
  for (let i = 1; i < array.length; i++) {
    const val = keyFn(array[i]);
    if (val > maxVal) {
      max = array[i];
      maxVal = val;
    }
  }
  return max;
}

export function minBy(array, keyFn) {
  if (array.length === 0) return undefined;
  let min = array[0];
  let minVal = keyFn(min);
  for (let i = 1; i < array.length; i++) {
    const val = keyFn(array[i]);
    if (val < minVal) {
      min = array[i];
      minVal = val;
    }
  }
  return min;
}

export function omit(obj, keys) {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

export function pick(obj, keys) {
  const result = {};
  for (const key of keys) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
}