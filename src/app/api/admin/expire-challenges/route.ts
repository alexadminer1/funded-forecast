export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { closeOpenPositionsForChallenge } from "@/lib/closeChallengePositions";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  let processed = 0, passed = 0, expired = 0, errors = 0;

  const expiredChallenges = await prisma.challenge.findMany({
    where: {
      status:    "active",
      expiresAt: { not: null, lt: now },
    },
    select: { id: true },
  });

  for (const c of expiredChallenges) {
    processed++;
    try {
      // Phase 4.B Task 2 site #12 — close all open positions and set the
      // terminal status in a single transaction via the shared helper.
      // Stale-market freeze logic was removed: the helper logs a warning
      // when a position's market is stale but still closes at the last
      // known price, matching the rest of the finalize-site behavior.
      // Audit ref: docs/PHASE_4_0_AUDIT.md finding #3.
      const result = await prisma.$transaction(async (tx) => {
        await closeOpenPositionsForChallenge(tx, c.id, "expired");

        const updated = await tx.challenge.findUnique({
          where:  { id: c.id },
          select: {
            realizedBalance:            true,
            startBalance:               true,
            profitTargetPct:            true,
            qualifyingTradingDaysCount: true,
            minTradingDays:             true,
          },
        });
        if (!updated) return null;

        const profitTargetReached = updated.realizedBalance >= updated.startBalance * (1 + updated.profitTargetPct / 100);
        // P0.4.next: pass requires qualifyingTradingDaysCount, not raw tradingDaysCount.
        const tradingDaysOk = updated.qualifyingTradingDaysCount >= updated.minTradingDays;
        const newStatus     = (profitTargetReached && tradingDaysOk) ? "passed" : "expired";

        await tx.challenge.update({
          where: { id: c.id },
          data:  { status: newStatus, endedAt: now },
        });

        await tx.auditLog.create({
          data: {
            actorId:    null,
            targetType: "challenge",
            targetId:   String(c.id),
            category:   "challenge",
            action:     `challenge_${newStatus}`,
            metadata: {
              profitTargetReached,
              tradingDaysOk,
              realizedBalance: updated.realizedBalance,
              startBalance:    updated.startBalance,
            },
          },
        });

        return newStatus;
      }, { timeout: 30000 });

      if (result === "passed") passed++;
      else if (result === "expired") expired++;
    } catch (err) {
      console.error(`[EXPIRE] Challenge ${c.id} failed:`, err);
      errors++;
    }
  }

  return NextResponse.json({ processed, passed, expired, errors });
}
