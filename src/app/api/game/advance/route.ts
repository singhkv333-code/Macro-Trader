import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Session expired — please log in again" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { targetPhase } = await req.json();
    const game = await prisma.game.findFirst({ orderBy: { createdAt: "desc" } });
    if (!game) {
      return NextResponse.json({ error: "No game found" }, { status: 404 });
    }

    let update: { phase?: string; currentRound?: number } = {};

    switch (targetPhase) {
      case "input": {
        // Guard: only allow advancing to input from "waiting" or "results"
        if (game.phase !== "waiting" && game.phase !== "results") {
          return NextResponse.json(
            { error: `Cannot start next round from "${game.phase}" phase. Must be in "waiting" or "results" phase.` },
            { status: 400 }
          );
        }
        // Guard: max 4 rounds
        if (game.currentRound >= 4) {
          return NextResponse.json(
            { error: "Game is already at maximum rounds (4)" },
            { status: 400 }
          );
        }
        // Guard: if round > 0, ensure simulation ran for current round (RoundStates exist)
        if (game.currentRound > 0) {
          const statesExist = await prisma.roundState.findFirst({
            where: { round: game.currentRound },
          });
          if (!statesExist) {
            return NextResponse.json(
              { error: `Simulation has not been run for round ${game.currentRound} yet. Run simulation before advancing.` },
              { status: 400 }
            );
          }
        }
        update = { phase: "input", currentRound: game.currentRound + 1 };
        break;
      }
      case "simulating":
        if (game.phase !== "input") {
          return NextResponse.json(
            { error: `Cannot move to simulating from "${game.phase}". Must be in "input" phase.` },
            { status: 400 }
          );
        }
        update = { phase: "simulating" };
        break;
      case "results":
        update = { phase: "results" };
        break;
      case "waiting":
        update = { phase: "waiting" };
        break;
      default:
        return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
    }

    const updated = await prisma.game.update({
      where: { id: game.id },
      data: update,
    });

    return NextResponse.json({ game: updated });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
