export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveMarketPositions } from "@/lib/marketResolve";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

interface PolymarketMarket {
  id: string;
  conditionId: string;
  closed: boolean;
  active: boolean;
  outcomePrices: string;
  resolutionSource?: string;
  endDateIso: string;
}

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // 1. Get our live markets (skip negRisk — those resolve manually via force_resolve)
    const liveMarkets = await prisma.market.findMany({
      where: { status: "live" },
      select: { id: true, conditionId: true, negRisk: true },
    });

    if (liveMarkets.length === 0) {
      return NextResponse.json({ success: true, resolved: 0, message: "No live markets" });
    }

    const negRiskIds = new Set(
      liveMarkets.filter((m) => m.negRisk).map((m) => m.id)
    );
    const eligibleMarketIds = new Set(
      liveMarkets.filter((m) => !m.negRisk).map((m) => m.id)
    );

    // 2. Fetch from Polymarket
    const res = await fetch(
      `https://gamma-api.polymarket.com/markets?limit=100&closed=true`,
      { headers: { Accept: "application/json" }, cache: "no-store" }
    );

    if (!res.ok) {
      throw new Error(`Polymarket API error: ${res.status}`);
    }

    const markets: PolymarketMarket[] = await res.json();

    let skippedNegRisk = 0;

    // 3. Filter resolved markets (negRisk excluded — handled manually)
    const resolvedMarkets = markets.filter((m) => {
      if (negRiskIds.has(m.id)) {
        console.warn(`[RESOLVE] negRisk skipped auto-resolve: ${m.id}`);
        skippedNegRisk++;
        return false;
      }
      if (!eligibleMarketIds.has(m.id)) return false;
      if (!m.closed) return false;
      try {
        const prices = JSON.parse(m.outcomePrices);
        const yesPrice = parseFloat(prices[0]);
        const noPrice = parseFloat(prices[1]);
        return yesPrice > 0.99 || noPrice > 0.99;
      } catch {
        return false;
      }
    });

    let totalResolved = 0;
    let totalPositionsProcessed = 0;

    for (const polyMarket of resolvedMarkets) {
      // Determine winner
      const prices = JSON.parse(polyMarket.outcomePrices);
      const yesPrice = parseFloat(prices[0]);
      const winningOutcome: "yes" | "no" = yesPrice > 0.99 ? "yes" : "no";

      // Update market status
      await prisma.market.update({
        where: { id: polyMarket.id },
        data: {
          status: "resolved",
          winningOutcome,
          resolutionSource: "polymarket_api",
          resolvedExternalAt: new Date(),
        },
      });

      // Resolve open positions via shared lib
      const { positionsProcessed } = await resolveMarketPositions(
        polyMarket.id,
        winningOutcome
      );

      totalPositionsProcessed += positionsProcessed;

      // Audit log
      await prisma.auditLog.create({
        data: {
          actorId: null,
          targetType: "market",
          targetId: polyMarket.id as unknown as number,
          category: "market",
          action: "market_resolved",
          metadata: {
            winningOutcome,
            positionsProcessed,
          },
        },
      });

      totalResolved++;
    }

    return NextResponse.json({
      success: true,
      resolved: totalResolved,
      positionsProcessed: totalPositionsProcessed,
      checkedMarkets: markets.length,
      skippedNegRisk,
    });

  } catch (error) {
    console.error("[RESOLVE]", error);
    return NextResponse.json({ error: "Resolve failed" }, { status: 500 });
  }
}
