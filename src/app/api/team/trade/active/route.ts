import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/team/trade/active
// Returns all accepted TradeAgreements for the current team,
// including partner's country profile (resource surpluses/deficits)
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "team" || !session.teamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agreements = await prisma.tradeAgreement.findMany({
      where: {
        status: "accepted",
        OR: [
          { proposerId: session.teamId },
          { receiverId: session.teamId },
        ],
      },
      include: {
        proposer: {
          select: {
            id: true, name: true, flagEmoji: true, color: true,
            countryProfile: {
              select: {
                oilProduction: true, oilConsumption: true,
                metalsProduction: true, metalsConsumption: true,
                foodProduction: true, foodConsumption: true,
                semisProduction: true, semisConsumption: true,
                pharmaProduction: true, pharmaConsumption: true,
                textilesProduction: true, textilesConsumption: true,
              },
            },
          },
        },
        receiver: {
          select: {
            id: true, name: true, flagEmoji: true, color: true,
            countryProfile: {
              select: {
                oilProduction: true, oilConsumption: true,
                metalsProduction: true, metalsConsumption: true,
                foodProduction: true, foodConsumption: true,
                semisProduction: true, semisConsumption: true,
                pharmaProduction: true, pharmaConsumption: true,
                textilesProduction: true, textilesConsumption: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // For each agreement, identify the partner (the team that is not the current user)
    const activeDeals = agreements.map((a) => {
      const isProposer = a.proposerId === session.teamId;
      const partner = isProposer ? a.receiver : a.proposer;
      return {
        agreementId: a.id,
        roundProposed: a.roundProposed,
        partner: {
          id: partner.id,
          name: partner.name,
          flagEmoji: partner.flagEmoji,
          color: partner.color,
          resources: partner.countryProfile
            ? {
                oil:      (partner.countryProfile.oilProduction      - partner.countryProfile.oilConsumption),
                metals:   (partner.countryProfile.metalsProduction    - partner.countryProfile.metalsConsumption),
                food:     (partner.countryProfile.foodProduction      - partner.countryProfile.foodConsumption),
                semis:    (partner.countryProfile.semisProduction     - partner.countryProfile.semisConsumption),
                pharma:   (partner.countryProfile.pharmaProduction    - partner.countryProfile.pharmaConsumption),
                textiles: (partner.countryProfile.textilesProduction  - partner.countryProfile.textilesConsumption),
              }
            : null,
        },
      };
    });

    return NextResponse.json({ deals: activeDeals });
  } catch (error) {
    console.error("Trade active error:", error);
    return NextResponse.json({ error: "Failed to fetch active deals" }, { status: 500 });
  }
}
