// Final Decision Engine (M10-style) - JavaScript

import { 
  TeamTactic, TeamAttitude, MatchLocation,
  createEmptySectorTotals, clamp01
} from '../shared/index.js';

import { createMonteCarloEngine } from './monte-carlo.js';
import { createFormationOptimizer } from './formation-optimizer.js';
import { createTacticalDecisionEngine } from './tactical-engine.js';
import { createOpponentAnalyzer } from './opponent-analyzer.js';
import { createPositionOptimizer } from './position-optimizer.js';

export class FinalDecisionEngine {
  constructor(formationOptimizer, tacticalEngine, opponentAnalyzer, monteCarlo) {
    this.formationOptimizer = formationOptimizer || createFormationOptimizer();
    this.tacticalEngine = tacticalEngine || createTacticalDecisionEngine();
    this.opponentAnalyzer = opponentAnalyzer || createOpponentAnalyzer();
    this.monteCarlo = monteCarlo || createMonteCarloEngine();
    
    this.REQUIRED_FORMATION_DEPTH = 3;
    this.DEFAULT_TACTICAL_WEIGHT = 0.55;
    this.DEFAULT_PREDICTION_WEIGHT = 0.30;
    this.DEFAULT_STRUCTURAL_WEIGHT = 0.15;
  }
  
  async analyzeAndDecide(ownPlayers, opponentTeam, preferences = {}) {
    const coachLevel = preferences.coachLevel || 0;
    const matchLocation = preferences.matchLocation || MatchLocation.Neutral;
    const simCount = preferences.simulationCount || 10000;
    
    const opponentAnalysis = await this.opponentAnalyzer.analyzeOpponent(
      { ...opponentTeam, teamName: opponentTeam.teamName }, coachLevel
    );
    
    const formationResult = await this.formationOptimizer.generateCandidates(ownPlayers, coachLevel, preferences.preferredFormation);
    
    if (!formationResult.bestFormation) throw new Error('No valid formation candidates found');
    
    const candidateEvaluations = [];
    
    for (const candidate of formationResult.candidates) {
      const lineup = this.assignmentToLineup(candidate.bestAssignment, candidate.formation, ownPlayers);
      
      const slotAssignments = new Map();
      for (const assignment of candidate.bestAssignment) {
        const player = ownPlayers.find(p => p.id === assignment.playerId);
        if (player) slotAssignments.set(assignment.slotCode, { player, order: assignment.order });
      }
      
      const tacticalDecision = await this.tacticalEngine.evaluateAllTactics(
        ownPlayers, candidate.formation, slotAssignments,
        { regionalRatings: opponentAnalysis.regionalRatings, predictedTactic: opponentAnalysis.predictedTactic },
        coachLevel, preferences.preferredTactic
      );
      
      for (const tacticEval of tacticalDecision.evaluations) {
        if (tacticEval.overallScore < 0.2) continue;
        
        const simulation = await this.monteCarlo.simulate(
          candidate.sectorRatings, opponentAnalysis.regionalRatings,
          tacticEval.tactic, opponentAnalysis.predictedTactic || TeamTactic.Normal,
          matchLocation, { simulationCount: simCount }
        );
        
        const prediction = {
          expectedHomeGoals: simulation.expectedHomeGoals,
          expectedAwayGoals: simulation.expectedAwayGoals,
          possessionProbability: 0.5,
          simulation,
          winProbability: simulation.winProbability,
          drawProbability: simulation.drawProbability,
          lossProbability: simulation.lossProbability
        };
        
        candidateEvaluations.push({
          formation: candidate.formation, lineup,
          tacticalCandidate: { lineup, rating: candidate.sectorRatings, matchup: { opponentRatings: opponentAnalysis.regionalRatings }, tacticalScore: tacticEval.overallScore },
          prediction, structuralScore: candidate.structuralScore
        });
      }
    }
    
    const decision = this.selectBest(candidateEvaluations, preferences.priorities);
    const formationCompetition = this.buildFormationCompetition(candidateEvaluations);
    const attitudeDecision = this.selectAttitude(decision.bestPlan, opponentAnalysis, preferences.priorities);
    
    return {
      bestPlan: { formation: decision.bestPlan.formation, lineup: decision.bestPlan.lineup, regionalRatings: decision.bestPlan.rating, matchup: decision.bestPlan.matchup, tacticalScore: decision.bestPlan.tacticalScore },
      prediction: decision.prediction,
      ranking: decision.ranking,
      formationCompetition,
      status: 'SelectedDeterministically',
      selectedApproach: attitudeDecision.selectedAttitude,
      approachRanking: attitudeDecision.ranking
    };
  }
  
  assignmentToLineup(assignment, formation, players) {
    const slots = assignment.map(a => {
      const player = players.find(p => p.id === a.playerId);
      return { code: a.slotCode, label: a.slotCode, description: 'Optimized', playerName: a.playerName, playerId: a.playerId, rating: a.positionRating, x: 0, y: 0, order: a.order, historicalStars: undefined };
    });
    return { teamName: 'Optimized XI', formation, slots };
  }
  
  selectBest(candidates, priorities) {
    const valid = candidates.filter(c => c.tacticalCandidate && c.prediction && isFinite(c.tacticalCandidate.tacticalScore));
    if (valid.length === 0) throw new Error('No valid candidates for decision');
    
    const ranked = valid.map(c => ({
      candidate: c,
      expectedPoints: this.expectedPoints(c.prediction),
      winProb: c.prediction.winProbability,
      goalDiff: c.prediction.expectedHomeGoals - c.prediction.expectedAwayGoals,
      tacticalScore: c.tacticalCandidate.tacticalScore,
      signature: this.lineupSignature(c.lineup)
    })).sort((a, b) => {
      if (Math.abs(b.expectedPoints - a.expectedPoints) > 0.001) return b.expectedPoints - a.expectedPoints;
      if (Math.abs(b.winProb - a.winProb) > 0.001) return b.winProb - a.winProb;
      if (Math.abs(b.goalDiff - a.goalDiff) > 0.001) return b.goalDiff - a.goalDiff;
      if (Math.abs(b.tacticalScore - a.tacticalScore) > 0.001) return b.tacticalScore - a.tacticalScore;
      return a.signature.localeCompare(b.signature);
    });
    
    const winner = ranked[0].candidate;
    
    if (priorities && priorities.length > 0) {
      const priorityAdjusted = this.applyPriorities(ranked, priorities);
      if (priorityAdjusted) {
        return { bestPlan: priorityAdjusted.candidate.tacticalCandidate, prediction: priorityAdjusted.candidate.prediction, ranking: this.buildRanking(priorityAdjusted.remaining) };
      }
    }
    
    return { bestPlan: winner.tacticalCandidate, prediction: winner.prediction, ranking: this.buildRanking(ranked) };
  }
  
  applyPriorities(ranked, priorities) {
    if (priorities.includes('draw')) {
      const adjusted = [...ranked].sort((a, b) => b.candidate.prediction.drawProbability - a.candidate.prediction.drawProbability);
      return { candidate: adjusted[0], remaining: adjusted.slice(1) };
    }
    if (priorities.includes('attack')) {
      const adjusted = [...ranked].sort((a, b) => b.candidate.prediction.expectedHomeGoals - a.candidate.prediction.expectedHomeGoals);
      return { candidate: adjusted[0], remaining: adjusted.slice(1) };
    }
    if (priorities.includes('defence')) {
      const adjusted = [...ranked].sort((a, b) => a.candidate.prediction.expectedAwayGoals - b.candidate.prediction.expectedAwayGoals);
      return { candidate: adjusted[0], remaining: adjusted.slice(1) };
    }
    return null;
  }
  
  buildRanking(ranked) {
    return ranked.map((r, index) => ({
      formation: r.candidate.formation,
      candidateId: r.signature,
      tacticalScore: r.tacticalScore,
      winProbability: r.winProb,
      compositeScore: r.expectedPoints,
      drawProbability: r.candidate.prediction.drawProbability,
      lossProbability: r.candidate.prediction.lossProbability,
      mostLikelyScore: r.candidate.prediction.simulation.mostLikelyScore
    }));
  }
  
  buildFormationCompetition(candidates) {
    const byFormation = new Map();
    for (const c of candidates) {
      const existing = byFormation.get(c.formation);
      if (!existing || this.expectedPoints(c.prediction) > this.expectedPoints(existing.prediction)) {
        byFormation.set(c.formation, c);
      }
    }
    
    const formationGroups = Array.from(byFormation.entries())
      .map(([formation, candidate]) => ({
        formation, candidate,
        expectedPoints: this.expectedPoints(candidate.prediction),
        winProb: candidate.prediction.winProbability,
        goalDiff: candidate.prediction.expectedHomeGoals - candidate.prediction.expectedAwayGoals,
        tacticalScore: candidate.tacticalCandidate.tacticalScore
      }))
      .sort((a, b) => {
        if (Math.abs(b.expectedPoints - a.expectedPoints) > 0.001) return b.expectedPoints - a.expectedPoints;
        return b.winProb - a.winProb;
      });
    
    return formationGroups.map((group, index) => {
      const nextEP = index + 1 < formationGroups.length ? formationGroups[index + 1].expectedPoints : group.expectedPoints;
      return {
        formation: group.formation,
        bestCandidateId: this.lineupSignature(group.candidate.lineup),
        tacticalScore: group.tacticalScore,
        winProbability: group.winProb,
        compositeScore: group.expectedPoints,
        candidateCount: candidates.filter(c => c.formation === group.formation).length,
        rank: index + 1,
        marginVsNext: group.expectedPoints - nextEP,
        searchDepthStatus: (candidates.filter(c => c.formation === group.formation).length >= this.REQUIRED_FORMATION_DEPTH) ? 'Sufficient' : 'Insufficient',
        drawProbability: group.candidate.prediction.drawProbability,
        lossProbability: group.candidate.prediction.lossProbability,
        mostLikelyScore: group.candidate.prediction.simulation.mostLikelyScore,
        expectedPoints: group.expectedPoints
      };
    });
  }
  
  selectAttitude(bestPlan, opponentAnalysis, priorities) {
    const attitudes = [TeamAttitude.Normal, TeamAttitude.PlayItCool, TeamAttitude.MatchOfTheSeason];
    const rankings = [];
    
    for (const attitude of attitudes) {
      let attitudeMod = 1.0;
      if (attitude === TeamAttitude.MatchOfTheSeason) attitudeMod = 1.1;
      else if (attitude === TeamAttitude.PlayItCool) attitudeMod = 0.95;
      
      const baseWin = bestPlan.prediction?.winProbability || 0.33;
      const baseDraw = bestPlan.prediction?.drawProbability || 0.33;
      
      rankings.push({
        attitude, winProbability: clamp01(baseWin * attitudeMod),
        structuralScore: bestPlan.tacticalScore || 0.5, tacticalScore: bestPlan.tacticalScore || 0.5,
        compositeScore: 3 * clamp01(baseWin * attitudeMod) + clamp01(baseDraw / attitudeMod)
      });
    }
    
    rankings.sort((a, b) => b.compositeScore - a.compositeScore);
    return { selectedAttitude: rankings[0].attitude, ranking: rankings };
  }
  
  expectedPoints(prediction) { return 3 * prediction.winProbability + prediction.drawProbability; }
  
  lineupSignature(lineup) {
    return lineup.slots.sort((a, b) => a.code.localeCompare(b.code)).map(s => `${s.code}:${s.playerId}:${s.order}`).join(';');
  }
}

export async function quickMatchAnalysis(ownPlayers, opponentPlayers, preferences = {}) {
  const engine = new FinalDecisionEngine();
  const result = await engine.analyzeAndDecide(ownPlayers, { teamName: 'Opponent', players: opponentPlayers }, preferences);
  return {
    bestFormation: result.bestPlan.formation,
    bestTactic: result.bestPlan.matchup?.tactic || TeamTactic.Normal,
    winProbability: result.prediction.winProbability,
    expectedGoals: result.prediction.expectedHomeGoals,
    expectedGoalsAgainst: result.prediction.expectedAwayGoals,
    reasoning: `En iyi ${result.bestPlan.formation} dizilişi ile ${result.prediction.winProbability.toFixed(1)}% galibiyet olasılığı.`
  };
}

export function createFinalDecisionEngine(formationOptimizer, tacticalEngine, opponentAnalyzer, monteCarlo) {
  return new FinalDecisionEngine(formationOptimizer, tacticalEngine, opponentAnalyzer, monteCarlo);
}