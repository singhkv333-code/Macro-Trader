import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

// ─── Country data (mirrors prisma/seed.ts) ───────────────────────────────────
const COUNTRIES = [
  {
    team: { name: "India", flagEmoji: "🇮🇳", color: "#FF6B35" },
    profile: {
      countryName: "Republic of India",
      productivityFactor: 0.75, tradeMultiplier: 1.35, monetaryPower: 0.85,
      taxEfficiency: 0.68, potentialGrowth: 6.5, creditSpread: 0.04,
      startingDebtToGdp: 0.48, rNeutral: 8.5,
      startingRevenue: 435.2, startingDebtService: 197.0, startingNetBudget: 238.2,
      startingGdpBillions: 3200, startingGdpGrowth: 6.2,
      startingInflation: 5.1, startingForex: 250, startingMilitary: 65,
      startingCreditRating: "BBB",
      oilProduction: 3, oilConsumption: 8,
      metalsProduction: 6, metalsConsumption: 5,
      foodProduction: 8, foodConsumption: 7,
      semisProduction: 2, semisConsumption: 6,
      pharmaProduction: 7, pharmaConsumption: 5,
      textilesProduction: 8, textilesConsumption: 6,
      powerUpName: "Demographic Dividend",
      powerUpDescription: "Labor exponent in GDP formula doubles for one round (+2% GDP growth).",
    },
  },
  {
    team: { name: "United States", flagEmoji: "🇺🇸", color: "#2E75B6" },
    profile: {
      countryName: "United States of America",
      productivityFactor: 1.20, tradeMultiplier: 1.05, monetaryPower: 1.30,
      taxEfficiency: 0.92, potentialGrowth: 2.0, creditSpread: 0.02,
      startingDebtToGdp: 0.50, rNeutral: 4.0,
      startingRevenue: 4968, startingDebtService: 810, startingNetBudget: 4158,
      startingGdpBillions: 27000, startingGdpGrowth: 2.4,
      startingInflation: 3.2, startingForex: 400, startingMilitary: 150,
      startingCreditRating: "AA",
      oilProduction: 9, oilConsumption: 8,
      metalsProduction: 5, metalsConsumption: 7,
      foodProduction: 9, foodConsumption: 6,
      semisProduction: 7, semisConsumption: 9,
      pharmaProduction: 8, pharmaConsumption: 7,
      textilesProduction: 3, textilesConsumption: 8,
      powerUpName: "Reserve Currency Privilege",
      powerUpDescription: "Debt penalty exponent drops from 1.5 to 0.8 for one round. Borrowing costs waived.",
    },
  },
  {
    team: { name: "China", flagEmoji: "🇨🇳", color: "#C0392B" },
    profile: {
      countryName: "People's Republic of China",
      productivityFactor: 1.00, tradeMultiplier: 2.10, monetaryPower: 0.70,
      taxEfficiency: 0.80, potentialGrowth: 5.0, creditSpread: 0.03,
      startingDebtToGdp: 0.45, rNeutral: 7.0,
      startingRevenue: 2960, startingDebtService: 721.5, startingNetBudget: 2238.5,
      startingGdpBillions: 18500, startingGdpGrowth: 4.8,
      startingInflation: 0.3, startingForex: 350, startingMilitary: 130,
      startingCreditRating: "A",
      oilProduction: 4, oilConsumption: 9,
      metalsProduction: 7, metalsConsumption: 8,
      foodProduction: 7, foodConsumption: 9,
      semisProduction: 5, semisConsumption: 9,
      pharmaProduction: 6, pharmaConsumption: 6,
      textilesProduction: 10, textilesConsumption: 5,
      powerUpName: "Belt & Road Initiative",
      powerUpDescription: "Trade deals give 2× β_n benefit to partner for one round. China also gains +0.5% GDP.",
    },
  },
  {
    team: { name: "Germany", flagEmoji: "🇩🇪", color: "#2C3E50" },
    profile: {
      countryName: "Federal Republic of Germany",
      productivityFactor: 1.15, tradeMultiplier: 2.25, monetaryPower: 1.10,
      taxEfficiency: 0.93, potentialGrowth: 1.2, creditSpread: 0.02,
      startingDebtToGdp: 0.40, rNeutral: 3.2,
      startingRevenue: 837, startingDebtService: 115.2, startingNetBudget: 721.8,
      startingGdpBillions: 4500, startingGdpGrowth: 0.8,
      startingInflation: 2.8, startingForex: 300, startingMilitary: 80,
      startingCreditRating: "AAA",
      oilProduction: 1, oilConsumption: 6,
      metalsProduction: 3, metalsConsumption: 7,
      foodProduction: 5, foodConsumption: 4,
      semisProduction: 6, semisConsumption: 7,
      pharmaProduction: 8, pharmaConsumption: 4,
      textilesProduction: 4, textilesConsumption: 5,
      powerUpName: "Mittelstand Innovation",
      powerUpDescription: "Permanent +10% to productivityFactor (A_n) applied from this round onward.",
    },
  },
  {
    team: { name: "Japan", flagEmoji: "🇯🇵", color: "#E8792F" },
    profile: {
      countryName: "Japan",
      productivityFactor: 1.10, tradeMultiplier: 1.80, monetaryPower: 0.50,
      taxEfficiency: 0.91, potentialGrowth: 0.8, creditSpread: 0.01,
      startingDebtToGdp: 0.50, rNeutral: 2.8,
      startingRevenue: 764.4, startingDebtService: 321.3, startingNetBudget: 443.1,
      startingGdpBillions: 4200, startingGdpGrowth: 1.1,
      startingInflation: 2.5, startingForex: 320, startingMilitary: 60,
      startingCreditRating: "A",
      oilProduction: 0, oilConsumption: 5,
      metalsProduction: 1, metalsConsumption: 6,
      foodProduction: 4, foodConsumption: 5,
      semisProduction: 8, semisConsumption: 6,
      pharmaProduction: 7, pharmaConsumption: 5,
      textilesProduction: 3, textilesConsumption: 5,
      powerUpName: "Yield Curve Control",
      powerUpDescription: "Debt service payments are frozen for one round. cumulativeDebt stops growing.",
    },
  },
  {
    team: { name: "Brazil", flagEmoji: "🇧🇷", color: "#27AE60" },
    profile: {
      countryName: "Federative Republic of Brazil",
      productivityFactor: 0.72, tradeMultiplier: 1.50, monetaryPower: 0.90,
      taxEfficiency: 0.65, potentialGrowth: 3.0, creditSpread: 0.035,
      startingDebtToGdp: 0.42, rNeutral: 5.0,
      startingRevenue: 286, startingDebtService: 91.1, startingNetBudget: 194.9,
      startingGdpBillions: 2200, startingGdpGrowth: 2.9,
      startingInflation: 4.6, startingForex: 200, startingMilitary: 55,
      startingCreditRating: "BB",
      oilProduction: 7, oilConsumption: 5,
      metalsProduction: 9, metalsConsumption: 4,
      foodProduction: 10, foodConsumption: 6,
      semisProduction: 1, semisConsumption: 4,
      pharmaProduction: 3, pharmaConsumption: 5,
      textilesProduction: 4, textilesConsumption: 6,
      powerUpName: "Pre-Salt Oil Boom",
      powerUpDescription: "Oil production +3 units for one round, generating extra trade income.",
    },
  },
  {
    team: { name: "United Kingdom", flagEmoji: "🇬🇧", color: "#8E44AD" },
    profile: {
      countryName: "United Kingdom",
      productivityFactor: 1.05, tradeMultiplier: 1.65, monetaryPower: 1.40,
      taxEfficiency: 0.90, potentialGrowth: 1.5, creditSpread: 0.025,
      startingDebtToGdp: 0.48, rNeutral: 3.5,
      startingRevenue: 594, startingDebtService: 148.5, startingNetBudget: 445.5,
      startingGdpBillions: 3300, startingGdpGrowth: 1.5,
      startingInflation: 3.8, startingForex: 280, startingMilitary: 75,
      startingCreditRating: "AA",
      oilProduction: 3, oilConsumption: 5,
      metalsProduction: 2, metalsConsumption: 5,
      foodProduction: 4, foodConsumption: 5,
      semisProduction: 4, semisConsumption: 6,
      pharmaProduction: 8, pharmaConsumption: 4,
      textilesProduction: 3, textilesConsumption: 5,
      powerUpName: "City of London",
      powerUpDescription: "Capital inflows doubled for one round — forexReserves +50, currencyIndex +5.",
    },
  },
  {
    team: { name: "Russia", flagEmoji: "🇷🇺", color: "#1A3A5C" },
    profile: {
      countryName: "Russian Federation",
      productivityFactor: 0.68, tradeMultiplier: 1.20, monetaryPower: 0.60,
      taxEfficiency: 0.62, potentialGrowth: 1.5, creditSpread: 0.04,
      startingDebtToGdp: 0.20, rNeutral: 3.5,
      startingRevenue: 235.6, startingDebtService: 22.8, startingNetBudget: 212.8,
      startingGdpBillions: 1900, startingGdpGrowth: 2.0,
      startingInflation: 7.5, startingForex: 180, startingMilitary: 120,
      startingCreditRating: "BB",
      oilProduction: 10, oilConsumption: 4,
      metalsProduction: 8, metalsConsumption: 5,
      foodProduction: 7, foodConsumption: 6,
      semisProduction: 1, semisConsumption: 5,
      pharmaProduction: 2, pharmaConsumption: 5,
      textilesProduction: 2, textilesConsumption: 6,
      powerUpName: "Energy Weapon",
      powerUpDescription: "Cut oil exports to 2 chosen nations: each suffers +3% inflation and -2% GDP for one round.",
    },
  },
  {
    team: { name: "South Korea", flagEmoji: "🇰🇷", color: "#16A085" },
    profile: {
      countryName: "Republic of Korea",
      productivityFactor: 1.12, tradeMultiplier: 2.175, monetaryPower: 1.00,
      taxEfficiency: 0.88, potentialGrowth: 2.5, creditSpread: 0.02,
      startingDebtToGdp: 0.38, rNeutral: 4.5,
      startingRevenue: 299.2, startingDebtService: 37.4, startingNetBudget: 261.8,
      startingGdpBillions: 1700, startingGdpGrowth: 2.2,
      startingInflation: 2.8, startingForex: 220, startingMilitary: 70,
      startingCreditRating: "AA",
      oilProduction: 0, oilConsumption: 5,
      metalsProduction: 1, metalsConsumption: 6,
      foodProduction: 3, foodConsumption: 4,
      semisProduction: 10, semisConsumption: 4,
      pharmaProduction: 5, pharmaConsumption: 4,
      textilesProduction: 4, textilesConsumption: 5,
      powerUpName: "Chip Monopoly",
      powerUpDescription: "Semiconductor exports earn 3× price for one round. Massive trade income surge.",
    },
  },
  {
    team: { name: "Saudi Arabia", flagEmoji: "🇸🇦", color: "#D4AF37" },
    profile: {
      countryName: "Kingdom of Saudi Arabia",
      productivityFactor: 0.80, tradeMultiplier: 1.65, monetaryPower: 0.70,
      taxEfficiency: 0.75, potentialGrowth: 3.0, creditSpread: 0.02,
      startingDebtToGdp: 0.22, rNeutral: 5.0,
      startingRevenue: 165, startingDebtService: 11, startingNetBudget: 154,
      startingGdpBillions: 1100, startingGdpGrowth: 3.5,
      startingInflation: 2.0, startingForex: 300, startingMilitary: 85,
      startingCreditRating: "A",
      oilProduction: 10, oilConsumption: 3,
      metalsProduction: 3, metalsConsumption: 4,
      foodProduction: 1, foodConsumption: 4,
      semisProduction: 1, semisConsumption: 3,
      pharmaProduction: 1, pharmaConsumption: 3,
      textilesProduction: 2, textilesConsumption: 4,
      powerUpName: "OPEC Production Cut",
      powerUpDescription: "Global oil base price increases 40% for one round. Saudi oil income triples.",
    },
  },
  {
    team: { name: "Nigeria", flagEmoji: "🇳🇬", color: "#007A5E" },
    profile: {
      countryName: "Federal Republic of Nigeria",
      productivityFactor: 0.50, tradeMultiplier: 1.275, monetaryPower: 0.55,
      taxEfficiency: 0.45, potentialGrowth: 4.0, creditSpread: 0.05,
      startingDebtToGdp: 0.30, rNeutral: 6.0,
      startingRevenue: 40.5, startingDebtService: 25.2, startingNetBudget: 15.3,
      startingGdpBillions: 450, startingGdpGrowth: 3.0,
      startingInflation: 9.5, startingForex: 80, startingMilitary: 35,
      startingCreditRating: "B",
      oilProduction: 8, oilConsumption: 4,
      metalsProduction: 4, metalsConsumption: 3,
      foodProduction: 5, foodConsumption: 8,
      semisProduction: 0, semisConsumption: 2,
      pharmaProduction: 1, pharmaConsumption: 4,
      textilesProduction: 3, textilesConsumption: 6,
      powerUpName: "Leapfrog Development",
      powerUpDescription: "Infrastructure spending effectiveness 3× for one round. Massive GDP and employment boost.",
    },
  },
  {
    team: { name: "Australia", flagEmoji: "🇦🇺", color: "#1ABC9C" },
    profile: {
      countryName: "Commonwealth of Australia",
      productivityFactor: 1.08, tradeMultiplier: 1.80, monetaryPower: 1.10,
      taxEfficiency: 0.91, potentialGrowth: 2.5, creditSpread: 0.02,
      startingDebtToGdp: 0.35, rNeutral: 4.5,
      startingRevenue: 309.4, startingDebtService: 34, startingNetBudget: 275.4,
      startingGdpBillions: 1700, startingGdpGrowth: 2.5,
      startingInflation: 3.5, startingForex: 210, startingMilitary: 55,
      startingCreditRating: "AAA",
      oilProduction: 5, oilConsumption: 3,
      metalsProduction: 10, metalsConsumption: 3,
      foodProduction: 8, foodConsumption: 2,
      semisProduction: 2, semisConsumption: 3,
      pharmaProduction: 4, pharmaConsumption: 2,
      textilesProduction: 2, textilesConsumption: 3,
      powerUpName: "Mineral Royalties Windfall",
      powerUpDescription: "All commodity export revenue is tax-free for one round. Treasury +30% of export income.",
    },
  },
  {
    team: { name: "Turkey", flagEmoji: "🇹🇷", color: "#E74C3C" },
    profile: {
      countryName: "Republic of Turkey",
      productivityFactor: 0.78, tradeMultiplier: 1.725, monetaryPower: 0.65,
      taxEfficiency: 0.70, potentialGrowth: 4.5, creditSpread: 0.035,
      startingDebtToGdp: 0.28, rNeutral: 6.5,
      startingRevenue: 154, startingDebtService: 22.9, startingNetBudget: 131.1,
      startingGdpBillions: 1100, startingGdpGrowth: 4.0,
      startingInflation: 12.0, startingForex: 150, startingMilitary: 60,
      startingCreditRating: "BB",
      oilProduction: 1, oilConsumption: 6,
      metalsProduction: 5, metalsConsumption: 5,
      foodProduction: 7, foodConsumption: 6,
      semisProduction: 2, semisConsumption: 4,
      pharmaProduction: 3, pharmaConsumption: 4,
      textilesProduction: 8, textilesConsumption: 5,
      powerUpName: "Bosphorus Leverage",
      powerUpDescription: "Charge a 5% transit fee on ALL global trade this round — collect tradeIncome bonus from every nation.",
    },
  },
  {
    team: { name: "Switzerland", flagEmoji: "🇨🇭", color: "#E8003D" },
    profile: {
      countryName: "Swiss Confederation",
      productivityFactor: 1.30, tradeMultiplier: 1.575, monetaryPower: 1.20,
      taxEfficiency: 0.95, potentialGrowth: 1.5, creditSpread: 0.01,
      startingDebtToGdp: 0.25, rNeutral: 3.5,
      startingRevenue: 167.2, startingDebtService: 10.1, startingNetBudget: 157.1,
      startingGdpBillions: 880, startingGdpGrowth: 1.2,
      startingInflation: 1.2, startingForex: 350, startingMilitary: 40,
      startingCreditRating: "AAA",
      oilProduction: 0, oilConsumption: 2,
      metalsProduction: 1, metalsConsumption: 2,
      foodProduction: 3, foodConsumption: 2,
      semisProduction: 4, semisConsumption: 3,
      pharmaProduction: 9, pharmaConsumption: 1,
      textilesProduction: 3, textilesConsumption: 2,
      powerUpName: "Swiss Banking Secrecy",
      powerUpDescription: "Immune to all sanctions and diplomatic penalties for one round. forexReserves +40.",
    },
  },
  {
    team: { name: "Mexico", flagEmoji: "🇲🇽", color: "#006847" },
    profile: {
      countryName: "United Mexican States",
      productivityFactor: 0.74, tradeMultiplier: 1.95, monetaryPower: 0.80,
      taxEfficiency: 0.60, potentialGrowth: 3.5, creditSpread: 0.03,
      startingDebtToGdp: 0.40, rNeutral: 5.5,
      startingRevenue: 168, startingDebtService: 38.5, startingNetBudget: 129.5,
      startingGdpBillions: 1400, startingGdpGrowth: 3.2,
      startingInflation: 4.8, startingForex: 160, startingMilitary: 50,
      startingCreditRating: "BBB",
      oilProduction: 6, oilConsumption: 5,
      metalsProduction: 5, metalsConsumption: 4,
      foodProduction: 6, foodConsumption: 7,
      semisProduction: 3, semisConsumption: 5,
      pharmaProduction: 2, pharmaConsumption: 4,
      textilesProduction: 7, textilesConsumption: 5,
      powerUpName: "Nearshoring Magnet",
      powerUpDescription: "Trade partners get 1.5× GDP benefit from deals. Mexico permanently gains +5% taxEfficiency.",
    },
  },
  // ── 5 new countries (from Claude.md) ────────────────────────────────────
  {
    team: { name: "France", flagEmoji: "🇫🇷", color: "#002395" },
    profile: {
      countryName: "French Republic",
      productivityFactor: 1.05, tradeMultiplier: 1.08, monetaryPower: 1.05,
      taxEfficiency: 0.90, potentialGrowth: 2.0, creditSpread: 0.02,
      startingDebtToGdp: 0.48, rNeutral: 4.0,
      startingRevenue: 185.4, startingDebtService: 74.2, startingNetBudget: 111.2,
      startingGdpBillions: 1030, startingGdpGrowth: 2.0,
      startingInflation: 3.0, startingForex: 250, startingMilitary: 65,
      startingCreditRating: "AA",
      oilProduction: 1, oilConsumption: 5,
      metalsProduction: 3, metalsConsumption: 5,
      foodProduction: 7, foodConsumption: 5,
      semisProduction: 5, semisConsumption: 6,
      pharmaProduction: 7, pharmaConsumption: 4,
      textilesProduction: 5, textilesConsumption: 5,
      powerUpName: "EU Integration",
      powerUpDescription: "All trade deals with European nations (Germany, UK, Switzerland) give 2× β benefit for one round.",
      challengeText: "High debt (72%) with moderate growth potential. Strong pharma and food exports but heavy oil importer. Must leverage European trade partnerships.",
    },
  },
  {
    team: { name: "Indonesia", flagEmoji: "🇮🇩", color: "#CE1126" },
    profile: {
      countryName: "Republic of Indonesia",
      productivityFactor: 0.88, tradeMultiplier: 1.08, monetaryPower: 0.90,
      taxEfficiency: 0.78, potentialGrowth: 4.0, creditSpread: 0.025,
      startingDebtToGdp: 0.35, rNeutral: 6.0,
      startingRevenue: 150.5, startingDebtService: 37.4, startingNetBudget: 113.1,
      startingGdpBillions: 960, startingGdpGrowth: 4.0,
      startingInflation: 4.5, startingForex: 170, startingMilitary: 55,
      startingCreditRating: "BBB",
      oilProduction: 5, oilConsumption: 6,
      metalsProduction: 7, metalsConsumption: 4,
      foodProduction: 6, foodConsumption: 7,
      semisProduction: 2, semisConsumption: 4,
      pharmaProduction: 2, pharmaConsumption: 4,
      textilesProduction: 7, textilesConsumption: 5,
      powerUpName: "Archipelago Trade Hub",
      powerUpDescription: "Maritime trade routes boost all trade income by 40% for one round.",
      challengeText: "Low debt gives fiscal room but low tax efficiency limits revenue. Rich in metals and textiles but needs tech imports. High growth potential if infra spend is maximized.",
    },
  },
  {
    team: { name: "Canada", flagEmoji: "🇨🇦", color: "#FF0000" },
    profile: {
      countryName: "Canada",
      productivityFactor: 1.08, tradeMultiplier: 1.10, monetaryPower: 1.05,
      taxEfficiency: 0.90, potentialGrowth: 2.5, creditSpread: 0.02,
      startingDebtToGdp: 0.38, rNeutral: 4.5,
      startingRevenue: 183.6, startingDebtService: 41.0, startingNetBudget: 142.6,
      startingGdpBillions: 1020, startingGdpGrowth: 2.5,
      startingInflation: 3.2, startingForex: 230, startingMilitary: 50,
      startingCreditRating: "AAA",
      oilProduction: 8, oilConsumption: 4,
      metalsProduction: 7, metalsConsumption: 4,
      foodProduction: 7, foodConsumption: 3,
      semisProduction: 3, semisConsumption: 5,
      pharmaProduction: 4, pharmaConsumption: 3,
      textilesProduction: 2, textilesConsumption: 4,
      powerUpName: "Arctic Resources",
      powerUpDescription: "Discover new oil and metals reserves. Oil production +2, metals +2 permanently.",
      challengeText: "Resource-rich with clean balance sheet but small labour force and needs tech imports. Natural trade partner for oil-hungry nations like India and Germany.",
    },
  },
  {
    team: { name: "South Africa", flagEmoji: "🇿🇦", color: "#007749" },
    profile: {
      countryName: "Republic of South Africa",
      productivityFactor: 0.88, tradeMultiplier: 1.00, monetaryPower: 0.90,
      taxEfficiency: 0.80, potentialGrowth: 3.0, creditSpread: 0.03,
      startingDebtToGdp: 0.42, rNeutral: 5.0,
      startingRevenue: 150.8, startingDebtService: 46.8, startingNetBudget: 104.0,
      startingGdpBillions: 940, startingGdpGrowth: 3.0,
      startingInflation: 5.5, startingForex: 160, startingMilitary: 45,
      startingCreditRating: "BB",
      oilProduction: 2, oilConsumption: 5,
      metalsProduction: 9, metalsConsumption: 4,
      foodProduction: 5, foodConsumption: 6,
      semisProduction: 1, semisConsumption: 3,
      pharmaProduction: 3, pharmaConsumption: 4,
      textilesProduction: 4, textilesConsumption: 5,
      powerUpName: "Mineral Wealth Surge",
      powerUpDescription: "Metals export prices increase 50% for one round due to rare earth discovery.",
      challengeText: "Metals superpower but deficit in almost everything else. Must convert mineral wealth into diversified imports. Moderate inflation needs attention.",
    },
  },
  {
    team: { name: "UAE", flagEmoji: "🇦🇪", color: "#00732F" },
    profile: {
      countryName: "United Arab Emirates",
      productivityFactor: 0.95, tradeMultiplier: 1.12, monetaryPower: 0.92,
      taxEfficiency: 0.85, potentialGrowth: 3.5, creditSpread: 0.015,
      startingDebtToGdp: 0.22, rNeutral: 5.5,
      startingRevenue: 166.6, startingDebtService: 24.5, startingNetBudget: 142.1,
      startingGdpBillions: 980, startingGdpGrowth: 3.5,
      startingInflation: 2.5, startingForex: 300, startingMilitary: 70,
      startingCreditRating: "AA",
      oilProduction: 9, oilConsumption: 3,
      metalsProduction: 2, metalsConsumption: 4,
      foodProduction: 1, foodConsumption: 4,
      semisProduction: 2, semisConsumption: 4,
      pharmaProduction: 1, pharmaConsumption: 3,
      textilesProduction: 3, textilesConsumption: 4,
      powerUpName: "Sovereign Wealth Fund",
      powerUpDescription: "Inject $200B from sovereign wealth into budget for one round. No borrowing cost.",
      challengeText: "Oil-rich with low debt and stable inflation — strongest starting fiscal position. But deficit in 5 of 6 commodities means total dependence on trade. If partners sanction you, economy collapses.",
    },
  },
];

export async function POST() {
  try {
    // Clear all data in dependency order
    await prisma.powerUpUsage.deleteMany();
    await prisma.tradeTransaction.deleteMany();
    await prisma.tradeOrder.deleteMany();
    await prisma.newsEvent.deleteMany();
    await prisma.diplomaticRelation.deleteMany();
    await prisma.decision.deleteMany();
    await prisma.roundState.deleteMany();
    await prisma.countryProfile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.team.deleteMany();
    await prisma.game.deleteMany();

    // Create admin user
    const adminPassword = await hashPassword("episteme2026");
    await prisma.user.create({
      data: { username: "admin", password: adminPassword, role: "admin" },
    });

    // Login codes from Claude.md — handed out on printed cards at the event
    const LOGIN_CODES: Record<string, string> = {
      "India":          "KR4N8WXJ",
      "United States":  "BP7M3YTH",
      "China":          "QV6D9FLS",
      "Germany":        "HN2X5CWR",
      "Japan":          "WT8K4PBG",
      "Brazil":         "FJ3V7NMD",
      "United Kingdom": "XC9L2HTQ",
      "Russia":         "DM5R8YKW",
      "South Korea":    "PG4T6JNV",
      "Saudi Arabia":   "LH7W3BXF",
      "Nigeria":        "YK8D5QMC",
      "Australia":      "NR2P9THJ",
      "Turkey":         "BW6X4FLG",
      "Switzerland":    "TJ3M7VKD",
      "Mexico":         "GF5N8CWP",
      "France":         "VX4H2RBN",
      "Indonesia":      "CW7L9TJK",
      "Canada":         "MQ3Y6DHP",
      "South Africa":   "RB8F4NXW",
      "UAE":            "HT5K7GJV",
    };

    // Create teams with country profiles and country-specific initial states
    for (const { team: teamDef, profile } of COUNTRIES) {
      const loginCode = LOGIN_CODES[teamDef.name] ?? teamDef.name.toUpperCase().slice(0, 3) + "2026";

      const team = await prisma.team.create({
        data: { name: teamDef.name, color: teamDef.color, flagEmoji: teamDef.flagEmoji },
      });

      // Create country profile (engine multipliers + resource endowments)
      await prisma.countryProfile.create({
        data: { teamId: team.id, ...profile },
      });

      // Create team login using the unique code as both username and password
      const hashedCode = await hashPassword(loginCode);
      await prisma.user.create({
        data: { username: loginCode, password: hashedCode, role: "team", teamId: team.id },
      });

      // Round-0 initial state using country-specific starting conditions
      const tradeBalance =
        (profile.oilProduction      - profile.oilConsumption)
        + (profile.metalsProduction   - profile.metalsConsumption)
        + (profile.foodProduction     - profile.foodConsumption)
        + (profile.semisProduction    - profile.semisConsumption)
        + (profile.pharmaProduction   - profile.pharmaConsumption)
        + (profile.textilesProduction - profile.textilesConsumption);

      await prisma.roundState.create({
        data: {
          teamId: team.id,
          round: 0,
          gdp: profile.startingGdpBillions,
          gdpGrowth: profile.startingGdpGrowth,
          inflation: profile.startingInflation,
          unemployment: 6.0,
          fiscalDeficit: 0,
          currencyIndex: 100,
          forexReserves: profile.startingForex,
          militaryStrength: profile.startingMilitary,
          approvalRating: 60,
          tradeIncome: profile.startingGdpBillions * 0.05,
          taxRevenue: profile.startingGdpBillions * profile.taxEfficiency * 0.20,
          creditRating: profile.startingCreditRating,
          trustScore: 80,
          tradeBalance,
          diplomacyScore: 0,
          treasury: 0,
          cumulativeDebt: profile.startingDebtToGdp * 100,
        },
      });
    }

    // Create game record
    await prisma.game.create({
      data: { currentRound: 0, phase: "waiting" },
    });

    // Return credentials for the admin to distribute
    const credentials = COUNTRIES.map(({ team }) => ({
      team: team.name,
      code: LOGIN_CODES[team.name] ?? team.name.toUpperCase().slice(0, 3) + "2026",
    }));

    return NextResponse.json({
      success: true,
      admin: { username: "admin", password: "episteme2026" },
      teams: credentials,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Seed failed", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
