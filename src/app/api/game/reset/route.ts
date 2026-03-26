import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete all round data
    await prisma.tradeAgreement.deleteMany();
    await prisma.newsEvent.deleteMany();
    await prisma.diplomaticRelation.deleteMany();
    await prisma.decision.deleteMany();
    await prisma.roundState.deleteMany();
    await prisma.tradeOrder.deleteMany();
    await prisma.tradeTransaction.deleteMany();
    await prisma.powerUpUsage.deleteMany();

    // Reset game to round 0, waiting
    const game = await prisma.game.findFirst({ orderBy: { createdAt: "desc" } });
    if (game) {
      await prisma.game.update({
        where: { id: game.id },
        data: {
          currentRound: 0,
          phase: "waiting",
          globalEvent: null,
          oilPriceIndex: 100,
          isLeaderboardVisible: true,
        },
      });
    }

    // Reset power-up usage flags + rebuild round 0 states in parallel
    const [, teams] = await Promise.all([
      prisma.countryProfile.updateMany({ data: { powerUpUsed: false } }),
      prisma.team.findMany({ include: { countryProfile: true } }),
    ]);

    const round0States = teams
      .filter((t) => t.countryProfile)
      .map((team) => {
        const cp = team.countryProfile!;
        const debtAmount = cp.startingDebtToGdp * cp.startingGdpBillions;
        const debtService = debtAmount * (0.02 + cp.creditSpread);
        const revenue = cp.startingGdpBillions * 0.20 * cp.taxEfficiency;
        const netBudget = Math.max(0, revenue - debtService);
        return {
          teamId: team.id,
          round: 0,
          gdp: cp.startingGdpBillions,
          gdpGrowth: cp.startingGdpGrowth,
          inflation: cp.startingInflation,
          unemployment: 6.0,
          fiscalDeficit: 0,
          currencyIndex: 100,
          forexReserves: cp.startingForex,
          militaryStrength: cp.startingMilitary,
          approvalRating: 60,
          tradeIncome: cp.startingGdpBillions * 0.05,
          taxRevenue: revenue,
          creditRating: cp.startingCreditRating,
          trustScore: 80,
          tradeBalance: (cp.oilProduction - cp.oilConsumption)
                      + (cp.metalsProduction - cp.metalsConsumption)
                      + (cp.foodProduction - cp.foodConsumption)
                      + (cp.semisProduction - cp.semisConsumption)
                      + (cp.pharmaProduction - cp.pharmaConsumption)
                      + (cp.textilesProduction - cp.textilesConsumption),
          diplomacyScore: 0,
          treasury: 0,
          cumulativeDebt: cp.startingDebtToGdp * 100,
          revenue: revenue,
          debtServicePaid: debtService,
          budgetAvailable: netBudget,
          gdpScore: null,
          inflationScore: null,
          fiscalScore: null,
          forexScore: null,
        };
      });

    await prisma.roundState.createMany({ data: round0States });

    return NextResponse.json({ success: true, message: "Game reset to round 0" });
  } catch (error) {
    console.error("Reset error:", error);
    return NextResponse.json({ error: "Failed to reset game" }, { status: 500 });
  }
}
