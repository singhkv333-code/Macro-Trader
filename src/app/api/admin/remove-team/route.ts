import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { teamId } = await req.json();
  if (!teamId) {
    return NextResponse.json({ error: "teamId required" }, { status: 400 });
  }

  // Soft delete — data stays intact, team is excluded from game
  await prisma.team.update({ where: { id: teamId }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
