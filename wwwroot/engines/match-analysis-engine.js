// Match Analysis Engine - Main orchestrator - JavaScript

import { 
  TeamTactic, TeamAttitude, MatchLocation,
  PerformanceTimer
} from '../shared/index.js';

import { getRatingEngine } from './rating-engine.js';
import { createPositionOptimizer } from './position-optimizer.js';
import { createFormationOptimizer } from './formation-optimizer.js';
import { createOpponentAnalyzer } from './opponent-analyzer.js';
import { createTacticalDecisionEngine } from './tactical-engine.js';
import { createMonteCarloEngine } from './monte-carlo.js';
import { createFinalDecisionEngine } from './decision-engine.js';

export class MatchAnalysisEngine {
  constructor() {
    this.ratingEngine = getRatingEngine();
    this.positionOptimizer = createPositionOptimizer(this.ratingEngine);
    this.formationOptimizer = createFormationOptimizer(this.positionOptimizer, this.ratingEngine);
    this.opponentAnalyzer = createOpponentAnalyzer(this.ratingEngine, this.positionOptimizer, this.formationOptimizer);
    this.tacticalEngine = createTacticalDecisionEngine(this.ratingEngine, this.positionOptimizer, this.formationOptimizer, this.opponentAnalyzer);
    this.monteCarlo = createMonteCarloEngine();
    this.decisionEngine = createFinalDecisionEngine(this.formationOptimizer, this.tacticalEngine, this.opponentAnalyzer, this.monteCarlo);
  }
  
  async analyze(request) {
    const timer = new PerformanceTimer();
    const { ownTeam, opponentTeam, simulationConfig } = request;
    const coachLevel = ownTeam.coachLevel || 0;
    const matchLocation = ownTeam.matchLocation || MatchLocation.Neutral;
    const preferredFormation = ownTeam.preferredFormation;
    const preferredTactic = ownTeam.preferredTactic;
    const preferredAttitude = ownTeam.preferredAttitude;
    const priorities = ownTeam.priorities;
    const simCount = simulationConfig?.simulationCount || 10000;
    
    timer.mark('position-optimization-start');
    const positionOptimization = this.positionOptimizer.analyzeAllPlayers(ownTeam.players);
    timer.mark('position-optimization-end');
    
    timer.mark('formation-optimization-start');
    const formationOptimization = await this.formationOptimizer.generateCandidates(ownTeam.players, coachLevel, preferredFormation);
    timer.mark('formation-optimization-end');
    
    timer.mark('opponent-analysis-start');
    const opponentAnalysis = await this.opponentAnalyzer.analyzeOpponent(
      { teamName: opponentTeam.teamName, players: opponentTeam.players, lineup: opponentTeam.lineup, regionalRatings: opponentTeam.regionalRatings, knownFormation: opponentTeam.knownFormation, knownTactic: opponentTeam.knownTactic },
      coachLevel
    );
    timer.mark('opponent-analysis-end');
    
    timer.mark('tactical-decision-start');
    
    const bestFormation = formationOptimization.bestFormation;
    let slotAssignments = new Map();
    if (bestFormation) {
      for (const assignment of bestFormation.bestAssignment) {
        const player = ownTeam.players.find(p => p.id === assignment.playerId);
        if (player) slotAssignments.set(assignment.slotCode, { player, order: assignment.order });
      }
    }
    
    const tacticalDecision = await this.tacticalEngine.evaluateAllTactics(
      ownTeam.players, bestFormation?.formation || '4-4-2', slotAssignments,
      { regionalRatings: opponentAnalysis.regionalRatings, predictedTactic: opponentAnalysis.predictedTactic },
      coachLevel, preferredTactic
    );
    timer.mark('tactical-decision-end');
    
    timer.mark('match-simulation-start');
    const bestTactic = tacticalDecision.bestTactic.tactic;
    const matchSimulation = await this.monteCarlo.simulate(
      bestFormation?.sectorRatings || opponentAnalysis.regionalRatings,
      opponentAnalysis.regionalRatings,
      bestTactic, opponentAnalysis.predictedTactic || TeamTactic.Normal,
      matchLocation, { simulationCount: simCount }
    );
    timer.mark('match-simulation-end');
    
    timer.mark('final-decision-start');
    const finalDecision = await this.decisionEngine.analyzeAndDecide(
      ownTeam.players,
      { teamName: opponentTeam.teamName, players: opponentTeam.players, lineup: opponentTeam.lineup, regionalRatings: opponentTeam.regionalRatings, knownFormation: opponentTeam.knownFormation, knownTactic: opponentTeam.knownTactic },
      { preferredFormation, preferredTactic, preferredAttitude, coachLevel, matchLocation, priorities, simulationCount: simCount }
    );
    timer.mark('final-decision-end');
    
    timer.mark('ai-explanation-start');
    const aiExplanation = this.generateAIExplanation(
      positionOptimization, formationOptimization, opponentAnalysis,
      tacticalDecision, matchSimulation, finalDecision, ownTeam, opponentTeam
    );
    timer.mark('ai-explanation-end');
    
    const totalTime = timer.getTotal();
    
    return {
      request, positionOptimization, formationOptimization, opponentAnalysis,
      tacticalDecision, matchSimulation, finalDecision, aiExplanation,
      timestamp: new Date().toISOString(), computationTimeMs: totalTime
    };
  }
  
  generateAIExplanation(positionOpt, formationOpt, opponentAnalysis, tacticalDecision, matchSim, finalDecision, ownTeam, opponentTeam) {
    const lines = [];
    
    lines.push('=== HATTRICKAI V6 MAÇ ANALİZİ ===');
    lines.push('');
    lines.push(`📋 BİZİM TAKIM: ${ownTeam.teamName || 'Bilinmeyen'}`);
    lines.push(`   ${ownTeam.players.length} oyuncu, Koç seviyesi: ${ownTeam.coachLevel || 0}`);
    lines.push('');
    
    lines.push(`🎯 RAKİP: ${opponentTeam.teamName || 'Bilinmeyen'}`);
    if (opponentAnalysis.missingData.length > 0) {
      lines.push(`   ⚠️ Eksik veriler: ${opponentAnalysis.missingData.join(', ')}`);
    }
    lines.push(`   Genel güç: ${opponentAnalysis.midfieldStrength.toFixed(1)} MF / ${((opponentAnalysis.leftAttackStrength + opponentAnalysis.centralAttackStrength + opponentAnalysis.rightAttackStrength)/3).toFixed(1)} ATT / ${((opponentAnalysis.leftDefenceStrength + opponentAnalysis.centralDefenceStrength + opponentAnalysis.rightDefenceStrength)/3).toFixed(1)} DEF`);
    lines.push(`   En güçlü hücum: ${this.sectorName(opponentAnalysis.strongestAttackSector)} (${this.getSectorValue(opponentAnalysis, opponentAnalysis.strongestAttackSector).toFixed(1)})`);
    lines.push(`   En zayıf savunma: ${this.sectorName(opponentAnalysis.weakestDefenceSector)} (${this.getSectorValue(opponentAnalysis, opponentAnalysis.weakestDefenceSector).toFixed(1)})`);
    if (opponentAnalysis.advantages.length > 0) lines.push(`   Avantajlarımız: ${opponentAnalysis.advantages.join('; ')}`);
    if (opponentAnalysis.disadvantages.length > 0) lines.push(`   Dezavantajlarımız: ${opponentAnalysis.disadvantages.join('; ')}`);
    lines.push('');
    
    lines.push('👥 POZİSYON ANALİZİ:');
    lines.push(`   En iyi 11 için önerilen oyuncular:`);
    const top11 = positionOpt.slice(0, 11);
    for (const p of top11) {
      const orderNames = ['Normal', 'Defansif', 'Ofansif', 'Merkeze', 'Kanada'];
      lines.push(`   • ${p.playerName}: ${p.bestPosition.positionCode} ${orderNames[p.bestPosition.order]} (${p.bestPosition.rating.toFixed(2)})`);
    }
    lines.push('');
    
    lines.push('🏗️ DİZİLİŞ ANALİZİ:');
    lines.push(`   En iyi: ${formationOpt.bestFormation?.formation || '—'} (Yapısal skor: ${formationOpt.bestFormation?.structuralScore.toFixed(3) || '—'})`);
    if (formationOpt.userPreferredFormation) {
      lines.push(`   Tercih edilen: ${formationOpt.userPreferredFormation.formation} (Skor: ${formationOpt.userPreferredFormation.structuralScore.toFixed(3)})`);
    }
    lines.push(`   Alternatifler:`);
    for (const c of formationOpt.candidates.slice(0, 5)) {
      lines.push(`   • ${c.formation}: ${c.structuralScore.toFixed(3)} (${c.bestAssignment.length}/11 dolu)`);
    }
    lines.push('');
    
    lines.push('⚽ TAKTİK ANALİZİ:');
    lines.push(`   Önerilen: ${tacticalDecision.bestTactic.tacticName} (Genel skor: ${(tacticalDecision.bestTactic.overallScore*100).toFixed(0)}%)`);
    lines.push(`   ${tacticalDecision.bestTactic.explanation}`);
    if (tacticalDecision.bestTactic.riskFactors.length > 0) lines.push(`   Riskler: ${tacticalDecision.bestTactic.riskFactors.join('; ')}`);
    if (tacticalDecision.userPreferredTactic) lines.push(`   Tercih edilen: ${tacticalDecision.userPreferredTactic.tacticName} (Skor: ${(tacticalDecision.userPreferredTactic.overallScore*100).toFixed(0)}%)`);
    lines.push('');
    
    lines.push('🎲 MAÇ SİMÜLASYONU (Monte Carlo):');
    lines.push(`   Simülasyon: ${matchSim.config.simulationCount.toLocaleString()} maç × ${matchSim.config.matchTicks} tick`);
    lines.push(`   Sonuç: Galibiyet %${(matchSim.winProbability*100).toFixed(1)} | Beraberlik %${(matchSim.drawProbability*100).toFixed(1)} | Mağlubiyet %${(matchSim.lossProbability*100).toFixed(1)}`);
    lines.push(`   Beklenen gol: ${matchSim.expectedHomeGoals.toFixed(2)} - ${matchSim.expectedAwayGoals.toFixed(2)}`);
    lines.push(`   En olası skor: ${matchSim.mostLikelyScore} (%${(matchSim.mostLikelyScoreProbability*100).toFixed(1)})`);
    lines.push(`   Beklenen Puan: ${(3*matchSim.winProbability + matchSim.drawProbability).toFixed(2)}`);
    if (matchSim.scenarioResults && matchSim.scenarioResults.length > 0) {
      lines.push(`   Senaryolar:`);
      for (const s of matchSim.scenarioResults) {
        lines.push(`   • ${s.name}: G%${(s.winProbability*100).toFixed(0)} B%${(s.drawProbability*100).toFixed(0)} M%${(s.lossProbability*100).toFixed(0)} - ${s.mostLikelyScore}`);
      }
    }
    lines.push('');
    
    lines.push('🏆 NİHAİ KARAR:');
    lines.push(`   Diziliş: ${finalDecision.bestPlan.formation}`);
    lines.push(`   Taktik: ${this.getTacticName(finalDecision.bestPlan.matchup?.tactic) || tacticalDecision.bestTactic.tacticName}`);
    lines.push(`   Tutum: ${finalDecision.selectedAttitude !== undefined ? ['Sakin Oyna', 'Normal', 'Sezonun Maçı'][finalDecision.selectedAttitude + 1] || 'Normal' : 'Normal'}`);
    lines.push(`   Galibiyet: %${(finalDecision.prediction.winProbability*100).toFixed(1)}`);
    lines.push(`   Beraberlik: %${(finalDecision.prediction.drawProbability*100).toFixed(1)}`);
    lines.push(`   Mağlubiyet: %${(finalDecision.prediction.lossProbability*100).toFixed(1)}`);
    lines.push('');
    
    if (finalDecision.formationCompetition && finalDecision.formationCompetition.length > 1) {
      lines.push('📊 FORMASYON YARIŞMASI:');
      for (const fc of finalDecision.formationCompetition.slice(0, 5)) {
        const depthIcon = fc.searchDepthStatus === 'Sufficient' ? '✅' : '⚠️';
        lines.push(`   #${fc.rank} ${fc.formation}: EP=${fc.expectedPoints.toFixed(2)} G%${(fc.winProbability*100).toFixed(0)} ${fc.mostLikelyScore} ${depthIcon}`);
      }
      lines.push('');
    }
    
    lines.push('💡 ÖNEMLİ ÇIKARIMLAR:');
    if (opponentAnalysis.weakestDefenceSector) lines.push(`   • Rakibin ${this.sectorName(opponentAnalysis.weakestDefenceSector).toLowerCase()} zayıf - bu bölgeye atak odaklanmalı`);
    if (tacticalDecision.bestTactic.tactic !== TeamTactic.Normal) lines.push(`   • ${tacticalDecision.bestTactic.tacticName} taktiği Normal'e göre avantaj sağlıyor`);
    if (finalDecision.bestPlan.formation !== ownTeam.preferredFormation && ownTeam.preferredFormation) lines.push(`   • Tercih edilen ${ownTeam.preferredFormation} yerine ${finalDecision.bestPlan.formation} öneriliyor (daha yüksek beklenti puanı)`);
    lines.push(`   • Simülasyon deterministik: Aynı seed (${matchSim.config.seed}) ile tekrar edilebilir`);
    lines.push('');
    
    lines.push(`⏱️ Toplam hesaplama süresi: ${finalDecision.computationTimeMs?.toFixed(0) || '—'}ms`);
    lines.push('=== ANALİZ TAMAMLANDI ===');
    
    return lines.join('\n');
  }
  
  sectorName(sector) {
    const names = { 'LeftDefence': 'Sol Savunma', 'CentralDefence': 'Merkez Savunma', 'RightDefence': 'Sağ Savunma', 'Midfield': 'Orta Saha', 'LeftAttack': 'Sol Hücum', 'CentralAttack': 'Merkez Hücum', 'RightAttack': 'Sağ Hücum' };
    return names[sector] || sector;
  }
  
  getSectorValue(analysis, sector) {
    const map = { 'LeftDefence': analysis.leftDefenceStrength, 'CentralDefence': analysis.centralDefenceStrength, 'RightDefence': analysis.rightDefenceStrength, 'Midfield': analysis.midfieldStrength, 'LeftAttack': analysis.leftAttackStrength, 'CentralAttack': analysis.centralAttackStrength, 'RightAttack': analysis.rightAttackStrength };
    return map[sector] || 0;
  }
  
  getTacticName(tactic) {
    if (tactic === undefined) return '—';
    const names = { 0: 'Normal', 1: 'Pres', 2: 'Kontra Atak', 3: 'Orta Saldırı', 4: 'Kanatlardan Atak', 7: 'Yaratıcı', 8: 'Uzun Şutlar' };
    return names[tactic] || 'Normal';
  }
  
  async initializeRatingEngine(genelAllHex) {
    await this.ratingEngine.loadFromGenelAllData(genelAllHex);
  }
  
  isReady() { return this.ratingEngine.isReady(); }
}

export function createMatchAnalysisEngine() {
  return new MatchAnalysisEngine();
}