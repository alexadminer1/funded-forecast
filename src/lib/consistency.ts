import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// P0.3.a Consistency Rule — biggest winning day must not exceed a share
// of gross profit. Two thresholds:
//   - Challenge auto-pass: 25 % (strict; anti-gambling guard before passing)
//   - Payout request:      35 % (softer; user is already on funded stage)
//
// Both thresholds are inclusive — `biggestDayPct <= threshold` passes.
export const CONSISTENCY_THRESHOLD_CHALLENGE = 0.25;
export const CONSISTENCY_THRESHOLD_PAYOUT    = 0.35;

export interface ConsistencyResult {
  /** Ratio in 0..1. Example: 0.23 means biggest winning day is 23 % of gross profit. */
  biggestDayPct: number;
  /** Date of the biggest winning day, or null if no winning days exist. */
  biggestWinningDay: Date | null;
  /** Sum of dailyPnl across winning days only (gross profit, Q2 decision). */
  totalProfit: number;
  /** Whether the challenge may auto-pass under the 25 % threshold. */
  isPassChallenge: boolean;
  /** Whether a payout request may be approved under the 35 % threshold. */
  isPassPayout: boolean;
}

const EMPTY_PASS: ConsistencyResult = {
  biggestDayPct: 0,
  biggestWinningDay: null,
  totalProfit: 0,
  isPassChallenge: true,
  isPassPayout: true,
};

function resultFromWinningDays(rows: { date: Date; dailyPnl: number }[]): ConsistencyResult {
  if (rows.length === 0) return EMPTY_PASS;

  let totalProfit = 0;
  let biggestDayValue = 0;
  let biggestWinningDay: Date | null = null;

  for (const row of rows) {
    totalProfit += row.dailyPnl;
    if (row.dailyPnl > biggestDayValue) {
      biggestDayValue = row.dailyPnl;
      biggestWinningDay = row.date;
    }
  }

  const biggestDayPct = biggestDayValue / totalProfit;
  return {
    biggestDayPct,
    biggestWinningDay,
    totalProfit,
    isPassChallenge: biggestDayPct <= CONSISTENCY_THRESHOLD_CHALLENGE,
    isPassPayout:    biggestDayPct <= CONSISTENCY_THRESHOLD_PAYOUT,
  };
}

/**
 * Read consistency from the pre-aggregated ChallengeDailyPnL table.
 *
 * Use for PAYOUT decisions — the daily cron has had multiple chances to
 * aggregate since any individual sell (payout cooldown is days, not hours),
 * so the table is effectively up-to-date.
 *
 * Source: rows where `isWinningDay = true` (dailyPnl > 0). Loss/zero days are
 * stored in the table but excluded here — they neither contribute to gross
 * profit nor compete for "biggest winning day".
 *
 * Edge cases:
 *   - No winning days yet → totalProfit = 0, biggestDayPct = 0,
 *     biggestWinningDay = null, both isPass* = true.
 *   - Single winning day → biggestDayPct = 1.0; fails both thresholds.
 *
 * Determinism: `orderBy date asc` + strict `>` in the reducer makes the
 * earliest day win on ties — important for stable audit-log metadata.
 */
export async function computeConsistency(
  challengeId: number
): Promise<ConsistencyResult> {
  const winningDays = await prisma.challengeDailyPnL.findMany({
    where: { challengeId, isWinningDay: true },
    select: { date: true, dailyPnl: true },
    orderBy: { date: "asc" },
  });

  return resultFromWinningDays(
    winningDays.map((r) => ({ date: r.date, dailyPnl: r.dailyPnl.toNumber() })),
  );
}

/**
 * Compute consistency LIVE from the Trade table, bypassing ChallengeDailyPnL.
 *
 * Use for AUTO-PASS decisions inside sell/route.ts and marketResolve.ts —
 * today's pending Trade rows (just inserted in the current transaction)
 * MUST be reflected, otherwise the rule has a same-day loophole: a single
 * massive sell that triggers passing would not yet be in the daily-aggregate
 * table (which is populated by a once-a-day cron) and would slip past.
 *
 * Accepts an optional Prisma transaction client. When called inside
 * `prisma.$transaction(async (tx) => { ... })`, pass `tx` so the freshly
 * inserted Trade row is visible. Otherwise reads from the top-level client.
 *
 * Mirror of: scripts/backfill-daily-pnl.sql aggregation formula and
 *            src/app/api/cron/daily-pnl-aggregate/route.ts.
 * Same `DATE("createdAt")` day-grouping rule; do NOT use `AT TIME ZONE 'UTC'`
 * (see ChallengeDailyPnL model comment in prisma/schema.prisma).
 *
 * Edge cases identical to computeConsistency().
 */
export async function computeConsistencyLive(
  challengeId: number,
  tx?: Prisma.TransactionClient,
): Promise<ConsistencyResult> {
  const db = tx ?? prisma;

  const rows = await db.$queryRaw<{ date: Date; dailyPnl: Prisma.Decimal }[]>(Prisma.sql`
    SELECT
      DATE("createdAt")  AS "date",
      SUM("realizedPnl") AS "dailyPnl"
    FROM "Trade"
    WHERE "challengeId" = ${challengeId}
      AND "realizedPnl" IS NOT NULL
    GROUP BY DATE("createdAt")
    HAVING SUM("realizedPnl") > 0
    ORDER BY DATE("createdAt") ASC
  `);

  return resultFromWinningDays(
    rows.map((r) => ({ date: r.date, dailyPnl: r.dailyPnl.toNumber() })),
  );
}
