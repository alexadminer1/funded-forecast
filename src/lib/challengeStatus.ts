import type { Prisma } from "@prisma/client";
import { MIN_RESOLVED_POSITIONS, MIN_UNIQUE_EVENTS } from "@/lib/engine/constants";
import { computeConsistencyLive, CONSISTENCY_THRESHOLD_CHALLENGE } from "@/lib/consistency";
import { closeOpenPositionsForChallenge } from "@/lib/closeChallengePositions";

/**
 * Check passing conditions and mark challenge as passed if all met.
 *
 * Passing conditions (ALL must be true):
 *   1. challenge.status === "active"                                  (not failed/passed/expired/frozen)
 *   2. challenge.profitTargetMet === true
 *   3. qualifyingTradingDaysCount >= challenge.minTradingDays          (P0.4.next — recounted by daily-pnl-aggregate cron)
 *   4. resolvedPositionsCount >= MIN_RESOLVED_POSITIONS                (P0.3.b)
 *   5. uniqueEventsCount >= MIN_UNIQUE_EVENTS                          (P0.3.c)
 *   6. consistency.isPassChallenge — biggestDayPct ≤ 25 %              (P0.3.a, live from Trade)
 *
 * Called from:
 *   - src/lib/marketResolve.ts (after market resolve increments counter)
 *
 * Uses Prisma transaction client so caller controls atomicity. The live
 * consistency check sees the 'resolve' Trade row just written in the same tx.
 *
 * @param tx - Prisma transaction client
 * @param challengeId - Challenge ID to check
 * @returns true if challenge was marked passed in this call, false otherwise
 */
export async function checkAndMarkPassed(
  tx: Prisma.TransactionClient,
  challengeId: number
): Promise<boolean> {
  const c = await tx.challenge.findUnique({
    where: { id: challengeId },
    select: {
      id: true,
      status: true,
      profitTargetMet: true,
      qualifyingTradingDaysCount: true,
      minTradingDays: true,
      resolvedPositionsCount: true,
      uniqueEventsCount: true,
    },
  });

  if (!c) return false;
  if (c.status !== "active") return false;
  if (!c.profitTargetMet) return false;
  if (c.qualifyingTradingDaysCount < c.minTradingDays) return false;
  if (c.resolvedPositionsCount < MIN_RESOLVED_POSITIONS) return false;
  if (c.uniqueEventsCount < MIN_UNIQUE_EVENTS) return false;

  // P0.3.a — live consistency aggregation includes any Trade row just inserted in this tx
  // (e.g. the 'resolve' Trade row written by marketResolve.ts immediately before this call).
  const consistency = await computeConsistencyLive(challengeId, tx);
  if (!consistency.isPassChallenge) {
    console.warn(
      `[AUTO_PASS_BLOCKED] challenge ${challengeId} consistency rule failed: ` +
      `biggestDayPct=${(consistency.biggestDayPct * 100).toFixed(2)}% ` +
      `exceeds ${(CONSISTENCY_THRESHOLD_CHALLENGE * 100).toFixed(0)}% threshold ` +
      `(totalProfit=$${consistency.totalProfit.toFixed(2)})`,
    );
    return false;
  }

  // Phase 4.B Task 2 site #8 — close every remaining open position of the
  // challenge before flipping status to "passed". Caller's tx wraps both.
  // Audit ref: docs/PHASE_4_0_AUDIT.md finding #3.
  await closeOpenPositionsForChallenge(tx, challengeId, "passed");

  await tx.challenge.update({
    where: { id: challengeId },
    data: {
      status: "passed",
      endedAt: new Date(),
    },
  });

  return true;
}
