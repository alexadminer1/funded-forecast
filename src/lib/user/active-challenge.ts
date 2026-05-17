import { prisma } from "@/lib/prisma";
import { computeConsistencyLive } from "@/lib/consistency";
import {
  MIN_POSITION_PCT,
  MAX_AGGREGATE_POSITION_PCT,
} from "@/lib/engine/constants";

// Phase 3 — shared shape consumed by /api/user/me and /api/user/mode.
// Field names follow the new dashboard contract; values are derived from
// the existing Challenge / ChallengePlan columns and the consistency helper.
//
// NB: the real ChallengePlan model has no `tier` field (see schema.prisma:167),
// so the spec's `plan: { id, name, tier, price }` was reduced to the columns
// that actually exist. Documented in the Step 1 report.
export interface ActiveChallenge {
  id: number;
  status: string;
  plan: { id: number; name: string; price: number };
  startedAt: string;
  currentBalance: number;
  profitTarget: number;
  profitPercent: number;
  isPassed: boolean;

  consistency: number;
  daysRemaining: number;
  daysTraded: number;
  minTradingDays: number;
  dailyLossLimitPercent: number;
  maxLossLimitPercent: number;
  currentDrawdownPercent: number;
  dailyDrawdownPercent: number;
  minPositionPercent: number;
  maxAggregatePositionPercent: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function buildActiveChallenge(
  userId: number,
): Promise<ActiveChallenge | null> {
  const challenge = await prisma.challenge.findFirst({
    where: { userId, status: "active" },
    select: {
      id: true,
      status: true,
      startedAt: true,
      startBalance: true,
      realizedBalance: true,
      peakBalance: true,
      dayStartBalance: true,
      dayStartDate: true,
      maxDailyDdPct: true,
      maxTotalDdPct: true,
      qualifyingTradingDaysCount: true,
      minTradingDays: true,
      profitTargetPct: true,
      profitTargetMet: true,
      plan: {
        select: {
          id: true,
          name: true,
          price: true,
          challengePeriodDays: true,
        },
      },
    },
  });

  if (!challenge) return null;

  const [consistencyResult] = await Promise.all([
    computeConsistencyLive(challenge.id),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const daysSinceStart = Math.floor(
    (Date.now() - challenge.startedAt.getTime()) / MS_PER_DAY,
  );
  const challengePeriodDays = challenge.plan?.challengePeriodDays ?? 0;
  const daysRemaining = Math.max(0, challengePeriodDays - daysSinceStart);

  const profitTarget = round2(
    challenge.startBalance * (challenge.profitTargetPct / 100),
  );
  const profitPercent =
    challenge.startBalance > 0
      ? round2(
          ((challenge.realizedBalance - challenge.startBalance) /
            challenge.startBalance) *
            100,
        )
      : 0;

  const currentDrawdownAmount = Math.max(
    0,
    challenge.peakBalance - challenge.realizedBalance,
  );
  const currentDrawdownPercent =
    challenge.startBalance > 0
      ? round2((currentDrawdownAmount / challenge.startBalance) * 100)
      : 0;

  // Lazy-reset awareness: if dayStartDate is not today (snapshot stale
  // before the first trade of the new UTC day), treat daily DD as zero.
  // The engine refreshes dayStartBalance on the first trade of the day
  // via the lazy-reset block in trade/buy/route.ts and trade/sell/route.ts.
  const dayStartIso =
    challenge.dayStartDate?.toISOString().slice(0, 10) ?? null;
  const effectiveDayStart =
    dayStartIso === today && challenge.dayStartBalance != null
      ? challenge.dayStartBalance
      : challenge.realizedBalance;
  const dailyDrawdownAmount = Math.max(
    0,
    effectiveDayStart - challenge.realizedBalance,
  );
  const dailyDrawdownPercent =
    effectiveDayStart > 0
      ? round2((dailyDrawdownAmount / effectiveDayStart) * 100)
      : 0;

  return {
    id: challenge.id,
    status: challenge.status,
    plan: challenge.plan
      ? {
          id: challenge.plan.id,
          name: challenge.plan.name,
          price: challenge.plan.price,
        }
      : { id: 0, name: "", price: 0 },
    startedAt: challenge.startedAt.toISOString(),
    currentBalance: challenge.realizedBalance,
    profitTarget,
    profitPercent,
    isPassed: challenge.profitTargetMet,

    consistency: consistencyResult.biggestDayPct,
    daysRemaining,
    daysTraded: challenge.qualifyingTradingDaysCount,
    minTradingDays: challenge.minTradingDays,
    dailyLossLimitPercent: challenge.maxDailyDdPct,
    maxLossLimitPercent: challenge.maxTotalDdPct,
    currentDrawdownPercent,
    dailyDrawdownPercent,
    minPositionPercent: MIN_POSITION_PCT,
    maxAggregatePositionPercent: MAX_AGGREGATE_POSITION_PCT,
  };
}
