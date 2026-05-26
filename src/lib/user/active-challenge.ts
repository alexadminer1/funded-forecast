import { prisma } from "@/lib/prisma";
import { computeConsistencyLive } from "@/lib/consistency";

// Phase 3 — shared shape consumed by /api/user/me and /api/user/mode.
//
// Notes on data sources (confirmed in Phase 3 Step 1 micro-discovery):
// - `currentBalance` = Challenge.realizedBalance. BalanceLog and
//   Challenge.realizedBalance are updated atomically in the same
//   prisma.$transaction in trade/sell, so values are consistent.
// - `daysRemaining` derived from Challenge.expiresAt (set in
//   payment/activation.ts as startedAt + plan.challengePeriodDays days).
//   Falls back to 0 if expiresAt is null (legacy challenges).
// - `plan` may be null on legacy challenges (no plan attached). We
//   surface that honestly via nullable type rather than fabricating
//   a placeholder object.
// - Drawdown formula is peak-based (matches engine MLL logic), not
//   initial-based as written in BUSINESS_RULES.md. BR doc update is
//   tracked as TASK-DOC-1.
// - `stage` and `status` are TWO separate Challenge columns:
//     stage  = "evaluation" | "funded"             (lifecycle phase)
//     status = "active" | "passed" | "failed" | "expired"  (current state)
//   Both are exposed independently; neither is a rename of the other.
// - `isPassed` (computed: status === "passed") and `profitTargetMet`
//   (Challenge.profitTargetMet column) are TWO distinct booleans:
//     profitTargetMet = profit target hit, even if other pass-conditions
//                       are not met yet (e.g. consistency, min trading
//                       days) — challenge can still be "active".
//     isPassed        = strict status === "passed".
//   Both exposed independently.

// Shape that callers must supply when pre-loading the Challenge record
// to skip the helper's own findFirst. Must be a strict superset of every
// field the helper reads — keep this in sync with the fallback select
// inside buildActiveChallenge.
export interface PreloadedChallenge {
  id: number;
  stage: string;
  status: string;
  startedAt: Date;
  expiresAt: Date | null;
  startBalance: number;
  realizedBalance: number;
  peakBalance: number;
  dayStartBalance: number | null;
  dayStartDate: Date | null;
  maxDailyDdPct: number;
  maxTotalDdPct: number;
  qualifyingTradingDaysCount: number;
  minTradingDays: number;
  profitTargetPct: number;
  profitTargetMet: boolean;
  plan: { id: number; name: string; price: number } | null;
}

export interface BuildActiveChallengeOptions {
  /**
   * Pre-loaded Challenge row (e.g. selected by the calling endpoint for
   * its own response composition). When supplied, the helper skips its
   * own `prisma.challenge.findFirst` and uses this record verbatim,
   * cutting the per-call query count by one.
   */
  challenge?: PreloadedChallenge;
}

export interface ActiveChallenge {
  // Identity & lifecycle
  id: number;
  stage: string;                     // "evaluation" | "funded"
  status: string;                    // "active" | "passed" | "failed" | "expired"
  plan: { id: number; name: string; price: number } | null;
  startedAt: string;

  // Balance & profit
  currentBalance: number;
  profitTarget: number;
  profitPercent: number;
  profitTargetMet: boolean;          // column from Challenge.profitTargetMet
  isPassed: boolean;                 // computed: status === "passed"

  // Phase 3 — dashboard metrics
  consistency: number;
  daysRemaining: number;
  daysTraded: number;
  minTradingDays: number;
  dailyLossLimitPercent: number;
  maxLossLimitPercent: number;
  currentDrawdownPercent: number;
  dailyDrawdownPercent: number;

  // Phase 5 — widget metrics
  startBalance: number;
  mllAmount: number;
  mllBufferAmount: number;
  resolvedPositionsCount: number;
  uniqueEventsCount: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function buildActiveChallenge(
  userId: number,
  opts?: BuildActiveChallengeOptions,
): Promise<ActiveChallenge | null> {
  const challenge: PreloadedChallenge | null =
    opts?.challenge ??
    (await prisma.challenge.findFirst({
      where: { userId, status: "active" },
      select: {
        id: true,
        stage: true,
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
    }));

  if (!challenge) return null;

  const consistencyResult = await computeConsistencyLive(challenge.id);

  // Phase 5 — MLL buffer (hybrid formula per docs/PHASE_5_BRIEF.md
  // MLL formula reference section; verified against engine code in
  // src/app/api/trade/{buy,sell}/route.ts and src/lib/marketResolve.ts):
  // dollar drawdown anchored to startBalance, trailing offset from peak.
  const maxLossAmount = round2(
    challenge.startBalance * (challenge.maxTotalDdPct / 100),
  );
  const mllFailPoint = challenge.peakBalance - maxLossAmount;
  const mllBufferAmount = round2(
    Math.max(0, challenge.realizedBalance - mllFailPoint),
  );

  // Phase 5 — resolved positions counter (market-resolved only,
  // NOT manually closed via full-sell which sets status="closed").
  const resolvedPositionsCount = await prisma.position.count({
    where: { challengeId: challenge.id, status: "resolved" },
  });

  // Phase 5 — unique events counter. Distinct over polymarketEventId
  // via JS Set (Prisma `distinct` doesn't support relation fields).
  // Strict: null eventIds excluded (no fallback to marketId).
  const resolvedWithEvent = await prisma.position.findMany({
    where: { challengeId: challenge.id, status: "resolved" },
    select: { market: { select: { polymarketEventId: true } } },
  });
  const uniqueEventsCount = new Set(
    resolvedWithEvent
      .map((p) => p.market.polymarketEventId)
      .filter((x): x is string => x !== null),
  ).size;

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
    stage: challenge.stage,
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
    isPassed: challenge.status === "passed",

    consistency: consistencyResult.biggestDayPct,
    daysRemaining,
    daysTraded: challenge.qualifyingTradingDaysCount,
    minTradingDays: challenge.minTradingDays,
    dailyLossLimitPercent: challenge.maxDailyDdPct,
    maxLossLimitPercent: challenge.maxTotalDdPct,
    currentDrawdownPercent,
    dailyDrawdownPercent,

    startBalance: challenge.startBalance,
    mllAmount: maxLossAmount,
    mllBufferAmount,
    resolvedPositionsCount,
    uniqueEventsCount,
  };
}
