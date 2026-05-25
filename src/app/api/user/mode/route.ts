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

  const payload = verifyToken(authHeader.slice(7));
  if (!payload?.userId) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const userId = payload.userId as number;

  try {
    // Phase 3: keep `findFirst` without `select` to preserve back-compat
    // for the existing spread (all 35 Challenge columns leak through into
    // response). Add `include: { plan }` so the relation is loaded too —
    // makes the row structurally compatible with PreloadedChallenge so we
    // can pass it into the helper and skip its internal findFirst.
    const activeChallenge = await prisma.challenge.findFirst({
      where: { userId, status: "active" },
      include: {
        plan: { select: { id: true, name: true, price: true } },
      },
    });

    const mode = activeChallenge ? "challenge" : "sandbox";

    const lastLog = await prisma.balanceLog.findFirst({
      where: activeChallenge
        ? { userId, challengeId: activeChallenge.id }
        : { userId, challengeId: null },
      orderBy: { createdAt: "desc" },
    });

    const currentBalance = lastLog ? lastLog.runningBalance : 0;

    // If no active challenge, fetch the most recent terminal one (passed/failed)
    const lastChallenge = activeChallenge ? null : await prisma.challenge.findFirst({
      where:   { userId, status: { in: ["passed", "failed"] } },
      orderBy: [{ endedAt: "desc" }, { startedAt: "desc" }],
      select: {
        id:              true,
        status:          true,
        violationReason: true,
        profitTargetMet: true,
        endedAt:         true,
      },
    });

    // When in challenge mode, include sandbox summary for the secondary card
    let sandboxBalance: number | null = null;
    let sandboxPositionsCount: number | null = null;
    if (activeChallenge) {
      const sandboxLog = await prisma.balanceLog.findFirst({
        where:   { userId, challengeId: null },
        orderBy: { createdAt: "desc" },
        select:  { runningBalance: true },
      });
      const sandboxCount = await prisma.position.count({
        where: { userId, challengeId: null, status: "open" },
      });
      sandboxBalance = sandboxLog?.runningBalance ?? 0;
      sandboxPositionsCount = sandboxCount;
    }

    // Phase 3: helper computes 12 dashboard fields from the same Challenge row.
    // We pass `activeChallenge` via opts.challenge so the helper skips its own
    // findFirst and only runs computeConsistencyLive — net +1 query.
    let helperData: Awaited<ReturnType<typeof buildActiveChallenge>> = null;
    if (activeChallenge) {
      helperData = await buildActiveChallenge(userId, {
        // Narrowing cast — see /api/user/me/route.ts for rationale.
        // Prisma `include` returns Challenge + plan; PreloadedChallenge
        // is a strict structural subset. Cast keeps production build
        // (where Prisma type inference can degrade) happy.
        challenge: activeChallenge as PreloadedChallenge,
      });
    }

    // P0.4.next — augment active challenge with today's buy volume + min required.
    // Mirrors logic in /api/user/me (kept in two places to avoid coupling those endpoints).
    let challengeWithVolume: typeof activeChallenge & {
      todayBuyVolume?: number;
      minDailyVolumeUsd?: number;
      // Phase 3 overlay — 11 dashboard fields (status already lives in
      // ...activeChallenge spread as a raw Challenge column; not duplicated).
      isPassed?: boolean;
      consistency?: number;
      daysRemaining?: number;
      daysTraded?: number;
      dailyLossLimitPercent?: number;
      maxLossLimitPercent?: number;
      currentDrawdownPercent?: number;
      dailyDrawdownPercent?: number;
    } | null = null;
    if (activeChallenge) {
      const todayUtcDateStr = new Date().toISOString().slice(0, 10);
      const rows = await prisma.$queryRaw<{ volume: Prisma.Decimal | number | null }[]>(Prisma.sql`
        SELECT COALESCE(SUM("cost"), 0) AS volume
        FROM "Trade"
        WHERE "challengeId" = ${activeChallenge.id}
          AND "action" = 'buy'
          AND DATE("createdAt") = ${todayUtcDateStr}::date
      `);
      const raw = rows[0]?.volume;
      const todayBuyVolume = raw == null ? 0 : parseFloat(Number(raw).toFixed(2));
      const minDailyVolumeUsd = parseFloat(
        (activeChallenge.startBalance * (MIN_DAILY_VOLUME_PCT / 100)).toFixed(2),
      );
      challengeWithVolume = {
        ...activeChallenge,
        todayBuyVolume,
        minDailyVolumeUsd,
        // Phase 3 overlay — 11 dashboard fields from helper. `status` already
        // arrives via ...activeChallenge spread (Challenge column), so it's
        // not duplicated here. `plan` likewise — included via `include` above.
        ...(helperData
          ? {
              isPassed: helperData.isPassed,
              consistency: helperData.consistency,
              daysRemaining: helperData.daysRemaining,
              daysTraded: helperData.daysTraded,
              dailyLossLimitPercent: helperData.dailyLossLimitPercent,
              maxLossLimitPercent: helperData.maxLossLimitPercent,
              currentDrawdownPercent: helperData.currentDrawdownPercent,
              dailyDrawdownPercent: helperData.dailyDrawdownPercent,
            }
          : {}),
      };
    }

    return NextResponse.json({
      success: true,
      mode,
      currentBalance,
      challenge:            challengeWithVolume,
      lastChallenge,
      sandboxBalance,
      sandboxPositionsCount,
    });

  } catch (error) {
    console.error("[MODE]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
