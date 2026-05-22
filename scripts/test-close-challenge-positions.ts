/**
 * Phase 4.B Task 1 — closeOpenPositionsForChallenge smoke test.
 *
 * Seeds an active challenge with 2 open positions (yes + no), wraps
 * a call to the helper in a single $transaction, and asserts that
 * both positions are closed, Trade + BalanceLog rows are emitted,
 * the runningBalance chain is scoped, and Challenge.realizedBalance
 * is bumped exactly once.
 *
 * Run:  npx tsx scripts/test-close-challenge-positions.ts
 * Env:  DATABASE_URL (required — dev DB)
 */

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { closeOpenPositionsForChallenge } from "@/lib/closeChallengePositions";
import { applySellSpread } from "@/lib/engine/spreads";

try {
  for (const line of readFileSync(".env", "utf-8").split("\n")) {
    const m = line.match(/^([^#\s][^=]*)=(.*)/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = val;
    }
  }
} catch {}

const prisma = new PrismaClient();
const STAMP = Date.now();

type Result = { label: string; passed: boolean; detail?: string };
const results: Result[] = [];

function pass(label: string): void {
  results.push({ label, passed: true });
  console.log(`  ✓  ${label}`);
}
function fail(label: string, detail: string): void {
  results.push({ label, passed: false, detail });
  console.log(`  ✗  ${label}`);
  console.log(`     → ${detail}`);
}

async function cleanup(userIds: number[], marketIds: string[]): Promise<void> {
  if (userIds.length > 0) {
    await prisma.balanceLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.trade.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.position.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.challenge.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userConsent.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  if (marketIds.length > 0) {
    await prisma.market.deleteMany({ where: { id: { in: marketIds } } });
  }
}

async function main(): Promise<number> {
  const userIds:   number[] = [];
  const marketIds: string[] = [];

  try {
    const user = await prisma.user.create({
      data: {
        email:     `test-close-helper+${STAMP}@funded.dev`,
        username:  `t-cch-${STAMP}`,
        firstName: "Test",
        lastName:  "Helper",
        provider:  "email",
      },
    });
    userIds.push(user.id);

    const marketA = await prisma.market.create({
      data: {
        id:           `test-mkt-cch-a-${STAMP}`,
        conditionId:  `test-cond-cch-a-${STAMP}`,
        slug:         `test-slug-cch-a-${STAMP}`,
        title:        "Test market A (helper)",
        yesPrice:     0.60,
        noPrice:      0.40,
        endDate:      new Date(Date.now() + 30 * 24 * 3600 * 1000),
        status:       "live",
        lastSyncedAt: new Date(),
      },
    });
    marketIds.push(marketA.id);

    const marketB = await prisma.market.create({
      data: {
        id:           `test-mkt-cch-b-${STAMP}`,
        conditionId:  `test-cond-cch-b-${STAMP}`,
        slug:         `test-slug-cch-b-${STAMP}`,
        title:        "Test market B (helper)",
        yesPrice:     0.20,
        noPrice:      0.80,
        endDate:      new Date(Date.now() + 30 * 24 * 3600 * 1000),
        status:       "live",
        lastSyncedAt: new Date(),
      },
    });
    marketIds.push(marketB.id);

    const challenge = await prisma.challenge.create({
      data: {
        userId:          user.id,
        stage:           "evaluation",
        status:          "active",
        startBalance:    10_000,
        realizedBalance: 9_800,   // bought 200 worth across the two positions
        peakBalance:     10_000,
        profitTargetPct: 10,
        maxDailyDdPct:   5,
        maxTotalDdPct:   10,
        minTradingDays:  10,
      },
    });

    await prisma.balanceLog.create({
      data: {
        userId:         user.id,
        challengeId:    challenge.id,
        type:           "challenge_start",
        amount:         10_000,
        balanceBefore:  0,
        balanceAfter:   10_000,
        runningBalance: 10_000,
      },
    });
    // Simulate balance after two buys (cost 100 + 100 = 200).
    await prisma.balanceLog.create({
      data: {
        userId:         user.id,
        challengeId:    challenge.id,
        type:           "trade_open",
        amount:         -200,
        balanceBefore:  10_000,
        balanceAfter:   9_800,
        runningBalance: 9_800,
      },
    });

    const positionA = await prisma.position.create({
      data: {
        userId:      user.id,
        marketId:    marketA.id,
        challengeId: challenge.id,
        side:        "yes",
        status:      "open",
        shares:      200,
        avgPrice:    0.50,
        costBasis:   100,
        realizedPnl: 0,
      },
    });

    const positionB = await prisma.position.create({
      data: {
        userId:      user.id,
        marketId:    marketB.id,
        challengeId: challenge.id,
        side:        "no",
        status:      "open",
        shares:      125,
        avgPrice:    0.80,
        costBasis:   100,
        realizedPnl: 0,
      },
    });

    // ───────────────────────────────────────────────────────────────
    // Invoke the helper inside a real $transaction.
    // ───────────────────────────────────────────────────────────────
    const summary = await prisma.$transaction(async (tx) => {
      return closeOpenPositionsForChallenge(tx, challenge.id, "expired");
    });

    console.log(`\nHelper summary: closedCount=${summary.closedCount} totalPnl=${summary.totalPnl}`);

    if (summary.closedCount !== 2) {
      fail("closedCount=2", `got ${summary.closedCount}`);
    } else {
      pass("closedCount=2");
    }

    // Expected per-position numbers.
    const aSell = applySellSpread(marketA.yesPrice).effectivePrice;
    const bSell = applySellSpread(marketB.noPrice).effectivePrice;
    const aProceeds = parseFloat((200 * aSell).toFixed(2));
    const bProceeds = parseFloat((125 * bSell).toFixed(2));
    const aProfit   = parseFloat((aProceeds - 100).toFixed(2));
    const bProfit   = parseFloat((bProceeds - 100).toFixed(2));
    const expectedTotalPnl = parseFloat((aProfit + bProfit).toFixed(2));

    if (Math.abs(summary.totalPnl - expectedTotalPnl) > 0.01) {
      fail("totalPnl matches per-position spread math", `expected ${expectedTotalPnl}, got ${summary.totalPnl}`);
    } else {
      pass(`totalPnl=${summary.totalPnl} (expected ${expectedTotalPnl})`);
    }

    // Position assertions.
    const posAAfter = await prisma.position.findUnique({ where: { id: positionA.id } });
    const posBAfter = await prisma.position.findUnique({ where: { id: positionB.id } });
    if (posAAfter?.status !== "closed" || posAAfter.shares !== 0 || posAAfter.closedAt === null) {
      fail("positionA closed", `status=${posAAfter?.status} shares=${posAAfter?.shares} closedAt=${posAAfter?.closedAt}`);
    } else {
      pass("positionA closed (shares=0, closedAt set)");
    }
    if (posBAfter?.status !== "closed" || posBAfter.shares !== 0 || posBAfter.closedAt === null) {
      fail("positionB closed", `status=${posBAfter?.status} shares=${posBAfter?.shares} closedAt=${posBAfter?.closedAt}`);
    } else {
      pass("positionB closed (shares=0, closedAt set)");
    }

    // Trade rows.
    const trades = await prisma.trade.findMany({
      where:   { userId: user.id, action: "auto_close_finalize" },
      orderBy: { createdAt: "asc" },
    });
    if (trades.length !== 2) {
      fail("2 Trade rows with action=auto_close_finalize", `got ${trades.length}`);
    } else {
      pass(`2 Trade rows action=auto_close_finalize (ids: ${trades.map(t => t.id).join(", ")})`);
    }
    const wrongChallenge = trades.find(t => t.challengeId !== challenge.id);
    if (wrongChallenge) {
      fail("all Trade rows scoped to challenge", `trade ${wrongChallenge.id} has challengeId=${wrongChallenge.challengeId}`);
    } else {
      pass("all Trade rows scoped to challenge");
    }

    // BalanceLog rows.
    const logs = await prisma.balanceLog.findMany({
      where:   { userId: user.id, type: "trade_close" },
      orderBy: { createdAt: "asc" },
    });
    if (logs.length !== 2) {
      fail("2 BalanceLog rows type=trade_close", `got ${logs.length}`);
    } else {
      pass(`2 BalanceLog rows type=trade_close (ids: ${logs.map(l => l.id).join(", ")})`);
    }
    if (logs.length === 2) {
      // Chain check: first row's balanceBefore = 9800 (after the two buys),
      // first row's runningBalance = 9800 + aProceeds,
      // second row's balanceBefore = first runningBalance,
      // second row's runningBalance = first running + bProceeds.
      const firstBefore = logs[0].balanceBefore;
      const firstAfter  = logs[0].runningBalance;
      const secondBefore = logs[1].balanceBefore;
      const secondAfter  = logs[1].runningBalance;

      if (firstBefore !== 9800) {
        fail("first close balanceBefore=9800 (scoped chain)", `got ${firstBefore}`);
      } else {
        pass("first close balanceBefore=9800 (scoped chain)");
      }
      if (Math.abs(firstAfter - (9800 + aProceeds)) > 0.01) {
        fail("first close runningBalance correct", `expected ${(9800 + aProceeds).toFixed(2)}, got ${firstAfter}`);
      } else {
        pass(`first close runningBalance=${firstAfter}`);
      }
      if (secondBefore !== firstAfter) {
        fail("second close balanceBefore chains from first", `expected ${firstAfter}, got ${secondBefore}`);
      } else {
        pass("second close balanceBefore chains from first");
      }
      if (Math.abs(secondAfter - (firstAfter + bProceeds)) > 0.01) {
        fail("second close runningBalance correct", `expected ${(firstAfter + bProceeds).toFixed(2)}, got ${secondAfter}`);
      } else {
        pass(`second close runningBalance=${secondAfter}`);
      }
    }

    // Challenge balance bump.
    const finalChallenge = await prisma.challenge.findUnique({ where: { id: challenge.id } });
    const expectedRealized = parseFloat((9_800 + aProceeds + bProceeds).toFixed(2));
    if (Math.abs((finalChallenge?.realizedBalance ?? -1) - expectedRealized) > 0.01) {
      fail("challenge.realizedBalance bumped by totalProceeds", `expected ${expectedRealized}, got ${finalChallenge?.realizedBalance}`);
    } else {
      pass(`challenge.realizedBalance=${finalChallenge?.realizedBalance}`);
    }

    // Idempotency: second call should be a no-op.
    const secondRun = await prisma.$transaction(async (tx) => {
      return closeOpenPositionsForChallenge(tx, challenge.id, "admin_force");
    });
    if (secondRun.closedCount !== 0) {
      fail("idempotent: second call closes 0 positions", `got ${secondRun.closedCount}`);
    } else {
      pass("idempotent: second call closed 0 positions");
    }

    // Empty challenge: no open positions ever → no-op.
    const challenge2 = await prisma.challenge.create({
      data: {
        userId:          user.id,
        stage:           "evaluation",
        status:          "active",
        startBalance:    10_000,
        realizedBalance: 10_000,
        peakBalance:     10_000,
        profitTargetPct: 10,
        maxDailyDdPct:   5,
        maxTotalDdPct:   10,
        minTradingDays:  10,
      },
    });
    const emptyRun = await prisma.$transaction(async (tx) => {
      return closeOpenPositionsForChallenge(tx, challenge2.id, "expired");
    });
    if (emptyRun.closedCount !== 0 || emptyRun.totalPnl !== 0) {
      fail("empty challenge: zero closedCount / totalPnl", `got ${JSON.stringify(emptyRun)}`);
    } else {
      pass("empty challenge: zero closedCount / totalPnl");
    }
  } finally {
    console.log("\nCleanup...");
    await cleanup(userIds, marketIds);
  }

  console.log("\n────────────────────────────");
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`PASS: ${passed}    FAIL: ${failed}`);

  return failed === 0 ? 0 : 1;
}

main()
  .then(code => prisma.$disconnect().then(() => process.exit(code)))
  .catch(err => {
    console.error("UNEXPECTED ERROR:", err);
    return prisma.$disconnect().then(() => process.exit(1));
  });
