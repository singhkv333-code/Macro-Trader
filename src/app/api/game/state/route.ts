import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateScores } from "@/lib/simulation/scoring";

export async function GET() {
  try {
    let game = await prisma.game.findFirst();
    if (!game) {
      game = await prisma.game.create({ data: { currentRound: 0, phase: "waiting" } });
    }

    const teams = await prisma.team.findMany({
      include: {
        roundStates: {
          orderBy: { round: "desc" },
          take: 6,
        },
        decisions: {
          orderBy: { round: "desc" },
          take: 1,
        },
        countryProfile: true,
      },
      orderBy: { name: "asc" },
    });

    const news = await prisma.newsEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const relations = await prisma.diplomaticRelation.findMany({
      where: { active: true },
    });

    const roundBuckets = teams.reduce<Record<number, typeof teams[number]["roundStates"]>>(
      (acc, team) => {
        for (const state of team.roundStates) {
          if (!acc[state.round]) {
            acc[state.round] = [];
          }
          acc[state.round].push(state);
        }
        return acc;
      },
      {}
    );

    const rounds = Object.keys(roundBuckets)
      .map(Number)
      .sort((a, b) => a - b);

    const scores =
      rounds.length > 0 ? calculateScores(rounds.map((round) => roundBuckets[round])) : [];
    const previousScores =
      rounds.length > 1
        ? calculateScores(rounds.slice(0, -1).map((round) => roundBuckets[round]))
        : [];

    return NextResponse.json({ game, teams, news, relations, scores, previousScores });
  } catch (error) {
    console.error("Game state error:", error);
    return NextResponse.json(
      { error: "Internal server error", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
