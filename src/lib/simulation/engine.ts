/**
 * V2 Simulation Engine
 *
 * Computation order per round:
 * 1. Collect decisions + trade orders
 * 2. World Market Pricing — prices from aggregate supply/demand
 * 3. Trade Matching — compute trade income per nation
 * 4. Fiscal Engine — revenue, debt service, deficit
 * 5. GDP Engine — Cobb-Douglas
 * 6. Inflation Engine — Phillips Curve
 * 7. Forex Engine — currency movement
 * 8. Approval Engine — composite score
 * 9. Cross-country effects (diplomacy, sanctions, trade wars)
 * 10. Conflict resolution
 * 11. Feedback loops — debt, treasury, credit rating
 * 12. Clamp + persist
 */

import { prisma } from "../prisma";
import { CLAMPS, ROUND_SCENARIOS, COMMODITY_BASE_PRICES } from "../constants";
import {
  calculateGDPGrowth,
  calculateInflation,
  calculateRevenue,
  calculateDebtService,
  calculateFiscalDeficit,
  calculateBudget,
  calculateForexDelta,
  calculateApproval,
  calculateWorldPrice,
  calculateTradeIncome,
  calculateDiplomacyDelta,
  updateCreditRating,
  subsidySpendingImpact,
  defenseSpendingImpact,
  CountryMultipliers,
} from "./formulas";
import { applyCrossCountryEffects } from "./crossCountry";
import { resolveConflicts } from "./conflicts";

interface NewsItem { headline: string; type: string; }

function clamp(value: number, key: keyof typeof CLAMPS): number {
  const { min, max } = CLAMPS[key];
  return Math.max(min, Math.min(max, value));
}

// Explicit type alias to allow the conditional Promise.resolve([]) to type-check
type RoundStateRow = Awaited<ReturnType<typeof prisma.roundState.findMany>>;

export async function runSimulation(round: number): Promise<NewsItem[]> {
  // Fetch ALL data needed upfront in one parallel batch — single network round-trip
  const [teams, decisions, tradeOrders, prevStates, game, existingRelations, prevPrevStatesEarly] =
    await Promise.all([
      prisma.team.findMany({ include: { countryProfile: true } }),
      prisma.decision.findMany({ where: { round } }),
      prisma.tradeOrder.findMany({ where: { round } }),
      prisma.roundState.findMany({ where: { round: round - 1 } }),
      prisma.game.findFirst({ orderBy: { createdAt: "desc" } }),
      prisma.diplomaticRelation.findMany({ where: { active: true } }),
      round >= 2
        ? prisma.roundState.findMany({ where: { round: round - 2 } })
        : Promise.resolve([] as RoundStateRow),
    ]);

  const scenario     = ROUND_SCENARIOS[round];

  
  const news: NewsItem[] = [];
  const teamNames: Record<string, string> = {};
  teams.forEach(t => teamNames[t.id] = t.name);

  // ── 1. Process new diplomatic actions ──────────────────────────────────────
  // existingRelations already fetched above — check in memory
  const existingRelSet = new Set(
    existingRelations.map((r) => `${r.fromTeamId}:${r.toTeamId}:${r.type}`)
  );

  const newDiploActions: Array<{ fromTeamId: string; toTeamId: string; type: string; round: number }> = [];
  for (const dec of decisions) {
    const isAggressive = ["sanctions", "trade_war", "conflict"].includes(dec.diplomaticAction);
    const isDiplomatic = ["trade_deal", "alliance"].includes(dec.diplomaticAction);
    const isBreaking   = ["break_alliance", "cancel_deal"].includes(dec.diplomaticAction);

    if (isBreaking && dec.diplomaticTarget) {
      // Deactivate the matching relation
      const relType = dec.diplomaticAction === "break_alliance" ? "alliance" : "trade_deal";
      await prisma.diplomaticRelation.updateMany({
        where: {
          OR: [
            { fromTeamId: dec.teamId, toTeamId: dec.diplomaticTarget, type: relType },
            { fromTeamId: dec.diplomaticTarget, toTeamId: dec.teamId, type: relType },
          ],
          active: true,
        },
        data: { active: false },
      });
      const from = teamNames[dec.teamId] || "Unknown";
      const to   = teamNames[dec.diplomaticTarget] || "Unknown";
      if (dec.diplomaticAction === "break_alliance")
        news.push({ headline: `${from} dissolves military alliance with ${to} — diplomatic fallout expected`, type: "conflict" });
      else
        news.push({ headline: `${from} cancels trade agreement with ${to}`, type: "trade" });
    }

    if ((isAggressive || isDiplomatic) && dec.diplomaticTarget) {
      const key = `${dec.teamId}:${dec.diplomaticTarget}:${dec.diplomaticAction}`;
      if (!existingRelSet.has(key)) {
        newDiploActions.push({ fromTeamId: dec.teamId, toTeamId: dec.diplomaticTarget, type: dec.diplomaticAction, round });
        const from = teamNames[dec.teamId] || "Unknown";
        const to   = teamNames[dec.diplomaticTarget] || "Unknown";
        if (dec.diplomaticAction === "trade_deal")
          news.push({ headline: `${from} and ${to} sign bilateral trade agreement`, type: "trade" });
        else if (dec.diplomaticAction === "alliance")
          news.push({ headline: `${from} and ${to} formalize military alliance`, type: "alliance" });
        else if (dec.diplomaticAction === "sanctions")
          news.push({ headline: `${from} imposes economic sanctions on ${to}`, type: "crisis" });
        else if (dec.diplomaticAction === "trade_war")
          news.push({ headline: `BREAKING: ${from} declares trade war against ${to}`, type: "conflict" });
        else if (dec.diplomaticAction === "conflict")
          news.push({ headline: `BREAKING: ${from} declares military conflict against ${to}`, type: "conflict" });
      }
    }
  }
  // Batch-insert new diplomatic relations and merge into activeRelations — no extra query
  if (newDiploActions.length > 0) {
    await prisma.diplomaticRelation.createMany({ data: newDiploActions });
  }
  // Merge newly created relations into existing list (avoid a re-fetch)
  const activeRelations = [
    ...existingRelations,
    ...newDiploActions.map((a, i) => ({ ...a, id: `new_${i}`, active: true, createdAt: new Date() })),
  ];

  // ── 2. World Market Pricing ─────────────────────────────────────────────────
  const commodities = ["oil", "metals", "food", "semis", "pharma", "textiles"];
  const worldPrices: Record<string, number> = {};
  const commodityStats: Record<string, { supply: number; demand: number }> = {};

  if (scenario?.tradeEnabled) {
    // Compute all commodity stats first (no DB), then batch-upsert
    for (const commodity of commodities) {
      const exports = tradeOrders.filter(o => o.commodity === commodity && o.direction === "export");
      const imports = tradeOrders.filter(o => o.commodity === commodity && o.direction === "import");
      const totalSupply = exports.reduce((s, o) => s + o.quantity, 0);
      const totalDemand = imports.reduce((s, o) => s + o.quantity, 0);
      commodityStats[commodity] = { supply: totalSupply, demand: totalDemand };
      const base = COMMODITY_BASE_PRICES[commodity] ?? 100;
      worldPrices[commodity] = calculateWorldPrice(base, Math.max(totalDemand, 0.1), Math.max(totalSupply, 0.1));
    }
    // deleteMany + createMany = 2 queries instead of 6 individual upserts
    await prisma.tradeTransaction.deleteMany({ where: { round } });
    await prisma.tradeTransaction.createMany({
      data: commodities.map((commodity) => ({
        round, commodity,
        worldPrice: worldPrices[commodity],
        totalSupply: commodityStats[commodity].supply,
        totalDemand: commodityStats[commodity].demand,
      })),
    });
  } else {
    // No trade in Round 1 — use base prices
    commodities.forEach(c => { worldPrices[c] = COMMODITY_BASE_PRICES[c] ?? 100; });
  }

  // ── 3. World averages (for Forex calculations) ──────────────────────────────
  const prevStateMap = new Map(prevStates.map(s => [s.teamId, s]));

  const worldAvgInterestRate = decisions.length > 0
    ? decisions.reduce((s, d) => s + d.interestRate, 0) / decisions.length
    : 5.0;

  // ── 4–10. Per-team simulation ───────────────────────────────────────────────
  type SimState = {
    teamId: string;
    gdpGrowth: number; gdp: number; inflation: number; unemployment: number;
    fiscalDeficit: number; currencyIndex: number; forexReserves: number;
    militaryStrength: number; approvalRating: number;
    tradeIncome: number; taxRevenue: number;
    creditRating: string; trustScore: number;
    tradeBalance: number; diplomacyScore: number;
    treasury: number; cumulativeDebt: number;
  };

  const newStates: SimState[] = [];

  for (const team of teams) {
    const dec      = decisions.find(d => d.teamId === team.id);
    const prev     = prevStateMap.get(team.id);
    const profile  = team.countryProfile;

    // Fallback if no decision or previous state
    if (!dec || !prev) {
      const base = prev ?? { teamId: team.id, gdpGrowth: 3.0, gdp: 1000, inflation: 4.0,
        unemployment: 6.0, fiscalDeficit: 0, currencyIndex: 100, forexReserves: 200,
        militaryStrength: 50, approvalRating: 60, tradeIncome: 50, taxRevenue: 200,
        creditRating: "A", trustScore: 80, tradeBalance: 0, diplomacyScore: 0,
        treasury: 0, cumulativeDebt: 0 };
      newStates.push({ ...base } as SimState);
      continue;
    }

    const multipliers: CountryMultipliers = profile
      ? {
          productivityFactor: profile.productivityFactor,
          tradeMultiplier: profile.tradeMultiplier,
          monetaryPower: profile.monetaryPower,
          taxEfficiency: profile.taxEfficiency,
          potentialGrowth: profile.potentialGrowth,
          creditSpread: profile.creditSpread,
          startingDebtToGdp: profile.startingDebtToGdp,
        }
      : { productivityFactor: 1.0, tradeMultiplier: 1.0, monetaryPower: 1.0,
          taxEfficiency: 0.8, potentialGrowth: 3.0, creditSpread: 0.02, startingDebtToGdp: 0.5 };

    const debtToGdp = (prev.cumulativeDebt ?? 0) / 100;

    // 3a. Trade income from commodity orders
    const myExports: Record<string, number> = {};
    const myImports: Record<string, number> = {};
    if (scenario?.tradeEnabled) {
      for (const order of tradeOrders.filter(o => o.teamId === team.id)) {
        if (order.direction === "export") myExports[order.commodity] = order.quantity;
        else myImports[order.commodity] = order.quantity;
      }
    } else if (profile) {
      // In Round 1, use natural resource balance as implicit trade (domestic only)
      myExports["oil"]      = Math.max(0, profile.oilProduction - profile.oilConsumption);
      myExports["metals"]   = Math.max(0, profile.metalsProduction - profile.metalsConsumption);
      myExports["food"]     = Math.max(0, profile.foodProduction - profile.foodConsumption);
      myExports["semis"]    = Math.max(0, profile.semisProduction - profile.semisConsumption);
      myExports["pharma"]   = Math.max(0, profile.pharmaProduction - profile.pharmaConsumption);
      myExports["textiles"] = Math.max(0, profile.textilesProduction - profile.textilesConsumption);
    }

    const tradeIncome = calculateTradeIncome(myExports, myImports, worldPrices);
    const tradeBalance = Object.entries(myExports).reduce((s, [c, q]) => s + q * (worldPrices[c] ?? 0), 0)
                       - Object.entries(myImports).reduce((s, [c, q]) => s + q * (worldPrices[c] ?? 0), 0);

    // net exports over GDP (for Cobb-Douglas trade term)
    const netExportsOverGDP = tradeBalance / Math.max(prev.gdp, 1);

    // 4. Fiscal Engine
    // First compute the actual budget available (revenue - debt service + borrowing).
    // Spending sliders are % of that budget — NOT % of GDP. Applying them to GDP caused
    // every team to spend 100% of GDP, blowing deficits to the 15% ceiling every round.
    const budget = calculateBudget({
      gdpBillions: prev.gdp,
      taxRate: dec.taxRate / 100,
      taxEfficiency: multipliers.taxEfficiency,
      debtToGdp: debtToGdp,
      creditSpread: multipliers.creditSpread,
      borrowingPct: dec.borrowing / 100,
    });
    const revenue    = budget.revenue;
    const debtService = budget.debtService;
    // Apply spending percentages to totalBudget (what the country can actually spend)
    const infraAmt   = (dec.infraSpending   / 100) * budget.totalBudget;
    const subsidyAmt = (dec.subsidySpending / 100) * budget.totalBudget;
    const defenseAmt = (dec.defenseSpending / 100) * budget.totalBudget;
    const totalSpending = infraAmt + subsidyAmt + defenseAmt;
    const { deficit: fiscalDeficit, newBudget: treasury } = calculateFiscalDeficit({
      totalSpending, revenue, tradeIncome: Math.max(0, tradeIncome),
      borrowing: dec.borrowing, gdp: prev.gdp, debtService,
    });

    // Debt accumulation
    const newDebt = Math.max(0, (prev.cumulativeDebt ?? 0) + Math.max(0, dec.borrowing));

    // 5. GDP Engine
    // In Round 1, trade is not enabled so myImports is empty — supply a baseline
    // to prevent a uniform -0.5% resource penalty hitting all countries equally.
    const importsForGDP = scenario?.tradeEnabled ? myImports : { _baseline: 5 };
    const gdpGrowthRaw = calculateGDPGrowth({
      infraSpendingPct: dec.infraSpending,
      infraSpendBillions: infraAmt,
      gdpBillions: prev.gdp,
      netExportsOverGDP,
      interestRate: dec.interestRate,
      debtToGdp,
      borrowingPct: dec.borrowing / 100,
      taxRatePct: dec.taxRate / 100,
      imports: importsForGDP,
      countryName: team.name,
      multipliers,
      baseGDPGrowth: prev.gdpGrowth,
    });
    // Smooth with 30% inertia from previous round — prevents wild round-to-round jumps
    const gdpGrowth = round === 1
      ? gdpGrowthRaw
      : 0.3 * prev.gdpGrowth + 0.7 * gdpGrowthRaw;

    // 6. Inflation Engine
    const importFraction = scenario?.tradeEnabled
      ? Object.values(myImports).reduce((s, q) => s + q, 0) / Math.max(1, prev.gdp * 0.01)
      : 0;
    const fxChange = 0; // placeholder — will be recalculated after forex step
    const inflation = calculateInflation({
      prevInflation: prev.inflation,
      gdpGrowth,
      interestRate: dec.interestRate,
      debtToGdp,
      importFraction: Math.min(importFraction, 1),
      fxRateChange: fxChange,
      budgetDeficitPct: Math.max(0, fiscalDeficit),
      multipliers,
    });

    // Subsidy & defense effects on unemployment and military
    const subImpact = subsidySpendingImpact(dec.subsidySpending);
    const defImpact = defenseSpendingImpact(dec.defenseSpending);

    const unemploymentDelta = (subImpact.unemployment || 0)
      // higher GDP growth reduces unemployment (Okun's law)
      - Math.max(0, (gdpGrowth - multipliers.potentialGrowth) * 0.3);
    // Cap per-round change at ±1.5% to prevent unrealistic single-round swings
    const unemployment = Math.max(1.0,
      prev.unemployment + Math.max(-1.5, Math.min(1.5, unemploymentDelta))
    );

    const militaryStrength = Math.max(10,
      prev.militaryStrength + (defImpact.militaryStrength || 0)
    );

    // 7. Forex Engine
    const worldAvgInflation = prevStates.length > 0
      ? prevStates.reduce((s, p) => s + p.inflation, 0) / prevStates.length
      : 4.0;
    const capitalOutflowRisk = (activeRelations.some(r => r.toTeamId === team.id && r.type === "sanctions")) ? 0.5 : 0;

    const fxDelta = calculateForexDelta({
      interestRate: dec.interestRate,
      worldAvgInterestRate,
      inflation,
      worldAvgInflation,
      tradeBalance,
      gdpScale: Math.max(prev.gdp, 1),
      capitalOutflowRisk,
    });

    const currencyIndex = prev.currencyIndex + fxDelta;

    // Forex reserves track currency strength
    const forexReserves = prev.forexReserves
      + (currencyIndex > 100 ? 5 : currencyIndex < 80 ? -10 : 0);

    // 8. Approval Engine
    const prevDiplomacyScore = prev.diplomacyScore ?? 0;
    const diplomacyDelta = calculateDiplomacyDelta({
      tradeDealsFormed:  activeRelations.filter(r => r.fromTeamId === team.id && r.type === "trade_deal" && r.round === round).length,
      alliancesFormed:   activeRelations.filter(r => r.fromTeamId === team.id && r.type === "alliance" && r.round === round).length,
      sanctionsInitiated:activeRelations.filter(r => r.fromTeamId === team.id && r.type === "sanctions" && r.round === round).length,
      alliancesBroken:   0, // handled in conflicts
    });
    const diplomacyScore = prevDiplomacyScore + diplomacyDelta;

    const approvalRating = calculateApproval({
      gdpGrowth,
      inflation,
      fiscalDeficit,
      tradeBalance,
      diplomacyScore,
      prevApproval: prev.approvalRating,
    });

    const newGDP = prev.gdp * (1 + gdpGrowth / 100);
    const taxRevenue = calculateRevenue(newGDP, dec.taxRate, multipliers.taxEfficiency);

    newStates.push({
      teamId: team.id,
      gdpGrowth, gdp: newGDP, inflation, unemployment,
      fiscalDeficit, currencyIndex, forexReserves, militaryStrength,
      approvalRating, tradeIncome, taxRevenue,
      creditRating: prev.creditRating, trustScore: prev.trustScore,
      tradeBalance, diplomacyScore, treasury: Math.max(0, treasury),
      cumulativeDebt: newDebt,
    });
  }

  // ── 9. Cross-country effects ────────────────────────────────────────────────
  const crossDeltas = applyCrossCountryEffects(
    newStates.map(s => ({ teamId: s.teamId, gdpGrowth: s.gdpGrowth, gdp: s.gdp, inflation: s.inflation, tradeIncome: s.tradeIncome, currencyIndex: s.currencyIndex })),
    decisions.map(d => ({ teamId: d.teamId, interestRate: d.interestRate, tradePolicy: d.tradeOpenness > 0.5 ? "open" : d.tradeOpenness < 0.3 ? "protectionist" : "moderate" })),
    activeRelations
  );

  for (const delta of crossDeltas) {
    const state = newStates.find(s => s.teamId === delta.teamId);
    if (!state) continue;
    state.gdpGrowth   += delta.gdpGrowth;
    state.inflation   += delta.inflation;
    state.tradeIncome += delta.tradeIncome;
    state.currencyIndex += delta.currencyIndex;
    const prev = prevStateMap.get(state.teamId);
    if (prev) state.gdp = prev.gdp * (1 + state.gdpGrowth / 100);
  }

  // ── 10. Conflict resolution ─────────────────────────────────────────────────
  const conflictResults = resolveConflicts(
    newStates.map(s => ({ teamId: s.teamId, militaryStrength: s.militaryStrength, gdpGrowth: s.gdpGrowth, unemployment: s.unemployment, approvalRating: s.approvalRating, trustScore: s.trustScore })),
    activeRelations
  );

  for (const result of conflictResults) {
    for (const [teamId, delta] of Object.entries(result.deltas)) {
      const state = newStates.find(s => s.teamId === teamId);
      if (state) {
        state.gdpGrowth     += delta.gdpGrowth;
        state.unemployment  += delta.unemployment;
        state.approvalRating += delta.approvalRating;
        state.trustScore    += delta.trustScore;
      }
    }
    news.push({
      headline: `${teamNames[result.winnerId] || "Unknown"} emerges victorious in conflict against ${teamNames[result.loserId] || "Unknown"}`,
      type: "conflict",
    });
  }

  // ── 11. Round scenario effects ──────────────────────────────────────────────
  if (scenario) {
    const fx  = scenario.effects;
    const mul = fx.effectMultiplier || 1.0;
    for (const s of newStates) {
      if (fx.inflationAdd) s.inflation  += fx.inflationAdd * mul;
      if (fx.gdpGrowthAdd) s.gdpGrowth  += fx.gdpGrowthAdd * mul;

      // Governance crisis in Round 4
      if (fx.governanceCrisisThreshold && s.approvalRating < fx.governanceCrisisThreshold) {
        s.gdpGrowth   *= 0.8;
        s.inflation   *= 1.2;
        s.fiscalDeficit *= 1.2;
        news.push({ headline: `GOVERNANCE CRISIS: ${teamNames[s.teamId]} facing political collapse — all outputs penalized 20%`, type: "crisis" });
      }
    }
    if (scenario.title !== "Foundation") {
      news.push({ headline: `ROUND ${round}: ${scenario.title} — ${scenario.description.split('.')[0]}`, type: "crisis" });
    }
  }

  // ── 12. Global event effects ────────────────────────────────────────────────
  const effectMul = scenario?.effects.effectMultiplier || 1.0;
  if (game?.globalEvent) {
    switch (game.globalEvent) {
      case "oil_crisis":
        for (const s of newStates) {
          s.inflation  += 2.0 * effectMul;
          s.gdpGrowth  -= 1.0 * effectMul;
        }
        news.push({ headline: "GLOBAL SHOCK: Oil Crisis — all economies bracing for impact", type: "crisis" });
        break;
      case "pandemic":
        for (const s of newStates) {
          s.gdpGrowth  -= 2.0 * effectMul;
          s.unemployment += 1.5 * effectMul;
        }
        news.push({ headline: "GLOBAL SHOCK: Pandemic sweeps across nations — economies reeling", type: "crisis" });
        break;
      case "currency_crisis":
        for (const s of newStates) {
          s.currencyIndex -= 10 * effectMul;
          s.inflation    += 1.5 * effectMul;
        }
        news.push({ headline: "GLOBAL SHOCK: Currency Crisis — exchange markets in turmoil", type: "crisis" });
        break;
    }
  }

  // ── 13. Leaderboard visibility — always visible through all 4 rounds ────────
  // Leaderboard is hidden only after the game ends (round > MAX_ROUNDS), not during play.

  // ── 14. Clamp, credit rating, news headlines ────────────────────────────────
  // prevPrevStatesEarly was fetched upfront in the initial Promise.all
  const prevPrevStateMap = new Map(prevPrevStatesEarly.map((s) => [s.teamId, s]));

  for (const state of newStates) {
    state.gdpGrowth       = clamp(state.gdpGrowth, "gdpGrowth");
    state.inflation       = clamp(state.inflation, "inflation");
    state.unemployment    = clamp(state.unemployment, "unemployment");
    state.fiscalDeficit   = clamp(state.fiscalDeficit, "fiscalDeficit");
    state.currencyIndex   = clamp(state.currencyIndex, "currencyIndex");
    state.forexReserves   = clamp(state.forexReserves, "forexReserves");
    state.militaryStrength = clamp(state.militaryStrength, "militaryStrength");
    state.approvalRating  = clamp(state.approvalRating, "approvalRating");
    state.trustScore      = clamp(state.trustScore, "trustScore");
    state.cumulativeDebt  = clamp(state.cumulativeDebt, "cumulativeDebt");

    // Credit rating
    const prev = prevStateMap.get(state.teamId);
    let consecutiveLow = 0;
    if (prev && prev.fiscalDeficit < 2) {
      consecutiveLow = 1;
      const pp = prevPrevStateMap.get(state.teamId);
      if (pp && pp.fiscalDeficit < 2) consecutiveLow = 2;
    }
    const lostConflict = conflictResults.some(r => r.loserId === state.teamId);
    state.creditRating = updateCreditRating(prev?.creditRating ?? "A", state.fiscalDeficit, lostConflict, consecutiveLow);

    // News headlines
    const name = teamNames[state.teamId] || "Unknown";
    if (state.gdpGrowth > 5)
      news.push({ headline: `${name} posts stunning ${state.gdpGrowth.toFixed(1)}% GDP growth — markets rally`, type: "economic" });
    else if (state.gdpGrowth < 0)
      news.push({ headline: `RECESSION: ${name}'s economy contracts ${Math.abs(state.gdpGrowth).toFixed(1)}%`, type: "economic" });
    if (state.inflation > 10)
      news.push({ headline: `Inflation alarm: ${name} hits ${state.inflation.toFixed(1)}% — central bank under pressure`, type: "crisis" });
    if (state.currencyIndex < 70)
      news.push({ headline: `${name}'s currency in freefall — index at ${state.currencyIndex.toFixed(0)}`, type: "crisis" });
    if (state.fiscalDeficit > 8)
      news.push({ headline: `Credit agencies warn: ${name}'s deficit hits ${state.fiscalDeficit.toFixed(1)}% of GDP`, type: "economic" });
  }

  // ── 15. Validate all outputs before writing ─────────────────────────────────
  for (const state of newStates) {
    if (isNaN(state.gdp) || state.gdp <= 0) {
      throw new Error(`Invalid GDP for team ${state.teamId}: ${state.gdp}`);
    }
    if (isNaN(state.inflation)) {
      throw new Error(`Invalid inflation for team ${state.teamId}: ${state.inflation}`);
    }
    if (isNaN(state.gdpGrowth)) {
      throw new Error(`Invalid gdpGrowth for team ${state.teamId}: ${state.gdpGrowth}`);
    }
    // Final clamp pass to ensure no out-of-range values reach the DB
    state.gdp           = Math.max(100, state.gdp);
    state.gdpGrowth     = Math.max(-10, Math.min(20, state.gdpGrowth));
    state.inflation     = Math.max(-1, Math.min(25, state.inflation));
    state.currencyIndex = Math.max(10, Math.min(500, state.currencyIndex));
  }

  // ── 15b. Compute per-metric scores (stored in DB, read by dashboard + leaderboard) ─
  for (const state of newStates) {
    // GDP Score: max 30 pts
    const gdpScore =
      state.gdpGrowth >= 5  ? 30 :
      state.gdpGrowth >= 3  ? 25 :
      state.gdpGrowth >= 1  ? 18 :
      state.gdpGrowth >= 0  ? 10 :
      state.gdpGrowth >= -2 ? 3  : 0;

    // Inflation Score: max 30 pts (target 2–4%)
    const inf = state.inflation;
    const inflationScore =
      inf >= 2 && inf <= 4   ? 30 :
      inf >= 1 && inf <= 6   ? 22 :
      inf >= 0 && inf <= 8   ? 14 :
      inf >= 0 && inf <= 12  ? 6  : 0;

    // Fiscal Score: max 20 pts
    const fiscalScore =
      state.fiscalDeficit <= 2 ? 20 :
      state.fiscalDeficit <= 4 ? 15 :
      state.fiscalDeficit <= 6 ? 8  :
      state.fiscalDeficit <= 9 ? 3  : 0;

    // Forex Score: max 20 pts
    const forexScore =
      state.currencyIndex >= 105 ? 20 :
      state.currencyIndex >= 98  ? 16 :
      state.currencyIndex >= 90  ? 11 :
      state.currencyIndex >= 80  ? 6  : 0;

    (state as Record<string, unknown>).gdpScore       = gdpScore;
    (state as Record<string, unknown>).inflationScore = inflationScore;
    (state as Record<string, unknown>).fiscalScore    = fiscalScore;
    (state as Record<string, unknown>).forexScore     = forexScore;
  }

  // ── 16. Persist — deleteMany + createMany = 2 queries, Promise.all for news ─
  // NOTE: prisma.$transaction([...]) silently fails with PgBouncer in transaction
  // mode (Supabase). Use Promise.all of independent writes instead.
  await prisma.roundState.deleteMany({ where: { round } });
  await Promise.all([
    prisma.roundState.createMany({ data: newStates.map((s) => ({ ...s, round })) }),
    news.length > 0
      ? prisma.newsEvent.createMany({ data: news.map((item) => ({ round, headline: item.headline, type: item.type })) })
      : Promise.resolve(),
  ]);

  return news;
}
