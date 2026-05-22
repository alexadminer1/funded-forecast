/**
 * Phase 4.A.2 Task 1 — runningBalance chain scope test.
 *
 * Verifies docs/PHASE_4_0_AUDIT.md finding #2 is fixed:
 *   resolveMarketPositions must read the lastLog scoped by both
 *   (userId, challengeId) — sandbox BalanceLog must not pollute
 *   challenge-mode resolves, and vice versa.
 *
 * Run:  npx tsx scripts/test-resolve-chain-scope.ts
 * Env:  DATABASE_URL (required — points at dev DB)
 *
 * Idempotent: seeds rows with timestamped emails / market ids and
 * cleans them up at the end (success or failure).
 */

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { resolveMarketPositions } from "@/lib/marketResolve";

// Load .env so DATABASE_URL is available when invoked without env wrappers.
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
  // Order matters: drop FK-dependent rows first.
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

async function seedUser(suffix: string) {
  return prisma.user.create({
    data: {
      email:     `test-resolve-chain-scope+${suffix}-${STAMP}@funded.dev`,
      username:  `t-rcs-${suffix}-${STAMP}`,
      firstName: "Test",
      lastName:  suffix,
      provider:  "email",
    },
  });
}

async function seedMarket(suffix: string) {
  return prisma.market.create({
    data: {
      id:           `test-mkt-rcs-${suffix}-${STAMP}`,
      conditionId:  `test-cond-rcs-${suffix}-${STAMP}`,
      slug:         `test-slug-rcs-${suffix}-${STAMP}`,
      title:        "Test market (chain scope)",
      yesPrice:     0.99,
      noPrice:      0.01,
      endDate:      new Date(Date.now() + 30 * 24 * 3600 * 1000),
      status:       "live",
      lastSyncedAt: new Date(),
    },
  });
}

async function main(): Promise<number> {
  const seededUserIds:   number[] = [];
  const seededMarketIds: string[] = [];

  try {
    // ───────────────────────────────────────────────────────────────
    // Scenario 1 — challenge resolve must read challenge-scoped chain
    // even when a NEWER sandbox BalanceLog exists for the same user.
    // ───────────────────────────────────────────────────────────────
    console.log("\n[Scenario 1] challenge resolve, sandbox log is newer:");

    const userA = await seedUser("challenge");
    seededUserIds.push(userA.id);

    const marketA = await seedMarket("a");
    seededMarketIds.push(marketA.id);

    const challengeA = await prisma.challenge.create({
      data: {
        userId:          userA.id,
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

    // Challenge_start log (oldest).
    await prisma.balanceLog.create({
      data: {
        userId:         userA.id,
        challengeId:    challengeA.id,
        type:           "challenge_start",
        amount:         10_000,
        balanceBefore:  0,
        balanceAfter:   10_000,
        runningBalance: 10_000,
      },
    });

    // Pre-existing sandbox BalanceLog with NEWER createdAt and a small
    // runningBalance. Under the buggy (userId-only) lookup, resolve
    // would pick THIS row as the predecessor — picking up balanceBefore=50.
    await prisma.balanceLog.create({
      data: {
        userId:         userA.id,
        challengeId:    null,
        type:           "adjustment",
        amount:         50,
        balanceBefore:  0,
        balanceAfter:   50,
        runningBalance: 50,
      },
    });

    // Open challenge position on market.
    const positionA = await prisma.position.create({
      data: {
        userId:      userA.id,
        marketId:    marketA.id,
        challengeId: challengeA.id,
        side:        "yes",
        status:      "open",
        shares:      100,
        avgPrice:    0.50,
        costBasis:   50,
        realizedPnl: 0,
      },
    });

    // Flip market to resolved (mimic admin endpoint pre-call step).
    await prisma.market.update({
      where: { id: marketA.id },
      data:  { status: "resolved", winningOutcome: "yes", resolvedExternalAt: new Date() },
    });

    await resolveMarketPositions(marketA.id, "yes", marketA.yesPrice, marketA.noPrice);

    const resolveLog = await prisma.balanceLog.findFirst({
      where:   { userId: userA.id, type: "market_resolve" },
      orderBy: { createdAt: "desc" },
    });

    if (!resolveLog) {
      fail("S1 resolve BalanceLog created", "no market_resolve row found");
    } else if (resolveLog.balanceBefore !== 10_000) {
      fail(
        "S1 challenge-scoped predecessor used",
        `expected balanceBefore=10000 (challenge chain), got ${resolveLog.balanceBefore} (likely sandbox-poisoned)`,
      );
    } else {
      pass("S1 challenge-scoped predecessor used (balanceBefore=10000)");
    }
    if (resolveLog && resolveLog.challengeId !== challengeA.id) {
      fail(
        "S1 resolve log challengeId matches position",
        `expected ${challengeA.id}, got ${resolveLog.challengeId}`,
      );
    } else if (resolveLog) {
      pass(`S1 resolve log challengeId=${resolveLog.challengeId}`);
    }
    if (resolveLog && resolveLog.runningBalance !== 10_100) {
      fail(
        "S1 runningBalance = 10000 + payout(100)",
        `expected 10100, got ${resolveLog.runningBalance}`,
      );
    } else if (resolveLog) {
      pass(`S1 runningBalance=${resolveLog.runningBalance}`);
    }

    // Position should be resolved.
    const posAAfter = await prisma.position.findUnique({ where: { id: positionA.id } });
    if (posAAfter?.status !== "resolved") {
      fail("S1 position marked resolved", `status=${posAAfter?.status}`);
    } else {
      pass("S1 position marked resolved");
    }

    // ───────────────────────────────────────────────────────────────
    // Scenario 2 — sandbox resolve must read sandbox-scoped chain even
    // when an active challenge with a higher balance exists.
    // ───────────────────────────────────────────────────────────────
    console.log("\n[Scenario 2] sandbox resolve, challenge log is newer:");

    const userB = await seedUser("sandbox");
    seededUserIds.push(userB.id);

    const marketB = await seedMarket("b");
    seededMarketIds.push(marketB.id);

    // Sandbox seed (oldest).
    await prisma.balanceLog.create({
      data: {
        userId:         userB.id,
        challengeId:    null,
        type:           "challenge_start",
        amount:         50,
        balanceBefore:  0,
        balanceAfter:   50,
        runningBalance: 50,
      },
    });

    // Active challenge with NEWER seed.
    const challengeB = await prisma.challenge.create({
      data: {
        userId:          userB.id,
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
    await prisma.balanceLog.create({
      data: {
        userId:         userB.id,
        challengeId:    challengeB.id,
        type:           "challenge_start",
        amount:         10_000,
        balanceBefore:  0,
        balanceAfter:   10_000,
        runningBalance: 10_000,
      },
    });

    // Sandbox position (challengeId = null).
    const positionB = await prisma.position.create({
      data: {
        userId:      userB.id,
        marketId:    marketB.id,
        challengeId: null,
        side:        "yes",
        status:      "open",
        shares:      100,
        avgPrice:    0.50,
        costBasis:   50,
        realizedPnl: 0,
      },
    });

    await prisma.market.update({
      where: { id: marketB.id },
      data:  { status: "resolved", winningOutcome: "yes", resolvedExternalAt: new Date() },
    });

    await resolveMarketPositions(marketB.id, "yes", marketB.yesPrice, marketB.noPrice);

    const resolveLogSandbox = await prisma.balanceLog.findFirst({
      where:   { userId: userB.id, type: "market_resolve" },
      orderBy: { createdAt: "desc" },
    });

    if (!resolveLogSandbox) {
      fail("S2 sandbox resolve BalanceLog created", "no market_resolve row found");
    } else if (resolveLogSandbox.balanceBefore !== 50) {
      fail(
        "S2 sandbox-scoped predecessor used",
        `expected balanceBefore=50 (sandbox chain), got ${resolveLogSandbox.balanceBefore} (likely challenge-poisoned)`,
      );
    } else {
      pass("S2 sandbox-scoped predecessor used (balanceBefore=50)");
    }
    if (resolveLogSandbox && resolveLogSandbox.challengeId !== null) {
      fail("S2 resolve log challengeId is null", `got ${resolveLogSandbox.challengeId}`);
    } else if (resolveLogSandbox) {
      pass("S2 resolve log challengeId=null");
    }
    if (resolveLogSandbox && resolveLogSandbox.runningBalance !== 150) {
      fail(
        "S2 runningBalance = 50 + payout(100)",
        `expected 150, got ${resolveLogSandbox.runningBalance}`,
      );
    } else if (resolveLogSandbox) {
      pass(`S2 runningBalance=${resolveLogSandbox.runningBalance}`);
    }

    const posBAfter = await prisma.position.findUnique({ where: { id: positionB.id } });
    if (posBAfter?.status !== "resolved") {
      fail("S2 sandbox position marked resolved", `status=${posBAfter?.status}`);
    } else {
      pass("S2 sandbox position marked resolved");
    }
  } finally {
    console.log("\nCleanup...");
    await cleanup(seededUserIds, seededMarketIds);
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
