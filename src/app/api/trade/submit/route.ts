import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const VALID_COMMODITIES = ["oil", "metals", "food", "semis", "pharma", "textiles"];
const VALID_DIRECTIONS  = ["export", "import"];

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "team") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const game = await prisma.game.findFirst({ orderBy: { createdAt: "desc" } });
    if (!game || game.phase !== "input") {
      return NextResponse.json({ error: "Not accepting orders right now" }, { status: 400 });
    }

    const { orders } = await req.json();
    if (!Array.isArray(orders)) {
      return NextResponse.json({ error: "orders must be an array" }, { status: 400 });
    }

    const round = game.currentRound;

    for (const order of orders) {
      const { commodity, direction, quantity } = order;

      if (!VALID_COMMODITIES.includes(commodity)) continue;
      if (!VALID_DIRECTIONS.includes(direction)) continue;
      if (typeof quantity !== "number" || quantity < 0 || quantity > 15) continue;

      await prisma.tradeOrder.upsert({
        where: {
          teamId_round_commodity_direction: {
            teamId: session.teamId!,
            round,
            commodity,
            direction,
          },
        },
        update: { quantity },
        create: {
          teamId: session.teamId!,
          round,
          commodity,
          direction,
          quantity,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
