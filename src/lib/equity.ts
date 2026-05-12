import { Prisma } from "@prisma/client";

/**
 * Compute total value of open positions for a challenge.
 * Uses current market prices (yesPrice/noPrice) at moment of read.
 *
 * MUST be called inside a Prisma transaction (tx) to get consistent snapshot.
 *
 * @param tx Prisma transaction client
 * @param challengeId Challenge ID to compute positions for
 * @returns Sum of (shares × currentPrice) across all open positions
 */
export async function computeOpenPositionsValue(
  tx: Prisma.TransactionClient,
  challengeId: number,
): Promise<number> {
  const openPositions = await tx.position.findMany({
    where: {
      challengeId,
      status: "open",
    },
    include: {
      market: {
        select: {
          yesPrice: true,
          noPrice: true,
          status: true,
        },
      },
    },
  });

  let total = 0;
  for (const pos of openPositions) {
    // If market is no longer live (resolved/closed), price may be stale.
    // Safe fallback: use avgPrice (cost basis per share).
    if (pos.market.status !== "live") {
      total += pos.shares * pos.avgPrice;
      continue;
    }
    const currentPrice =
      pos.side === "yes" ? pos.market.yesPrice : pos.market.noPrice;
    total += pos.shares * currentPrice;
  }

  return total;
}

/**
 * Compute equity = realizedBalance + open positions value.
 */
export async function computeEquity(
  tx: Prisma.TransactionClient,
  challengeId: number,
  realizedBalance: number,
): Promise<number> {
  const positionsValue = await computeOpenPositionsValue(tx, challengeId);
  return realizedBalance + positionsValue;
}
