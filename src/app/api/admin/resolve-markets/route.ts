export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    // 1. Get our live markets
    const liveMarkets = await prisma.market.findMany({
      where: { status: "live" },
      select: { id: true, conditionId: true },
    });

    if (liveMarkets.length === 0) {
      return NextResponse.json({ success: true, resolved: 0, message: "No live markets" });
    }

    // 2. Fetch from Polymarket
    const ids = liveMarkets.map((m) => m.id).join(",");
    const res = await fetch(
      `https://gamma-api.polymarket.com/markets?id=${ids}&limit=200`,
      { headers: { Accept: "application/json" }, cache: "no-store" }
    );

    if (!res.ok) {
      throw new Error(`Polymarket API error: ${res.status}`);
    }

    const markets: PolymarketMarket[] = await res.json();

    // 3. Filter resolved markets
    const resolvedMarkets = markets.filter((m) => {
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
      const winningOutcome = yesPrice > 0.99 ? "yes" : "no";

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

      // Get all open positions for this market
      const openPositions = await prisma.position.findMany({
        where: {
          marketId: polyMarket.id,
          status: "open",
          resolvedAt: null,
        },
      });

      // Process each position in its own transaction
      for (const position of openPositions) {
        try {
          await prisma.$transaction(async (tx) => {
            // Idempotency check
            const fresh = await tx.position.findUnique({
              where: { id: position.id },
            });

            if (!fresh || fresh.resolvedAt !== null) return;

            const isWinner = fresh.side === winningOutcome;
            const payout = isWinner ? parseFloat((fresh.shares * 1.0).toFixed(2)) : 0;
            const profit = parseFloat((payout - fresh.costBasis).toFixed(2));

            // Get current balance
            const lastLog = await tx.balanceLog.findFirst({
              where: { userId: fresh.userId },
              orderBy: { createdAt: "desc" },
              select: { runningBalance: true },
            });

            const currentBalance = lastLog?.runningBalance ?? 0;
            const newBalance = parseFloat((currentBalance + payout).toFixed(2));

            // Insert balance log
            await tx.balanceLog.create({
              data: {
                userId: fresh.userId,
                challengeId: fresh.challengeId,
                type: "market_resolve",
                amount: payout,
                balanceBefore: currentBalance,
                balanceAfter: newBalance,
                runningBalance: newBalance,
              },
            });

            // Update position
            await tx.position.update({
              where: { id: fresh.id },
              data: {
                status: "resolved",
                resolvedAt: new Date(),
                shares: 0,
                realizedPnl: parseFloat((fresh.realizedPnl + profit).toFixed(2)),
                closedAt: new Date(),
              },
            });

            // Update challenge if applicable
            if (fresh.challengeId) {
              const challenge = await tx.challenge.findUnique({
                where: { id: fresh.challengeId },
              });

              if (challenge && challenge.status === "active") {
                const newRealizedBalance = parseFloat(
                  (challenge.realizedBalance + payout).toFixed(2)
                );
                const newPeakBalance = Math.max(challenge.peakBalance, newRealizedBalance);

                const profitPct = parseFloat(
                  (((newRealizedBalance - challenge.startBalance) / challenge.startBalance) * 100).toFixed(2)
                );
                const profitTargetMet = profitPct >= challenge.profitTargetPct;

                const totalDrawdownPct = parseFloat(
                  (((challenge.startBalance - newRealizedBalance) / challenge.startBalance) * 100).toFixed(2)
                );
                const drawdownViolated = totalDrawdownPct >= challenge.maxTotalDdPct;

                await tx.challenge.update({
                  where: { id: fresh.challengeId },
                  data: {
                    realizedBalance: newRealizedBalance,
                    peakBalance: newPeakBalance,
                    profitTargetMet,
                    ...(drawdownViolated ? {
                      drawdownViolated: true,
                      status: "failed",
                      violationReason: `Drawdown ${totalDrawdownPct}% after market resolve`,
                      endedAt: new Date(),
                    } : {}),
                    ...(profitTargetMet && !challenge.profitTargetMet ? {
                      tradingDaysCount: { increment: 0 },
                    } : {}),
                  },
                });
              }
            }
          }, { timeout: 15000 });

          totalPositionsProcessed++;
        } catch (err) {
          console.error(`[RESOLVE] Position ${position.id} failed:`, err);
        }
      }

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
            positionsProcessed: openPositions.length,
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
    });

  } catch (error) {
    console.error("[RESOLVE]", error);
    return NextResponse.json({ error: "Resolve failed" }, { status: 500 });
  }
}
