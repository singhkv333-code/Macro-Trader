/**
 * V2 Simulation Formulas
 *
 * GDP Engine   — Cobb-Douglas production function
 * Inflation    — Modified Phillips Curve with monetary transmission
 * Fiscal       — Budget constraint + debt dynamics
 * Forex        — Interest rate differential + trade balance model
 * Approval     — Weighted composite of all outputs
 */

import { ENGINE_CONSTANTS } from "../constants";

const {
  gamma, delta, zeta, debtThreshold,
  lambda, omega, nu,
  chi, psi, theta,
  inflationTarget, piMax,
} = ENGINE_CONSTANTS;

// ─── Country Multiplier Shape ────────────────────────────────────────────────
export interface CountryMultipliers {
  productivityFactor: number;   // A_n
  tradeMultiplier: number;      // β_n (already ×1.5 in seed)
  monetaryPower: number;        // μ_n
  taxEfficiency: number;        // collect_eff
  potentialGrowth: number;      // g_potential_n (%)
  creditSpread: number;         // borrowing cost premium
  startingDebtToGdp: number;    // initial debt/GDP ratio
  rNeutral?: number;            // per-country neutral rate (optional, defaults to potentialGrowth + 2.0)
}

// ─── Population lookup (millions) for labor factor in production function ────
const POPULATION_M: Record<string, number> = {
  "India": 1420, "United States": 335, "China": 1410, "Germany": 84,
  "Japan": 124, "Brazil": 215, "United Kingdom": 67, "Russia": 144,
  "South Korea": 52, "Saudi Arabia": 35, "Nigeria": 220, "Australia": 26,
  "Turkey": 85, "Switzerland": 9, "Mexico": 130,
};

// ─── GDP Engine (Production Function) ───────────────────────────────────────
/**
 * gdpGrowth = production + trade + rateEffect - taxDrag - debtPenalty - resourcePenalty
 *
 * Returns GDP growth in % points.
 */
export function calculateGDPGrowth(params: {
  infraSpendingPct: number;     // 0–100% of budget allocation
  infraSpendBillions: number;   // $ billions spent on infra (= infraPct/100 × totalBudget_B)
  gdpBillions: number;          // current GDP in $B
  netExportsOverGDP: number;    // (exports - imports) / GDP
  interestRate: number;         // r (%)
  debtToGdp: number;            // cumulative debt / GDP ratio
  borrowingPct: number;         // new borrowing as % of GDP (fraction, not %)
  taxRatePct: number;           // tax rate as fraction (e.g., 0.20)
  imports: Record<string, number>; // commodity units imported
  countryName: string;          // for labor factor lookup
  multipliers: CountryMultipliers;
  baseGDPGrowth?: number;
}): number {
  const { infraSpendBillions, gdpBillions, netExportsOverGDP, interestRate,
          debtToGdp, borrowingPct, taxRatePct, imports, countryName, multipliers } = params;

  const rNeutral = multipliers.rNeutral ?? (multipliers.potentialGrowth + 2.0);
  const A = multipliers.productivityFactor;
  const beta = multipliers.tradeMultiplier;

  // 1. PRODUCTION — anchored to country's potential growth rate and productivity factor.
  // infraSpendingPct is the % of budget allocated to infra (0–100). Sweet spot is ~35%.
  // This prevents wild swings: a 20% infra team vs 50% infra team gets a smooth 0.6-power difference.
  const infraScale = Math.pow(Math.max(params.infraSpendingPct, 1) / 35, 0.6);
  const production = A * multipliers.potentialGrowth * infraScale * 0.75;

  // 2. TRADE — β_n × net_exports/GDP × scale factor
  const trade = beta * netExportsOverGDP * 4.0;

  // 3. INTEREST RATE — directional (stimulus below neutral, drag above)
  let rateEffect: number;
  if (interestRate > rNeutral) {
    const gap = (interestRate - rNeutral) / rNeutral;
    rateEffect = -0.5 * Math.pow(gap, 1.2);
  } else {
    const gap = (rNeutral - interestRate) / rNeutral;
    rateEffect = 0.3 * Math.pow(gap, 0.8);
  }

  // 4. TAX LAFFER DRAG — optimal 20-28%, penalty on both extremes
  const taxDrag = 25 * Math.pow(Math.max(0, taxRatePct - 0.28), 2)
                + 8  * Math.pow(Math.max(0, 0.12 - taxRatePct), 2);

  // 5. DEBT PENALTY — gradual from 40%, accelerating at 80%
  const totalDebt = debtToGdp + borrowingPct;
  let debtPenalty = 0;
  if (totalDebt >= 0.4 && totalDebt < 0.8) {
    debtPenalty = 0.25 * Math.pow((totalDebt - 0.4) / 0.4, 1.2);
  } else if (totalDebt >= 0.8) {
    debtPenalty = 0.25 + 0.35 * Math.pow(totalDebt - 0.8, 1.5);
  }

  // 6. RESOURCE PENALTY — simplified; 0.1% per unmet unit below 5 total imports
  const totalImports = Object.values(imports).reduce((s, q) => s + q, 0);
  const resourcePenalty = Math.max(0, 5 - totalImports) * 0.1;

  const gdpGrowth = production + trade + rateEffect - taxDrag - debtPenalty - resourcePenalty;
  return gdpGrowth; // in % points
}

// ─── Inflation Engine (Modified Phillips Curve) ──────────────────────────────
/**
 * π = 0.6 × π_prev + 0.4 × π_target          (inertia + anchoring)
 *   + 0.25 × (g - g_potential_n)              (output gap)
 *   - μ_n × (r - r_neutral) / (1 + 0.3×debt) (monetary, less weakened by debt)
 *   + 0.10 × importPriceChange                (import inflation pass-through)
 *   + 0.15 × max(0, deficit - 3%)             (fiscal inflation above 3%)
 */
export function calculateInflation(params: {
  prevInflation: number;
  gdpGrowth: number;
  interestRate: number;
  debtToGdp: number;
  importFraction: number;       // fraction of GDP spent on imports
  fxRateChange: number;         // % change in currency (kept for API compatibility)
  budgetDeficitPct: number;     // deficit as % of GDP
  importPriceChange?: number;   // change in import cost index (0 if no trade round)
  multipliers: CountryMultipliers;
}): number {
  const { prevInflation, gdpGrowth, interestRate, debtToGdp,
          budgetDeficitPct, multipliers } = params;
  const importPriceChange = params.importPriceChange ?? 0;

  const rNeutral = multipliers.rNeutral ?? (multipliers.potentialGrowth + 2.0);
  const piTarget = 2.0;

  // 1. INERTIA + ANCHORING — 60% carry, 40% target pull
  const base = 0.6 * prevInflation + 0.4 * piTarget;

  // 2. OUTPUT GAP — coefficient 0.25
  const outputGap = 0.25 * (gdpGrowth - multipliers.potentialGrowth);

  // 3. MONETARY EFFECT — less weakened by debt (0.3× instead of 1×)
  const monetary = multipliers.monetaryPower * (interestRate - rNeutral)
                   / (1 + 0.3 * debtToGdp);

  // 4. IMPORT INFLATION — 10% pass-through
  const importInflation = 0.10 * importPriceChange;

  // 5. FISCAL INFLATION — only kicks in above 3% deficit
  const fiscalInflation = 0.15 * Math.max(0, budgetDeficitPct - 3.0);

  const inflation = base + outputGap - monetary + importInflation + fiscalInflation;
  return Math.max(-1.0, inflation); // Floor at -1% (mild deflation)
}

// ─── Fiscal Engine ──────────────────────────────────────────────────────────
export function calculateRevenue(gdpPrev: number, taxRate: number, taxEfficiency: number): number {
  return gdpPrev * (taxRate / 100) * taxEfficiency;
}

export function calculateDebtService(cumulativeDebt: number, gdp: number, baseRate: number, creditSpread: number): number {
  const debtAmount = (cumulativeDebt / 100) * gdp;
  return debtAmount * (baseRate / 100 + creditSpread);
}

export function calculateFiscalDeficit(params: {
  totalSpending: number;      // infra + subsidies + defense (in GDP units)
  revenue: number;
  tradeIncome: number;
  borrowing: number;          // % of GDP
  gdp: number;
  debtService: number;
}): { deficit: number; newBudget: number } {
  const { totalSpending, revenue, tradeIncome, borrowing, gdp, debtService } = params;
  const borrowingAmount = (borrowing / 100) * gdp;
  const totalInflow = revenue + tradeIncome + borrowingAmount;
  const totalOutflow = totalSpending + debtService;
  const deficit = (totalOutflow - totalInflow) / gdp * 100; // as % of GDP
  const newBudget = Math.max(0, totalInflow - totalOutflow);
  return { deficit, newBudget };
}

// ─── Forex Engine ───────────────────────────────────────────────────────────
/**
 * dFX = χ × (r - r_world_avg)
 *     - ψ × (π - π_world_avg)
 *     + θ × trade_balance / GDP_norm
 *     - κ × capital_outflow_risk
 *
 * Returns delta to currencyIndex (base 100).
 */
export function calculateForexDelta(params: {
  interestRate: number;
  worldAvgInterestRate: number;
  inflation: number;
  worldAvgInflation: number;
  tradeBalance: number;         // net export surplus in units
  gdpScale: number;             // GDP in billions (for normalization)
  capitalOutflowRisk: number;   // 0–1 risk factor (sanctions, instability)
}): number {
  const { interestRate, worldAvgInterestRate, inflation, worldAvgInflation, tradeBalance, gdpScale, capitalOutflowRisk } = params;

  // Interest rate differential attracting/repelling capital
  const rateDiff = chi * (interestRate - worldAvgInterestRate);

  // Inflation differential weakens currency
  const inflationDiff = psi * (inflation - worldAvgInflation);

  // Trade balance: surplus strengthens currency
  const tradeEffect = theta * (tradeBalance / Math.max(gdpScale * 0.01, 1));

  // Capital flight from risk
  const capitalFlight = capitalOutflowRisk * 5; // up to -5 per unit risk

  return rateDiff - inflationDiff + tradeEffect - capitalFlight;
}

// ─── Approval Engine ────────────────────────────────────────────────────────
/**
 * Approval = 30 × normalize(GDP_growth)
 *          + 25 × (1 - π / π_max)
 *          + 20 × fiscal_health
 *          + 15 × trade_performance
 *          + 10 × diplomacy_factor
 */
export function calculateApproval(params: {
  gdpGrowth: number;
  inflation: number;
  fiscalDeficit: number;
  tradeBalance: number;
  diplomacyScore: number;
  prevApproval: number;
}): number {
  const { gdpGrowth, inflation, fiscalDeficit, tradeBalance, diplomacyScore, prevApproval } = params;

  // GDP component: full 30 pts at 5%+ growth, 0 at -5%
  const gdpComponent = 30 * Math.max(0, Math.min(1, (gdpGrowth + 5) / 10));

  // Inflation component: best at 2%, zero at piMax
  const inflationComponent = 25 * Math.max(0, 1 - Math.abs(inflation - inflationTarget) / piMax);

  // Fiscal health: better when deficit < 3%, worsens above
  const fiscalComponent = 20 * Math.max(0, 1 - Math.max(0, fiscalDeficit - 0) / 15);

  // Trade performance
  const tradeComponent = 15 * Math.max(0, Math.min(1, (tradeBalance + 10) / 20));

  // Diplomacy
  const diplomacyComponent = 10 * Math.max(0, Math.min(1, diplomacyScore / 50));

  const rawApproval = gdpComponent + inflationComponent + fiscalComponent + tradeComponent + diplomacyComponent;

  // Smooth with 60% current + 40% previous (prevents wild swings)
  return 0.6 * rawApproval + 0.4 * prevApproval;
}

// ─── World Market Pricing ────────────────────────────────────────────────────
/**
 * World_Price_i = Base_Price_i × (Total_Demand_i / Total_Supply_i)^0.3
 * Dampened exponent prevents extreme swings.
 */
export function calculateWorldPrice(basePrice: number, totalDemand: number, totalSupply: number): number {
  if (totalSupply <= 0) return basePrice * 2; // extreme scarcity
  const ratio = totalDemand / totalSupply;
  return basePrice * Math.pow(ratio, 0.3);
}

// ─── Trade Income ────────────────────────────────────────────────────────────
export function calculateTradeIncome(exports: Record<string, number>, imports: Record<string, number>, worldPrices: Record<string, number>): number {
  let income = 0;
  for (const [commodity, qty] of Object.entries(exports)) {
    income += qty * (worldPrices[commodity] ?? 0);
  }
  for (const [commodity, qty] of Object.entries(imports)) {
    income -= qty * (worldPrices[commodity] ?? 0);
  }
  return income;
}

// ─── Diplomacy Score ────────────────────────────────────────────────────────
/**
 * Formula: deals×2 + alliances×3 - sanctions_initiated×4 - treaties_broken×8 + aid×2
 */
export function calculateDiplomacyDelta(params: {
  tradeDealsFormed: number;
  alliancesFormed: number;
  sanctionsInitiated: number;
  alliancesBroken: number;
}): number {
  return (
    params.tradeDealsFormed * 2
    + params.alliancesFormed * 3
    - params.sanctionsInitiated * 4
    - params.alliancesBroken * 8
  );
}

// ─── Credit Rating Update ────────────────────────────────────────────────────
import { CREDIT_RATINGS } from "../constants";

export function updateCreditRating(
  currentRating: string,
  deficitPct: number,
  lostConflict: boolean,
  consecutiveLowDeficitRounds: number
): string {
  let idx = CREDIT_RATINGS.indexOf(currentRating);
  if (idx === -1) idx = 2; // default to "A"

  if (deficitPct > 8)      idx = Math.min(idx + 2, CREDIT_RATINGS.length - 1);
  else if (deficitPct > 5) idx = Math.min(idx + 1, CREDIT_RATINGS.length - 1);

  if (lostConflict) idx = Math.min(idx + 1, CREDIT_RATINGS.length - 1);

  if (consecutiveLowDeficitRounds >= 2 && deficitPct < 2) {
    idx = Math.max(idx - 1, 0);
  }

  return CREDIT_RATINGS[idx];
}

// ─── Concrete Budget Calculation ─────────────────────────────────────────────
export function calculateBudget(params: {
  gdpBillions: number;
  taxRate: number;        // fraction (0.20 = 20%)
  taxEfficiency: number;
  debtToGdp: number;     // ratio (0.82 = 82%)
  creditSpread: number;
  borrowingPct: number;  // fraction (0.05 = 5% of GDP)
}): {
  revenue: number;
  debtService: number;
  netBudget: number;
  borrowed: number;
  totalBudget: number;
  deficitPct: number;
  newDebtToGdp: number;
} {
  const { gdpBillions, taxRate, taxEfficiency, debtToGdp, creditSpread, borrowingPct } = params;
  const revenue     = gdpBillions * taxRate * taxEfficiency;
  const debtService = (debtToGdp * gdpBillions) * (0.02 + creditSpread);
  const netBudget   = Math.max(0, revenue - debtService);
  const borrowed    = borrowingPct * gdpBillions;
  const totalBudget = netBudget + borrowed;
  return {
    revenue, debtService, netBudget, borrowed, totalBudget,
    deficitPct: (borrowed / Math.max(gdpBillions, 1)) * 100,
    newDebtToGdp: debtToGdp + borrowingPct,
  };
}

// ─── Legacy V1 Helpers (kept for backward compatibility in UI/display) ───────
export function taxRateImpact(rate: number) {
  const baseline = 20;
  const diff = rate - baseline;
  return { gdpGrowth: diff * -0.08, unemployment: diff * 0.06 };
}

export function subsidySpendingImpact(pct: number) {
  const pctOfGDP = pct / 10;
  // Reduced unemployment coefficient to 0.2 (was 0.6) — prevents unemployment collapsing in 1-2 rounds
  return { unemployment: pctOfGDP * -0.2, approvalRating: pctOfGDP * 3, inflation: pctOfGDP * 0.2 };
}

export function defenseSpendingImpact(pct: number) {
  const pctOfGDP = pct / 10;
  return { militaryStrength: pctOfGDP * 8, gdpGrowth: pctOfGDP * -0.1 };
}
