import { prisma } from "@/lib/prisma";
import { computeEquity } from "@/lib/equity";
import { checkAndMarkPassed } from "@/lib/challengeStatus";

export interface ResolveMarketResult {
  positionsProcessed: number;
  positionsSkipped: number;
}

/**
 * Resolve all open positions for a market that has been declared resolved.
 * Idempotent: positions already resolved (resolvedAt != null) are skipped.
 *
 * Caller must have already updated Market.status = "resolved" and set winningOutcome.
 *
 * For each open position:
 * - Winners get $1 per share as payout (added to balance + challenge realizedBalance)
 * - Losers get $0 payout (their costBasis was already deducted at buy time)
 * - Position is marked resolved (status, resolvedAt, closedAt, shares=0)
 * - Challenge is updated (peakBalance, profitTargetMet, drawdown check)
 * - BalanceLog entry of type "market_resolve" is created
 *
 * Each position is processed in its own transaction for isolation.
 */
export async function resolveMarketPositions(
  marketId: string,
  winningOutcome: "yes" | "no"
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

        const isWinner = fresh.side === winningOutcome;
        const payout = isWinner ? parseFloat((fresh.shares * 1.0).toFixed(2)) : 0;
        const profit = parseFloat((payout - fresh.costBasis).toFixed(2));

        // Get current balance
        const lastLog = await tx.balanceLog.findFirst({
          where: { userId: fresh.userId },
          orderBy: { createdAt: "desc" },
          select: { runningBalance: true },
        });

        const currentBalance = lastLog?.runningBalance ?? 0;
        const newBalance = parseFloat((currentBalance + payout).toFixed(2));

        // Insert balance log
        await tx.balanceLog.create({
          data: {
            userId: fresh.userId,
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
