export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { computeEquity } from "@/lib/equity";
import { BUY_PRICE_CAP, MAX_DAILY_VOLUME_PCT } from "@/lib/engine/constants";
import {
  applyBuySpread,
  checkBuyCap,
  checkMinPosition,
  getMinPositionUsd,
  checkAggregatePosition,
  getMaxAggregatePositionUsd,
  checkMaxDailyVolume,
} from "@/lib/engine/spreads";

const MAX_SLIPPAGE = 0.02;
const SANDBOX_MAX_POSITION_PCT = 2;

class PriceMovedError extends Error {
  currentPrice: number;
  constructor(currentPrice: number) {
    super("PRICE_MOVED");
    this.currentPrice = currentPrice;
  }
}

type PreTradeFailCategory = "mll_breach" | "daily_drawdown_exceeded";

class DrawdownViolatedError extends Error {
  challengeId: number;
  reason: string;
  category: PreTradeFailCategory;
  constructor(challengeId: number, reason: string, category: PreTradeFailCategory) {
    super("CHALLENGE_DRAWDOWN_VIOLATED");
    this.challengeId = challengeId;
    this.reason = reason;
    this.category = category;
  }
}

class ChallengeExpiredError extends Error {
  challengeId: number;
  constructor(challengeId: number) {
    super("CHALLENGE_EXPIRED");
    this.challengeId = challengeId;
  }
}

class BuyCapExceededError extends Error {
  rawPrice: number;
  constructor(rawPrice: number) {
    super("BUY_CAP_EXCEEDED");
    this.rawPrice = rawPrice;
  }
}

// Phase 2.A — pre-trade position size rejects (BUSINESS_RULES rules #2, #3)
// Pure HTTP 400 errors. No side effects on Challenge.status.
// DO NOT mimic DrawdownViolatedError persistence pattern for these.

class MinPositionError extends Error {
  cost: number;
  minRequired: number;
  constructor(cost: number, minRequired: number) {
    super("MIN_POSITION_BELOW_LIMIT");
    this.cost = cost;
    this.minRequired = minRequired;
  }
}

class AggregatePositionExceededError extends Error {
  existingCost: number;
  newCost: number;
  totalAfter: number;
  maxAllowed: number;
  constructor(existingCost: number, newCost: number, totalAfter: number, maxAllowed: number) {
    super("AGGREGATE_POSITION_EXCEEDED");
    this.existingCost = existingCost;
    this.newCost = newCost;
    this.totalAfter = totalAfter;
    this.maxAllowed = maxAllowed;
  }
}

// Phase 2.B — pre-trade security + daily-volume rejects (rules #4, #5, #6).
// Pure HTTP rejects. No side effects on Challenge.status.

class UserBlockedError extends Error {
  blockReason: string | null;
  constructor(blockReason: string | null) {
    super("Account is blocked");
    this.name = "UserBlockedError";
    this.blockReason = blockReason;
  }
}

class MarketEndedError extends Error {
  endDate: Date;
  constructor(endDate: Date) {
    super("Market trading period has ended");
    this.name = "MarketEndedError";
    this.endDate = endDate;
  }
}

class DailyVolumeExceededError extends Error {
  currentDailyVolume: number;
  newCost: number;
  totalAfter: number;
  maxAllowed: number;
  constructor(currentDailyVolume: number, newCost: number, totalAfter: number, maxAllowed: number) {
    super("Daily buy volume cap exceeded");
    this.name = "DailyVolumeExceededError";
    this.currentDailyVolume = currentDailyVolume;
    this.newCost = newCost;
    this.totalAfter = totalAfter;
    this.maxAllowed = maxAllowed;
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

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
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { marketId, side, amount, clientPrice } = body;

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

  // Phase 2.B — Rule #6: blocked users cannot trade.
  // Hard reject before any state read. No challenge state change.
  // Dedicated try/catch — the main try below wraps only the transaction-bearing
  // flow (and lazy daily reset above it sits outside the main try too).
  try {
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isBlocked: true, blockReason: true },
    });
    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (userRecord.isBlocked) {
      throw new UserBlockedError(userRecord.blockReason ?? null);
    }
  } catch (err: unknown) {
    if (err instanceof UserBlockedError) {
      return NextResponse.json(
        {
          error: err.message,
          error_code: "USER_BLOCKED",
          blockReason: err.blockReason,
        },
        { status: 403 },
      );
    }
    throw err;
  }

  // === Lazy daily reset (outside transaction so it persists even on rollback) ===
  const activeChallengePre = await prisma.challenge.findFirst({
    where: { userId, status: "active" },
  });

  if (activeChallengePre) {
    const today = todayUtc();
    const stored = activeChallengePre.dayStartDate?.toISOString().slice(0, 10) ?? null;
    if (stored !== today) {
      await prisma.challenge.update({
        where: { id: activeChallengePre.id },
        data: {
          dayStartBalance: activeChallengePre.realizedBalance,
          dayStartDate: new Date(),
        },
      });
    }
  }

  let drawdownFail: { challengeId: number; reason: string } | null = null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const activeChallenge = await tx.challenge.findFirst({
        where: { userId, status: "active" },
      });
      const challengeId = activeChallenge ? activeChallenge.id : null;

      if (activeChallenge && activeChallenge.expiresAt && new Date() > activeChallenge.expiresAt) {
        throw new ChallengeExpiredError(activeChallenge.id);
      }

      const market = await tx.market.findUnique({ where: { id: marketId } });
      if (!market) throw new Error("MARKET_NOT_FOUND");
      if (market.status !== "live") throw new Error("MARKET_NOT_LIVE");

      // Phase 2.B — Rule #5: market.endDate hard reject for buy.
      // Existing status check above catches resolved/disputed markets;
      // this catches the gap window where endDate passed but cron has not yet
      // flipped status. Buy only — sell allows legitimate position close.
      if (market.endDate && market.endDate < new Date()) {
        throw new MarketEndedError(market.endDate);
      }

      const rawPrice = side === "yes" ? market.yesPrice : market.noPrice;
      if (Math.abs(clientPrice - rawPrice) > MAX_SLIPPAGE) {
        throw new PriceMovedError(rawPrice);
      }

      // P0.4: buy cap on RAW price (before spread).
      if (!checkBuyCap(rawPrice)) {
        throw new BuyCapExceededError(rawPrice);
      }

      // P0.4: buy spread against user. Position.avgPrice / Trade.price store effective.
      // Raw remains in Trade.marketYesPriceAtExecution / marketNoPriceAtExecution.
      const { effectivePrice, spreadPct } = applyBuySpread(rawPrice);
      const executionPrice = effectivePrice;
      const cost = parseFloat((amount * executionPrice).toFixed(2));

      if (!(cost > 0)) throw new Error("INVALID_TRADE_COST");

      const lastLog = await tx.balanceLog.findFirst({
        where: challengeId !== null
          ? { userId, challengeId }
          : { userId, challengeId: null },
        orderBy: { createdAt: "desc" },
      });

      const currentBalance = lastLog ? lastLog.runningBalance : 0;

      if (currentBalance < cost) throw new Error("INSUFFICIENT_BALANCE");

      // Phase 2.A: existingPosition fetched ONCE here, reused for:
      //   1. aggregate position cap check (rule #3)
      //   2. upsert decision below
      // Do NOT add a second findFirst later.
      const existingPosition = await tx.position.findFirst({
        where: { userId, marketId, side, status: "open", challengeId },
      });

      // Phase 2.A: position size rules per BUSINESS_RULES.md
      // - Challenge mode: rule #2 (min 2% startBalance) + rule #3 (max aggregate 5% startBalance per market+side)
      // - Sandbox mode: legacy per-trade cap vs currentBalance (unchanged)
      if (activeChallenge) {
        // Rule #2: min position
        if (!checkMinPosition(cost, activeChallenge.startBalance)) {
          throw new MinPositionError(
            cost,
            getMinPositionUsd(activeChallenge.startBalance),
          );
        }

        // Rule #3: max aggregate position per (marketId, side)
        const existingCost = existingPosition?.costBasis ?? 0;
        if (!checkAggregatePosition(existingCost, cost, activeChallenge.startBalance)) {
          const totalAfter = parseFloat((existingCost + cost).toFixed(2));
          throw new AggregatePositionExceededError(
            existingCost,
            cost,
            totalAfter,
            getMaxAggregatePositionUsd(activeChallenge.startBalance),
          );
        }

        // Phase 2.B — Rule #4: max daily buy volume cap (challenge mode only).
        // Pre-insert read inside tx — aggregate sums BUY costs for this challenge,
        // today (UTC), excluding the new trade.
        const now = new Date();
        const todayUtcStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

        const dailyAgg = await tx.trade.aggregate({
          _sum: { cost: true },
          where: {
            challengeId: activeChallenge.id,
            action: "buy",
            createdAt: { gte: todayUtcStart },
          },
        });
        const currentDailyVolume = dailyAgg._sum.cost ?? 0;

        if (!checkMaxDailyVolume(currentDailyVolume, cost, activeChallenge.startBalance)) {
          const maxAllowed = activeChallenge.startBalance * (MAX_DAILY_VOLUME_PCT / 100);
          throw new DailyVolumeExceededError(
            Math.round(currentDailyVolume * 100) / 100,
            Math.round(cost * 100) / 100,
            Math.round((currentDailyVolume + cost) * 100) / 100,
            Math.round(maxAllowed * 100) / 100,
          );
        }
      } else {
        const maxCost = parseFloat((currentBalance * SANDBOX_MAX_POSITION_PCT / 100).toFixed(2));
        if (cost > maxCost) throw new Error("POSITION_SIZE_EXCEEDED");
      }

      // Upsert position (reusing existingPosition fetched above)
      let position;
      if (existingPosition) {
        const newCostBasis = parseFloat((existingPosition.costBasis + cost).toFixed(2));
        const newShares = existingPosition.shares + amount;
        position = await tx.position.update({
          where: { id: existingPosition.id },
          data: {
            shares: newShares,
            costBasis: newCostBasis,
            avgPrice: parseFloat((newCostBasis / newShares).toFixed(6)),
            version: { increment: 1 },
          },
        });
      } else {
        position = await tx.position.create({
          data: {
            userId, marketId, side,
            challengeId,
            status: "open",
            shares: amount,
            avgPrice: executionPrice,
            costBasis: cost,
            realizedPnl: 0,
          },
        });

        // P0.3.d Inactivity Timer — reset on NEW position only (not on shares increment)
        if (challengeId) {
          await tx.challenge.update({
            where: { id: challengeId },
            data: { lastNewPositionAt: new Date() },
          });
        }
      }

      const trade = await tx.trade.create({
        data: {
          userId, marketId,
          challengeId,
          side, action: "buy",
          amount, price: executionPrice, cost,
          marketYesPriceAtExecution: market.yesPrice,
          marketNoPriceAtExecution: market.noPrice,
        },
      });

      const newBalance = parseFloat((currentBalance - cost).toFixed(2));
      await tx.balanceLog.create({
        data: {
          userId, tradeId: trade.id, challengeId,
          type: "trade_open",
          amount: -cost,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          runningBalance: newBalance,
        },
      });

      // === Drawdown checks (challenge mode only) ===
      if (activeChallenge && challengeId) {
        const newRealizedBalance = parseFloat((activeChallenge.realizedBalance - cost).toFixed(2));
        const newPeakBalance = Math.max(activeChallenge.peakBalance, newRealizedBalance);

        const maxLossAmount = activeChallenge.startBalance * (activeChallenge.maxTotalDdPct / 100);
        const mll = newPeakBalance - maxLossAmount;
        const isFailedByCash = newRealizedBalance < mll;

        // Wave C: equity-aware MLL check
        const equity = parseFloat((await computeEquity(tx, challengeId, newRealizedBalance)).toFixed(2));
        const currentPeakEquity = activeChallenge.peakEquity ?? activeChallenge.peakBalance;
        const newPeakEquity = Math.max(currentPeakEquity, equity);
        const equityMLL = newPeakEquity - maxLossAmount;
        const isFailedByEquity = equity < equityMLL;

        const isFailed = isFailedByCash || isFailedByEquity;

        if (isFailed) {
          const reason = isFailedByEquity && !isFailedByCash
            ? `Max Loss hit (equity): equity $${equity.toFixed(2)} below limit $${equityMLL.toFixed(2)} (peak equity $${newPeakEquity.toFixed(2)})`
            : `Max Loss hit: balance $${newRealizedBalance.toFixed(2)} below limit $${mll.toFixed(2)} (peak $${newPeakBalance.toFixed(2)})`;
          throw new DrawdownViolatedError(challengeId, reason, "mll_breach");
        }

        // Daily drawdown check
        const dayStart = activeChallenge.dayStartBalance ?? newRealizedBalance;
        if (dayStart > 0) {
          const dailyDrawdownPct = parseFloat(
            (((dayStart - newRealizedBalance) / dayStart) * 100).toFixed(2)
          );
          if (dailyDrawdownPct >= activeChallenge.maxDailyDdPct) {
            throw new DrawdownViolatedError(
              challengeId,
              `Daily drawdown ${dailyDrawdownPct}% exceeded limit ${activeChallenge.maxDailyDdPct}%`,
              "daily_drawdown_exceeded"
            );
          }
        }

        await tx.challenge.update({
          where: { id: challengeId },
          data: { realizedBalance: newRealizedBalance, peakBalance: newPeakBalance, peakEquity: newPeakEquity },
        });

        // Counting trading days (race-safe via conditional update)
        const todayUtcStart = new Date();
        todayUtcStart.setUTCHours(0, 0, 0, 0);
        await tx.challenge.updateMany({
          where: {
            id: challengeId,
            OR: [
              { lastTradingDay: null },
              { lastTradingDay: { lt: todayUtcStart } },
            ],
          },
          data: {
            tradingDaysCount: { increment: 1 },
            lastTradingDay: todayUtcStart,
          },
        });

        // P0.3.c: recalculate unique events count across all positions for this challenge.
        // Fallback: market:${id} prefix prevents collisions between real eventIds and market ids.
        const challengePositions = await tx.position.findMany({
          where: { challengeId },
          select: { market: { select: { id: true, polymarketEventId: true } } },
        });
        const uniqueEvents = new Set(
          challengePositions.map(p => p.market.polymarketEventId ?? `market:${p.market.id}`)
        ).size;
        await tx.challenge.update({
          where: { id: challengeId },
          data: { uniqueEventsCount: uniqueEvents },
        });
      }

      await tx.user.update({ where: { id: userId }, data: { lastTradeAt: new Date() } });

      return { trade, position, balanceAfter: newBalance, rawPrice, effectivePrice, spreadPct, cost };
    }, { timeout: 15000 });

    return NextResponse.json({
      success: true,
      tradeId: result.trade.id,
      positionId: result.position.id,
      balanceAfter: result.balanceAfter,
      rawPrice: result.rawPrice,
      effectivePrice: result.effectivePrice,
      spreadPct: result.spreadPct,
      cost: result.cost,
    });

  } catch (error: unknown) {
    if (error instanceof DrawdownViolatedError) {
      drawdownFail = { challengeId: error.challengeId, reason: error.reason };
    }

    if (error instanceof PriceMovedError) {
      return NextResponse.json(
        {
          error: "Price moved beyond slippage tolerance. Please retry.",
          currentPrice: error.currentPrice,
        },
        { status: 409 }
      );
    }

    if (error instanceof BuyCapExceededError) {
      return NextResponse.json(
        {
          error: `Buy cap exceeded: price $${error.rawPrice.toFixed(4)} is at or above $${BUY_PRICE_CAP.toFixed(2)}`,
          rawPrice: error.rawPrice,
          cap: BUY_PRICE_CAP,
        },
        { status: 400 }
      );
    }

    // Phase 2.A — pre-trade position size rejects (rules #2, #3).
    // Pure 400, no Challenge state changes.
    if (error instanceof MinPositionError) {
      return NextResponse.json(
        {
          error: `Minimum position is $${error.minRequired.toFixed(2)}. Your trade cost: $${error.cost.toFixed(2)}.`,
          error_code: "MIN_POSITION_BELOW_LIMIT",
          cost: error.cost,
          minRequired: error.minRequired,
        },
        { status: 400 }
      );
    }

    if (error instanceof AggregatePositionExceededError) {
      return NextResponse.json(
        {
          error: `Position cap exceeded. Existing: $${error.existingCost.toFixed(2)}, new: $${error.newCost.toFixed(2)}, total: $${error.totalAfter.toFixed(2)}, max: $${error.maxAllowed.toFixed(2)}.`,
          error_code: "AGGREGATE_POSITION_EXCEEDED",
          existingCost: error.existingCost,
          newCost: error.newCost,
          totalAfter: error.totalAfter,
          maxAllowed: error.maxAllowed,
        },
        { status: 400 }
      );
    }

    // Phase 2.B — pure 400 rejects (rules #4, #5). No Challenge state changes.
    // UserBlockedError is handled in its own dedicated try/catch above (pre-tx),
    // so no handler is needed here for rule #6.
    if (error instanceof MarketEndedError) {
      return NextResponse.json(
        {
          error: error.message,
          error_code: "MARKET_ENDED",
          endDate: error.endDate.toISOString(),
        },
        { status: 400 }
      );
    }

    if (error instanceof DailyVolumeExceededError) {
      return NextResponse.json(
        {
          error: `Daily volume cap reached. Spent today: $${error.currentDailyVolume.toFixed(2)}, new trade: $${error.newCost.toFixed(2)}, total: $${error.totalAfter.toFixed(2)}, max: $${error.maxAllowed.toFixed(2)}.`,
          error_code: "DAILY_VOLUME_EXCEEDED",
          currentDailyVolume: error.currentDailyVolume,
          newCost: error.newCost,
          totalAfter: error.totalAfter,
          maxAllowed: error.maxAllowed,
        },
        { status: 400 }
      );
    }

    if (error instanceof DrawdownViolatedError) {
      // Persist fail outside the rolled-back transaction
      try {
        await prisma.challenge.update({
          where: { id: error.challengeId },
          data: {
            status: "failed",
            drawdownViolated: true,
            violationReason: error.reason,
            endedAt: new Date(),
          },
        });
      } catch (e) {
        console.error("[BUY] Failed to persist challenge fail:", e);
      }
      return NextResponse.json(
        {
          error_code: "CHALLENGE_FAILED_PRE_TRADE",
          reason: error.category,
          details: error.reason,
          challengeStatusAfter: "failed",
          violationCause: "price_movement_on_existing_positions",
        },
        { status: 409 }
      );
    }

    if (error instanceof ChallengeExpiredError) {
      try {
        await prisma.challenge.update({
          where: { id: error.challengeId },
          data: {
            status: "failed",
            violationReason: "Challenge period expired",
            endedAt: new Date(),
          },
        });
      } catch (e) {
        console.error("[BUY] Failed to persist challenge expiry:", e);
      }
      return NextResponse.json(
        {
          error_code: "CHALLENGE_FAILED_PRE_TRADE",
          reason: "time_limit",
          details: "Challenge period has ended",
          challengeStatusAfter: "failed",
          violationCause: "challenge_period_ended",
        },
        { status: 409 }
      );
    }

    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const clientErrors: Record<string, { status: number; error: string }> = {
      MARKET_NOT_FOUND:             { status: 404, error: "Market not found" },
      MARKET_NOT_LIVE:              { status: 400, error: "Market is not live" },
      INSUFFICIENT_BALANCE:         { status: 400, error: "Insufficient balance" },
      POSITION_SIZE_EXCEEDED:       { status: 400, error: "Position size exceeds limit" },
      POSITION_NOT_OPEN:            { status: 400, error: "Position is not open" },
      INVALID_TRADE_COST:           { status: 400, error: "Invalid trade cost" },
    };
    if (message in clientErrors) {
      const { status, error } = clientErrors[message];
      return NextResponse.json({ error }, { status });
    }
    console.error("[BUY] Unexpected error:", error, drawdownFail);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
