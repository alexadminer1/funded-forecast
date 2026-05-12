export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { sendEmail, buildBrandTemplate, buildKeyValueTable, escapeHtml } from "@/lib/email";

const MAX_SLIPPAGE = 0.02;

class PriceMovedError extends Error {
  currentPrice: number;
  constructor(currentPrice: number) {
    super("PRICE_MOVED");
    this.currentPrice = currentPrice;
  }
}

class DrawdownViolatedError extends Error {
  challengeId: number;
  reason: string;
  constructor(challengeId: number, reason: string) {
    super("CHALLENGE_DRAWDOWN_VIOLATED");
    this.challengeId = challengeId;
    this.reason = reason;
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

  try {
    const result = await prisma.$transaction(async (tx) => {
      const activeChallenge = await tx.challenge.findFirst({
        where: { userId, status: "active" },
      });
      const challengeId = activeChallenge ? activeChallenge.id : null;

      if (activeChallenge && activeChallenge.expiresAt && new Date() > activeChallenge.expiresAt) {
        throw new Error("CHALLENGE_EXPIRED");
      }

      const market = await tx.market.findUnique({ where: { id: marketId } });
      if (!market) throw new Error("MARKET_NOT_FOUND");
      if (market.status !== "live") throw new Error("MARKET_NOT_LIVE");

      const currentPrice = side === "yes" ? market.yesPrice : market.noPrice;
      if (Math.abs(clientPrice - currentPrice) > MAX_SLIPPAGE) {
        throw new PriceMovedError(currentPrice);
      }

      const executionPrice = currentPrice;

      const position = await tx.position.findFirst({
        where: { userId, marketId, side, challengeId, status: "open" },
      });

      if (!position) throw new Error("POSITION_NOT_FOUND");
      if (position.shares < amount) throw new Error("INSUFFICIENT_SHARES");

      const proceeds = parseFloat((amount * executionPrice).toFixed(2));
      const realizedPnl = parseFloat((amount * (executionPrice - position.avgPrice)).toFixed(2));

      const newShares = position.shares - amount;
      const costBasisReduced = parseFloat((amount * position.avgPrice).toFixed(2));
      const newCostBasis = parseFloat((position.costBasis - costBasisReduced).toFixed(2));
      const isFullClose = newShares === 0;

      const updatedPosition = await tx.position.update({
        where: { id: position.id },
        data: {
          shares: newShares,
          costBasis: newCostBasis,
          avgPrice: newShares > 0 ? parseFloat((newCostBasis / newShares).toFixed(6)) : 0,
          realizedPnl: parseFloat((position.realizedPnl + realizedPnl).toFixed(2)),
          status: isFullClose ? "closed" : "open",
          closedAt: isFullClose ? new Date() : null,
          version: { increment: 1 },
        },
      });

      const trade = await tx.trade.create({
        data: {
          userId, marketId, challengeId,
          side, action: "sell",
          amount, price: executionPrice, cost: proceeds,
          marketYesPriceAtExecution: market.yesPrice,
          marketNoPriceAtExecution: market.noPrice,
        },
      });

      // Balance scoped to mode
      const lastLog = await tx.balanceLog.findFirst({
        where: challengeId !== null
          ? { userId, challengeId }
          : { userId, challengeId: null },
        orderBy: { createdAt: "desc" },
      });

      const currentBalance = lastLog ? lastLog.runningBalance : 0;
      const newBalance = parseFloat((currentBalance + proceeds).toFixed(2));

      await tx.balanceLog.create({
        data: {
          userId, tradeId: trade.id, challengeId,
          type: "trade_close",
          amount: proceeds,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          runningBalance: newBalance,
        },
      });

      // === Challenge balance update + drawdown checks ===
      let autoPass = false;
      let passMeta: { profitPct: number; profitTargetPct: number; tradingDays: number; minTradingDays: number } | null = null;
      if (activeChallenge && challengeId) {
        const newRealizedBalance = parseFloat((activeChallenge.realizedBalance + proceeds).toFixed(2));
        const newPeakBalance = Math.max(activeChallenge.peakBalance, newRealizedBalance);
        const profitPct = parseFloat(
          (((newRealizedBalance - activeChallenge.startBalance) / activeChallenge.startBalance) * 100).toFixed(2)
        );
        const profitTargetMet = profitPct >= activeChallenge.profitTargetPct;

        // Total MLL check (trailing fixed drawdown from peakBalance)
        const maxLossAmount = activeChallenge.startBalance * (activeChallenge.maxTotalDdPct / 100);
        const mll = newPeakBalance - maxLossAmount;
        const isFailed = newRealizedBalance < mll;

        if (isFailed) {
          throw new DrawdownViolatedError(
            challengeId,
            `Max Loss hit: balance $${newRealizedBalance.toFixed(2)} below limit $${mll.toFixed(2)} (peak $${newPeakBalance.toFixed(2)})`
          );
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
              `Daily drawdown ${dailyDrawdownPct}% exceeded limit ${activeChallenge.maxDailyDdPct}%`
            );
          }
        }

        await tx.challenge.update({
          where: { id: challengeId },
          data: { realizedBalance: newRealizedBalance, peakBalance: newPeakBalance, profitTargetMet },
        });

        if (profitTargetMet && !activeChallenge.profitTargetMet) {
          await tx.auditLog.create({
            data: {
              actorId: userId,
              targetType: "challenge",
              targetId: String(challengeId),
              category: "challenge",
              action: "challenge_profit_target_met",
              metadata: { profitPct, target: activeChallenge.profitTargetPct, realizedBalance: newRealizedBalance },
            },
          });
        }

        // Counting trading days (race-safe via conditional update)
        const todayUtcStart = new Date();
        todayUtcStart.setUTCHours(0, 0, 0, 0);
        const isNewTradingDay =
          !activeChallenge.lastTradingDay || activeChallenge.lastTradingDay < todayUtcStart;
        const effectiveTradingDays = activeChallenge.tradingDaysCount + (isNewTradingDay ? 1 : 0);
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

        if (profitTargetMet && effectiveTradingDays >= activeChallenge.minTradingDays) {
          autoPass = true;
          passMeta = {
            profitPct,
            profitTargetPct: activeChallenge.profitTargetPct,
            tradingDays: effectiveTradingDays,
            minTradingDays: activeChallenge.minTradingDays,
          };
          await tx.challenge.update({
            where: { id: challengeId },
            data: { status: "passed", endedAt: new Date() },
          });
          await tx.auditLog.create({
            data: {
              actorId: userId,
              targetType: "challenge",
              targetId: String(challengeId),
              category: "challenge",
              action: "challenge_auto_passed",
              metadata: {
                profitPct,
                profitTargetPct: activeChallenge.profitTargetPct,
                tradingDays: effectiveTradingDays,
                minTradingDays: activeChallenge.minTradingDays,
                realizedBalance: newRealizedBalance,
              },
            },
          });
        }
      }

      await tx.user.update({ where: { id: userId }, data: { lastTradeAt: new Date() } });

      return { trade, position: updatedPosition, proceeds, realizedPnl, balanceAfter: newBalance, positionClosed: isFullClose, autoPass, passMeta };
    });

    if (result.autoPass && result.passMeta) {
      try {
        const passedUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, firstName: true },
        });
        if (passedUser?.email) {
          const name = passedUser.firstName ?? "Trader";
          const { profitPct, profitTargetPct, tradingDays, minTradingDays } = result.passMeta;
          const profitPctStr = profitPct.toFixed(2);
          const targetStr = profitTargetPct.toFixed(0);
          const tradingDaysStr = String(tradingDays);
          const minDaysStr = String(minTradingDays);
          const balanceStr = `$${result.balanceAfter.toFixed(2)}`;

          const bodyHtml = `
<p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px">Hi ${escapeHtml(name)},</p>
<p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 20px">Congratulations — you have successfully completed your FundedForecast challenge.</p>
${buildKeyValueTable([
  { label: "Profit",        value: `${profitPctStr}% (target: ${targetStr}%)` },
  { label: "Trading days",  value: `${tradingDaysStr} / ${minDaysStr}` },
  { label: "Final balance", value: balanceStr },
])}
<p style="font-size:14px;color:#374151;line-height:1.6;margin:20px 0 0">Our team will reach out shortly with next steps for funding your account.</p>`;

          const bodyText = `Hi ${name},

Congratulations — you have successfully completed your FundedForecast challenge.

Profit:         ${profitPctStr}% (target: ${targetStr}%)
Trading days:   ${tradingDaysStr} / ${minDaysStr}
Final balance:  ${balanceStr}

Our team will reach out shortly with next steps for funding your account.`;

          const tpl = buildBrandTemplate({
            heading: "Challenge passed",
            bodyHtml,
            bodyText,
          });

          await sendEmail({
            to: passedUser.email,
            subject: "Congratulations — you passed your FundedForecast challenge",
            html: tpl.html,
            text: tpl.text,
          });
        }
      } catch (err) {
        console.error("[SELL] auto-pass email failed (non-fatal):", err);
      }
    }

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
    if (error instanceof PriceMovedError) {
      return NextResponse.json(
        {
          error: "Price moved beyond slippage tolerance. Please retry.",
          currentPrice: error.currentPrice,
        },
        { status: 409 }
      );
    }

    if (error instanceof DrawdownViolatedError) {
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
        console.error("[SELL] Failed to persist challenge fail:", e);
      }
      return NextResponse.json(
        { error: `Challenge failed: ${error.reason}` },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const clientErrors: Record<string, { status: number; error: string }> = {
      MARKET_NOT_FOUND:       { status: 404, error: "Market not found" },
      MARKET_NOT_LIVE:        { status: 400, error: "Market is not live" },
      POSITION_NOT_FOUND:     { status: 404, error: "No open position found for this market and side" },
      INSUFFICIENT_SHARES:    { status: 400, error: "Not enough shares to sell" },
      CHALLENGE_EXPIRED:      { status: 400, error: "Challenge period has ended" },
    };
    if (message in clientErrors) {
      const { status, error } = clientErrors[message];
      return NextResponse.json({ error }, { status });
    }
    console.error("[SELL] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
