import { prisma } from "@/lib/prisma";
import { computeConsistencyLive } from "@/lib/consistency";
import {
  MIN_POSITION_PCT,
  MAX_AGGREGATE_POSITION_PCT,
} from "@/lib/engine/constants";

// Phase 3 — shared shape consumed by /api/user/me and /api/user/mode.
//
// Notes on data sources (confirmed in Phase 3 Step 1 micro-discovery):
// - `currentBalance` = Challenge.realizedBalance. BalanceLog and
//   Challenge.realizedBalance are updated atomically in the same
//   prisma.$transaction in trade/sell, so values are consistent.
// - `daysRemaining` derived from Challenge.expiresAt (set in
//   payment/activation.ts as startedAt + plan.challengePeriodDays days).
//   Falls back to 0 if expiresAt is null (legacy challenges).
// - `minPositionPercent` / `maxAggregatePositionPercent` come from
//   engine constants — currently uniform across all tiers (see BACKLOG
//   TECH-DEBT-5). When per-tier position limits ship, switch to plan.
// - `plan` may be null on legacy challenges (no plan attached). We
//   surface that honestly via nullable type rather than fabricating
//   a placeholder object.
// - Drawdown formula is peak-based (matches engine MLL logic), not
//   initial-based as written in BUSINESS_RULES.md. BR doc update is
//   tracked as TASK-DOC-1.
// - `status` field reflects Challenge.status lifecycle column
//   (active / passed / failed). The existing /api/user/me response
//   exposed `stage` (a different field). The Step 2 endpoint refactor
//   must reconcile this rename with frontend types.

export interface ActiveChallenge {
  id: number;
  status: string;
  plan: { id: number; name: string; price: number } | null;
  startedAt: string;
  currentBalance: number;
  profitTarget: number;
  profitPercent: number;
  profitTargetMet: boolean;

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
      expiresAt: true,
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
        },
      },
    },
  });

  if (!challenge) return null;

  const consistencyResult = await computeConsistencyLive(challenge.id);

  const today = new Date().toISOString().slice(0, 10);

  // daysRemaining via expiresAt (set in activation as startedAt + plan
  // period days). Null on legacy challenges → returns 0.
  const daysRemaining = challenge.expiresAt
    ? Math.max(
        0,
        Math.ceil(
          (challenge.expiresAt.getTime() - Date.now()) / MS_PER_DAY,
        ),
      )
    : 0;

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

  // Peak-based drawdown (matches engine MLL logic, not initial-based).
  const currentDrawdownAmount = Math.max(
    0,
    challenge.peakBalance - challenge.realizedBalance,
  );
  const currentDrawdownPercent =
    challenge.startBalance > 0
      ? round2((currentDrawdownAmount / challenge.startBalance) * 100)
      : 0;

  // Lazy-reset awareness: dayStartBalance is a snapshot updated only on
  // the first trade of each UTC day. Before that snapshot refresh (e.g.
  // user opens dashboard at 03:00 UTC having not traded yet today), the
  // value is stale; treat today's DD as zero in that case.
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
      : null,
    startedAt: challenge.startedAt.toISOString(),
    currentBalance: challenge.realizedBalance,
    profitTarget,
    profitPercent,
    profitTargetMet: challenge.profitTargetMet,

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
