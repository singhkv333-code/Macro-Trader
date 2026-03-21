import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { runSimulation } from "@/lib/simulation/engine";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const game = await prisma.game.findFirst();
    if (!game) {
      return NextResponse.json({ error: "No game found" }, { status: 404 });
    }

    if (game.phase !== "simulating") {
      return NextResponse.json(
        { error: "Game must be in simulating phase" },
        { status: 400 }
      );
    }

    // Auto-submit default decisions for teams that haven't submitted
    const teams = await prisma.team.findMany({ select: { id: true } });
    const existingDecisions = await prisma.decision.findMany({
      where: { round: game.currentRound },
      select: { teamId: true },
    });
    const submittedTeamIds = new Set(existingDecisions.map((d) => d.teamId));

    for (const team of teams) {
      if (!submittedTeamIds.has(team.id)) {
        // Get previous round's decision for defaults, or use baseline
        const prevDecision = await prisma.decision.findUnique({
          where: { teamId_round: { teamId: team.id, round: game.currentRound - 1 } },
        });

        await prisma.decision.create({
          data: {
            teamId: team.id,
            round: game.currentRound,
            interestRate: prevDecision?.interestRate ?? 5.0,
            taxRate: prevDecision?.taxRate ?? 20,
            infraSpending: prevDecision?.infraSpending ?? 34,
            subsidySpending: prevDecision?.subsidySpending ?? 33,
            defenseSpending: prevDecision?.defenseSpending ?? 33,
            borrowing: prevDecision?.borrowing ?? 0,
            tradeOpenness: prevDecision?.tradeOpenness ?? 0.5,
            diplomaticAction: "none",
            diplomaticTarget: null,
          },
        });
      }
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

      // Reset phase back to input so the game isn't stuck
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
    return NextResponse.json({ error: "Simulation failed" }, { status: 500 });
  }
}
