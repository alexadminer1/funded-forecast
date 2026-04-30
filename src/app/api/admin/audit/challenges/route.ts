export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_KEY = process.env.ADMIN_API_KEY;
const EPSILON = 0.01;

type Severity = "critical" | "warning" | "info";

interface Issue {
  code: string;
  severity: Severity;
  message: string;
  details?: Record<string, unknown>;
}

interface ChallengeReport {
  challengeId: number;
  userId: number;
  status: string;
  issues: Issue[];
}

function todayUtcStart(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON;
}

async function auditChallenge(challengeId: number): Promise<ChallengeReport | null> {
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) return null;

  const issues: Issue[] = [];

  const balanceLogs = await prisma.balanceLog.findMany({
    where: { challengeId },
    orderBy: { createdAt: "asc" },
  });

  const trades = await prisma.trade.findMany({
    where: { challengeId },
    orderBy: { createdAt: "asc" },
  });

  const positions = await prisma.position.findMany({
    where: { challengeId },
    include: { market: { select: { id: true, status: true, winningOutcome: true } } },
  });

  // ─── CRITICAL CHECKS ────────────────────────────────────────

  // 1. SUM_MISMATCH
  const sumAmounts = balanceLogs.reduce((acc, l) => acc + l.amount, 0);
  if (!approxEqual(sumAmounts, challenge.realizedBalance)) {
    issues.push({
      code: "SUM_MISMATCH",
      severity: "critical",
      message: `Sum of BalanceLog.amount (${sumAmounts.toFixed(2)}) != realizedBalance (${challenge.realizedBalance.toFixed(2)})`,
      details: { sumAmounts, realizedBalance: challenge.realizedBalance, startBalance: challenge.startBalance },
    });
  }

  // 2. RUNNING_BALANCE_MISMATCH
  if (balanceLogs.length > 0) {
    const lastRunning = balanceLogs[balanceLogs.length - 1].runningBalance;
    if (!approxEqual(lastRunning, challenge.realizedBalance)) {
      issues.push({
        code: "RUNNING_BALANCE_MISMATCH",
        severity: "critical",
        message: `Last BalanceLog.runningBalance (${lastRunning.toFixed(2)}) != realizedBalance (${challenge.realizedBalance.toFixed(2)})`,
        details: { lastRunning, realizedBalance: challenge.realizedBalance },
      });
    }
  }

  // 3. BALANCE_AFTER_BROKEN — в каждой записи balanceBefore + amount == balanceAfter
  for (const log of balanceLogs) {
    const expected = log.balanceBefore + log.amount;
    if (!approxEqual(expected, log.balanceAfter)) {
      issues.push({
        code: "BALANCE_AFTER_BROKEN",
        severity: "critical",
        message: `BalanceLog #${log.id}: balanceBefore (${log.balanceBefore}) + amount (${log.amount}) != balanceAfter (${log.balanceAfter})`,
        details: { logId: log.id, balanceBefore: log.balanceBefore, amount: log.amount, balanceAfter: log.balanceAfter },
      });
      break; // отчитываем только первое расхождение, не флудим
    }
  }

  // 4. BALANCE_CHAIN_BROKEN — balanceBefore[i] == balanceAfter[i-1]
  for (let i = 1; i < balanceLogs.length; i++) {
    const prev = balanceLogs[i - 1];
    const curr = balanceLogs[i];
    if (!approxEqual(curr.balanceBefore, prev.balanceAfter)) {
      issues.push({
        code: "BALANCE_CHAIN_BROKEN",
        severity: "critical",
        message: `BalanceLog chain broken between #${prev.id} (after=${prev.balanceAfter}) and #${curr.id} (before=${curr.balanceBefore})`,
        details: { prevId: prev.id, prevAfter: prev.balanceAfter, currId: curr.id, currBefore: curr.balanceBefore },
      });
      break;
    }
  }

  // 5. PEAK_LESS_THAN_REALIZED
  if (challenge.peakBalance < challenge.realizedBalance - EPSILON) {
    issues.push({
      code: "PEAK_LESS_THAN_REALIZED",
      severity: "critical",
      message: `peakBalance (${challenge.peakBalance}) < realizedBalance (${challenge.realizedBalance})`,
      details: { peakBalance: challenge.peakBalance, realizedBalance: challenge.realizedBalance },
    });
  }

  // 6. PEAK_LESS_THAN_HISTORICAL
  if (balanceLogs.length > 0) {
    const maxRunning = Math.max(...balanceLogs.map(l => l.runningBalance));
    if (challenge.peakBalance < maxRunning - EPSILON) {
      issues.push({
        code: "PEAK_LESS_THAN_HISTORICAL",
        severity: "critical",
        message: `peakBalance (${challenge.peakBalance}) < max historical runningBalance (${maxRunning})`,
        details: { peakBalance: challenge.peakBalance, maxRunning },
      });
    }
  }

  // 7. FAILED_NO_END
  if (challenge.status === "failed") {
    if (!challenge.endedAt) {
      issues.push({
        code: "FAILED_NO_END",
        severity: "critical",
        message: `status=failed but endedAt is null`,
      });
    }
    if (!challenge.drawdownViolated && !challenge.violationReason) {
      issues.push({
        code: "FAILED_NO_REASON",
        severity: "critical",
        message: `status=failed but neither drawdownViolated nor violationReason set`,
      });
    }
  }

  // 8. PASSED_NO_END
  if (challenge.status === "passed") {
    if (!challenge.endedAt) {
      issues.push({
        code: "PASSED_NO_END",
        severity: "critical",
        message: `status=passed but endedAt is null`,
      });
    }
    if (!challenge.profitTargetMet) {
      issues.push({
        code: "PASSED_NO_PROFIT_FLAG",
        severity: "critical",
        message: `status=passed but profitTargetMet=false`,
      });
    }
  }

  // 9. POSITION_OPEN_ON_RESOLVED_MARKET
  for (const pos of positions) {
    if (pos.status === "open" && pos.market.status === "resolved") {
      issues.push({
        code: "POSITION_OPEN_ON_RESOLVED_MARKET",
        severity: "critical",
        message: `Position #${pos.id} is open but market ${pos.marketId} is resolved`,
        details: { positionId: pos.id, marketId: pos.marketId, marketWinner: pos.market.winningOutcome },
      });
    }
  }

  // 10. POSITION_CLOSED_NO_LOG
  for (const pos of positions) {
    if (pos.status === "closed" || pos.status === "resolved") {
      const expectedTypes = pos.status === "resolved"
        ? ["market_resolve", "trade_close"]
        : ["trade_close"];
      const matching = balanceLogs.filter(l => expectedTypes.includes(l.type));
      if (matching.length === 0) {
        issues.push({
          code: "POSITION_CLOSED_NO_LOG",
          severity: "critical",
          message: `Position #${pos.id} (${pos.status}) has no matching BalanceLog (${expectedTypes.join("/")})`,
          details: { positionId: pos.id, positionStatus: pos.status },
        });
      }
    }
  }

  // 11. SHARES_NEGATIVE
  for (const pos of positions) {
    if (pos.shares < 0) {
      issues.push({
        code: "SHARES_NEGATIVE",
        severity: "critical",
        message: `Position #${pos.id} has negative shares: ${pos.shares}`,
        details: { positionId: pos.id, shares: pos.shares },
      });
    }
  }

  // 12. COST_BASIS_NEGATIVE
  for (const pos of positions) {
    if (pos.costBasis < 0) {
      issues.push({
        code: "COST_BASIS_NEGATIVE",
        severity: "critical",
        message: `Position #${pos.id} has negative costBasis: ${pos.costBasis}`,
        details: { positionId: pos.id, costBasis: pos.costBasis },
      });
    }
  }

  // ─── WARNING CHECKS ─────────────────────────────────────────

  // 13. PROFIT_TARGET_FLAG_WRONG
  if (challenge.profitTargetMet) {
    const profitPct = ((challenge.realizedBalance - challenge.startBalance) / challenge.startBalance) * 100;
    if (profitPct < challenge.profitTargetPct - EPSILON) {
      issues.push({
        code: "PROFIT_TARGET_FLAG_WRONG",
        severity: "warning",
        message: `profitTargetMet=true but actual profit ${profitPct.toFixed(2)}% < target ${challenge.profitTargetPct}%`,
        details: { profitPct, target: challenge.profitTargetPct },
      });
    }
  }

  // 14. DRAWDOWN_BOUND_EXCEEDED
  if (challenge.status === "active" && !challenge.drawdownViolated) {
    const drawdownPct = ((challenge.startBalance - challenge.realizedBalance) / challenge.startBalance) * 100;
    if (drawdownPct >= challenge.maxTotalDdPct) {
      issues.push({
        code: "DRAWDOWN_BOUND_EXCEEDED",
        severity: "warning",
        message: `Active challenge with drawdown ${drawdownPct.toFixed(2)}% >= limit ${challenge.maxTotalDdPct}% but drawdownViolated=false`,
        details: { drawdownPct, limit: challenge.maxTotalDdPct },
      });
    }
  }

  // 15. TRADE_NO_LOG
  const logTradeIds = new Set(balanceLogs.filter(l => l.tradeId !== null).map(l => l.tradeId));
  for (const trade of trades) {
    if (!logTradeIds.has(trade.id)) {
      issues.push({
        code: "TRADE_NO_LOG",
        severity: "warning",
        message: `Trade #${trade.id} has no associated BalanceLog`,
        details: { tradeId: trade.id, action: trade.action },
      });
      break; // первое расхождение
    }
  }

  // 16. DAY_START_MISSING
  const todayStr = utcDateString(todayUtcStart());
  const tradesToday = trades.filter(t => utcDateString(t.createdAt) === todayStr);
  if (tradesToday.length > 0) {
    const dayStartStr = challenge.dayStartDate ? utcDateString(challenge.dayStartDate) : null;
    if (dayStartStr !== todayStr || challenge.dayStartBalance === null) {
      issues.push({
        code: "DAY_START_MISSING",
        severity: "warning",
        message: `Trade(s) today but dayStartDate/dayStartBalance not properly set`,
        details: { tradesToday: tradesToday.length, dayStartDate: challenge.dayStartDate, dayStartBalance: challenge.dayStartBalance },
      });
    }
  }

  // 17. TRADING_DAYS_OVERCOUNT
  const uniqueDays = new Set(trades.map(t => utcDateString(t.createdAt)));
  if (challenge.tradingDaysCount > uniqueDays.size) {
    issues.push({
      code: "TRADING_DAYS_OVERCOUNT",
      severity: "warning",
      message: `tradingDaysCount (${challenge.tradingDaysCount}) > unique UTC days in Trade history (${uniqueDays.size})`,
      details: { tradingDaysCount: challenge.tradingDaysCount, uniqueDays: uniqueDays.size },
    });
  }

  // ─── INFO CHECKS ────────────────────────────────────────────

  // 18. NO_TRADES
  if (challenge.status === "active" && trades.length === 0 && approxEqual(challenge.realizedBalance, challenge.startBalance)) {
    issues.push({
      code: "NO_TRADES",
      severity: "info",
      message: `Active challenge with no trades and balance untouched`,
    });
  }

  return {
    challengeId: challenge.id,
    userId: challenge.userId,
    status: challenge.status,
    issues,
  };
}

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const challengeIdParam = req.nextUrl.searchParams.get("challengeId");
  const statusParam = req.nextUrl.searchParams.get("status") ?? "all";

  let challengeIds: number[];

  if (challengeIdParam) {
    const id = parseInt(challengeIdParam, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid challengeId" }, { status: 400 });
    }
    challengeIds = [id];
  } else {
    const validStatuses = ["active", "failed", "passed", "all"];
    if (!validStatuses.includes(statusParam)) {
      return NextResponse.json({ error: `status must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
    }
    const where = statusParam === "all" ? {} : { status: statusParam };
    const challenges = await prisma.challenge.findMany({
      where,
      select: { id: true },
      orderBy: { id: "asc" },
    });
    challengeIds = challenges.map(c => c.id);
  }

  const reports: ChallengeReport[] = [];
  for (const id of challengeIds) {
    const r = await auditChallenge(id);
    if (r && r.issues.length > 0) reports.push(r);
  }

  const bySeverity = { critical: 0, warning: 0, info: 0 };
  let totalIssues = 0;
  for (const r of reports) {
    for (const i of r.issues) {
      bySeverity[i.severity]++;
      totalIssues++;
    }
  }

  return NextResponse.json({
    totalChecked: challengeIds.length,
    totalWithIssues: reports.length,
    totalIssues,
    bySeverity,
    challenges: reports,
  });
}
