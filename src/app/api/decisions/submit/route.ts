import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "team") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const game = await prisma.game.findFirst({ orderBy: { createdAt: "desc" } });
    if (!game || game.phase !== "input") {
      return NextResponse.json({ error: "Not accepting decisions right now" }, { status: 400 });
    }

    const body = await req.json();
    const {
      interestRate,
      taxRate,
      infraSpending,
      subsidySpending,
      defenseSpending,
      borrowing,
      tradeOpenness,
      diplomaticAction,
      diplomaticTarget,
      usePowerUp,
    } = body;

    // Validate budget sums to 100
    const budgetSum = infraSpending + subsidySpending + defenseSpending;
    if (Math.abs(budgetSum - 100) > 0.1) {
      return NextResponse.json(
        { error: "Budget allocation must sum to 100%" },
        { status: 400 }
      );
    }

    // Check if already submitted
    const existing = await prisma.decision.findUnique({
      where: {
        teamId_round: { teamId: session.teamId!, round: game.currentRound },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Decisions already submitted for this round" },
        { status: 400 }
      );
    }

    // Handle power-up activation
    if (usePowerUp) {
      const profile = await prisma.countryProfile.findUnique({
        where: { teamId: session.teamId! },
      });
      if (profile && !profile.powerUpUsed) {
        await prisma.countryProfile.update({
          where: { teamId: session.teamId! },
          data: { powerUpUsed: true },
        });
        await prisma.powerUpUsage.create({
          data: {
            teamId: session.teamId!,
            round: game.currentRound,
            powerUpName: profile.powerUpName,
            effectJson: JSON.stringify({ activatedAt: new Date().toISOString() }),
          },
        });
      }
    }

    const decision = await prisma.decision.create({
      data: {
        teamId: session.teamId!,
        round: game.currentRound,
        interestRate,
        taxRate,
        infraSpending,
        subsidySpending,
        defenseSpending,
        borrowing,
        tradeOpenness: tradeOpenness ?? 0.5,
        diplomaticAction: diplomaticAction || "none",
        diplomaticTarget: diplomaticTarget || null,
        usePowerUp: usePowerUp ?? false,
      },
    });

    return NextResponse.json({ decision });
  } catch (err) {
    console.error("Decision submit error:", err);
    return NextResponse.json(
      { error: "Internal server error", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
