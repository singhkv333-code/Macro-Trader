import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// POST /api/team/trade/respond
// Body: { agreementId: string, response: "accepted" | "rejected" }
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "team" || !session.teamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agreementId, response } = await req.json();
    if (!agreementId || !["accepted", "rejected"].includes(response)) {
      return NextResponse.json({ error: "agreementId and response (accepted|rejected) are required" }, { status: 400 });
    }

    const agreement = await prisma.tradeAgreement.findUnique({ where: { id: agreementId } });
    if (!agreement) {
      return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
    }
    if (agreement.receiverId !== session.teamId) {
      return NextResponse.json({ error: "You are not the receiver of this agreement" }, { status: 403 });
    }
    if (agreement.status !== "pending") {
      return NextResponse.json({ error: "Agreement is no longer pending" }, { status: 409 });
    }

    const updated = await prisma.tradeAgreement.update({
      where: { id: agreementId },
      data: { status: response },
    });

    return NextResponse.json({ success: true, status: updated.status });
  } catch (error) {
    console.error("Trade respond error:", error);
    return NextResponse.json({ error: "Failed to respond to trade deal" }, { status: 500 });
  }
}
