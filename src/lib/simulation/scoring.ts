/**
 * V2 Scoring System
 *
 * Total = 100 points
 *   GDP Growth Rate    — 25 pts (cumulative growth across all rounds)
 *   Inflation Stability — 25 pts (distance from 2% target)
 *   Budget Deficit      — 15 pts (lower avg deficit = better)
 *   Trade & Forex       — 20 pts (currency stability + trade balance)
 *   Diplomacy Grade     — 15 pts (deals, alliances, penalties)
 */

import { SCORING_WEIGHTS } from "../constants";

interface TeamRoundData {
  teamId: string;
  gdpGrowth: number;
  inflation: number;
  fiscalDeficit: number;
  currencyIndex: number;
  tradeBalance: number;
  diplomacyScore: number;
  approvalRating: number;
}

export interface TeamScore {
  teamId: string;
  total: number;
  breakdown: {
    cumulativeGDP: number;
    inflationStability: number;
    fiscalDiscipline: number;
    tradeBalance: number;
    diplomaticScore: number;
  };
}

/**
 * Interpolate score between max and floor.
 * Best team gets maxPoints, worst gets 20% (floor), others linear in between.
 */
function interpolateScore(
  value: number,
  bestValue: number,
  worstValue: number,
  maxPoints: number,
  lowerIsBetter: boolean
): number {
  const floor = maxPoints * 0.2;
  if (bestValue === worstValue) return maxPoints;

  let normalized: number;
  if (lowerIsBetter) {
    normalized = worstValue === bestValue ? 1 : (worstValue - value) / (worstValue - bestValue);
  } else {
    normalized = bestValue === worstValue ? 1 : (value - worstValue) / (bestValue - worstValue);
  }

  normalized = Math.max(0, Math.min(1, normalized));
  return floor + normalized * (maxPoints - floor);
}

export function calculateScores(allRoundStates: TeamRoundData[][]): TeamScore[] {
  if (allRoundStates.length === 0) return [];

  const teamIds = [...new Set(allRoundStates[0].map(s => s.teamId))];

  // Aggregate metrics per team across all completed rounds
  const teamMetrics = teamIds.map(teamId => {
    const states = allRoundStates
      .map(round => round.find(s => s.teamId === teamId))
      .filter((s): s is TeamRoundData => s != null);

    if (states.length === 0) return { teamId, cumulativeGDP: 0, avgInflationDev: 10, avgDeficit: 10, avgCurrencyDev: 20, avgTradeBalance: -10, finalDiplomacy: 0 };

    const cumulativeGDP       = states.reduce((s, r) => s + r.gdpGrowth, 0);
    const avgInflationDev     = states.reduce((s, r) => s + Math.abs(r.inflation - 2.0), 0) / states.length;
    const avgDeficit          = states.reduce((s, r) => s + r.fiscalDeficit, 0) / states.length;
    const avgCurrencyDev      = states.reduce((s, r) => s + Math.abs(r.currencyIndex - 100), 0) / states.length;
    const avgTradeBalance     = states.reduce((s, r) => s + r.tradeBalance, 0) / states.length;
    const finalDiplomacy      = states[states.length - 1]?.diplomacyScore ?? 0;

    // Combined trade score: currency stability (weighted 60%) + trade balance (40%)
    const tradeScore = -avgCurrencyDev * 0.6 + avgTradeBalance * 0.4;

    return { teamId, cumulativeGDP, avgInflationDev, avgDeficit, avgCurrencyDev, avgTradeBalance, finalDiplomacy, tradeScore };
  });

  // Value arrays for ranking
  const cumulativeGDPs  = teamMetrics.map(m => m.cumulativeGDP);
  const inflationDevs   = teamMetrics.map(m => m.avgInflationDev);
  const deficits        = teamMetrics.map(m => m.avgDeficit);
  const tradeScores     = teamMetrics.map(m => (m as any).tradeScore ?? 0);
  const diplomacies     = teamMetrics.map(m => m.finalDiplomacy);

  const scores: TeamScore[] = teamMetrics.map(tm => {
    const ts = (tm as any).tradeScore ?? 0;

    const breakdown = {
      cumulativeGDP: interpolateScore(
        tm.cumulativeGDP, Math.max(...cumulativeGDPs), Math.min(...cumulativeGDPs),
        SCORING_WEIGHTS.cumulativeGDP, false
      ),
      inflationStability: interpolateScore(
        tm.avgInflationDev, Math.min(...inflationDevs), Math.max(...inflationDevs),
        SCORING_WEIGHTS.inflationStability, true
      ),
      fiscalDiscipline: interpolateScore(
        tm.avgDeficit, Math.min(...deficits), Math.max(...deficits),
        SCORING_WEIGHTS.fiscalDiscipline, true
      ),
      tradeBalance: interpolateScore(
        ts, Math.max(...tradeScores), Math.min(...tradeScores),
        SCORING_WEIGHTS.tradeBalance, false
      ),
      diplomaticScore: interpolateScore(
        tm.finalDiplomacy, Math.max(...diplomacies), Math.min(...diplomacies),
        SCORING_WEIGHTS.diplomaticScore, false
      ),
    };

    const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
    return { teamId: tm.teamId, total: Math.round(total * 10) / 10, breakdown };
  });

  return scores.sort((a, b) => b.total - a.total);
}
