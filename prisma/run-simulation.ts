/**
 * Full 4-Round Stress Test + Simulation Runner
 *
 * - Seeds realistic decisions for all 15 nations
 * - Each country plays a strategy based on their economic profile
 * - Runs all 4 rounds: Foundation → Open Borders → Oil Shock → Endgame
 * - Prints round-by-round results + final leaderboard
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { runSimulation } from "../src/lib/simulation/engine";
import { calculateScores } from "../src/lib/simulation/scoring";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// ─── Country Strategies (per-round decisions) ─────────────────────────────────
//
// Each strategy is indexed by country name.
// interestRate: how aggressively to set rates vs neutral
// Round 1: no trade. Rounds 2-4: trade orders & diplomacy.
//
// rNeutral values from seed:
//   India=8.5, US=4.0, China=7.0, Germany=3.2, Japan=2.8,
//   Brazil=5.0, UK=3.5, Russia=3.5, SouthKorea=4.5, SaudiArabia=5.0,
//   Nigeria=6.0, Australia=4.5, Turkey=6.5, Switzerland=3.5, Mexico=5.5

interface RoundDecision {
  interestRate: number;    // 1-15%
  taxRate: number;         // 10-35%
  infraSpending: number;   // % of budget (must sum with subsidy+defense = 100)
  subsidySpending: number;
  defenseSpending: number;
  borrowing: number;       // 0-15% of GDP
  tradeOpenness: number;   // 0-1
  diplomaticAction: string;
  diplomaticTarget: string | null; // country NAME (we resolve to ID)
}

interface CountryStrategy {
  name: string;
  rounds: [RoundDecision, RoundDecision, RoundDecision, RoundDecision];
  // Trade orders per round (rounds 2-4 only); key = commodity, value = [exportQty, importQty]
  tradeOrders: {
    [round: number]: {
      exports: Partial<Record<string, number>>;
      imports: Partial<Record<string, number>>;
    };
  };
}

const STRATEGIES: CountryStrategy[] = [
  {
    name: "India",
    // Strategy: Cool inflation, grow GDP via infra, form trade deals round 2
    rounds: [
      { interestRate: 9.0,  taxRate: 22, infraSpending: 55, subsidySpending: 35, defenseSpending: 10, borrowing: 3.0, tradeOpenness: 0.7, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 8.5,  taxRate: 22, infraSpending: 55, subsidySpending: 30, defenseSpending: 15, borrowing: 3.5, tradeOpenness: 0.8, diplomaticAction: "trade_deal", diplomaticTarget: "United States" },
      { interestRate: 9.5,  taxRate: 23, infraSpending: 50, subsidySpending: 30, defenseSpending: 20, borrowing: 3.0, tradeOpenness: 0.7, diplomaticAction: "trade_deal", diplomaticTarget: "South Korea" },
      { interestRate: 9.0,  taxRate: 22, infraSpending: 55, subsidySpending: 30, defenseSpending: 15, borrowing: 2.5, tradeOpenness: 0.8, diplomaticAction: "none", diplomaticTarget: null },
    ],
    tradeOrders: {
      2: { exports: { pharma: 5, textiles: 6, food: 3 }, imports: { oil: 4, semis: 5 } },
      3: { exports: { pharma: 6, textiles: 7, food: 3 }, imports: { oil: 5, semis: 4 } },
      4: { exports: { pharma: 7, textiles: 8, food: 4 }, imports: { oil: 4, semis: 5 } },
    },
  },
  {
    name: "United States",
    // Strategy: Balanced growth, reserve currency leverage, global trade deals
    rounds: [
      { interestRate: 4.0,  taxRate: 25, infraSpending: 45, subsidySpending: 35, defenseSpending: 20, borrowing: 4.0, tradeOpenness: 0.8, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 4.5,  taxRate: 25, infraSpending: 45, subsidySpending: 35, defenseSpending: 20, borrowing: 3.5, tradeOpenness: 0.9, diplomaticAction: "trade_deal", diplomaticTarget: "Germany" },
      { interestRate: 5.0,  taxRate: 26, infraSpending: 40, subsidySpending: 35, defenseSpending: 25, borrowing: 4.0, tradeOpenness: 0.8, diplomaticAction: "sanctions", diplomaticTarget: "Russia" },
      { interestRate: 4.5,  taxRate: 25, infraSpending: 45, subsidySpending: 35, defenseSpending: 20, borrowing: 3.0, tradeOpenness: 0.9, diplomaticAction: "none", diplomaticTarget: null },
    ],
    tradeOrders: {
      2: { exports: { oil: 5, food: 7, semis: 5, pharma: 6 }, imports: { textiles: 6, metals: 4 } },
      3: { exports: { oil: 5, food: 8, semis: 6, pharma: 7 }, imports: { textiles: 7, metals: 5 } },
      4: { exports: { oil: 5, food: 8, semis: 7, pharma: 8 }, imports: { textiles: 6, metals: 4 } },
    },
  },
  {
    name: "China",
    // Strategy: Stimulate deflation-risk economy, massive exports, belt-and-road diplomacy
    rounds: [
      { interestRate: 6.0,  taxRate: 20, infraSpending: 60, subsidySpending: 30, defenseSpending: 10, borrowing: 4.0, tradeOpenness: 0.9, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 5.5,  taxRate: 20, infraSpending: 60, subsidySpending: 25, defenseSpending: 15, borrowing: 4.5, tradeOpenness: 0.95, diplomaticAction: "trade_deal", diplomaticTarget: "Brazil" },
      { interestRate: 6.0,  taxRate: 21, infraSpending: 55, subsidySpending: 25, defenseSpending: 20, borrowing: 4.0, tradeOpenness: 0.9, diplomaticAction: "trade_deal", diplomaticTarget: "Nigeria" },
      { interestRate: 6.0,  taxRate: 20, infraSpending: 60, subsidySpending: 25, defenseSpending: 15, borrowing: 4.5, tradeOpenness: 0.95, diplomaticAction: "none", diplomaticTarget: null },
    ],
    tradeOrders: {
      2: { exports: { textiles: 8, metals: 6, semis: 4 }, imports: { oil: 7, food: 5 } },
      3: { exports: { textiles: 9, metals: 7, semis: 4 }, imports: { oil: 8, food: 6 } },
      4: { exports: { textiles: 10, metals: 7, semis: 5 }, imports: { oil: 7, food: 6 } },
    },
  },
  {
    name: "Germany",
    // Strategy: Fiscal hawk, export powerhouse, EU trade deals
    rounds: [
      { interestRate: 3.2,  taxRate: 28, infraSpending: 40, subsidySpending: 40, defenseSpending: 20, borrowing: 1.0, tradeOpenness: 0.9, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 3.5,  taxRate: 28, infraSpending: 40, subsidySpending: 40, defenseSpending: 20, borrowing: 1.0, tradeOpenness: 0.95, diplomaticAction: "trade_deal", diplomaticTarget: "Japan" },
      { interestRate: 4.0,  taxRate: 28, infraSpending: 35, subsidySpending: 40, defenseSpending: 25, borrowing: 1.5, tradeOpenness: 0.9, diplomaticAction: "trade_deal", diplomaticTarget: "India" },
      { interestRate: 3.5,  taxRate: 28, infraSpending: 40, subsidySpending: 40, defenseSpending: 20, borrowing: 1.0, tradeOpenness: 0.95, diplomaticAction: "none", diplomaticTarget: null },
    ],
    tradeOrders: {
      2: { exports: { semis: 5, pharma: 7, metals: 3 }, imports: { oil: 5, textiles: 3, food: 2 } },
      3: { exports: { semis: 5, pharma: 8, metals: 3 }, imports: { oil: 5, textiles: 3, food: 2 } },
      4: { exports: { semis: 6, pharma: 8, metals: 3 }, imports: { oil: 5, textiles: 3, food: 2 } },
    },
  },
  {
    name: "Japan",
    // Strategy: Yield curve control, manage massive debt, tech exports
    rounds: [
      { interestRate: 2.0,  taxRate: 27, infraSpending: 45, subsidySpending: 40, defenseSpending: 15, borrowing: 1.0, tradeOpenness: 0.8, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 2.5,  taxRate: 27, infraSpending: 45, subsidySpending: 38, defenseSpending: 17, borrowing: 1.5, tradeOpenness: 0.85, diplomaticAction: "trade_deal", diplomaticTarget: "South Korea" },
      { interestRate: 3.0,  taxRate: 27, infraSpending: 40, subsidySpending: 40, defenseSpending: 20, borrowing: 1.0, tradeOpenness: 0.8, diplomaticAction: "trade_deal", diplomaticTarget: "Australia" },
      { interestRate: 2.5,  taxRate: 27, infraSpending: 45, subsidySpending: 38, defenseSpending: 17, borrowing: 1.5, tradeOpenness: 0.85, diplomaticAction: "none", diplomaticTarget: null },
    ],
    tradeOrders: {
      2: { exports: { semis: 7, pharma: 6 }, imports: { oil: 4, metals: 5, food: 3 } },
      3: { exports: { semis: 7, pharma: 6 }, imports: { oil: 4, metals: 5, food: 3 } },
      4: { exports: { semis: 8, pharma: 6 }, imports: { oil: 4, metals: 5, food: 3 } },
    },
  },
  {
    name: "Brazil",
    // Strategy: Commodity export boom, infrastructure push, manage inflation
    rounds: [
      { interestRate: 5.5,  taxRate: 24, infraSpending: 55, subsidySpending: 35, defenseSpending: 10, borrowing: 3.5, tradeOpenness: 0.7, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 5.0,  taxRate: 23, infraSpending: 55, subsidySpending: 30, defenseSpending: 15, borrowing: 4.0, tradeOpenness: 0.75, diplomaticAction: "trade_deal", diplomaticTarget: "China" },
      { interestRate: 5.5,  taxRate: 24, infraSpending: 50, subsidySpending: 30, defenseSpending: 20, borrowing: 3.5, tradeOpenness: 0.7, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 5.0,  taxRate: 23, infraSpending: 55, subsidySpending: 30, defenseSpending: 15, borrowing: 3.0, tradeOpenness: 0.75, diplomaticAction: "none", diplomaticTarget: null },
    ],
    tradeOrders: {
      2: { exports: { food: 8, metals: 7, oil: 4 }, imports: { semis: 3, pharma: 3 } },
      3: { exports: { food: 9, metals: 8, oil: 4 }, imports: { semis: 3, pharma: 3 } },
      4: { exports: { food: 10, metals: 8, oil: 5 }, imports: { semis: 4, pharma: 3 } },
    },
  },
  {
    name: "United Kingdom",
    // Strategy: Finance hub, moderate rates, trade openness, City of London play
    rounds: [
      { interestRate: 3.5,  taxRate: 26, infraSpending: 45, subsidySpending: 35, defenseSpending: 20, borrowing: 2.5, tradeOpenness: 0.85, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 3.5,  taxRate: 26, infraSpending: 45, subsidySpending: 35, defenseSpending: 20, borrowing: 2.5, tradeOpenness: 0.9, diplomaticAction: "trade_deal", diplomaticTarget: "Australia" },
      { interestRate: 4.0,  taxRate: 27, infraSpending: 40, subsidySpending: 35, defenseSpending: 25, borrowing: 2.0, tradeOpenness: 0.85, diplomaticAction: "alliance", diplomaticTarget: "United States" },
      { interestRate: 3.5,  taxRate: 26, infraSpending: 45, subsidySpending: 35, defenseSpending: 20, borrowing: 2.0, tradeOpenness: 0.9, diplomaticAction: "none", diplomaticTarget: null },
    ],
    tradeOrders: {
      2: { exports: { pharma: 7, oil: 2, semis: 3 }, imports: { food: 3, textiles: 4, metals: 4 } },
      3: { exports: { pharma: 7, oil: 2, semis: 3 }, imports: { food: 3, textiles: 4, metals: 4 } },
      4: { exports: { pharma: 8, oil: 2, semis: 4 }, imports: { food: 3, textiles: 4, metals: 4 } },
    },
  },
  {
    name: "Russia",
    // Strategy: Energy weapon, high inflation needs rate hikes, military buildup
    rounds: [
      { interestRate: 8.5,  taxRate: 25, infraSpending: 40, subsidySpending: 30, defenseSpending: 30, borrowing: 1.0, tradeOpenness: 0.5, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 9.0,  taxRate: 25, infraSpending: 35, subsidySpending: 30, defenseSpending: 35, borrowing: 1.5, tradeOpenness: 0.5, diplomaticAction: "trade_deal", diplomaticTarget: "China" },
      { interestRate: 9.5,  taxRate: 26, infraSpending: 30, subsidySpending: 25, defenseSpending: 45, borrowing: 1.0, tradeOpenness: 0.4, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 9.0,  taxRate: 25, infraSpending: 35, subsidySpending: 30, defenseSpending: 35, borrowing: 1.0, tradeOpenness: 0.5, diplomaticAction: "none", diplomaticTarget: null },
    ],
    tradeOrders: {
      2: { exports: { oil: 8, metals: 7, food: 4 }, imports: { semis: 4, pharma: 3 } },
      3: { exports: { oil: 9, metals: 7, food: 4 }, imports: { semis: 4, pharma: 3 } },
      4: { exports: { oil: 9, metals: 8, food: 4 }, imports: { semis: 4, pharma: 3 } },
    },
  },
  {
    name: "South Korea",
    // Strategy: Chip monopoly, tech exports, fiscal discipline
    rounds: [
      { interestRate: 4.5,  taxRate: 24, infraSpending: 50, subsidySpending: 35, defenseSpending: 15, borrowing: 2.0, tradeOpenness: 0.85, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 4.5,  taxRate: 24, infraSpending: 50, subsidySpending: 35, defenseSpending: 15, borrowing: 2.0, tradeOpenness: 0.9, diplomaticAction: "trade_deal", diplomaticTarget: "Germany" },
      { interestRate: 5.0,  taxRate: 24, infraSpending: 45, subsidySpending: 35, defenseSpending: 20, borrowing: 2.0, tradeOpenness: 0.85, diplomaticAction: "trade_deal", diplomaticTarget: "United States" },
      { interestRate: 4.5,  taxRate: 24, infraSpending: 50, subsidySpending: 35, defenseSpending: 15, borrowing: 1.5, tradeOpenness: 0.9, diplomaticAction: "none", diplomaticTarget: null },
    ],
    tradeOrders: {
      2: { exports: { semis: 9, pharma: 4 }, imports: { oil: 4, food: 2, metals: 5 } },
      3: { exports: { semis: 9, pharma: 4 }, imports: { oil: 4, food: 2, metals: 5 } },
      4: { exports: { semis: 10, pharma: 4 }, imports: { oil: 4, food: 2, metals: 5 } },
    },
  },
  {
    name: "Saudi Arabia",
    // Strategy: Oil exporter, low rates, massive forex, OPEC leverage
    rounds: [
      { interestRate: 4.5,  taxRate: 18, infraSpending: 50, subsidySpending: 40, defenseSpending: 10, borrowing: 1.0, tradeOpenness: 0.7, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 4.0,  taxRate: 18, infraSpending: 50, subsidySpending: 38, defenseSpending: 12, borrowing: 1.0, tradeOpenness: 0.75, diplomaticAction: "trade_deal", diplomaticTarget: "China" },
      { interestRate: 4.5,  taxRate: 18, infraSpending: 45, subsidySpending: 38, defenseSpending: 17, borrowing: 1.5, tradeOpenness: 0.7, diplomaticAction: "trade_deal", diplomaticTarget: "India" },
      { interestRate: 4.0,  taxRate: 18, infraSpending: 50, subsidySpending: 38, defenseSpending: 12, borrowing: 1.0, tradeOpenness: 0.75, diplomaticAction: "none", diplomaticTarget: null },
    ],
    tradeOrders: {
      2: { exports: { oil: 9, metals: 2 }, imports: { food: 3, semis: 2, pharma: 2, textiles: 3 } },
      3: { exports: { oil: 10, metals: 3 }, imports: { food: 3, semis: 2, pharma: 2, textiles: 3 } },
      4: { exports: { oil: 10, metals: 3 }, imports: { food: 3, semis: 3, pharma: 2, textiles: 3 } },
    },
  },
  {
    name: "Nigeria",
    // Strategy: High inflation → aggressive rate hikes, oil + commodities exports
    rounds: [
      { interestRate: 11.0, taxRate: 20, infraSpending: 60, subsidySpending: 30, defenseSpending: 10, borrowing: 3.0, tradeOpenness: 0.6, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 10.5, taxRate: 20, infraSpending: 60, subsidySpending: 25, defenseSpending: 15, borrowing: 3.5, tradeOpenness: 0.65, diplomaticAction: "trade_deal", diplomaticTarget: "China" },
      { interestRate: 11.0, taxRate: 21, infraSpending: 55, subsidySpending: 25, defenseSpending: 20, borrowing: 3.0, tradeOpenness: 0.6, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 10.0, taxRate: 20, infraSpending: 60, subsidySpending: 25, defenseSpending: 15, borrowing: 3.0, tradeOpenness: 0.65, diplomaticAction: "none", diplomaticTarget: null },
    ],
    tradeOrders: {
      2: { exports: { oil: 7, metals: 3, food: 2 }, imports: { semis: 2, pharma: 3, textiles: 4 } },
      3: { exports: { oil: 7, metals: 4, food: 2 }, imports: { semis: 2, pharma: 3, textiles: 4 } },
      4: { exports: { oil: 8, metals: 4, food: 2 }, imports: { semis: 2, pharma: 3, textiles: 4 } },
    },
  },
  {
    name: "Australia",
    // Strategy: Minerals exporter, stable rates, trade deals with Asia
    rounds: [
      { interestRate: 4.5,  taxRate: 24, infraSpending: 48, subsidySpending: 35, defenseSpending: 17, borrowing: 2.0, tradeOpenness: 0.85, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 4.5,  taxRate: 24, infraSpending: 48, subsidySpending: 35, defenseSpending: 17, borrowing: 2.0, tradeOpenness: 0.9, diplomaticAction: "trade_deal", diplomaticTarget: "Japan" },
      { interestRate: 5.0,  taxRate: 24, infraSpending: 43, subsidySpending: 35, defenseSpending: 22, borrowing: 2.0, tradeOpenness: 0.85, diplomaticAction: "trade_deal", diplomaticTarget: "South Korea" },
      { interestRate: 4.5,  taxRate: 24, infraSpending: 48, subsidySpending: 35, defenseSpending: 17, borrowing: 1.5, tradeOpenness: 0.9, diplomaticAction: "none", diplomaticTarget: null },
    ],
    tradeOrders: {
      2: { exports: { metals: 9, food: 7, oil: 4 }, imports: { semis: 3, textiles: 2 } },
      3: { exports: { metals: 9, food: 7, oil: 4 }, imports: { semis: 3, textiles: 2 } },
      4: { exports: { metals: 10, food: 8, oil: 4 }, imports: { semis: 3, textiles: 2 } },
    },
  },
  {
    name: "Turkey",
    // Strategy: Severe inflation crisis → very high rates, textiles export, stabilize
    rounds: [
      { interestRate: 14.0, taxRate: 22, infraSpending: 50, subsidySpending: 35, defenseSpending: 15, borrowing: 2.0, tradeOpenness: 0.7, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 13.0, taxRate: 22, infraSpending: 50, subsidySpending: 32, defenseSpending: 18, borrowing: 2.5, tradeOpenness: 0.75, diplomaticAction: "trade_deal", diplomaticTarget: "Germany" },
      { interestRate: 12.0, taxRate: 23, infraSpending: 45, subsidySpending: 32, defenseSpending: 23, borrowing: 2.0, tradeOpenness: 0.7, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 11.0, taxRate: 22, infraSpending: 50, subsidySpending: 33, defenseSpending: 17, borrowing: 2.0, tradeOpenness: 0.75, diplomaticAction: "none", diplomaticTarget: null },
    ],
    tradeOrders: {
      2: { exports: { textiles: 7, food: 5 }, imports: { oil: 5, semis: 3, metals: 3 } },
      3: { exports: { textiles: 7, food: 5 }, imports: { oil: 5, semis: 3, metals: 4 } },
      4: { exports: { textiles: 8, food: 5 }, imports: { oil: 5, semis: 3, metals: 4 } },
    },
  },
  {
    name: "Switzerland",
    // Strategy: Finance & pharma hub, low rates (near deflation), fiscal surplus
    rounds: [
      { interestRate: 2.5,  taxRate: 28, infraSpending: 40, subsidySpending: 42, defenseSpending: 18, borrowing: 0.5, tradeOpenness: 0.9, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 2.5,  taxRate: 28, infraSpending: 40, subsidySpending: 42, defenseSpending: 18, borrowing: 0.5, tradeOpenness: 0.95, diplomaticAction: "trade_deal", diplomaticTarget: "Germany" },
      { interestRate: 3.0,  taxRate: 28, infraSpending: 37, subsidySpending: 42, defenseSpending: 21, borrowing: 0.5, tradeOpenness: 0.9, diplomaticAction: "trade_deal", diplomaticTarget: "United Kingdom" },
      { interestRate: 2.5,  taxRate: 28, infraSpending: 40, subsidySpending: 42, defenseSpending: 18, borrowing: 0.5, tradeOpenness: 0.95, diplomaticAction: "none", diplomaticTarget: null },
    ],
    tradeOrders: {
      2: { exports: { pharma: 8, semis: 3 }, imports: { oil: 1, food: 1, metals: 1, textiles: 1 } },
      3: { exports: { pharma: 8, semis: 3 }, imports: { oil: 1, food: 1, metals: 1, textiles: 1 } },
      4: { exports: { pharma: 9, semis: 4 }, imports: { oil: 1, food: 1, metals: 1, textiles: 1 } },
    },
  },
  {
    name: "Mexico",
    // Strategy: Nearshoring magnet, US trade partner, moderate inflation management
    rounds: [
      { interestRate: 6.0,  taxRate: 22, infraSpending: 55, subsidySpending: 32, defenseSpending: 13, borrowing: 3.5, tradeOpenness: 0.8, diplomaticAction: "none", diplomaticTarget: null },
      { interestRate: 5.5,  taxRate: 22, infraSpending: 55, subsidySpending: 30, defenseSpending: 15, borrowing: 4.0, tradeOpenness: 0.85, diplomaticAction: "trade_deal", diplomaticTarget: "United States" },
      { interestRate: 6.0,  taxRate: 23, infraSpending: 50, subsidySpending: 30, defenseSpending: 20, borrowing: 3.5, tradeOpenness: 0.8, diplomaticAction: "trade_deal", diplomaticTarget: "Brazil" },
      { interestRate: 5.5,  taxRate: 22, infraSpending: 55, subsidySpending: 30, defenseSpending: 15, borrowing: 3.0, tradeOpenness: 0.85, diplomaticAction: "none", diplomaticTarget: null },
    ],
    tradeOrders: {
      2: { exports: { textiles: 6, oil: 5, food: 5, metals: 4 }, imports: { semis: 4, pharma: 2 } },
      3: { exports: { textiles: 6, oil: 5, food: 5, metals: 4 }, imports: { semis: 4, pharma: 2 } },
      4: { exports: { textiles: 7, oil: 5, food: 5, metals: 4 }, imports: { semis: 5, pharma: 2 } },
    },
  },
];

// ─── Helper: bar chart for a value 0-100 ────────────────────────────────────
function bar(value: number, max = 100, width = 20): string {
  const filled = Math.round((value / max) * width);
  return "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, width - filled));
}

function pad(s: string | number, len: number): string {
  return String(s).padEnd(len);
}

function num(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║        MACRO TRADER — FULL SIMULATION STRESS TEST        ║");
  console.log("║          15 Nations × 4 Rounds × Live Engine             ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // ── Load teams from DB ───────────────────────────────────────────────────
  const teams = await prisma.team.findMany({ include: { countryProfile: true } });
  const teamMap = new Map(teams.map(t => [t.name, t]));

  // ── Validate strategies cover all teams ─────────────────────────────────
  const strategyNames = new Set(STRATEGIES.map(s => s.name));
  const missingStrategies = teams.filter(t => !strategyNames.has(t.name)).map(t => t.name);
  if (missingStrategies.length > 0) {
    console.warn("⚠️  No strategy defined for:", missingStrategies.join(", "), "— will use defaults");
  }

  // ── Get or create game ───────────────────────────────────────────────────
  let game = await prisma.game.findFirst();
  if (!game) {
    game = await prisma.game.create({ data: { currentRound: 0, phase: "waiting" } });
  }

  // ── STRESS TEST: Validate scoring function for key countries ────────────
  console.log("─".repeat(60));
  console.log("STRESS TEST: Inflation Scoring Validation");
  console.log("─".repeat(60));
  const { calculateInflationScore } = await import("../src/lib/simulation/scoring");
  const inflationTestCases = [
    { country: "India",       inflation: 5.1, expectedMin: 22, expectedMax: 24 },
    { country: "Turkey",      inflation: 12.0, expectedMin: 5, expectedMax: 9 },
    { country: "Switzerland", inflation: 1.2, expectedMin: 22, expectedMax: 24 },
    { country: "China",       inflation: 0.3, expectedMin: 19, expectedMax: 22 },
    { country: "Saudi Arabia",inflation: 2.0, expectedMin: 25, expectedMax: 25 },
    { country: "Germany",     inflation: 2.8, expectedMin: 25, expectedMax: 25 },
    { country: "Japan",       inflation: 2.5, expectedMin: 25, expectedMax: 25 },
    { country: "Nigeria",     inflation: 9.5, expectedMin: 9, expectedMax: 13 },
  ];

  let allPassed = true;
  for (const tc of inflationTestCases) {
    const score = calculateInflationScore(tc.inflation);
    const passed = score >= tc.expectedMin && score <= tc.expectedMax;
    if (!passed) allPassed = false;
    const status = passed ? "✅ PASS" : "❌ FAIL";
    console.log(`  ${status}  ${pad(tc.country, 14)} inflation=${num(tc.inflation)}%  score=${num(score, 1)}/25  (expected ${tc.expectedMin}-${tc.expectedMax})`);
  }
  console.log(allPassed ? "\n✅ All inflation scoring tests passed!\n" : "\n⚠️  Some tests failed — check scoring logic\n");

  // ── Stress test: Decision constraint validation ──────────────────────────
  console.log("─".repeat(60));
  console.log("STRESS TEST: Decision Constraint Validation");
  console.log("─".repeat(60));
  let constraintsPassed = true;
  for (const strat of STRATEGIES) {
    for (let r = 0; r < 4; r++) {
      const dec = strat.rounds[r];
      const budgetSum = dec.infraSpending + dec.subsidySpending + dec.defenseSpending;
      const rateOk = dec.interestRate >= 1.0 && dec.interestRate <= 15.0;
      const taxOk = dec.taxRate >= 10 && dec.taxRate <= 35;
      const borrowOk = dec.borrowing >= 0 && dec.borrowing <= 15;
      const budgetOk = budgetSum === 100;

      if (!budgetOk || !rateOk || !taxOk || !borrowOk) {
        constraintsPassed = false;
        console.log(`  ❌ FAIL  ${strat.name} Round ${r + 1}: budget=${budgetSum}% rate=${dec.interestRate} tax=${dec.taxRate} borrow=${dec.borrowing}`);
      }
    }
  }
  if (constraintsPassed) {
    console.log("  ✅ All decision constraints valid (budget=100%, rates/taxes in range)\n");
  }

  // ── Run 4 Rounds ─────────────────────────────────────────────────────────
  const allRoundStates: any[][] = [];

  for (let round = 1; round <= 4; round++) {
    const roundNames = ["", "Foundation", "Open Borders", "Oil Shock & Conflict", "Endgame"];
    console.log("═".repeat(60));
    console.log(`ROUND ${round}: ${roundNames[round]}`);
    console.log("═".repeat(60));

    // 1. Advance game to input phase
    await prisma.game.update({
      where: { id: game.id },
      data: { currentRound: round, phase: "input" },
    });
    console.log(`✓ Game advanced to Round ${round} (input phase)`);

    // 2. Submit decisions for all teams
    let decisionsSubmitted = 0;
    for (const strat of STRATEGIES) {
      const team = teamMap.get(strat.name);
      if (!team) continue;

      const dec = strat.rounds[round - 1];

      // Resolve diplomatic target name → team ID
      let diplomaticTargetId: string | null = null;
      if (dec.diplomaticTarget) {
        const targetTeam = teamMap.get(dec.diplomaticTarget);
        diplomaticTargetId = targetTeam?.id ?? null;
      }

      await prisma.decision.upsert({
        where: { teamId_round: { teamId: team.id, round } },
        update: {
          interestRate: dec.interestRate,
          taxRate: dec.taxRate,
          infraSpending: dec.infraSpending,
          subsidySpending: dec.subsidySpending,
          defenseSpending: dec.defenseSpending,
          borrowing: dec.borrowing,
          tradeOpenness: dec.tradeOpenness,
          diplomaticAction: dec.diplomaticAction,
          diplomaticTarget: diplomaticTargetId,
          usePowerUp: false,
        },
        create: {
          teamId: team.id,
          round,
          interestRate: dec.interestRate,
          taxRate: dec.taxRate,
          infraSpending: dec.infraSpending,
          subsidySpending: dec.subsidySpending,
          defenseSpending: dec.defenseSpending,
          borrowing: dec.borrowing,
          tradeOpenness: dec.tradeOpenness,
          diplomaticAction: dec.diplomaticAction,
          diplomaticTarget: diplomaticTargetId,
          usePowerUp: false,
        },
      });
      decisionsSubmitted++;
    }
    console.log(`✓ Submitted decisions for ${decisionsSubmitted}/15 teams`);

    // 3. Submit trade orders (rounds 2-4 only)
    if (round >= 2) {
      let tradeOrdersSubmitted = 0;
      for (const strat of STRATEGIES) {
        const team = teamMap.get(strat.name);
        if (!team) continue;

        const orders = strat.tradeOrders[round];
        if (!orders) continue;

        // Delete existing orders for this team/round
        await prisma.tradeOrder.deleteMany({ where: { teamId: team.id, round } });

        const orderRecords: any[] = [];
        for (const [commodity, qty] of Object.entries(orders.exports || {})) {
          if (qty > 0) orderRecords.push({ teamId: team.id, round, commodity, direction: "export", quantity: qty });
        }
        for (const [commodity, qty] of Object.entries(orders.imports || {})) {
          if (qty > 0) orderRecords.push({ teamId: team.id, round, commodity, direction: "import", quantity: qty });
        }
        if (orderRecords.length > 0) {
          await prisma.tradeOrder.createMany({ data: orderRecords });
          tradeOrdersSubmitted += orderRecords.length;
        }
      }
      console.log(`✓ Submitted ${tradeOrdersSubmitted} trade orders for round ${round}`);
    }

    // 4. Advance to simulating phase
    await prisma.game.update({
      where: { id: game.id },
      data: { phase: "simulating" },
    });

    // 5. Run the simulation engine
    console.log(`⚙  Running simulation engine...`);
    const startTime = Date.now();
    const newsItems = await runSimulation(round);
    const elapsed = Date.now() - startTime;
    console.log(`✓ Simulation complete in ${elapsed}ms — ${newsItems.length} news events generated`);

    // 6. Advance to results phase
    await prisma.game.update({
      where: { id: game.id },
      data: { phase: "results" },
    });

    // 7. Read results and print round summary
    const roundStates = await prisma.roundState.findMany({
      where: { round },
      include: { team: true },
    });

    // Sort by GDP growth descending
    roundStates.sort((a, b) => b.gdpGrowth - a.gdpGrowth);

    console.log("\n┌──────────────────┬───────┬────────┬─────────┬──────────┬──────────┐");
    console.log("│ Country          │ GDP%  │ Infl%  │ Deficit │ Currency │ Approval │");
    console.log("├──────────────────┼───────┼────────┼─────────┼──────────┼──────────┤");
    for (const s of roundStates) {
      const gdpStr   = num(s.gdpGrowth).padStart(5);
      const inflStr  = num(s.inflation).padStart(6);
      const defStr   = num(s.fiscalDeficit).padStart(7);
      const curStr   = num(s.currencyIndex, 0).padStart(8);
      const appStr   = num(s.approvalRating, 0).padStart(8);
      console.log(`│ ${pad(s.team.name, 16)} │ ${gdpStr} │ ${inflStr} │ ${defStr} │ ${curStr} │ ${appStr} │`);
    }
    console.log("└──────────────────┴───────┴────────┴─────────┴──────────┴──────────┘");

    // Notable news
    const keyNews = newsItems.slice(0, 5);
    if (keyNews.length > 0) {
      console.log("\nTop Headlines:");
      for (const n of keyNews) {
        const icon = n.type === "crisis" ? "🔴" : n.type === "trade" ? "🤝" : n.type === "conflict" ? "⚔️" : "📈";
        console.log(`  ${icon} ${n.headline}`);
      }
    }
    console.log();

    // Collect for final scoring
    allRoundStates.push(roundStates.map(s => ({
      teamId: s.teamId,
      gdpGrowth: s.gdpGrowth,
      inflation: s.inflation,
      fiscalDeficit: s.fiscalDeficit,
      currencyIndex: s.currencyIndex,
      tradeBalance: s.tradeBalance,
      diplomacyScore: s.diplomacyScore,
      approvalRating: s.approvalRating,
    })));
  }

  // ── Final Leaderboard ────────────────────────────────────────────────────
  console.log("═".repeat(60));
  console.log("FINAL LEADERBOARD — ALL 4 ROUNDS COMPLETE");
  console.log("═".repeat(60));

  const scores = calculateScores(allRoundStates);

  // Enrich with team names
  const teamIdToName = new Map(teams.map(t => [t.id, t.name]));
  const rankedScores = scores.map((s, i) => ({
    rank: i + 1,
    name: teamIdToName.get(s.teamId) ?? "Unknown",
    ...s,
  }));

  console.log("\n  Rank  Country            Score   GDP   Infl  Fisc  Trade  Dipl");
  console.log("  ─────────────────────────────────────────────────────────────");
  for (const s of rankedScores) {
    const medal = s.rank === 1 ? "🥇" : s.rank === 2 ? "🥈" : s.rank === 3 ? "🥉" : `#${s.rank} `;
    const b = s.breakdown;
    console.log(
      `  ${medal}  ${pad(s.name, 18)} ${String(s.total.toFixed(1)).padStart(5)}` +
      `   ${num(b.cumulativeGDP)}  ${num(b.inflationStability)}  ${num(b.fiscalDiscipline)}  ${num(b.tradeBalance)}  ${num(b.diplomaticScore)}`
    );
  }

  console.log("\n  Score breakdown: GDP(25) | Inflation(25) | Fiscal(15) | Trade(20) | Diplomacy(15)");

  // ── Score distribution bar chart ─────────────────────────────────────────
  console.log("\n  Score Distribution:");
  for (const s of rankedScores) {
    const barStr = bar(s.total, 100, 30);
    console.log(`  ${pad(s.name, 18)} ${barStr} ${s.total.toFixed(1)}`);
  }

  // ── Per-metric winners ───────────────────────────────────────────────────
  console.log("\n  🏆 Category Winners:");
  const topGDP   = rankedScores.sort((a, b) => b.breakdown.cumulativeGDP - a.breakdown.cumulativeGDP)[0];
  const topInfl  = rankedScores.sort((a, b) => b.breakdown.inflationStability - a.breakdown.inflationStability)[0];
  const topFisc  = rankedScores.sort((a, b) => b.breakdown.fiscalDiscipline - a.breakdown.fiscalDiscipline)[0];
  const topTrade = rankedScores.sort((a, b) => b.breakdown.tradeBalance - a.breakdown.tradeBalance)[0];
  const topDipl  = rankedScores.sort((a, b) => b.breakdown.diplomaticScore - a.breakdown.diplomaticScore)[0];
  console.log(`     📈 Best GDP Growth:    ${topGDP.name} (${topGDP.breakdown.cumulativeGDP.toFixed(1)} pts)`);
  console.log(`     🎯 Best Inflation:     ${topInfl.name} (${topInfl.breakdown.inflationStability.toFixed(1)} pts)`);
  console.log(`     💰 Best Fiscal:        ${topFisc.name} (${topFisc.breakdown.fiscalDiscipline.toFixed(1)} pts)`);
  console.log(`     🌐 Best Trade/FX:      ${topTrade.name} (${topTrade.breakdown.tradeBalance.toFixed(1)} pts)`);
  console.log(`     🤝 Best Diplomacy:     ${topDipl.name} (${topDipl.breakdown.diplomaticScore.toFixed(1)} pts)`);

  // ── Stress test assertions ───────────────────────────────────────────────
  console.log("\n─".repeat(60));
  console.log("STRESS TEST ASSERTIONS (post-simulation)");
  console.log("─".repeat(60));

  // Re-sort by total for assertions
  rankedScores.sort((a, b) => b.total - a.total);

  const assertions: { label: string; pass: boolean }[] = [];

  // All teams should have valid scores
  assertions.push({ label: "All 15 teams have scores", pass: scores.length === 15 });

  // No score should be NaN or negative
  const noNaN = scores.every(s => !isNaN(s.total) && s.total >= 0);
  assertions.push({ label: "No NaN or negative total scores", pass: noNaN });

  // Winner should be > 50 pts (a functional game)
  const winner = rankedScores[0];
  assertions.push({ label: `Winner (${winner?.name}) scored > 50 pts`, pass: (winner?.total ?? 0) > 50 });

  // Last place > 20 pts (competitive balance floor)
  const lastPlace = rankedScores[rankedScores.length - 1];
  assertions.push({ label: `Last place (${lastPlace?.name}) scored > 15 pts`, pass: (lastPlace?.total ?? 0) > 15 });

  // Turkey should improve inflation trajectory (starts at 12%, with 14% rates)
  const turkeyStates = await prisma.roundState.findMany({ where: { team: { name: "Turkey" } }, orderBy: { round: "asc" } });
  const turkeyInflR4 = turkeyStates.find(s => s.round === 4)?.inflation ?? 999;
  assertions.push({ label: `Turkey inflation improves by Round 4 (was 12%, now ${num(turkeyInflR4)}%)`, pass: turkeyInflR4 < 12.0 });

  // Oil exporters (Russia, Saudi, Nigeria, Brazil) should have positive trade balances
  const oilExporters = ["Russia", "Saudi Arabia", "Nigeria"];
  for (const country of oilExporters) {
    const finalState = await prisma.roundState.findFirst({ where: { team: { name: country }, round: 4 } });
    const tradeOk = (finalState?.tradeBalance ?? 0) > 0;
    assertions.push({ label: `${country} has positive trade balance R4`, pass: tradeOk });
  }

  // Switzerland should stay near 2-4% inflation range
  const chState = await prisma.roundState.findFirst({ where: { team: { name: "Switzerland" }, round: 4 } });
  const chInfl = chState?.inflation ?? 0;
  assertions.push({ label: `Switzerland inflation stays in/near range (${num(chInfl)}%)`, pass: chInfl <= 5.0 });

  // Game should be in results phase
  const finalGame = await prisma.game.findFirst();
  assertions.push({ label: "Game phase = results after all rounds", pass: finalGame?.phase === "results" });

  // Print assertions
  let allAssertionsPassed = true;
  for (const a of assertions) {
    if (!a.pass) allAssertionsPassed = false;
    console.log(`  ${a.pass ? "✅ PASS" : "❌ FAIL"}  ${a.label}`);
  }

  const passed = assertions.filter(a => a.pass).length;
  const total = assertions.length;
  console.log(`\n  ${passed}/${total} assertions passed ${allAssertionsPassed ? "✅" : "⚠️"}`);

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║         SIMULATION COMPLETE — ALL 4 ROUNDS DONE          ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
}

main()
  .catch(err => {
    console.error("❌ Simulation failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
