import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// ─── V2 Country Data (Compressed Balance) ────────────────────────────────────────
// All multipliers compressed to 0.85–1.15 range (±15% from 1.0)
// All GDPs compressed to $900B–$1100B range
// All debt ratios compressed to 20%–90%
// All inflations compressed to 1%–10%
// Population normalized to 85–115 range
const COUNTRIES = [
  {
    team: { name: "India", flagEmoji: "🇮🇳", color: "#FF6B35" },
    profile: {
      countryName: "Republic of India",
      productivityFactor: 0.90, tradeMultiplier: 1.10, monetaryPower: 0.92,
      taxEfficiency: 0.80, potentialGrowth: 4.5, creditSpread: 0.025,
      startingDebtToGdp: 0.65, rNeutral: 6.5,
      startingRevenue: 160.0, startingDebtService: 29.25, startingNetBudget: 130.75,
      startingGdpBillions: 1000, startingGdpGrowth: 4.2,
      startingInflation: 5.0, startingForex: 180, startingMilitary: 65,
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
      productivityFactor: 1.12, tradeMultiplier: 0.95, monetaryPower: 1.12,
      taxEfficiency: 0.92, potentialGrowth: 2.5, creditSpread: 0.02,
      startingDebtToGdp: 0.80, rNeutral: 4.5,
      startingRevenue: 202.4, startingDebtService: 35.2, startingNetBudget: 167.2,
      startingGdpBillions: 1100, startingGdpGrowth: 2.4,
      startingInflation: 3.0, startingForex: 200, startingMilitary: 150,
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
      productivityFactor: 1.00, tradeMultiplier: 1.15, monetaryPower: 0.88,
      taxEfficiency: 0.85, potentialGrowth: 4.0, creditSpread: 0.03,
      startingDebtToGdp: 0.60, rNeutral: 6.0,
      startingRevenue: 183.6, startingDebtService: 32.4, startingNetBudget: 151.2,
      startingGdpBillions: 1080, startingGdpGrowth: 4.5,
      startingInflation: 1.0, startingForex: 220, startingMilitary: 130,
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
      productivityFactor: 1.10, tradeMultiplier: 1.15, monetaryPower: 1.05,
      taxEfficiency: 0.93, potentialGrowth: 2.0, creditSpread: 0.02,
      startingDebtToGdp: 0.55, rNeutral: 4.0,
      startingRevenue: 195.3, startingDebtService: 23.1, startingNetBudget: 172.2,
      startingGdpBillions: 1050, startingGdpGrowth: 1.2,
      startingInflation: 2.5, startingForex: 180, startingMilitary: 80,
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
      productivityFactor: 1.08, tradeMultiplier: 1.05, monetaryPower: 0.85,
      taxEfficiency: 0.90, potentialGrowth: 1.5, creditSpread: 0.01,
      startingDebtToGdp: 0.90, rNeutral: 3.5,
      startingRevenue: 189.0, startingDebtService: 28.35, startingNetBudget: 160.65,
      startingGdpBillions: 1050, startingGdpGrowth: 1.0,
      startingInflation: 2.5, startingForex: 190, startingMilitary: 60,
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
      productivityFactor: 0.88, tradeMultiplier: 1.05, monetaryPower: 0.95,
      taxEfficiency: 0.78, potentialGrowth: 3.5, creditSpread: 0.025,
      startingDebtToGdp: 0.60, rNeutral: 5.5,
      startingRevenue: 149.76, startingDebtService: 25.92, startingNetBudget: 123.84,
      startingGdpBillions: 960, startingGdpGrowth: 2.5,
      startingInflation: 4.5, startingForex: 150, startingMilitary: 55,
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
      productivityFactor: 1.05, tradeMultiplier: 1.05, monetaryPower: 1.12,
      taxEfficiency: 0.90, potentialGrowth: 2.0, creditSpread: 0.025,
      startingDebtToGdp: 0.70, rNeutral: 4.0,
      startingRevenue: 183.6, startingDebtService: 32.13, startingNetBudget: 151.47,
      startingGdpBillions: 1020, startingGdpGrowth: 1.5,
      startingInflation: 3.5, startingForex: 170, startingMilitary: 75,
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
      productivityFactor: 0.88, tradeMultiplier: 0.95, monetaryPower: 0.88,
      taxEfficiency: 0.78, potentialGrowth: 2.5, creditSpread: 0.03,
      startingDebtToGdp: 0.20, rNeutral: 4.5,
      startingRevenue: 146.64, startingDebtService: 9.4, startingNetBudget: 137.24,
      startingGdpBillions: 940, startingGdpGrowth: 2.0,
      startingInflation: 7.0, startingForex: 160, startingMilitary: 120,
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
      productivityFactor: 1.08, tradeMultiplier: 1.12, monetaryPower: 1.00,
      taxEfficiency: 0.88, potentialGrowth: 3.0, creditSpread: 0.02,
      startingDebtToGdp: 0.45, rNeutral: 5.0,
      startingRevenue: 176.0, startingDebtService: 18.0, startingNetBudget: 158.0,
      startingGdpBillions: 1000, startingGdpGrowth: 2.2,
      startingInflation: 2.8, startingForex: 170, startingMilitary: 70,
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
      productivityFactor: 0.92, tradeMultiplier: 1.05, monetaryPower: 0.90,
      taxEfficiency: 0.82, potentialGrowth: 3.5, creditSpread: 0.02,
      startingDebtToGdp: 0.25, rNeutral: 5.5,
      startingRevenue: 155.8, startingDebtService: 9.5, startingNetBudget: 146.3,
      startingGdpBillions: 950, startingGdpGrowth: 3.5,
      startingInflation: 2.0, startingForex: 190, startingMilitary: 85,
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
      productivityFactor: 0.85, tradeMultiplier: 0.95, monetaryPower: 0.85,
      taxEfficiency: 0.75, potentialGrowth: 4.5, creditSpread: 0.03,
      startingDebtToGdp: 0.35, rNeutral: 6.5,
      startingRevenue: 135.0, startingDebtService: 15.75, startingNetBudget: 119.25,
      startingGdpBillions: 900, startingGdpGrowth: 3.0,
      startingInflation: 8.0, startingForex: 100, startingMilitary: 35,
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
      productivityFactor: 1.05, tradeMultiplier: 1.08, monetaryPower: 1.05,
      taxEfficiency: 0.90, potentialGrowth: 3.0, creditSpread: 0.02,
      startingDebtToGdp: 0.40, rNeutral: 5.0,
      startingRevenue: 180.0, startingDebtService: 16.0, startingNetBudget: 164.0,
      startingGdpBillions: 1000, startingGdpGrowth: 2.5,
      startingInflation: 3.5, startingForex: 160, startingMilitary: 55,
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
      productivityFactor: 0.90, tradeMultiplier: 1.08, monetaryPower: 0.88,
      taxEfficiency: 0.80, potentialGrowth: 4.0, creditSpread: 0.025,
      startingDebtToGdp: 0.30, rNeutral: 6.0,
      startingRevenue: 150.4, startingDebtService: 12.69, startingNetBudget: 137.71,
      startingGdpBillions: 940, startingGdpGrowth: 4.0,
      startingInflation: 10.0, startingForex: 120, startingMilitary: 60,
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
      productivityFactor: 1.12, tradeMultiplier: 1.02, monetaryPower: 1.10,
      taxEfficiency: 0.93, potentialGrowth: 2.0, creditSpread: 0.01,
      startingDebtToGdp: 0.30, rNeutral: 4.0,
      startingRevenue: 189.72, startingDebtService: 9.18, startingNetBudget: 180.54,
      startingGdpBillions: 1020, startingGdpGrowth: 1.2,
      startingInflation: 1.5, startingForex: 200, startingMilitary: 40,
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
      productivityFactor: 0.88, tradeMultiplier: 1.10, monetaryPower: 0.92,
      taxEfficiency: 0.78, potentialGrowth: 3.5, creditSpread: 0.03,
      startingDebtToGdp: 0.45, rNeutral: 5.5,
      startingRevenue: 149.76, startingDebtService: 21.6, startingNetBudget: 128.16,
      startingGdpBillions: 960, startingGdpGrowth: 3.2,
      startingInflation: 4.5, startingForex: 140, startingMilitary: 50,
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
];

async function main() {
  console.log("🌍 Seeding Macro Trader V2 database...");

  // Clear all data in dependency order
  await prisma.powerUpUsage.deleteMany();
  await prisma.tradeTransaction.deleteMany();
  await prisma.tradeOrder.deleteMany();
  await prisma.tradeAgreement.deleteMany();
  await prisma.newsEvent.deleteMany();
  await prisma.diplomaticRelation.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.roundState.deleteMany();
  await prisma.countryProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();
  await prisma.game.deleteMany();

  // Create admin
  await prisma.user.create({
    data: {
      username: "admin",
      password: await bcrypt.hash("episteme2026", 10),
      role: "admin",
    },
  });
  console.log("✅ Created admin user (admin / episteme2026)");

  // Create teams
  for (const { team: teamDef, profile } of COUNTRIES) {
    const team = await prisma.team.create({
      data: { name: teamDef.name, color: teamDef.color, flagEmoji: teamDef.flagEmoji },
    });

    await prisma.countryProfile.create({
      data: { teamId: team.id, ...profile },
    });

    // Username: lowercase name, no spaces
    const slug = teamDef.name.toLowerCase().replace(/\s+/g, "");
    const username = slug + "1";
    const password = slug + "123";

    await prisma.user.create({
      data: {
        username,
        password: await bcrypt.hash(password, 10),
        role: "team",
        teamId: team.id,
      },
    });

    // Round-0 initial state using country profile
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
        tradeIncome: profile.startingGdpBillions * 0.05, // 5% of GDP
        taxRevenue: profile.startingGdpBillions * profile.taxEfficiency * 0.20,
        creditRating: profile.startingCreditRating,
        trustScore: 80,
        tradeBalance: (profile.oilProduction - profile.oilConsumption)
                    + (profile.metalsProduction - profile.metalsConsumption)
                    + (profile.foodProduction - profile.foodConsumption)
                    + (profile.semisProduction - profile.semisConsumption)
                    + (profile.pharmaProduction - profile.pharmaConsumption)
                    + (profile.textilesProduction - profile.textilesConsumption),
        diplomacyScore: 0,
        treasury: 0,
        cumulativeDebt: profile.startingDebtToGdp * 100, // convert to %
      },
    });

    console.log(`✅ Created: ${teamDef.name} (${username} / ${password})`);
  }

  // Create initial game
  await prisma.game.create({
    data: { currentRound: 0, phase: "waiting" },
  });

  console.log("🎮 Seeding complete! 15 nations ready for Macro Trader.");
  console.log("📊 Admin: admin / episteme2026");
  console.log("🌐 Teams: [countryslug]1 / [countryslug]123  e.g. india1 / india123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
