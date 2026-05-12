import type { Prisma } from "@prisma/client";
import { MIN_RESOLVED_POSITIONS, MIN_UNIQUE_EVENTS } from "@/lib/engine/constants";

/**
 * P0.3.b — Check passing conditions and mark challenge as passed if all met.
 *
 * Passing conditions (ALL must be true):
 *   1. challenge.status === "active"  (not failed/passed/expired/frozen)
 *   2. challenge.profitTargetMet === true
 *   3. tradingDaysCount >= challenge.minTradingDays
 *   4. resolvedPositionsCount >= MIN_RESOLVED_POSITIONS
 *
 * Called from:
 *   - src/app/api/trade/sell/route.ts (after profitable sale)
 *   - src/lib/marketResolve.ts (after market resolve increments counter)
 *
 * Uses Prisma transaction client so caller controls atomicity.
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
      tradingDaysCount: true,
      minTradingDays: true,
      resolvedPositionsCount: true,
      uniqueEventsCount: true,
    },
  });

  if (!c) return false;
  if (c.status !== "active") return false;
  if (!c.profitTargetMet) return false;
  if (c.tradingDaysCount < c.minTradingDays) return false;
  if (c.resolvedPositionsCount < MIN_RESOLVED_POSITIONS) return false;
  if (c.uniqueEventsCount < MIN_UNIQUE_EVENTS) return false;

  await tx.challenge.update({
    where: { id: challengeId },
    data: {
      status: "passed",
      endedAt: new Date(),
    },
  });

  return true;
}
