import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventType } = await req.json();
    const game = await prisma.game.findFirst();
    if (!game) {
      return NextResponse.json({ error: "No game found" }, { status: 404 });
    }

    const globalEvent = eventType === "none" ? null : eventType;

    const updated = await prisma.game.update({
      where: { id: game.id },
      data: { globalEvent },
    });

    return NextResponse.json({ game: updated });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
