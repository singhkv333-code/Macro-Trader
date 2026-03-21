import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { DEFAULT_TEAMS, INITIAL_STATE } from "@/lib/constants";

export async function POST() {
  try {
    // Clear existing data
    await prisma.newsEvent.deleteMany();
    await prisma.diplomaticRelation.deleteMany();
    await prisma.decision.deleteMany();
    await prisma.roundState.deleteMany();
    await prisma.user.deleteMany();
    await prisma.team.deleteMany();
    await prisma.game.deleteMany();

    // Create admin user
    const adminPassword = await hashPassword("episteme2026");
    await prisma.user.create({
      data: {
        username: "admin",
        password: adminPassword,
        role: "admin",
      },
    });

    // Create teams with users and initial states
    for (const teamDef of DEFAULT_TEAMS) {
      const team = await prisma.team.create({
        data: {
          name: teamDef.name,
          color: teamDef.color,
          flagEmoji: teamDef.flagEmoji,
        },
      });

      // Create team user
      const username = teamDef.name.toLowerCase().replace(/\s+/g, "") + "1";
      const password = await hashPassword(teamDef.name.toLowerCase().replace(/\s+/g, "") + "123");
      await prisma.user.create({
        data: {
          username,
          password,
          role: "team",
          teamId: team.id,
        },
      });

      // Create initial round state (round 0)
      await prisma.roundState.create({
        data: {
          teamId: team.id,
          round: 0,
          gdpGrowth: INITIAL_STATE.gdpGrowth,
          gdp: INITIAL_STATE.gdp,
          inflation: INITIAL_STATE.inflation,
          unemployment: INITIAL_STATE.unemployment,
          fiscalDeficit: INITIAL_STATE.fiscalDeficit,
          currencyIndex: INITIAL_STATE.currencyIndex,
          forexReserves: INITIAL_STATE.forexReserves,
          militaryStrength: INITIAL_STATE.militaryStrength,
          approvalRating: INITIAL_STATE.approvalRating,
          tradeIncome: INITIAL_STATE.tradeIncome,
          taxRevenue: INITIAL_STATE.taxRevenue,
          creditRating: INITIAL_STATE.creditRating,
          trustScore: INITIAL_STATE.trustScore,
        },
      });
    }

    // Create game record
    await prisma.game.create({
      data: {
        currentRound: 0,
        phase: "waiting",
      },
    });

    // Generate team credentials for response
    const credentials = DEFAULT_TEAMS.map((t) => ({
      team: t.name,
      username: t.name.toLowerCase().replace(/\s+/g, "") + "1",
      password: t.name.toLowerCase().replace(/\s+/g, "") + "123",
    }));

    return NextResponse.json({
      success: true,
      admin: { username: "admin", password: "episteme2026" },
      teams: credentials,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
