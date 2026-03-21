import { NextRequest, NextResponse } from "next/server";
import { signToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { role, teamName } = await req.json();

    if (role === "admin") {
      const token = signToken({
        userId: "admin-1",
        username: "admin",
        role: "admin",
        teamId: null,
      });

      const response = NextResponse.json({
        user: { id: "admin-1", username: "admin", role: "admin", teamId: null },
      });

      response.cookies.set("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });

      return response;
    }

    // Look up the real team from the database by name
    const team = await prisma.team.findFirst({ where: { name: teamName } });
    if (!team) {
      return NextResponse.json({ error: "Invalid team" }, { status: 400 });
    }

    const token = signToken({
      userId: `${team.id}-user`,
      username: `${team.name.toLowerCase().replace(/\s+/g, "")}1`,
      role: "team",
      teamId: team.id,
      teamName: team.name,
    });

    const response = NextResponse.json({
      user: {
        id: `${team.id}-user`,
        username: `${team.name.toLowerCase().replace(/\s+/g, "")}1`,
        role: "team",
        teamId: team.id,
        teamName: team.name,
        teamColor: team.color,
        teamEmoji: team.flagEmoji,
      },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  const teams = await prisma.team.findMany({
    select: { id: true, name: true, color: true, flagEmoji: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ teams });
}
