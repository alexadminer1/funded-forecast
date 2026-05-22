export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MIN_DAILY_VOLUME_PCT } from "@/lib/engine/constants";
import { closeOpenPositionsForChallenge } from "@/lib/closeChallengePositions";

// Phase 4.A — End-of-day activity check (BUSINESS_RULES rule #7, "Daily volume below minimum").
// Replaces the legacy /api/cron/inactivity-check (72h/120h hour-based fail).
//
// For each active challenge:
//   1. Grace day skip: if challenge.startedAt is within today's UTC day,
//      no evaluation (trader had partial day, not full trading window).
//   2. Sum buy Trade.cost for today's UTC day.
//   3. If buyVolume === 0           → fail with "No trading activity".
//   4. If buyVolume < minDailyVolume → fail with "Daily volume below minimum".
//   5. Otherwise                    → no status change.
//
// Failure write: status='failed', violationReason=<reason>, endedAt=checkedAt.
// Match pattern: src/app/api/cron/expire-challenges/route.ts, inactivity-check (legacy).
//
// SQL aggregate pattern mirrors src/app/api/user/me/route.ts todayBuyVolume
// and src/app/api/cron/daily-pnl-aggregate/route.ts qualifyingTradingDaysCount.
//
// Auth: Bearer ${CRON_SECRET}.

// IMPORTANT: This cron MUST run BEFORE UTC midnight (recommended 23:55 UTC).
// Grace day logic compares challenge.startedAt against today's UTC midnight.
// If cron runs at or after 00:00 UTC, grace logic breaks: challenges
// created yesterday will be evaluated against today's start, breaking
// the boundary.

// All date arithmetic in UTC. Use new Date(Date.UTC(...)) and
// .toISOString() — never local Date methods which depend on container TZ.

const BATCH_LIMIT = 5000;

type EvalResult =
  | { kind: "grace"; challengeId: number }
  | { kind: "failed"; challengeId: number; reason: string; buyVolume: number; minDailyVolume: number }
  | { kind: "passed"; challengeId: number; buyVolume: number; minDailyVolume: number };

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checkedAt = new Date();
  const todayStart = new Date(Date.UTC(
    checkedAt.getUTCFullYear(),
    checkedAt.getUTCMonth(),
    checkedAt.getUTCDate(),
    0, 0, 0, 0,
  ));
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 3600 * 1000);

  const gracedIds: number[] = [];
  const failedResults: Array<{ challengeId: number; reason: string; buyVolume: number; minDailyVolume: number }> = [];
  const passedResults: Array<{ challengeId: number; buyVolume: number; minDailyVolume: number }> = [];
  const errors: Array<{ challengeId: number; message: string }> = [];

  try {
    const activeChallenges = await prisma.challenge.findMany({
      where: { status: "active" },
      select: { id: true, startBalance: true, startedAt: true },
      take: BATCH_LIMIT,
    });

    if (activeChallenges.length === BATCH_LIMIT) {
      console.warn(`[END_OF_DAY_CHECK] hit ${BATCH_LIMIT}-challenge cap — some active challenges were not processed this run`);
    }

    for (const c of activeChallenges) {
      try {
        // Grace day skip: challenge created within today's UTC day window.
        if (c.startedAt >= todayStart) {
          gracedIds.push(c.id);
          continue;
        }

        // Sum today's buy Trade.cost. COALESCE to 0 when no trades exist.
        const rows = await prisma.$queryRaw<{ volume: Prisma.Decimal | number | null }[]>(Prisma.sql`
          SELECT COALESCE(SUM("cost"), 0) AS volume
          FROM "Trade"
          WHERE "challengeId" = ${c.id}
            AND "action" = 'buy'
            AND "createdAt" >= ${todayStart}
            AND "createdAt" <  ${tomorrowStart}
        `);
        const buyVolume = Number(rows[0]?.volume ?? 0);
        const minDailyVolume = c.startBalance * (MIN_DAILY_VOLUME_PCT / 100);

        // Cents comparison to avoid Float drift (e.g. 199.999... vs 200.0).
        const buyVolumeCents = Math.round(buyVolume * 100);
        const minDailyVolumeCents = Math.round(minDailyVolume * 100);

        if (buyVolumeCents >= minDailyVolumeCents) {
          passedResults.push({ challengeId: c.id, buyVolume, minDailyVolume });
          continue;
        }

        const reason = buyVolume === 0
          ? "No trading activity"
          : "Daily volume below minimum";

        // Phase 4.B Task 2 site #2 — close open positions inside the same
        // tx as the status flip (audit finding #3).
        await prisma.$transaction(async (tx) => {
          await closeOpenPositionsForChallenge(tx, c.id, "expired");
          await tx.challenge.update({
            where: { id: c.id },
            data: {
              status:          "failed",
              violationReason: reason,
              endedAt:         checkedAt,
            },
          });
        }, { timeout: 30000 });
        failedResults.push({ challengeId: c.id, reason, buyVolume, minDailyVolume });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[END_OF_DAY_CHECK] challenge ${c.id} failed:`, err);
        errors.push({ challengeId: c.id, message });
      }
    }

    return NextResponse.json({
      checkedAt:    checkedAt.toISOString(),
      todayUtcDate: todayStart.toISOString().slice(0, 10),
      totalActive:  activeChallenges.length,
      gracedCount:  gracedIds.length,
      failedCount:  failedResults.length,
      passedCount:  passedResults.length,
      errorsCount:  errors.length,
      gracedIds,
      failed:       failedResults,
      passed:       passedResults,
      errors,
    });
  } catch (err) {
    console.error("[END_OF_DAY_CHECK] fatal error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Internal server error", message },
      { status: 500 },
    );
  }
}
