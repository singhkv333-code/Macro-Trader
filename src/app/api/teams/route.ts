import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hashPassword } from "@/lib/auth";

export async function GET() {
  try {
    const teams = await prisma.team.findMany({
      include: {
        users: { select: { id: true, username: true } },
        roundStates: { orderBy: { round: "asc" } },
      },
    });
    return NextResponse.json({ teams });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, color, flagEmoji, username, password } = await req.json();

    const team = await prisma.team.create({
      data: { name, color, flagEmoji },
    });

    // Create initial round state
    await prisma.roundState.create({
      data: {
        teamId: team.id,
        round: 0,
        gdpGrowth: 3.0,
        gdp: 1000,
        inflation: 4.0,
        unemployment: 6.0,
        fiscalDeficit: 0,
        currencyIndex: 100,
        forexReserves: 200,
        militaryStrength: 50,
        approvalRating: 60,
        tradeIncome: 50,
        taxRevenue: 200,
        creditRating: "A",
        trustScore: 80,
      },
    });

    // Create team user if provided
    if (username && password) {
      const hashedPassword = await hashPassword(password);
      await prisma.user.create({
        data: {
          username,
          password: hashedPassword,
          role: "team",
          teamId: team.id,
        },
      });
    }

    return NextResponse.json({ team });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await req.json();

    await prisma.user.deleteMany({ where: { teamId } });
    await prisma.decision.deleteMany({ where: { teamId } });
    await prisma.roundState.deleteMany({ where: { teamId } });
    await prisma.diplomaticRelation.deleteMany({
      where: { OR: [{ fromTeamId: teamId }, { toTeamId: teamId }] },
    });
    await prisma.team.delete({ where: { id: teamId } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
