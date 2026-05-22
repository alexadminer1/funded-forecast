export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { MIN_DAILY_VOLUME_PCT } from "@/lib/engine/constants";
import { buildActiveChallenge, type PreloadedChallenge } from "@/lib/user/active-challenge";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const userId = payload.userId as number;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        membershipStatus: true,
        isBlocked: true,
        lastTradeAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.isBlocked) {
      return NextResponse.json({ error: "Account is blocked" }, { status: 403 });
    }

    // Get active challenge if any.
    // Phase 3: select is a strict superset of PreloadedChallenge (the helper's
    // input contract) so we can pass this row into buildActiveChallenge below
    // and skip its internal findFirst — keeping the endpoint at +1 query
    // (computeConsistencyLive) instead of +2.
    const activeChallenge = await prisma.challenge.findFirst({
      where: { userId, status: "active" },
      select: {
        id: true,
        stage: true,
        status: true,                     // Phase 3 — for status / isPassed
        startBalance: true,
        realizedBalance: true,
        peakBalance: true,
        profitTargetPct: true,
        maxTotalDdPct: true,
        maxDailyDdPct: true,
        profitTargetMet: true,
        tradingDaysCount: true,
        qualifyingTradingDaysCount: true,
        minTradingDays: true,
        startedAt: true,
        expiresAt: true,                  // Phase 3 — for daysRemaining
        dayStartBalance: true,            // Phase 3 — for dailyDrawdownPercent
        dayStartDate: true,               // Phase 3 — lazy-reset gate
        planId: true,
        plan: { select: { id: true, name: true, price: true } },
      },
    });

    // Get current balance from last balance_log entry
    const lastLog = await prisma.balanceLog.findFirst({
      where: activeChallenge
        ? { userId, challengeId: activeChallenge.id }
        : { userId, challengeId: null },
      orderBy: { createdAt: "desc" },
      select: { runningBalance: true },
    });

    // TODO [A1]: replace with native walletId filter after wallet model implementation
    const openPositionsCount = await prisma.position.count({
      where: activeChallenge
        ? { userId, status: "open", challengeId: activeChallenge.id }
        : { userId, status: "open", challengeId: null },
    });

    // Balance fallback: if no BalanceLog yet (new challenge, no trades),
    // use the challenge's realizedBalance so the header doesn't show $0.
    const balance = lastLog?.runningBalance ?? activeChallenge?.realizedBalance ?? 0;

    // P0.4.next — today's buy volume (UTC day) toward the qualifying threshold.
    // Computed live; persisted counter lives on Challenge.qualifyingTradingDaysCount
    // but today's bucket is only finalised by daily-pnl-aggregate cron at next 01:00 UTC.
    // Day-grouping mirrors the cron's `DATE("createdAt")` (UTC wall-clock; see
    // ChallengeDailyPnL comment in schema for rationale).
    let todayBuyVolume = 0;
    let minDailyVolumeUsd = 0;
    if (activeChallenge) {
      minDailyVolumeUsd = parseFloat(
        (activeChallenge.startBalance * (MIN_DAILY_VOLUME_PCT / 100)).toFixed(2),
      );
      const todayUtcDateStr = new Date().toISOString().slice(0, 10);
      const rows = await prisma.$queryRaw<{ volume: Prisma.Decimal | number | null }[]>(Prisma.sql`
        SELECT COALESCE(SUM("cost"), 0) AS volume
        FROM "Trade"
        WHERE "challengeId" = ${activeChallenge.id}
          AND "action" = 'buy'
          AND DATE("createdAt") = ${todayUtcDateStr}::date
      `);
      const raw = rows[0]?.volume;
      todayBuyVolume = raw == null ? 0 : parseFloat(Number(raw).toFixed(2));
    }

    // Phase 3: helper computes 12 dashboard fields from the same Challenge row.
    // We pass `activeChallenge` via opts.challenge so the helper skips its own
    // findFirst and only runs computeConsistencyLive — net +1 query for the
    // whole endpoint.
    let helperData: Awaited<ReturnType<typeof buildActiveChallenge>> = null;
    if (activeChallenge) {
      helperData = await buildActiveChallenge(userId, {
        // Narrowing cast: Prisma's typed select result is structurally
        // identical to PreloadedChallenge here (verified locally), but
        // the production Next.js build (without prisma generate in the
        // same pass) infers Prisma types more loosely and complains
        // about plan-shape ordering. The cast is safe — every field
        // PreloadedChallenge requires is present in this select.
        challenge: activeChallenge as PreloadedChallenge,
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        balance,
        openPositionsCount,
        activeChallenge: activeChallenge
          ? {
              // Existing 14 fields — explicit cherry-pick to preserve
              // byte-identical response shape (no leakage of internal
              // select fields like dayStartBalance / expiresAt).
              id: activeChallenge.id,
              stage: activeChallenge.stage,
              startBalance: activeChallenge.startBalance,
              realizedBalance: activeChallenge.realizedBalance,
              peakBalance: activeChallenge.peakBalance,
              profitTargetPct: activeChallenge.profitTargetPct,
              maxTotalDdPct: activeChallenge.maxTotalDdPct,
              maxDailyDdPct: activeChallenge.maxDailyDdPct,
              profitTargetMet: activeChallenge.profitTargetMet,
              tradingDaysCount: activeChallenge.tradingDaysCount,
              qualifyingTradingDaysCount: activeChallenge.qualifyingTradingDaysCount,
              minTradingDays: activeChallenge.minTradingDays,
              startedAt: activeChallenge.startedAt,
              planId: activeChallenge.planId,
              plan: activeChallenge.plan
                ? { name: activeChallenge.plan.name }
                : null,
              todayBuyVolume,
              minDailyVolumeUsd,

              // Phase 3 overlay — 12 dashboard fields from helper.
              // Overrides `plan` above with expanded { id, name, price }
              // when helper resolved; falls back to raw activeChallenge.plan
              // shape (still expanded with id/price from select).
              ...(helperData
                ? {
                    status: helperData.status,
                    isPassed: helperData.isPassed,
                    consistency: helperData.consistency,
                    daysRemaining: helperData.daysRemaining,
                    daysTraded: helperData.daysTraded,
                    dailyLossLimitPercent: helperData.dailyLossLimitPercent,
                    maxLossLimitPercent: helperData.maxLossLimitPercent,
                    currentDrawdownPercent: helperData.currentDrawdownPercent,
                    dailyDrawdownPercent: helperData.dailyDrawdownPercent,
                    minPositionPercent: helperData.minPositionPercent,
                    maxAggregatePositionPercent: helperData.maxAggregatePositionPercent,
                    maxDailyVolumeUsd: helperData.maxDailyVolumeUsd,
                    plan:
                      helperData.plan ??
                      (activeChallenge.plan
                        ? {
                            id: activeChallenge.plan.id,
                            name: activeChallenge.plan.name,
                            price: activeChallenge.plan.price,
                          }
                        : null),
                  }
                : {}),
            }
          : null,
      },
    });

  } catch (error) {
    console.error("[ME]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
