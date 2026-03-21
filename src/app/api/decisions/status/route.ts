import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const game = await prisma.game.findFirst();
    if (!game) {
      return NextResponse.json({ error: "No game found" }, { status: 404 });
    }

    const teams = await prisma.team.findMany({ select: { id: true, name: true, flagEmoji: true } });
    const decisions = await prisma.decision.findMany({
      where: { round: game.currentRound },
      select: { teamId: true, submittedAt: true },
    });

    const status = teams.map((team) => {
      const decision = decisions.find((d) => d.teamId === team.id);
      return {
        teamId: team.id,
        teamName: team.name,
        flagEmoji: team.flagEmoji,
        submitted: !!decision,
        submittedAt: decision?.submittedAt || null,
      };
    });

    return NextResponse.json({ round: game.currentRound, status });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
