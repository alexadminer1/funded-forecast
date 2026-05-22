import { prisma } from "@/lib/prisma";
import { computeEquity } from "@/lib/equity";
import { checkAndMarkPassed } from "@/lib/challengeStatus";
import { closeOpenPositionsForChallenge } from "@/lib/closeChallengePositions";

export interface ResolveMarketResult {
  positionsProcessed: number;
  positionsSkipped: number;
}

/**
 * Resolve all open positions for a market that has been declared resolved.
 * Idempotent: positions already resolved (resolvedAt != null) are skipped.
 *
 * Caller must have already updated Market.status = "resolved" and set winningOutcome,
 * and pass the last-known live yesPrice/noPrice as snapshot — they become the
 * marketYes/NoPriceAtExecution on the Trade row created for the resolve event.
 *
 * For each open position:
 * - Trade row with action='resolve' is created (realizedPnl = payout - costBasis;
 *   P0.3.a aggregation source for ChallengeDailyPnL)
 * - BalanceLog entry of type "market_resolve" is created and linked to the Trade
 *   via tradeId (admin audit invariant: every Trade must have a matching BalanceLog)
 * - Winners get $1 per share as payout (added to balance + challenge realizedBalance)
 * - Losers get $0 payout (their costBasis was already deducted at buy time)
 * - Position is marked resolved (status, resolvedAt, closedAt, shares=0)
 * - Challenge is updated (peakBalance, profitTargetMet, drawdown check)
 *
 * Each position is processed in its own transaction for isolation.
 */
export async function resolveMarketPositions(
  marketId: string,
  winningOutcome: "yes" | "no",
  yesPriceSnapshot: number,
  noPriceSnapshot: number,
): Promise<ResolveMarketResult> {
  const openPositions = await prisma.position.findMany({
    where: {
      marketId,
      status: "open",
      resolvedAt: null,
    },
  });

  let positionsProcessed = 0;
  let positionsSkipped = 0;

  for (const position of openPositions) {
    try {
      await prisma.$transaction(async (tx) => {
        // Idempotency check
        const fresh = await tx.position.findUnique({
          where: { id: position.id },
        });

        if (!fresh || fresh.resolvedAt !== null) {
          positionsSkipped++;
          return;
        }

        // Phase 4.A.2 Task 2 (Option A) — skip resolve entirely for positions
        // whose source Challenge is no longer active. Position remains
        // status="open" as an orphan; Phase 4.B auto-close-at-finalize or
        // admin manual close will reconcile it. Sandbox positions
        // (challengeId === null) proceed normally.
        // Source: docs/PHASE_4_0_AUDIT.md finding #1.
        if (fresh.challengeId !== null) {
          const sourceChallenge = await tx.challenge.findUnique({
            where: { id: fresh.challengeId },
            select: { status: true },
          });
          if (sourceChallenge && sourceChallenge.status !== "active") {
            console.log(
              `[marketResolve] Skipping position ${fresh.id}: challenge ${fresh.challengeId} status=${sourceChallenge.status}`,
            );
            positionsSkipped++;
            return;
          }
        }

        const isWinner = fresh.side === winningOutcome;
        const payout = isWinner ? parseFloat((fresh.shares * 1.0).toFixed(2)) : 0;
        const profit = parseFloat((payout - fresh.costBasis).toFixed(2));

        // Phase 4.A.2 Task 1 — runningBalance chain must be scoped to the
        // same (userId, challengeId) pair, otherwise sandbox/challenge
        // balance chains cross-pollinate at resolve time.
        // Source: docs/PHASE_4_0_AUDIT.md finding #2.
        const lastLog = await tx.balanceLog.findFirst({
          where: {
            userId: fresh.userId,
            challengeId: fresh.challengeId,
          },
          orderBy: { createdAt: "desc" },
          select: { runningBalance: true },
        });

        const currentBalance = lastLog?.runningBalance ?? 0;
        const newBalance = parseFloat((currentBalance + payout).toFixed(2));

        // P0.3.a — record the resolve as a Trade row with action='resolve'.
        // Must be created BEFORE the BalanceLog so we can link tradeId
        // (admin audit checks every Trade has a matching BalanceLog).
        const trade = await tx.trade.create({
          data: {
            userId: fresh.userId,
            marketId,
            challengeId: fresh.challengeId,
            side: fresh.side,
            action: "resolve",
            amount: fresh.shares,
            price: isWinner ? 1.0 : 0.0,
            cost: payout,
            marketYesPriceAtExecution: yesPriceSnapshot,
            marketNoPriceAtExecution: noPriceSnapshot,
            realizedPnl: profit,
          },
        });

        // Insert balance log (linked to the resolve Trade row)
        await tx.balanceLog.create({
          data: {
            userId: fresh.userId,
            tradeId: trade.id,
            challengeId: fresh.challengeId,
            type: "market_resolve",
            amount: payout,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            runningBalance: newBalance,
          },
        });

        // Update position
        await tx.position.update({
          where: { id: fresh.id },
          data: {
            status: "resolved",
            resolvedAt: new Date(),
            shares: 0,
            realizedPnl: parseFloat((fresh.realizedPnl + profit).toFixed(2)),
            closedAt: new Date(),
          },
        });

        // Update challenge if applicable
        if (fresh.challengeId) {
          const challenge = await tx.challenge.findUnique({
            where: { id: fresh.challengeId },
          });

          if (challenge && challenge.status === "active") {
            const newRealizedBalance = parseFloat(
              (challenge.realizedBalance + payout).toFixed(2)
            );
            const newPeakBalance = Math.max(challenge.peakBalance, newRealizedBalance);

            const profitPct = parseFloat(
              (((newRealizedBalance - challenge.startBalance) / challenge.startBalance) * 100).toFixed(2)
            );
            const profitTargetMet = profitPct >= challenge.profitTargetPct;

            const maxLossAmount = challenge.startBalance * (challenge.maxTotalDdPct / 100);
            const mll = newPeakBalance - maxLossAmount;
            const isFailedByCash = newRealizedBalance < mll;

            // Wave C: equity-aware MLL check
            const equity = parseFloat((await computeEquity(tx, fresh.challengeId, newRealizedBalance)).toFixed(2));
            const currentPeakEquity = challenge.peakEquity ?? challenge.peakBalance;
            const newPeakEquity = Math.max(currentPeakEquity, equity);
            const equityMLL = newPeakEquity - maxLossAmount;
            const isFailedByEquity = equity < equityMLL;

            const drawdownViolated = isFailedByCash || isFailedByEquity;

            const violationReason = isFailedByEquity && !isFailedByCash
              ? `Max Loss hit (equity): equity $${equity.toFixed(2)} below limit $${equityMLL.toFixed(2)} (peak equity $${newPeakEquity.toFixed(2)})`
              : `Max Loss hit: balance $${newRealizedBalance.toFixed(2)} below limit $${mll.toFixed(2)} (peak $${newPeakBalance.toFixed(2)})`;

            await tx.challenge.update({
              where: { id: fresh.challengeId },
              data: {
                realizedBalance: newRealizedBalance,
                peakBalance: newPeakBalance,
                peakEquity: newPeakEquity,
                profitTargetMet,
                resolvedPositionsCount: { increment: 1 },
                ...(drawdownViolated ? {
                  drawdownViolated: true,
                  status: "failed",
                  violationReason,
                  endedAt: new Date(),
                } : {}),
              },
            });

              // Phase 4.B Task 2 site #7 — when this resolve trips the
              // drawdown limit, close every OTHER open position of the
              // challenge in the same per-position tx. The current
              // position was already flipped to status="resolved" above
              // (line 108-117), so it won't match the helper's
              // status="open" filter. Audit ref: docs/PHASE_4_0_AUDIT.md
              // finding #3.
              if (drawdownViolated) {
                await closeOpenPositionsForChallenge(tx, fresh.challengeId, "failed_drawdown");
              }

              // P0.3.b — auto-pass check (only if not failed by drawdown)
              if (!drawdownViolated) {
                await checkAndMarkPassed(tx, fresh.challengeId);
              }
          }
        }

        positionsProcessed++;
      }, { timeout: 15000 });
    } catch (err) {
      console.error(`[RESOLVE] Position ${position.id} failed:`, err);
    }
  }

  return { positionsProcessed, positionsSkipped };
}
