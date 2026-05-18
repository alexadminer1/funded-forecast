import type { Prisma } from "@prisma/client";
import { applySellSpread } from "@/lib/engine/spreads";

// Phase 4.B Task 1 — shared auto-close-at-finalize helper.
// Used by every Challenge.status transition into a terminal state
// (failed / passed / expired) to close any open positions of the
// challenge atomically in the same transaction. Source:
// docs/PHASE_4_B_BRIEF.md, addresses audit findings #3, #5, #6.
//
// Contract:
//   - MUST be called inside an existing prisma.$transaction; the
//     caller owns the tx boundary so the status update and the
//     position closes commit/rollback together.
//   - Idempotent: a no-op if the challenge has no `status="open"`
//     positions (re-running on already finalized challenge is safe).
//   - Closes at last-known market price minus sell spread, matching
//     the user-facing sell path (src/app/api/trade/sell/route.ts).
//   - Each closed position emits a Trade row with
//     `action="auto_close_finalize"` and a BalanceLog row of
//     `type="trade_close"`. BalanceLog runningBalance chain is
//     scoped by (userId, challengeId).
//   - Challenge.realizedBalance is bumped once at the end with the
//     accumulated proceeds. peakBalance / peakEquity are advanced
//     to the new realized balance if higher.

export type CloseFinalizeReason =
  | "expired"
  | "failed_drawdown"
  | "passed"
  | "admin_force";

export interface CloseFinalizeResult {
  closedCount: number;
  totalPnl: number;
}

const STALE_MARKET_MS = 5 * 60 * 1000;

export async function closeOpenPositionsForChallenge(
  tx: Prisma.TransactionClient,
  challengeId: number,
  reason: CloseFinalizeReason,
): Promise<CloseFinalizeResult> {
  const challenge = await tx.challenge.findUnique({
    where: { id: challengeId },
    select: {
      id: true,
      userId: true,
      realizedBalance: true,
      peakBalance: true,
      peakEquity: true,
    },
  });

  if (!challenge) {
    return { closedCount: 0, totalPnl: 0 };
  }

  const positions = await tx.position.findMany({
    where: { challengeId, status: "open" },
    include: {
      market: {
        select: {
          id: true,
          status: true,
          yesPrice: true,
          noPrice: true,
          lastSyncedAt: true,
        },
      },
    },
  });

  if (positions.length === 0) {
    return { closedCount: 0, totalPnl: 0 };
  }

  const userId = challenge.userId;

  // Scoped chain: same (userId, challengeId) only. Matches Phase 4.A.2
  // chain-scope fix in marketResolve.ts.
  const lastLog = await tx.balanceLog.findFirst({
    where:   { userId, challengeId },
    orderBy: { createdAt: "desc" },
    select:  { runningBalance: true },
  });
  let currentBalance = lastLog?.runningBalance ?? 0;

  const now = new Date();
  let totalPnl     = 0;
  let totalProceeds = 0;
  let closedCount  = 0;

  for (const pos of positions) {
    const m = pos.market;

    if (m.status !== "live") {
      console.warn(
        `[closeChallengePositions] market ${m.id} status=${m.status}; closing at last yes/no price (challenge=${challengeId} reason=${reason})`,
      );
    }
    if (now.getTime() - m.lastSyncedAt.getTime() > STALE_MARKET_MS) {
      console.warn(
        `[closeChallengePositions] market ${m.id} stale (lastSynced=${m.lastSyncedAt.toISOString()}); closing at possibly outdated price (challenge=${challengeId} reason=${reason})`,
      );
    }

    const rawPrice = pos.side === "yes" ? m.yesPrice : m.noPrice;
    const { effectivePrice } = applySellSpread(rawPrice);
    const proceeds = parseFloat((pos.shares * effectivePrice).toFixed(2));
    const profit   = parseFloat((proceeds - pos.costBasis).toFixed(2));

    const trade = await tx.trade.create({
      data: {
        userId,
        marketId:                  m.id,
        challengeId,
        side:                      pos.side,
        action:                    "auto_close_finalize",
        amount:                    pos.shares,
        price:                     effectivePrice,
        cost:                      proceeds,
        marketYesPriceAtExecution: m.yesPrice,
        marketNoPriceAtExecution:  m.noPrice,
        realizedPnl:               profit,
      },
    });

    const newBalance = parseFloat((currentBalance + proceeds).toFixed(2));
    await tx.balanceLog.create({
      data: {
        userId,
        tradeId:        trade.id,
        challengeId,
        type:           "trade_close",
        amount:         proceeds,
        balanceBefore:  currentBalance,
        balanceAfter:   newBalance,
        runningBalance: newBalance,
      },
    });

    await tx.position.update({
      where: { id: pos.id },
      data: {
        status:      "closed",
        shares:      0,
        closedAt:    now,
        realizedPnl: parseFloat((pos.realizedPnl + profit).toFixed(2)),
        version:     { increment: 1 },
      },
    });

    currentBalance = newBalance;
    totalProceeds += proceeds;
    totalPnl      += profit;
    closedCount++;
  }

  const newRealizedBalance = parseFloat((challenge.realizedBalance + totalProceeds).toFixed(2));
  const newPeakBalance     = Math.max(challenge.peakBalance, newRealizedBalance);
  const newPeakEquity      = Math.max(
    challenge.peakEquity ?? challenge.peakBalance,
    newRealizedBalance,
  );

  await tx.challenge.update({
    where: { id: challengeId },
    data: {
      realizedBalance: newRealizedBalance,
      peakBalance:     newPeakBalance,
      peakEquity:      newPeakEquity,
    },
  });

  return {
    closedCount,
    totalPnl: parseFloat(totalPnl.toFixed(2)),
  };
}
