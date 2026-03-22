import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { INITIAL_STATE } from "@/lib/constants";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete all round data
    await prisma.newsEvent.deleteMany();
    await prisma.diplomaticRelation.deleteMany();
    await prisma.decision.deleteMany();
    await prisma.roundState.deleteMany();

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

    // Re-create round 0 states for all teams
    const teams = await prisma.team.findMany();
    for (const team of teams) {
      await prisma.roundState.create({
        data: {
          teamId: team.id,
          round: 0,
          ...INITIAL_STATE,
        },
      });
    }

    return NextResponse.json({ success: true, message: "Game reset to round 0" });
  } catch (error) {
    console.error("Reset error:", error);
    return NextResponse.json({ error: "Failed to reset game" }, { status: 500 });
  }
}
