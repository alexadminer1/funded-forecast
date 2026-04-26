export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const MAX_SLIPPAGE = 0.02;

export async function POST(req: NextRequest) {
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

  let body: {
    marketId: string;
    side: "yes" | "no";
    amount: number;
    clientPrice: number;
    challengeId?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { marketId, side, amount, clientPrice, challengeId } = body;

  if (!marketId || !side || !amount || !clientPrice) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!["yes", "no"].includes(side)) {
    return NextResponse.json({ error: "Invalid side" }, { status: 400 });
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive integer" }, { status: 400 });
  }

  if (clientPrice <= 0 || clientPrice >= 1) {
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {

      // 1. Lock market and validate
      const market = await tx.market.findUnique({
        where: { id: marketId },
      });

      if (!market) {
        throw new Error("MARKET_NOT_FOUND");
      }

      if (market.status !== "live") {
        throw new Error("MARKET_NOT_LIVE");
      }

      if (market.negRisk) {
        throw new Error("NEG_RISK_NOT_SUPPORTED");
      }

      // 2. Slippage check
      const currentPrice = side === "yes" ? market.yesPrice : market.noPrice;
      const slippage = Math.abs(clientPrice - currentPrice);

      if (slippage > MAX_SLIPPAGE) {
        throw new Error("PRICE_MOVED");
      }

      const executionPrice = currentPrice;

      // 3. Lock position and validate
      const position = await tx.position.findFirst({
        where: {
          userId,
          marketId,
          side,
          challengeId: challengeId ?? null,
          status: "open",
        },
      });

      if (!position) {
        throw new Error("POSITION_NOT_FOUND");
      }

      if (position.shares < amount) {
        throw new Error("INSUFFICIENT_SHARES");
      }

      // 4. Calculate proceeds and realized PnL
      // proceeds = what user gets back (amount * sell price)
      // realizedPnl = amount * (sellPrice - avgPrice)
      const proceeds = parseFloat((amount * executionPrice).toFixed(2));
      const realizedPnl = parseFloat(
        (amount * (executionPrice - position.avgPrice)).toFixed(2)
      );

      // 5. Update position (AVCO — cost_basis reduces proportionally)
      const newShares = position.shares - amount;
      const costBasisReduced = parseFloat(
        (amount * position.avgPrice).toFixed(2)
      );
      const newCostBasis = parseFloat(
        (position.costBasis - costBasisReduced).toFixed(2)
      );
      const newAvgPrice =
        newShares > 0
          ? parseFloat((newCostBasis / newShares).toFixed(6))
          : 0;
      const newRealizedPnl = parseFloat(
        (position.realizedPnl + realizedPnl).toFixed(2)
      );

      const isFullClose = newShares === 0;

      const updatedPosition = await tx.position.update({
        where: { id: position.id },
        data: {
          shares: newShares,
          costBasis: newCostBasis,
          avgPrice: newAvgPrice,
          realizedPnl: newRealizedPnl,
          status: isFullClose ? "closed" : "open",
          closedAt: isFullClose ? new Date() : null,
          version: { increment: 1 },
        },
      });

      // 6. Insert trade (immutable)
      const trade = await tx.trade.create({
        data: {
          userId,
          marketId,
          challengeId: challengeId ?? null,
          side,
          action: "sell",
          amount,
          price: executionPrice,
          cost: proceeds,
          marketYesPriceAtExecution: market.yesPrice,
          marketNoPriceAtExecution: market.noPrice,
        },
      });

      // 7. Get current balance and insert balance log
      const lastLog = await tx.balanceLog.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      const currentBalance = lastLog ? lastLog.runningBalance : 0;
      const newBalance = parseFloat((currentBalance + proceeds).toFixed(2));

      await tx.balanceLog.create({
        data: {
          userId,
          tradeId: trade.id,
          challengeId: challengeId ?? null,
          type: "trade_close",
          amount: proceeds,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          runningBalance: newBalance,
        },
      });

      // 8. Update challenge realized balance
      if (challengeId) {
        const challenge = await tx.challenge.findUnique({
          where: { id: challengeId },
        });

        if (!challenge || challenge.userId !== userId) {
          throw new Error("CHALLENGE_NOT_FOUND");
        }

        if (challenge.status !== "active") {
          throw new Error("CHALLENGE_NOT_ACTIVE");
        }

        const newRealizedBalance = parseFloat(
          (challenge.realizedBalance + proceeds).toFixed(2)
        );
        const newPeakBalance = Math.max(challenge.peakBalance, newRealizedBalance);

        // Check profit target
        const profitPct = parseFloat(
          (((newRealizedBalance - challenge.startBalance) / challenge.startBalance) * 100).toFixed(2)
        );
        const profitTargetMet = profitPct >= challenge.profitTargetPct;

        await tx.challenge.update({
          where: { id: challengeId },
          data: {
            realizedBalance: newRealizedBalance,
            peakBalance: newPeakBalance,
            profitTargetMet,
            ...(profitTargetMet && !challenge.profitTargetMet
              ? { }
              : {}),
          },
        });

        if (profitTargetMet && !challenge.profitTargetMet) {
          await tx.auditLog.create({
            data: {
              actorId: userId,
              targetType: "challenge",
              targetId: challengeId,
              category: "challenge",
              action: "challenge_profit_target_met",
              metadata: {
                profitPct,
                target: challenge.profitTargetPct,
                realizedBalance: newRealizedBalance,
              },
            },
          });
        }
      }

      // 9. Update lastTradeAt
      await tx.user.update({
        where: { id: userId },
        data: { lastTradeAt: new Date() },
      });

      return {
        trade,
        position: updatedPosition,
        proceeds,
        realizedPnl,
        balanceAfter: newBalance,
        positionClosed: isFullClose,
      };
    });

    return NextResponse.json({
      success: true,
      tradeId: result.trade.id,
      positionId: result.position.id,
      proceeds: result.proceeds,
      realizedPnl: result.realizedPnl,
      balanceAfter: result.balanceAfter,
      positionClosed: result.positionClosed,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    const clientErrors: Record<string, { status: number; error: string }> = {
      MARKET_NOT_FOUND:         { status: 404, error: "Market not found" },
      MARKET_NOT_LIVE:          { status: 400, error: "Market is not live" },
      NEG_RISK_NOT_SUPPORTED:   { status: 400, error: "This market type is not supported" },
      PRICE_MOVED:              { status: 409, error: "Price moved beyond slippage tolerance. Please retry." },
      POSITION_NOT_FOUND:       { status: 404, error: "No open position found for this market and side" },
      INSUFFICIENT_SHARES:      { status: 400, error: "Not enough shares to sell" },
      CHALLENGE_NOT_FOUND:      { status: 404, error: "Challenge not found" },
      CHALLENGE_NOT_ACTIVE:     { status: 400, error: "Challenge is not active" },
    };

    if (message in clientErrors) {
      const { status, error } = clientErrors[message];
      return NextResponse.json({ error }, { status });
    }

    console.error("[SELL] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
