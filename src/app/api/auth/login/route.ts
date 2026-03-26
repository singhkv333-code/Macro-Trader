import { NextRequest, NextResponse } from "next/server";
import { signToken, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { role, username, password, teamName } = await req.json();

    if (role === "admin") {
      if (!username || !password) {
        return NextResponse.json({ error: "Username and password required" }, { status: 400 });
      }

      const adminUser = await prisma.user.findFirst({
        where: { username, role: "admin" },
      });

      if (!adminUser || !(await verifyPassword(password, adminUser.password))) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }

      const token = signToken({
        userId: adminUser.id,
        username: adminUser.username,
        role: "admin",
        teamId: null,
      });

      const response = NextResponse.json({
        user: { id: adminUser.id, username: adminUser.username, role: "admin", teamId: null },
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

    // Team login — look up team by name, then verify the team user's password
    if (!teamName || !password) {
      return NextResponse.json({ error: "Team and password required" }, { status: 400 });
    }

    const team = await prisma.team.findFirst({ where: { name: teamName } });
    if (!team) {
      return NextResponse.json({ error: "Invalid team" }, { status: 400 });
    }

    const teamUser = await prisma.user.findFirst({
      where: { teamId: team.id, role: "team" },
    });

    if (!teamUser || !(await verifyPassword(password, teamUser.password))) {
      return NextResponse.json({ error: "Invalid team code" }, { status: 401 });
    }

    const token = signToken({
      userId: teamUser.id,
      username: teamUser.username,
      role: "team",
      teamId: team.id,
      teamName: team.name,
    });

    const response = NextResponse.json({
      user: {
        id: teamUser.id,
        username: teamUser.username,
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
