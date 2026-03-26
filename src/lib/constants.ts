// ─── Game Configuration ──────────────────────────────────────────────────────────
export const MAX_ROUNDS = 4;

// ─── Initial State (used for new teams when no round-0 state exists) ───────────
export const INITIAL_STATE = {
  gdp: 1000,
  gdpGrowth: 3.0,
  inflation: 4.0,
  unemployment: 6.0,
  fiscalDeficit: 0,
  currencyIndex: 100,
  forexReserves: 200,
  militaryStrength: 50,
  approvalRating: 60,
  tradeIncome: 50,
  taxRevenue: 200,
  creditRating: "A",
  trustScore: 80,
  tradeBalance: 0,
  diplomacyScore: 0,
  treasury: 0,
  cumulativeDebt: 0,
};

// ─── Clamping Limits ────────────────────────────────────────────────────────────
export const CLAMPS = {
  gdpGrowth:       { min: -5.0, max: 10.0 },
  inflation:       { min: 0.0,  max: 20.0 },
  unemployment:    { min: 1.0,  max: 15.0 },
  fiscalDeficit:   { min: -2.0, max: 15.0 },
  currencyIndex:   { min: 40,   max: 160   },
  forexReserves:   { min: 0,    max: 500   },
  militaryStrength:{ min: 10,   max: 200   },
  approvalRating:  { min: 5,    max: 95    },
  trustScore:      { min: 0,    max: 100   },
  cumulativeDebt:  { min: 0,    max: 500   },
};

// ─── Credit Rating Ladder ───────────────────────────────────────────────────────
export const CREDIT_RATINGS = ["AAA", "AA", "A", "BBB", "BB", "B", "junk"];

// ─── Decision Input Limits ──────────────────────────────────────────────────────
export const DECISION_LIMITS = {
  interestRate:        { min: 1.0, max: 15.0, step: 0.1 },
  taxRate:             { min: 10,  max: 35,   step: 1   },
  borrowing:           { min: 0,   max: 15,   step: 0.5 }, // up to 15% of GDP in V2
  tradeOpenness:       { min: 0.0, max: 1.0,  step: 0.1 }, // 0=protectionist, 1=fully open
  commodityQuantity:   { min: 0,   max: 15,   step: 1   }, // units per commodity
  maxInterestRateChange: 1.0,
};

// ─── Commodity Base Prices ──────────────────────────────────────────────────────
export const COMMODITY_BASE_PRICES: Record<string, number> = {
  oil:      100,
  metals:   80,
  food:     60,
  semis:    150,
  pharma:   120,
  textiles: 40,
};

export const COMMODITY_LABELS: Record<string, string> = {
  oil:      "Oil & Gas",
  metals:   "Metals & Minerals",
  food:     "Food & Agriculture",
  semis:    "Semiconductors",
  pharma:   "Pharmaceuticals",
  textiles: "Textiles & Consumer Goods",
};

// ─── 15 Real-World Nations ─────────────────────────────────────────────────────
// flagEmoji, color used for UI display
export const DEFAULT_TEAMS = [
  { name: "India",        flagEmoji: "🇮🇳", color: "#FF6B35" },
  { name: "United States",flagEmoji: "🇺🇸", color: "#2E75B6" },
  { name: "China",        flagEmoji: "🇨🇳", color: "#C0392B" },
  { name: "Germany",      flagEmoji: "🇩🇪", color: "#2C3E50" },
  { name: "Japan",        flagEmoji: "🇯🇵", color: "#E8792F" },
  { name: "Brazil",       flagEmoji: "🇧🇷", color: "#27AE60" },
  { name: "United Kingdom",flagEmoji:"🇬🇧", color: "#8E44AD" },
  { name: "Russia",       flagEmoji: "🇷🇺", color: "#C0392B" },
  { name: "South Korea",  flagEmoji: "🇰🇷", color: "#16A085" },
  { name: "Saudi Arabia", flagEmoji: "🇸🇦", color: "#D4AF37" },
  { name: "Nigeria",      flagEmoji: "🇳🇬", color: "#27AE60" },
  { name: "Australia",    flagEmoji: "🇦🇺", color: "#1ABC9C" },
  { name: "Turkey",       flagEmoji: "🇹🇷", color: "#E74C3C" },
  { name: "Switzerland",  flagEmoji: "🇨🇭", color: "#E8003D" },
  { name: "Mexico",       flagEmoji: "🇲🇽", color: "#006847" },
];

// ─── Round Scenarios (V2: 4 rounds) ────────────────────────────────────────────
export const ROUND_SCENARIOS: Record<number, {
  title: string;
  description: string;
  mechanicText: string;
  tradeEnabled: boolean;
  conflictsEnabled: boolean;
  effects: {
    inflationAdd?: number;
    gdpGrowthAdd?: number;
    effectMultiplier?: number;
    leaderboardVisible?: boolean;
    governanceCrisisThreshold?: number; // approval < this triggers -20% penalty
  };
}> = {
  1: {
    title: "Foundation",
    description: "Peacetime. No trade between nations. Teams inherit starting conditions and must stabilize domestically. Learn the controls.",
    mechanicText: "No trade or diplomatic actions this round. Focus on interest rate, tax, budget, and borrowing.",
    tradeEnabled: false,
    conflictsEnabled: false,
    effects: {},
  },
  2: {
    title: "Open Borders",
    description: "Trade unlocks. Nations can now use Export/Import policies, Trade Openness, and Diplomatic Actions. World Market activates.",
    mechanicText: "Trade and diplomacy are now ENABLED. World Market Pricing activates — commodity prices shift based on supply and demand.",
    tradeEnabled: true,
    conflictsEnabled: false,
    effects: {},
  },
  3: {
    title: "Oil Shock & Conflict",
    description: "Global oil crisis strikes — all nations face +2% inflation shock. Wars and sanctions are now available. Energy exporters gain leverage.",
    mechanicText: "+2% inflation base shock for all nations. Military conflicts and sanctions are now ENABLED. Oil exporters benefit; oil importers suffer.",
    tradeEnabled: true,
    conflictsEnabled: true,
    effects: { inflationAdd: 2.0 },
  },
  4: {
    title: "Endgame",
    description: "All engine effects are amplified 1.5×. Leaderboard goes dark. Governance crisis if approval < 30.",
    mechanicText: "ALL effects ×1.5 this round. Leaderboard HIDDEN (fog of war). Approval < 30 → governance crisis (-20% on all outputs).",
    tradeEnabled: true,
    conflictsEnabled: true,
    effects: {
      effectMultiplier: 1.5,
      leaderboardVisible: false,
      governanceCrisisThreshold: 30,
    },
  },
};

// ─── Global Events (admin-triggered) ────────────────────────────────────────────
export const GLOBAL_EVENT_DETAILS: Record<string, {
  label: string;
  description: string;
  mechanicText: string;
  color: string;
}> = {
  oil_crisis: {
    label: "Oil Crisis",
    description: "Global oil prices double overnight. Energy costs skyrocket across all nations.",
    mechanicText: "+2.0% inflation, -1.0% GDP growth for all nations. Oil-exporting nations immune.",
    color: "text-orange-400",
  },
  pandemic: {
    label: "Pandemic",
    description: "A global pandemic sweeps across nations, disrupting supply chains and labor markets.",
    mechanicText: "-2.0% GDP growth, +1.5% unemployment for all nations.",
    color: "text-red-400",
  },
  currency_crisis: {
    label: "Currency Crisis",
    description: "A major currency crisis erupts. Exchange markets are in turmoil worldwide.",
    mechanicText: "-10 currency index, +1.5% inflation for all nations.",
    color: "text-yellow-400",
  },
  fog_of_war: {
    label: "Fog of War",
    description: "Intelligence blackout. All inter-nation data is hidden.",
    mechanicText: "Leaderboard hidden. Other nations' metrics show '???'.",
    color: "text-gray-400",
  },
};

// ─── V2 Scoring Weights (total = 100 pts) ───────────────────────────────────────
// GDP Growth: 25 pts | Inflation Stability: 25 pts | Budget Deficit: 15 pts
// Trade & Forex: 20 pts | Diplomacy Grade: 15 pts
export const SCORING_WEIGHTS = {
  cumulativeGDP:      25,  // sum of GDP growth % across rounds
  inflationStability: 25,  // distance from 2% target
  fiscalDiscipline:   15,  // lower deficit/GDP = better
  tradeBalance:       20,  // currency stability + trade surplus
  diplomaticScore:    15,  // deals × value + alliances - penalties
};

// ─── V2 Global Engine Constants ─────────────────────────────────────────────────
export const ENGINE_CONSTANTS = {
  gamma:       0.4,   // interest rate drag coefficient (γ)
  delta:       0.3,   // FDI boost coefficient (δ)
  zeta:        0.5,   // debt penalty coefficient (ζ, activates > 60% debt/GDP)
  debtThreshold: 0.6, // debt/GDP above which penalty activates
  lambda:      0.25,  // output gap → inflation coefficient (λ)
  omega:       0.10,  // import-driven inflation coefficient (ω)
  nu:          0.15,  // fiscal deficit → inflation coefficient (ν)
  chi:         0.6,   // interest rate differential → FX (χ)
  psi:         0.4,   // inflation differential → FX (ψ)
  theta:       0.3,   // trade balance → FX (θ)
  inflationTarget: 2.0, // π_target (%)
  // NOTE: rNeutral is now per-country = potentialGrowth + 2.0 (set in CountryMultipliers)
  piMax:       15.0,  // max inflation before approval contribution is zero
};
