export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { MIN_DAILY_VOLUME_PCT } from "@/lib/engine/constants";

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
    // TODO [A1]: replace with native walletId filter after wallet model implementation
    const activeChallenge = await prisma.challenge.findFirst({
      where: { userId, status: "active" },
      select: { id: true, startBalance: true },
    });

    const positions = await prisma.position.findMany({
      where: activeChallenge
        ? { userId, status: "open", challengeId: activeChallenge.id }
        : { userId, status: "open", challengeId: null },
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

    // Augment activeChallenge with today's buy volume + rule #8 lower bound.
    // Same UTC-day pattern as /api/user/me (kept duplicated to avoid coupling endpoints).
    let todayBuyVolume = 0;
    let minDailyVolumeUsd = 0;
    if (activeChallenge) {
      minDailyVolumeUsd = parseFloat(
        (activeChallenge.startBalance * (MIN_DAILY_VOLUME_PCT / 100)).toFixed(2),
      );
      const todayUtcDateStr = new Date().toISOString().slice(0, 10);
      const rows = await prisma.$queryRaw<{ volume: Prisma.Decimal | number | null }[]>(Prisma.sql`
        SELECT COALESCE(SUM("cost"), 0) AS volume
        FROM "Trade"
        WHERE "challengeId" = ${activeChallenge.id}
          AND "action" = 'buy'
          AND DATE("createdAt") = ${todayUtcDateStr}::date
      `);
      const raw = rows[0]?.volume;
      todayBuyVolume = raw == null ? 0 : parseFloat(Number(raw).toFixed(2));
    }

    return NextResponse.json({
      success: true,
      activeChallenge: activeChallenge
        ? {
            id: activeChallenge.id,
            startBalance: activeChallenge.startBalance,
            todayBuyVolume,
            minDailyVolumeUsd,
          }
        : null,
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
