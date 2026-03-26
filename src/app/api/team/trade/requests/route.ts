import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/team/trade/requests
// Returns all pending TradeAgreements where the current team is the receiver
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "team" || !session.teamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requests = await prisma.tradeAgreement.findMany({
      where: {
        receiverId: session.teamId,
        status: "pending",
      },
      include: {
        proposer: {
          select: { id: true, name: true, flagEmoji: true, color: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Trade requests error:", error);
    return NextResponse.json({ error: "Failed to fetch trade requests" }, { status: 500 });
  }
}
