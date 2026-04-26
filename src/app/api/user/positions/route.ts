export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const userId = payload.userId as number;

  try {
    const positions = await prisma.position.findMany({
      where: { userId, status: "open" },
      include: {
        market: {
          select: {
            id: true,
            title: true,
            yesPrice: true,
            noPrice: true,
            category: true,
            endDate: true,
            status: true,
          },
        },
      },
      orderBy: { openedAt: "desc" },
    });

    const result = positions.map((p) => {
      const currentPrice = p.side === "yes" ? p.market.yesPrice : p.market.noPrice;
      const unrealizedPnl = parseFloat(
        (p.shares * (currentPrice - p.avgPrice)).toFixed(2)
      );
      const currentValue = parseFloat((p.shares * currentPrice).toFixed(2));

      return {
        id: p.id,
        marketId: p.marketId,
        marketTitle: p.market.title,
        marketCategory: p.market.category,
        marketEndDate: p.market.endDate,
        marketStatus: p.market.status,
        side: p.side,
        shares: p.shares,
        avgPrice: p.avgPrice,
        currentPrice,
        costBasis: p.costBasis,
        currentValue,
        unrealizedPnl,
        realizedPnl: p.realizedPnl,
        openedAt: p.openedAt,
      };
    });

    const totalUnrealized = parseFloat(
      result.reduce((sum, p) => sum + p.unrealizedPnl, 0).toFixed(2)
    );

    const totalRealized = parseFloat(
      result.reduce((sum, p) => sum + p.realizedPnl, 0).toFixed(2)
    );

    return NextResponse.json({
      success: true,
      positions: result,
      summary: {
        count: result.length,
        totalUnrealizedPnl: totalUnrealized,
        totalRealizedPnl: totalRealized,
      },
    });

  } catch (error) {
    console.error("[POSITIONS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
