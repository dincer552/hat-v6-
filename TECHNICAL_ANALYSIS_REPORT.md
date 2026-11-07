# HattrickAI V6 - Technical Analysis Report

## Executive Summary

This report analyzes the current HattrickAI V6 architecture and the reference ho-ai project to establish a baseline for developing a comprehensive AI-powered squad optimization, opponent analysis, tactical decision, and match simulation system.

---

## 1. Current V6 Architecture Analysis

### 1.1 Technology Stack
- **Backend**: C#/.NET 9 (ASP.NET Core)
- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5
- **Authentication**: CHPP OAuth 1.0a (Hattrick API)
- **AI Integration**: NVIDIA Nemotron (via OpenAI-compatible API)
- **Deployment**: Docker, Azure VM, GitHub Actions CI/CD
- **Data Storage**: File-based JSONL memory store, no database

### 1.2 Core Components

#### Backend Services (`/workspace/app/Core/`)
| Component | Purpose |
|-----------|---------|
| `ChppV5.cs` | CHPP OAuth flow, XML API calls, token management |
| `ChppCoreModels.cs` | Player, Slot, Lineup records, enums (Specialty, Order, Tactic) |
| `TeamPlayerChppExportService.cs` | CHPP player export with trainer filtering |
| `HattrickMemoryStore.cs` | Session-based chat memory persistence |
| `Program.cs` | Web API endpoints, OAuth routes, AI chat, health checks |

#### Frontend Pages (`/workspace/app/wwwroot/`)
| Page | Purpose |
|------|---------|
| `hattrick.html` | Main player listing, AI chat interface |
| `genel.html` | All-positions calculator (44 positions × all orders) |
| `manual-rating.html` | Manual lineup with OCR image import |

#### JavaScript Modules
| Module | Purpose |
|--------|---------|
| `genel-rating-engine.js` | **Core rating engine** - Excel TOPLAM logic (ΣL then M) |
| `genel-all-data.js` | Compressed rating formulas (gzip + hex, ~50KB) |
| `rating-engines.js` | Engine comparison UI (V5 vs HO vs Loddar) |
| `formation-competition.js` | Formation ranking display |
| `tactic-comparison.js` | Tactic comparison display |
| `m9-prediction.js` | Match prediction display |

### 1.3 Rating Engine (genel-rating-engine.js)

**Algorithm: Excel TOPLAM (Sum-L then single M)**

```javascript
// Form Factor: I = 0.378 * sqrt(min(7, max(0, Form-1)))
// Experience Polynomial: K = -0.00000725*x^4 + 0.0005*x^3 - 0.01336*x^2 + 0.176*x (x=max(0,Exp-1))
// Line Contribution: L = (max(0, Skill-1) + Loyalty) * FormFactor * K + ExpPoly * N
// Sector Rating: M = qRound((ΣL * CoachR * SS)^V / 4 + 1)  [Quarter-round: round(x*4)/4]
```

**Key Formulas:**
- 7 sectors: LD, CD, RD, MID, LA, CA, RA
- Per-position coefficients (k, n, ss, V, o, p, q) from Excel
- Coach factor: 1.02 - (coach≤0 ? coach*0.08/10 : coach*0.12/10)

**Data Source**: `genel-all-data.js` contains 2000+ formula rows for 44 positions × orders.

---

## 2. Reference ho-ai Architecture Analysis

### 2.1 Full C# Pipeline (M4→M10)

```
M4 FormationCandidateEngine    → Legal formations, structural feasibility
M5 BehaviourEngine             → Legal player orders per position
M6 AdvancedTacticalScenarioEngine → Tactic skill, level, chance distribution
M7 RatingEngine (V5/HO/Dash)   → Regional ratings (ensemble)
M8 M8ChanceAllocationEngine    → Possession, sector shares, tactic conversion
M9 M9MatchPredictionEngine     → Event goals + Poisson + Monte Carlo
M10 M10FinalDecisionEngine     → Expected Points optimization
```

### 2.2 Key Engines

#### M8ChanceAllocationEngine (Paper-based)
- **Possession**: (ownMid^3) / (ownMid^3 + oppMid^3) [rating*4-3]^3
- **Tactic Conversion Rates** (from Constantinou et al. 2026):
  - Pressing: -0.0078*rt² + 0.4714*rt - 1.1074
  - CounterAttack: cubic polynomial
  - AttackMiddle: quadratic
  - AttackWings: quadratic
  - LongShots: linear
- **Sector Migration**: AttackMiddle moves wing→centre, AttackWings moves centre→wing

#### M9MatchPredictionEngine
- **Event Goals**: Player-based (winger, technical, quick, unpredictable) + Team-based (corners, experienced forward, etc.)
- **Special Events**: PNF (Powerful Normal Forward), PDIM (Powerful Def. Inner Mid)
- **Long Shots**: Shooter (Scoring^2.38 * SetPieces^2.77) vs Keeper (GK^0.9 + SP^2.33)
- **Outcome**: Poisson distribution (λ = expected goals) → Win/Draw/Loss probabilities

#### M9SimulationEngine (Monte Carlo)
- **Default**: 1000 simulations, 18 ticks (5-min intervals)
- **Scenarios**: Base, Left wing, Right wing, Low chance, High chance
- **Per-tick sampling**: Poisson for normal + event goals
- **Output**: Score frequencies, outcome probabilities, scenario breakdowns

#### M10FinalDecisionEngine
- **Primary Metric**: Expected Points = 3×WinProb + DrawProb
- **Tie-breakers**: WinProb → GoalDiff → TacticalScore → Signature
- **Formation Competition**: Group by formation, rank by Expected Points
- **Search Depth Check**: Minimum candidates per formation

### 2.3 Tactic Evaluators (Individual)
Each tactic has dedicated evaluator with weighted scoring:
- **Pressing**: Squad DEF/STAM/EXP fit, net suppression, opportunity cost, matchup
- **CounterAttack**: DEF+Passing, midfield penalty, conversion rate
- **AttackMiddle/AttackWings**: Passing-based, sector migration
- **Creative**: 4×Passing + Experience
- **LongShots**: Scoring + Passing

### 2.4 Legal Formations (FormationCandidateEngine)
1. 3-5-2 (GK, 3DEF, 5MID, 2FW)
2. 3-4-3 (GK, 3DEF, 4MID, 3FW)
3. 4-4-2 (GK, 4DEF, 4MID, 2FW)
4. 4-5-1 (GK, 4DEF, 5MID, 1FW)
5. 2-5-3 (GK, 2WB, 5MID, 3FW)
6. 5-3-2 (GK, 5DEF, 3MID, 2FW)
7. 5-5-0 (GK, 5DEF, 5MID, 0FW)

### 2.5 Player Orders per Position (BehaviourEngine)
| Position | Allowed Orders |
|----------|----------------|
| GK | Normal |
| WB (DEF-L/R) | Normal, Offensive, Defensive, TowardsMiddle |
| CD (DEF-CL/CR) | Normal, Offensive, TowardsWing |
| CEN (DEF-C) | Normal, Offensive |
| W (W-L/R) | Normal, Offensive, Defensive, TowardsMiddle |
| IM (IM-L/R) | Normal, Offensive, Defensive, TowardsWing |
| IM-C | Normal, Offensive, Defensive |
| FW-L/R | Normal, Defensive, TowardsWing |
| FW-C | Normal, Defensive |

---

## 3. Comparison: V6 vs ho-ai

| Aspect | V6 (Current) | ho-ai (Reference) |
|--------|--------------|-------------------|
| **Rating Engine** | JS Excel TOPLAM (ΣL→M) | C# Ensemble (V5+HO+Dash) |
| **Match Prediction** | Display only (M9 panel) | Full M8→M9 pipeline |
| **Monte Carlo** | Not implemented | 1000 sims, 18 ticks |
| **Tactic Evaluation** | Not implemented | 6 dedicated evaluators |
| **Formation Optimization** | Not implemented | M4 candidate engine |
| **Player Order Optimization** | Not implemented | M5 behaviour engine |
| **Opponent Analysis** | Manual UI only | M9 symmetric evaluation |
| **Decision Engine** | AI chat only | M10 Expected Points |
| **Data Source** | CHPP only | CHPP + historical calibration |
| **Calibration** | Not implemented | Research-backed, needs match calibration |

---

## 4. Gap Analysis for Target System

### 4.1 Missing Components (Must Build)
1. **Position Optimization Engine** - Player × Position × Order rating matrix
2. **Opponent Analysis Engine** - Regional strength/weakness detection
3. **Tactical Decision Engine** - Tactic selection based on squad + opponent
4. **Monte Carlo Match Simulator** - 10,000+ simulations with configurable parameters
5. **Automatic Best XI Selector** - Formation + Players + Orders + Tactic optimization
6. **Match Analysis UI** - New screen integrating all components

### 4.2 Existing Assets to Reuse
1. **CHPP Infrastructure** - Fully working OAuth, player export
2. **Rating Engine (JS)** - Excel TOPLAM formulas, validated
3. **AI Chat Infrastructure** - NVIDIA integration, memory store
4. **Deployment Pipeline** - Docker, Azure, GitHub Actions
5. **Player Models** - Complete CHPP player data structure

### 4.3 ho-ai Components to Port/Adapt
1. **M8ChanceAllocationEngine** - Paper-based possession/sector model
2. **M9EventGoalEngine** - Event-based goal calculation (PDF Tables 4/5)
3. **M9SimulationEngine** - Monte Carlo with scenarios
3. **Tactic Evaluators** - 6 tactic-specific suitability models
4. **FormationCandidateEngine** - Legal formations + feasibility
5. **BehaviourEngine** - Legal orders per position
6. **M10FinalDecisionEngine** - Expected Points optimization

---

## 5. Development Strategy

### Phase A: Foundation (Week 1)
- Port ho-ai C# engines to new V6 modules (separate from existing)
- Create unified TypeScript/JavaScript rating engine matching Excel TOPLAM
- Build PositionOptimizationEngine (player × position × order matrix)

### Phase B: Core Engines (Week 2)
- OpponentAnalysisEngine (regional comparison, weakness detection)
- TacticalDecisionEngine (6 tactics, squad fit, matchup)
- FormationOptimizationEngine (legal formations, slot assignment)

### Phase C: Match Simulation (Week 3)
- MonteCarloMatchEngine (10,000 sims, configurable ticks)
- EventGoalEngine (port from ho-ai M9EventGoalEngine)
- PoissonOutcomeEngine (win/draw/loss probabilities)

### Phase D: Integration (Week 4)
- MatchAnalysisScreen (new UI page)
- API endpoints for analysis pipeline
- AI chat integration for explanations
- Automated regression tests

---

## 6. Technical Decisions

### 6.1 Language Choice
- **New Engines**: TypeScript (shared with frontend, easier AI integration)
- **Existing C# Backend**: Keep for CHPP, auth, deployment
- **Bridge**: API endpoints exposing new engines

### 6.2 Architecture Pattern
```
┌─────────────────────────────────────────────────────────────┐
│                    V6 Web Application                       │
├─────────────────────────────────────────────────────────────┤
│  Frontend (JS)          │  Backend (C#)                     │
│  ┌──────────────────┐   │  ┌────────────────────────────┐  │
│  │ MatchAnalysis    │◄──┤  │ /api/v6/analysis           │  │
│  │ Screen (New)     │   │  │ - squad-optimization       │  │
│  └──────────────────┘   │  │ - opponent-analysis        │  │
│         │               │  │ - tactical-decision        │  │
│         ▼               │  │ - match-simulation         │  │
│  ┌──────────────────┐   │  │ - rating-engine (TS port)  │  │
│  │ Core Engines     │   │  └────────────────────────────┘  │
│  │ (TypeScript)     │   │         ▲                         │
│  │ - PositionOpt    │   │         │                         │
│  │ - OpponentAnl    │   │         │                         │
│  │ - TacticalDec    │   │         │                         │
│  │ - FormationOpt   │   │         │                         │
│  │ - MonteCarloSim  │   │         │                         │
│  │ - RatingEngine   │   │         │                         │
│  └──────────────────┘   │         │                         │
└─────────────────────────┼─────────┼─────────────────────────┘
                          │         │
                    ┌─────┴─────┐   │
                    │ CHPP API  │   │
                    │ NVIDIA AI │   │
                    └───────────┘   │
```

### 6.3 Data Flow for Match Analysis
```
User Input (Own Team + Opponent + Preferences)
         │
         ▼
┌────────────────────────────────────────────┐
│ 1. PositionOptimizationEngine              │
│    - All players × all positions × orders  │
│    - Position-specific rating contributions│
└────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ 2. FormationOptimizationEngine             │
│    - Legal formations (7)                  │
│    - Best XI per formation (assignment)    │
│    - Structural feasibility scores         │
└────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ 3. OpponentAnalysisEngine                  │
│    - Regional ratings (7 sectors)          │
│    - Strengths/weaknesses detection        │
│    - Tactical preference inference         │
└────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ 4. TacticalDecisionEngine                  │
│    - 6 tactics × squad fit × matchup       │
│    - Opportunity cost calculation          │
│    - User preference integration           │
└────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ 5. MonteCarloMatchEngine                   │
│    - 10,000 simulations per combination    │
│    - Event goals + Poisson + scenarios     │
│    - Win/Draw/Loss, Expected Goals, Scores │
└────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ 6. M10-style Decision Engine               │
│    - Expected Points optimization          │
│    - Formation competition                 │
│    - User priority weighting               │
└────────────────────────────────────────────┘
         │
         ▼
    Results + AI Explanation → UI
```

---

## 7. Implementation Priority

### P0 (Critical - Must Have)
1. PositionOptimizationEngine with Excel TOPLAM parity
2. FormationOptimizationEngine (7 legal formations)
3. MonteCarloMatchEngine (10,000 sims, deterministic)
4. MatchAnalysisScreen UI

### P1 (High - Core Value)
5. OpponentAnalysisEngine
6. TacticalDecisionEngine (6 tactics)
7. AI Explanation Integration

### P2 (Enhancement)
8. Historical calibration hooks
9. Advanced scenario modeling
10. Performance optimization (Web Workers)

---

## 8. Validation Criteria

### Regression Tests (Protect V5 Results)
- [ ] Same player + same formation = same 7 sector ratings
- [ ] Player swap updates correct sectors only
- [ ] Order change updates correct sectors
- [ ] Coach level factor matches Excel

### New Engine Tests
- [ ] Deterministic: Same seed = same simulation results
- [ ] Statistical: 10,000 sims converge (Win% ±0.5%)
- [ ] Opponent change triggers re-optimization
- [ ] User tactic preference included in comparison
- [ ] Missing opponent data handled gracefully

### Comparison Baseline
- [ ] ho-ai M9 predictions reproduced (where data available)
- [ ] Formation competition rankings match M10 logic
- [ ] Tactic evaluator scores align with ho-ai

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Formula divergence from Excel | Unit test each formula row against known values |
| Simulation non-determinism | Fixed seed, documented RNG, reproducible runs |
| Performance (10k sims) | Web Workers, incremental results, configurable count |
| CHPP rate limits | Caching, batch requests, graceful degradation |
| AI hallucination | AI only explains, never computes numbers |

---

## 10. File Structure Plan

```
/workspace/app/
├── wwwroot/
│   ├── match-analysis.html          # NEW: Main analysis screen
│   ├── match-analysis.js            # NEW: UI controller
│   ├── engines/
│   │   ├── rating-engine.ts         # NEW: TypeScript Excel TOPLAM port
│   │   ├── position-optimizer.ts    # NEW: Player×Position×Order matrix
│   │   ├── formation-optimizer.ts   # NEW: Legal formations + assignment
│   │   ├── opponent-analyzer.ts     # NEW: Regional analysis
│   │   ├── tactical-engine.ts       # NEW: 6 tactic evaluators
│   │   ├── monte-carlo.ts           # NEW: 10k simulation engine
│   │   ├── event-goals.ts           # NEW: M9 event goal port
│   │   └── decision-engine.ts       # NEW: M10 Expected Points
│   ├── shared/
│   │   ├── types.ts                 # NEW: Shared TypeScript types
│   │   ├── constants.ts             # NEW: Formations, orders, tactics
│   │   └── utils.ts                 # NEW: Math, RNG, helpers
│   └── ...existing files...
├── Core/
│   ├── Analysis/                    # NEW: C# API endpoints
│   │   ├── SquadOptimizationService.cs
│   │   ├── OpponentAnalysisService.cs
│   │   ├── TacticalDecisionService.cs
│   │   ├── MatchSimulationService.cs
│   │   └── AnalysisApiEndpoints.cs
│   └── ...existing...
└── Tests/
    ├── rating-engine.test.ts        # NEW: Formula regression
    ├── position-optimizer.test.ts   # NEW: Assignment logic
    ├── monte-carlo.test.ts          # NEW: Determinism + stats
    └── integration.test.ts          # NEW: Full pipeline
```

---

## 11. Next Steps

1. **Immediate**: Create TypeScript engine modules in `/wwwroot/engines/`
2. **Day 1-2**: Port Excel TOPLAM rating engine to TypeScript with full test coverage
3. **Day 3-4**: Build PositionOptimizationEngine + FormationOptimizationEngine
4. **Day 5-6**: Port M8/M9 engines (chance allocation, event goals, Monte Carlo)
5. **Day 7-8**: Build TacticalDecisionEngine + OpponentAnalyzer
6. **Day 9-10**: Create MatchAnalysisScreen UI + API integration
7. **Day 11-12**: Automated tests, regression validation, documentation

---

*Report generated: 2026-11-07*
*Based on analysis of V6 (hat-v6-) and ho-ai reference implementations*