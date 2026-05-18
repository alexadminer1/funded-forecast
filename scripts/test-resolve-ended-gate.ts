/**
 * Phase 4.A.2 Task 2 (Option A) — ended-challenge gate test.
 *
 * Verifies docs/PHASE_4_0_AUDIT.md finding #1 is fixed:
 *   resolveMarketPositions must skip positions whose source Challenge
 *   is no longer active. The position remains status="open" as an
 *   orphan; no Trade, no BalanceLog, no Challenge balance mutation.
 *   Sandbox positions (challengeId=null) proceed normally.
 *
 * Run:  npx tsx scripts/test-resolve-ended-gate.ts
 * Env:  DATABASE_URL (required — points at dev DB)
 *
 * Idempotent: seeds rows with timestamped emails / market ids and
 * cleans them up at the end (success or failure).
 */

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { resolveMarketPositions } from "@/lib/marketResolve";

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

async function seedUser(suffix: string) {
  return prisma.user.create({
    data: {
      email:     `test-resolve-ended-gate+${suffix}-${STAMP}@funded.dev`,
      username:  `t-reg-${suffix}-${STAMP}`,
      firstName: "Test",
      lastName:  suffix,
      provider:  "email",
    },
  });
}

async function seedMarket(suffix: string) {
  return prisma.market.create({
    data: {
      id:           `test-mkt-reg-${suffix}-${STAMP}`,
      conditionId:  `test-cond-reg-${suffix}-${STAMP}`,
      slug:         `test-slug-reg-${suffix}-${STAMP}`,
      title:        "Test market (ended gate)",
      yesPrice:     0.99,
      noPrice:      0.01,
      endDate:      new Date(Date.now() + 30 * 24 * 3600 * 1000),
      status:       "live",
      lastSyncedAt: new Date(),
    },
  });
}

async function seedChallengeForUser(
  userId: number,
  status: "active" | "failed" | "passed" | "expired",
) {
  return prisma.challenge.create({
    data: {
      userId,
      stage:           "evaluation",
      status,
      startBalance:    10_000,
      realizedBalance: 10_000,
      peakBalance:     10_000,
      profitTargetPct: 10,
      maxDailyDdPct:   5,
      maxTotalDdPct:   10,
      minTradingDays:  10,
      endedAt:         status === "active" ? null : new Date(Date.now() - 24 * 3600 * 1000),
    },
  });
}

async function seedChallengeSeedLog(userId: number, challengeId: number) {
  return prisma.balanceLog.create({
    data: {
      userId,
      challengeId,
      type:           "challenge_start",
      amount:         10_000,
      balanceBefore:  0,
      balanceAfter:   10_000,
      runningBalance: 10_000,
    },
  });
}

async function main(): Promise<number> {
  const seededUserIds:   number[] = [];
  const seededMarketIds: string[] = [];

  try {
    // ───────────────────────────────────────────────────────────────
    // Scenario 1 — ended (failed) challenge: resolve must SKIP.
    // ───────────────────────────────────────────────────────────────
    console.log("\n[Scenario 1] failed challenge → skip resolve:");

    const user1   = await seedUser("failed");
    seededUserIds.push(user1.id);
    const market1 = await seedMarket("a");
    seededMarketIds.push(market1.id);

    const challenge1 = await seedChallengeForUser(user1.id, "failed");
    await seedChallengeSeedLog(user1.id, challenge1.id);

    const position1 = await prisma.position.create({
      data: {
        userId:      user1.id,
        marketId:    market1.id,
        challengeId: challenge1.id,
        side:        "yes",
        status:      "open",
        shares:      100,
        avgPrice:    0.50,
        costBasis:   50,
        realizedPnl: 0,
      },
    });

    const preTradeCount      = await prisma.trade.count({ where: { userId: user1.id } });
    const preBalanceLogCount = await prisma.balanceLog.count({ where: { userId: user1.id } });
    const preChallenge       = await prisma.challenge.findUnique({ where: { id: challenge1.id } });

    await prisma.market.update({
      where: { id: market1.id },
      data:  { status: "resolved", winningOutcome: "yes", resolvedExternalAt: new Date() },
    });

    await resolveMarketPositions(market1.id, "yes", market1.yesPrice, market1.noPrice);

    const postTradeCount      = await prisma.trade.count({ where: { userId: user1.id } });
    const postBalanceLogCount = await prisma.balanceLog.count({ where: { userId: user1.id } });
    const postPosition        = await prisma.position.findUnique({ where: { id: position1.id } });
    const postChallenge       = await prisma.challenge.findUnique({ where: { id: challenge1.id } });

    if (postTradeCount !== preTradeCount) {
      fail("S1 no new Trade row", `pre=${preTradeCount} post=${postTradeCount}`);
    } else {
      pass("S1 no new Trade row");
    }
    if (postBalanceLogCount !== preBalanceLogCount) {
      fail("S1 no new BalanceLog row", `pre=${preBalanceLogCount} post=${postBalanceLogCount}`);
    } else {
      pass("S1 no new BalanceLog row");
    }
    if (postPosition?.status !== "open") {
      fail("S1 position remains open", `status=${postPosition?.status}`);
    } else {
      pass("S1 position remains open");
    }
    if (postPosition?.resolvedAt !== null) {
      fail("S1 position.resolvedAt is null", `resolvedAt=${postPosition?.resolvedAt?.toISOString()}`);
    } else {
      pass("S1 position.resolvedAt is null");
    }
    if (postChallenge?.realizedBalance !== preChallenge?.realizedBalance) {
      fail(
        "S1 challenge.realizedBalance unchanged",
        `pre=${preChallenge?.realizedBalance} post=${postChallenge?.realizedBalance}`,
      );
    } else {
      pass("S1 challenge.realizedBalance unchanged");
    }

    // ───────────────────────────────────────────────────────────────
    // Scenario 2 — active challenge: resolve must proceed normally.
    // ───────────────────────────────────────────────────────────────
    console.log("\n[Scenario 2] active challenge → resolve proceeds:");

    const user2   = await seedUser("active");
    seededUserIds.push(user2.id);
    const market2 = await seedMarket("b");
    seededMarketIds.push(market2.id);

    const challenge2 = await seedChallengeForUser(user2.id, "active");
    await seedChallengeSeedLog(user2.id, challenge2.id);

    const position2 = await prisma.position.create({
      data: {
        userId:      user2.id,
        marketId:    market2.id,
        challengeId: challenge2.id,
        side:        "yes",
        status:      "open",
        shares:      100,
        avgPrice:    0.50,
        costBasis:   50,
        realizedPnl: 0,
      },
    });

    await prisma.market.update({
      where: { id: market2.id },
      data:  { status: "resolved", winningOutcome: "yes", resolvedExternalAt: new Date() },
    });

    await resolveMarketPositions(market2.id, "yes", market2.yesPrice, market2.noPrice);

    const post2Trade   = await prisma.trade.findFirst({
      where:   { userId: user2.id, action: "resolve" },
      orderBy: { createdAt: "desc" },
    });
    const post2Log     = await prisma.balanceLog.findFirst({
      where:   { userId: user2.id, type: "market_resolve" },
      orderBy: { createdAt: "desc" },
    });
    const post2Position = await prisma.position.findUnique({ where: { id: position2.id } });
    const post2Challenge = await prisma.challenge.findUnique({ where: { id: challenge2.id } });

    if (!post2Trade) {
      fail("S2 resolve Trade created", "no Trade with action=resolve");
    } else {
      pass(`S2 resolve Trade created (id=${post2Trade.id})`);
    }
    if (!post2Log) {
      fail("S2 resolve BalanceLog created", "no BalanceLog with type=market_resolve");
    } else {
      pass(`S2 resolve BalanceLog created (id=${post2Log.id})`);
    }
    if (post2Position?.status !== "resolved") {
      fail("S2 position marked resolved", `status=${post2Position?.status}`);
    } else {
      pass("S2 position marked resolved");
    }
    if (post2Challenge?.realizedBalance !== 10_100) {
      fail(
        "S2 challenge.realizedBalance updated (10000 + payout 100)",
        `got ${post2Challenge?.realizedBalance}`,
      );
    } else {
      pass("S2 challenge.realizedBalance updated to 10100");
    }

    // ───────────────────────────────────────────────────────────────
    // Scenario 3 — sandbox position (challengeId=null): resolve proceeds.
    // ───────────────────────────────────────────────────────────────
    console.log("\n[Scenario 3] sandbox position → resolve proceeds:");

    const user3   = await seedUser("sandbox");
    seededUserIds.push(user3.id);
    const market3 = await seedMarket("c");
    seededMarketIds.push(market3.id);

    // Sandbox-only seed log.
    await prisma.balanceLog.create({
      data: {
        userId:         user3.id,
        challengeId:    null,
        type:           "challenge_start",
        amount:         50,
        balanceBefore:  0,
        balanceAfter:   50,
        runningBalance: 50,
      },
    });

    const position3 = await prisma.position.create({
      data: {
        userId:      user3.id,
        marketId:    market3.id,
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
      where: { id: market3.id },
      data:  { status: "resolved", winningOutcome: "yes", resolvedExternalAt: new Date() },
    });

    await resolveMarketPositions(market3.id, "yes", market3.yesPrice, market3.noPrice);

    const post3Trade = await prisma.trade.findFirst({
      where:   { userId: user3.id, action: "resolve" },
      orderBy: { createdAt: "desc" },
    });
    const post3Log = await prisma.balanceLog.findFirst({
      where:   { userId: user3.id, type: "market_resolve" },
      orderBy: { createdAt: "desc" },
    });
    const post3Position = await prisma.position.findUnique({ where: { id: position3.id } });

    if (!post3Trade) {
      fail("S3 sandbox resolve Trade created", "no Trade with action=resolve");
    } else if (post3Trade.challengeId !== null) {
      fail("S3 sandbox Trade.challengeId is null", `got ${post3Trade.challengeId}`);
    } else {
      pass("S3 sandbox resolve Trade created with challengeId=null");
    }
    if (!post3Log) {
      fail("S3 sandbox resolve BalanceLog created", "no row found");
    } else if (post3Log.challengeId !== null) {
      fail("S3 sandbox BalanceLog.challengeId is null", `got ${post3Log.challengeId}`);
    } else {
      pass("S3 sandbox resolve BalanceLog created with challengeId=null");
    }
    if (post3Position?.status !== "resolved") {
      fail("S3 sandbox position marked resolved", `status=${post3Position?.status}`);
    } else {
      pass("S3 sandbox position marked resolved");
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
