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
      const market = await tx.market.findUnique({
        where: { id: marketId },
      });

      if (!market) throw new Error("MARKET_NOT_FOUND");
      if (market.status !== "live") throw new Error("MARKET_NOT_LIVE");
      if (market.negRisk) throw new Error("NEG_RISK_NOT_SUPPORTED");

      const currentPrice = side === "yes" ? market.yesPrice : market.noPrice;
      const slippage = Math.abs(clientPrice - currentPrice);

      if (slippage > MAX_SLIPPAGE) {
        throw new Error("PRICE_MOVED");
      }

      const executionPrice = currentPrice;
      const cost = parseFloat((amount * executionPrice).toFixed(2));

      const lastLog = await tx.balanceLog.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      const currentBalance = lastLog ? lastLog.runningBalance : 0;

      if (currentBalance < cost) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      let challenge = null;
      if (challengeId) {
        challenge = await tx.challenge.findUnique({
          where: { id: challengeId },
        });

        if (!challenge || challenge.userId !== userId) {
          throw new Error("CHALLENGE_NOT_FOUND");
        }

        if (challenge.status !== "active") {
          throw new Error("CHALLENGE_NOT_ACTIVE");
        }

        const maxPositionCost = parseFloat(
          (challenge.realizedBalance * challenge.maxPositionSizePct / 100).toFixed(2)
        );

        if (cost > maxPositionCost) {
          throw new Error("POSITION_SIZE_EXCEEDED");
        }
      }

      const existingPosition = await tx.position.findFirst({
        where: {
          userId,
          marketId,
          side,
          status: "open",
          challengeId: challengeId ?? null,
        },
      });

      let position;

      if (existingPosition) {
        if (existingPosition.status !== "open") {
          throw new Error("POSITION_NOT_OPEN");
        }

        const newCostBasis = parseFloat((existingPosition.costBasis + cost).toFixed(2));
        const newShares = existingPosition.shares + amount;
        const newAvgPrice = parseFloat((newCostBasis / newShares).toFixed(6));

        position = await tx.position.update({
          where: { id: existingPosition.id },
          data: {
            shares: newShares,
            costBasis: newCostBasis,
            avgPrice: newAvgPrice,
            version: { increment: 1 },
          },
        });
      } else {
        position = await tx.position.create({
          data: {
            userId,
            marketId,
            side,
            challengeId: challengeId ?? null,
            status: "open",
            shares: amount,
            avgPrice: executionPrice,
            costBasis: cost,
            realizedPnl: 0,
          },
        });
      }

      const trade = await tx.trade.create({
        data: {
          userId,
          marketId,
          challengeId: challengeId ?? null,
          side,
          action: "buy",
          amount,
          price: executionPrice,
          cost,
          marketYesPriceAtExecution: market.yesPrice,
          marketNoPriceAtExecution: market.noPrice,
        },
      });

      const newBalance = parseFloat((currentBalance - cost).toFixed(2));

      await tx.balanceLog.create({
        data: {
          userId,
          tradeId: trade.id,
          challengeId: challengeId ?? null,
          type: "trade_open",
          amount: -cost,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          runningBalance: newBalance,
        },
      });

      if (challenge && challengeId) {
        const newRealizedBalance = parseFloat((challenge.realizedBalance - cost).toFixed(2));
        const newPeakBalance = Math.max(challenge.peakBalance, newRealizedBalance);

        const totalDrawdownPct = parseFloat(
          (((challenge.startBalance - newRealizedBalance) / challenge.startBalance) * 100).toFixed(2)
        );

        if (totalDrawdownPct >= challenge.maxTotalDdPct) {
          await tx.challenge.update({
            where: { id: challengeId },
            data: {
              realizedBalance: newRealizedBalance,
              peakBalance: newPeakBalance,
              status: "failed",
              drawdownViolated: true,
              violationReason: `Total drawdown ${totalDrawdownPct}% exceeded limit ${challenge.maxTotalDdPct}%`,
              endedAt: new Date(),
            },
          });

          await tx.auditLog.create({
            data: {
              actorId: userId,
              targetType: "challenge",
              targetId: challengeId,
              category: "challenge",
              action: "challenge_failed",
              metadata: {
                reason: "total_drawdown_exceeded",
                drawdownPct: totalDrawdownPct,
                limit: challenge.maxTotalDdPct,
              },
            },
          });

          throw new Error("CHALLENGE_DRAWDOWN_VIOLATED");
        }

        await tx.challenge.update({
          where: { id: challengeId },
          data: {
            realizedBalance: newRealizedBalance,
            peakBalance: newPeakBalance,
          },
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { lastTradeAt: new Date() },
      });

      return {
        trade,
        position,
        balanceAfter: newBalance,
      };
    }, { timeout: 15000 }); // ← ВАЖНО: увеличенный таймаут

    return NextResponse.json({
      success: true,
      tradeId: result.trade.id,
      positionId: result.position.id,
      balanceAfter: result.balanceAfter,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    const clientErrors: Record<string, { status: number; error: string }> = {
      MARKET_NOT_FOUND:          { status: 404, error: "Market not found" },
      MARKET_NOT_LIVE:           { status: 400, error: "Market is not live" },
      NEG_RISK_NOT_SUPPORTED:    { status: 400, error: "This market type is not supported" },
      PRICE_MOVED:               { status: 409, error: "Price moved beyond slippage tolerance. Please retry." },
      INSUFFICIENT_BALANCE:      { status: 400, error: "Insufficient balance" },
      CHALLENGE_NOT_FOUND:       { status: 404, error: "Challenge not found" },
      CHALLENGE_NOT_ACTIVE:      { status: 400, error: "Challenge is not active" },
      POSITION_SIZE_EXCEEDED:    { status: 400, error: "Position size exceeds challenge limit" },
      POSITION_NOT_OPEN:         { status: 400, error: "Position is not open" },
      CHALLENGE_DRAWDOWN_VIOLATED: { status: 400, error: "Challenge failed: drawdown limit exceeded" },
    };

    if (message in clientErrors) {
      const { status, error } = clientErrors[message];
      return NextResponse.json({ error }, { status });
    }

    console.error("[BUY] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
