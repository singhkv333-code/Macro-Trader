import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { runSimulation } from "@/lib/simulation/engine";

// Allow up to 60 seconds on Vercel — simulation needs ~8-12s with Supabase latency
export const maxDuration = 60;

export async function POST() {
  let gameId: string | null = null;

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Session expired — please log in again" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Fetch game + teams + decisions in parallel (was 3 sequential round-trips = ~3.6s wasted)
    const [game, teams, allDecisions] = await Promise.all([
      prisma.game.findFirst(),
      prisma.team.findMany({ select: { id: true } }),
      prisma.decision.findMany({ select: { teamId: true, round: true } }),
    ]);

    if (!game) {
      return NextResponse.json({ error: "No game found" }, { status: 404 });
    }
    gameId = game.id;

    if (game.phase !== "simulating") {
      return NextResponse.json(
        { error: "Game must be in simulating phase" },
        { status: 400 }
      );
    }

    // Auto-submit default decisions for teams that haven't submitted
    const submittedTeamIds = new Set(
      allDecisions.filter((d) => d.round === game.currentRound).map((d) => d.teamId)
    );
    const unsubmittedTeams = teams.filter((t) => !submittedTeamIds.has(t.id));

    if (unsubmittedTeams.length > 0) {
      // Fetch all previous decisions in parallel, then batch-create defaults
      const prevDecisions = await Promise.all(
        unsubmittedTeams.map((t) =>
          prisma.decision.findUnique({
            where: { teamId_round: { teamId: t.id, round: game.currentRound - 1 } },
          })
        )
      );
      await Promise.all(
        unsubmittedTeams.map((team, i) => {
          const prev = prevDecisions[i];
          return prisma.decision.create({
            data: {
              teamId: team.id,
              round: game.currentRound,
              interestRate: prev?.interestRate ?? 5.0,
              taxRate: prev?.taxRate ?? 20,
              infraSpending: prev?.infraSpending ?? 34,
              subsidySpending: prev?.subsidySpending ?? 33,
              defenseSpending: prev?.defenseSpending ?? 33,
              borrowing: prev?.borrowing ?? 0,
              tradeOpenness: prev?.tradeOpenness ?? 0.5,
              diplomaticAction: "none",
              diplomaticTarget: null,
            },
          });
        })
      );
    }

    try {
      const news = await runSimulation(game.currentRound);

      // Move to results phase
      await prisma.game.update({
        where: { id: game.id },
        data: { phase: "results" },
      });

      return NextResponse.json({ success: true, news });
    } catch (simError) {
      console.error("Simulation engine error:", simError);

      // Simulation threw — still move to results so admin isn't stuck
      await prisma.game.update({
        where: { id: game.id },
        data: { phase: "results" },
      });

      return NextResponse.json(
        {
          error: "Simulation failed: " + (simError instanceof Error ? simError.message : "Unknown error"),
          recoveredToResults: true,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Simulation route error:", error);

    // Outer catch: also reset phase so game is never stuck in "simulating"
    if (gameId) {
      try {
        await prisma.game.update({
          where: { id: gameId },
          data: { phase: "results" },
        });
      } catch { /* ignore — best effort */ }
    }

    return NextResponse.json({ error: "Simulation failed" }, { status: 500 });
  }
}
