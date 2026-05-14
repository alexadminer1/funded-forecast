export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MIN_DAILY_VOLUME_PCT } from "@/lib/engine/constants";

// P0.3.a Consistency Rule — daily aggregation cron.
// Schedule (set by Alexey in Coolify): 0 1 * * *  (01:00 UTC each day)
// Runs against yesterday's UTC date — by 01:00 UTC any in-flight trades
// from the previous day are settled.
//
// For each active challenge:
//   (1) upsert one ChallengeDailyPnL row for yesterday's settled Trade events
//       (realizedPnl IS NOT NULL). Idempotent via ON CONFLICT DO UPDATE.
//   (2) P0.4.next — recompute Challenge.qualifyingTradingDaysCount: count of
//       past UTC days where SUM(buy Trade.cost) >= MIN_DAILY_VOLUME_PCT * startBalance.
//       The recompute is a full scan over the challenge's buy-Trade history so
//       the cron is naturally idempotent and self-healing across reruns.
//
// Mirror of: scripts/backfill-daily-pnl.sql (one-shot historical backfill)
//            src/lib/consistency.ts → computeConsistencyLive() (live read)
// Same aggregation formula in all three; keep them in sync.
//
// Day-grouping formula: `DATE("createdAt")` — direct, NOT `AT TIME ZONE 'UTC'`.
// See ChallengeDailyPnL model comment in prisma/schema.prisma for the
// rationale (naive timestamp + Prisma UTC wall-clock invariant).
//
// Auth: Bearer ${CRON_SECRET} (same pattern as inactivity-check, expire-*).

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Yesterday's UTC date range, expressed as naive UTC wall-clock Date
  // objects. Prisma serializes these to `timestamp without time zone` exactly
  // matching the stored values.
  const now = new Date();
  const todayStart = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0,
  ));
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 3600 * 1000);
  const yesterdayDateOnly = yesterdayStart.toISOString().slice(0, 10); // 'YYYY-MM-DD'

  const processed: number[] = [];
  const skipped:   number[] = [];
  const errors:    { challengeId: number; message: string }[] = [];
  const qualifyingUpdated: { challengeId: number; count: number }[] = [];

  try {
    const activeChallenges = await prisma.challenge.findMany({
      where: { status: "active" },
      select: { id: true, startBalance: true },
      take: 5000,
    });

    if (activeChallenges.length === 5000) {
      console.warn("[DAILY_PNL_AGGREGATE] hit 5000-challenge cap — some active challenges were not processed this run");
    }

    for (const c of activeChallenges) {
      try {
        // Single-statement aggregate-and-upsert. The SELECT computes one
        // bucket row for the challenge over yesterday's qualifying trades;
        // HAVING COUNT(*) > 0 suppresses the insert when no trades exist
        // (the row is then "skipped"). $executeRaw returns the number of
        // rows actually inserted/updated — 0 for skipped, 1 for processed.
        const affected = await prisma.$executeRaw(Prisma.sql`
          INSERT INTO "ChallengeDailyPnL" (
            "challengeId",
            "date",
            "dailyPnl",
            "dailyTrades",
            "isWinningDay",
            "createdAt",
            "updatedAt"
          )
          SELECT
            ${c.id}::int                       AS "challengeId",
            ${yesterdayDateOnly}::date         AS "date",
            SUM("realizedPnl")                 AS "dailyPnl",
            COUNT(*)::int                      AS "dailyTrades",
            SUM("realizedPnl") > 0             AS "isWinningDay",
            NOW()                              AS "createdAt",
            NOW()                              AS "updatedAt"
          FROM "Trade"
          WHERE "challengeId" = ${c.id}
            AND "realizedPnl" IS NOT NULL
            AND "createdAt"  >= ${yesterdayStart}
            AND "createdAt"  <  ${todayStart}
          HAVING COUNT(*) > 0
          ON CONFLICT ("challengeId", "date") DO UPDATE
          SET
            "dailyPnl"     = EXCLUDED."dailyPnl",
            "dailyTrades"  = EXCLUDED."dailyTrades",
            "isWinningDay" = EXCLUDED."isWinningDay",
            "updatedAt"    = NOW();
        `);

        if (affected > 0) {
          processed.push(c.id);
        } else {
          skipped.push(c.id);
        }

        // P0.4.next — qualifying day recompute. Count UTC days (strictly before
        // today's UTC midnight) where SUM(buy Trade.cost) >= 2% startBalance.
        // Idempotent: full scan, write the absolute count, no increment.
        const minDailyVolume = c.startBalance * (MIN_DAILY_VOLUME_PCT / 100);
        const qualifyingRows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM (
            SELECT DATE("createdAt") AS d, SUM("cost") AS total
            FROM "Trade"
            WHERE "challengeId" = ${c.id}
              AND "action" = 'buy'
              AND "createdAt" < ${todayStart}
            GROUP BY DATE("createdAt")
            HAVING SUM("cost") >= ${minDailyVolume}
          ) q
        `);
        const qualifyingCount = Number(qualifyingRows[0]?.count ?? 0n);
        await prisma.challenge.update({
          where: { id: c.id },
          data: { qualifyingTradingDaysCount: qualifyingCount },
        });
        qualifyingUpdated.push({ challengeId: c.id, count: qualifyingCount });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[DAILY_PNL_AGGREGATE] challenge ${c.id} failed:`, err);
        errors.push({ challengeId: c.id, message });
      }
    }

    return NextResponse.json({
      date:      yesterdayDateOnly,
      processed: processed.length,
      skipped:   skipped.length,
      errors,
      processedChallengeIds: processed,
      skippedChallengeIds:   skipped,
      qualifyingUpdated,
    });
  } catch (err) {
    console.error("[DAILY_PNL_AGGREGATE] fatal error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Internal server error", message },
      { status: 500 },
    );
  }
}
