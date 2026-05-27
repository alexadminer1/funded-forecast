export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getLivePrice } from "@/lib/livePrice";

// Live unrealized PnL for the current user's open positions.
// Reads prices from the Redis live cache (background sync); falls back to the
// DB-cached Market price when the cache is missing/expired (marked priceSource:"cached").
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(authHeader.slice(7));
  if (!payload?.userId) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  const userId = payload.userId as number;

  try {
    const activeChallenge = await prisma.challenge.findFirst({
      where: { userId, status: "active" },
      select: { id: true },
    });

    const positions = await prisma.position.findMany({
      where: activeChallenge
        ? { userId, status: "open", challengeId: activeChallenge.id }
        : { userId, status: "open", challengeId: null },
      include: {
        market: { select: { id: true, yesPrice: true, noPrice: true, status: true } },
      },
      orderBy: { openedAt: "desc" },
    });

    let anyStale = false;

    const result = await Promise.all(
      positions.map(async (p) => {
        const live = await getLivePrice(p.marketId);
        let priceSource: "live" | "cached";
        let yesPrice: number;
        let noPrice: number;
        // Only trust the live cache for markets still live; resolved/closed use DB.
        if (live && p.market.status === "live") {
          yesPrice = live.yesPrice;
          noPrice = live.noPrice;
          priceSource = "live";
        } else {
          yesPrice = p.market.yesPrice;
          noPrice = p.market.noPrice;
          priceSource = "cached";
          anyStale = true;
        }
        const currentPrice = p.side === "yes" ? yesPrice : noPrice;
        const unrealizedPnl = parseFloat((p.shares * (currentPrice - p.avgPrice)).toFixed(2));
        const currentValue = parseFloat((p.shares * currentPrice).toFixed(2));
        return {
          id: p.id,
          marketId: p.marketId,
          side: p.side,
          shares: p.shares,
          avgPrice: p.avgPrice,
          currentPrice,
          currentValue,
          unrealizedPnl,
          priceSource,
        };
      }),
    );

    const totalUnrealizedPnl = parseFloat(
      result.reduce((s, p) => s + p.unrealizedPnl, 0).toFixed(2),
    );
    const totalCurrentValue = parseFloat(
      result.reduce((s, p) => s + p.currentValue, 0).toFixed(2),
    );

    return NextResponse.json({
      success: true,
      positions: result,
      summary: { totalUnrealizedPnl, totalCurrentValue },
      anyStale,
    });
  } catch (error) {
    console.error("[POSITIONS-LIVE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
