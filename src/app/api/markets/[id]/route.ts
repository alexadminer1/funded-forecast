export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Market ID required" }, { status: 400 });
  }

  try {
    const market = await prisma.market.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        imageUrl: true,
        yesPrice: true,
        noPrice: true,
        volume24h: true,
        endDate: true,
        status: true,
        slug: true,
        negRisk: true,
        winningOutcome: true,
        lastSyncedAt: true,
      },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    if (market.negRisk) {
      return NextResponse.json({ error: "Market not supported" }, { status: 400 });
    }

    return NextResponse.json({ success: true, market });

  } catch (error) {
    console.error("[MARKET-DETAIL]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
