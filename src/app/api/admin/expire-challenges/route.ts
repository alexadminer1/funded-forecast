export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_KEY = process.env.ADMIN_API_KEY;
const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  let processed = 0, passed = 0, expired = 0, frozen = 0, errors = 0;

  const expiredChallenges = await prisma.challenge.findMany({
    where: {
      status: "active",
      expiresAt: { not: null, lt: now },
    },
    include: {
      positions: {
        where: { status: "open" },
        include: { market: { select: { id: true, status: true, yesPrice: true, noPrice: true, lastSyncedAt: true } } },
      },
    },
  });

  for (const challenge of expiredChallenges) {
    processed++;
    let isFrozen = false;

    try {
      // Close all open positions at market price
      for (const pos of challenge.positions) {
        const market = pos.market;

        // Stale data check
        if (market.status !== "live" || (now.getTime() - market.lastSyncedAt.getTime()) > STALE_THRESHOLD_MS) {
          await prisma.challenge.update({
            where: { id: challenge.id },
            data: { status: "frozen" },
          });
          await prisma.auditLog.create({
            data: {
              actorId: null,
              targetType: "challenge",
              targetId: String(challenge.id),
              category: "challenge",
              action: "challenge_frozen",
              metadata: {
                reason: "stale market data on expire",
                marketId: pos.marketId,
                marketStatus: market.status,
                lastSyncedAt: market.lastSyncedAt,
              },
            },
          });
          isFrozen = true;
          frozen++;
          break;
        }

        const currentPrice = pos.side === "yes" ? market.yesPrice : market.noPrice;
        const proceeds = Math.round(pos.shares * currentPrice * 100) / 100;
        const profit = Math.round((currentPrice - pos.avgPrice) * pos.shares * 100) / 100;

        await prisma.$transaction(async (tx) => {
          const lastLog = await tx.balanceLog.findFirst({
            where: { userId: challenge.userId },
            orderBy: { createdAt: "desc" },
            select: { runningBalance: true },
          });
          const currentBalance = lastLog?.runningBalance ?? 0;
          const newBalance = Math.round((currentBalance + proceeds) * 100) / 100;

          await tx.balanceLog.create({
            data: {
              userId: challenge.userId,
              challengeId: challenge.id,
              type: "expire_close",
              amount: proceeds,
              balanceBefore: currentBalance,
              balanceAfter: newBalance,
              runningBalance: newBalance,
            },
          });

          await tx.position.update({
            where: { id: pos.id },
            data: {
              status: "closed",
              shares: 0,
              realizedPnl: Math.round((pos.realizedPnl + profit) * 100) / 100,
              closedAt: now,
            },
          });

          await tx.challenge.update({
            where: { id: challenge.id },
            data: {
              realizedBalance: newBalance,
              peakBalance: Math.max(challenge.peakBalance, newBalance),
            },
          });
        }, { timeout: 15000 });
      }

      if (isFrozen) continue;

      // Re-fetch updated challenge balance after position closes
      const updated = await prisma.challenge.findUnique({
        where: { id: challenge.id },
        select: { realizedBalance: true, startBalance: true, profitTargetPct: true, tradingDaysCount: true, minTradingDays: true },
      });
      if (!updated) continue;

      const profitTargetReached = updated.realizedBalance >= updated.startBalance * (1 + updated.profitTargetPct / 100);
      const tradingDaysOk = updated.tradingDaysCount >= updated.minTradingDays;
      const newStatus = (profitTargetReached && tradingDaysOk) ? "passed" : "expired";

      await prisma.challenge.update({
        where: { id: challenge.id },
        data: { status: newStatus, endedAt: now },
      });

      await prisma.auditLog.create({
        data: {
          actorId: null,
          targetType: "challenge",
          targetId: String(challenge.id),
          category: "challenge",
          action: `challenge_${newStatus}`,
          metadata: {
            profitTargetReached,
            tradingDaysOk,
            realizedBalance: updated.realizedBalance,
            startBalance: updated.startBalance,
          },
        },
      });

      if (newStatus === "passed") passed++;
      else expired++;

    } catch (err) {
      console.error(`[EXPIRE] Challenge ${challenge.id} failed:`, err);
      errors++;
    }
  }

  return NextResponse.json({ processed, passed, expired, frozen, errors });
}
