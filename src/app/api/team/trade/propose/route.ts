import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// POST /api/team/trade/propose
// Body: { targetTeamId: string }
// Creates a TradeAgreement with status="pending"
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "team" || !session.teamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { targetTeamId } = await req.json();
    if (!targetTeamId) {
      return NextResponse.json({ error: "targetTeamId is required" }, { status: 400 });
    }
    if (targetTeamId === session.teamId) {
      return NextResponse.json({ error: "Cannot propose a deal with yourself" }, { status: 400 });
    }

    const game = await prisma.game.findFirst({ orderBy: { createdAt: "desc" } });
    if (!game) {
      return NextResponse.json({ error: "No game found" }, { status: 404 });
    }

    // Check if a deal already exists between these two teams
    const existing = await prisma.tradeAgreement.findFirst({
      where: {
        gameId: game.id,
        OR: [
          { proposerId: session.teamId, receiverId: targetTeamId },
          { proposerId: targetTeamId, receiverId: session.teamId },
        ],
        status: { in: ["pending", "accepted"] },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "A deal already exists or is pending with this team" }, { status: 409 });
    }

    // Enforce max 3 new proposals per round
    const proposalsThisRound = await prisma.tradeAgreement.count({
      where: {
        gameId: game.id,
        proposerId: session.teamId,
        roundProposed: game.currentRound,
      },
    });
    if (proposalsThisRound >= 3) {
      return NextResponse.json({ error: "Maximum 3 proposals per round" }, { status: 429 });
    }

    const targetTeam = await prisma.team.findUnique({ where: { id: targetTeamId } });
    if (!targetTeam) {
      return NextResponse.json({ error: "Target team not found" }, { status: 404 });
    }

    const agreement = await prisma.tradeAgreement.create({
      data: {
        gameId: game.id,
        roundProposed: game.currentRound,
        proposerId: session.teamId,
        receiverId: targetTeamId,
        status: "pending",
      },
    });

    return NextResponse.json({ agreementId: agreement.id, targetName: targetTeam.name });
  } catch (error) {
    console.error("Trade propose error:", error);
    return NextResponse.json({ error: "Failed to propose trade deal" }, { status: 500 });
  }
}
