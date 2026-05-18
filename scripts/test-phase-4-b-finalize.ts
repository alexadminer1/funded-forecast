/**
 * Phase 4.B Task 4 — end-to-end finalize tests.
 *
 * Exercises the 7 scenarios from docs/PHASE_4_B_BRIEF.md against a
 * running app instance via HTTP, plus the auto-pass library path
 * (scenario 4) by directly invoking the lib helpers under the
 * test's own $transaction.
 *
 * Run inside the app-dev container (so localhost:3000 hits Next.js):
 *   dev-exec npx tsx scripts/test-phase-4-b-finalize.ts
 *
 * Env required (already present in the container):
 *   DATABASE_URL, JWT_SECRET, CRON_SECRET, ADMIN_API_KEY
 *
 * Idempotent: seeds rows with timestamped emails / market ids and
 * cleans up at the end (success or failure).
 */

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { signToken } from "@/lib/auth";
import { checkAndMarkPassed } from "@/lib/challengeStatus";
import { MIN_RESOLVED_POSITIONS, MIN_UNIQUE_EVENTS } from "@/lib/engine/constants";

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

const BASE_URL     = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const CRON_SECRET  = process.env.CRON_SECRET ?? "";
const prisma       = new PrismaClient();
const STAMP        = Date.now();

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
      email:     `test-p4b+${suffix}-${STAMP}@funded.dev`,
      username:  `t-p4b-${suffix}-${STAMP}`,
      firstName: "P4B",
      lastName:  suffix,
      provider:  "email",
    },
  });
}

async function seedMarket(suffix: string, yesPrice = 0.50, noPrice = 0.50) {
  return prisma.market.create({
    data: {
      id:           `test-mkt-p4b-${suffix}-${STAMP}`,
      conditionId:  `test-cond-p4b-${suffix}-${STAMP}`,
      slug:         `test-slug-p4b-${suffix}-${STAMP}`,
      title:        `Test market ${suffix}`,
      yesPrice,
      noPrice,
      endDate:      new Date(Date.now() + 30 * 24 * 3600 * 1000),
      status:       "live",
      lastSyncedAt: new Date(),
    },
  });
}

interface ChallengeSeed {
  userId:           number;
  status?:          "active" | "failed" | "passed" | "expired";
  startBalance?:    number;
  realizedBalance?: number;
  peakBalance?:     number;
  maxTotalDdPct?:   number;
  maxDailyDdPct?:   number;
  profitTargetPct?: number;
  expiresAt?:       Date | null;
  endedAt?:         Date | null;
}

async function seedChallenge(s: ChallengeSeed) {
  return prisma.challenge.create({
    data: {
      userId:          s.userId,
      stage:           "evaluation",
      status:          s.status         ?? "active",
      startBalance:    s.startBalance   ?? 10_000,
      realizedBalance: s.realizedBalance ?? (s.startBalance ?? 10_000),
      peakBalance:     s.peakBalance    ?? (s.startBalance ?? 10_000),
      profitTargetPct: s.profitTargetPct ?? 10,
      maxDailyDdPct:   s.maxDailyDdPct  ?? 5,
      maxTotalDdPct:   s.maxTotalDdPct  ?? 10,
      minTradingDays:  10,
      expiresAt:       s.expiresAt ?? null,
      endedAt:         s.endedAt   ?? null,
    },
  });
}

async function seedChallengeStartLog(userId: number, challengeId: number, balance: number) {
  return prisma.balanceLog.create({
    data: {
      userId,
      challengeId,
      type:           "challenge_start",
      amount:         balance,
      balanceBefore:  0,
      balanceAfter:   balance,
      runningBalance: balance,
    },
  });
}

interface PositionSeed {
  userId:      number;
  marketId:    string;
  challengeId: number | null;
  side:        "yes" | "no";
  shares:      number;
  avgPrice:    number;
}
async function seedPosition(s: PositionSeed) {
  return prisma.position.create({
    data: {
      userId:      s.userId,
      marketId:    s.marketId,
      challengeId: s.challengeId,
      side:        s.side,
      status:      "open",
      shares:      s.shares,
      avgPrice:    s.avgPrice,
      costBasis:   parseFloat((s.shares * s.avgPrice).toFixed(2)),
      realizedPnl: 0,
    },
  });
}

interface FetchOpts {
  headers?: Record<string, string>;
  body?:    unknown;
}
async function fetchJson(method: "GET" | "POST", path: string, opts: FetchOpts = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    body = { _parseError: true };
  }
  return { status: res.status, body };
}

// ─────────────────────────────────────────────────────────────────
// Scenarios
// ─────────────────────────────────────────────────────────────────

async function scenario1(userIds: number[], marketIds: string[]): Promise<void> {
  console.log("\n[Scenario 1] cron expire-challenges → auto-close:");
  const user = await seedUser("s1"); userIds.push(user.id);
  const mA   = await seedMarket("s1a", 0.60, 0.40); marketIds.push(mA.id);
  const mB   = await seedMarket("s1b", 0.40, 0.60); marketIds.push(mB.id);

  // Challenge with expiresAt in the past.
  const ch = await seedChallenge({
    userId:          user.id,
    status:          "active",
    realizedBalance: 9_800,
    expiresAt:       new Date(Date.now() - 60_000),
  });
  await seedChallengeStartLog(user.id, ch.id, 10_000);
  await prisma.balanceLog.create({
    data: {
      userId: user.id, challengeId: ch.id, type: "trade_open",
      amount: -200, balanceBefore: 10_000, balanceAfter: 9_800, runningBalance: 9_800,
    },
  });
  const pA = await seedPosition({ userId: user.id, marketId: mA.id, challengeId: ch.id, side: "yes", shares: 200, avgPrice: 0.50 });
  const pB = await seedPosition({ userId: user.id, marketId: mB.id, challengeId: ch.id, side: "no",  shares: 200, avgPrice: 0.50 });

  const res = await fetchJson("GET", "/api/cron/expire-challenges", {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  if (res.status !== 200) {
    fail("S1 cron returned 200", `status=${res.status} body=${JSON.stringify(res.body)}`);
    return;
  }

  const chAfter  = await prisma.challenge.findUnique({ where: { id: ch.id } });
  const pAAfter  = await prisma.position.findUnique({ where: { id: pA.id } });
  const pBAfter  = await prisma.position.findUnique({ where: { id: pB.id } });
  const trades   = await prisma.trade.findMany({ where: { challengeId: ch.id, action: "auto_close_finalize" } });
  const logs     = await prisma.balanceLog.findMany({ where: { challengeId: ch.id, type: "trade_close" } });

  if (chAfter?.status !== "failed") {
    fail("S1 challenge.status=failed", `got ${chAfter?.status}`);
  } else { pass("S1 challenge.status=failed"); }
  if (pAAfter?.status !== "closed" || pBAfter?.status !== "closed") {
    fail("S1 both positions closed", `pA=${pAAfter?.status} pB=${pBAfter?.status}`);
  } else { pass("S1 both positions closed"); }
  if (trades.length !== 2) {
    fail("S1 2 Trade rows action=auto_close_finalize", `got ${trades.length}`);
  } else { pass(`S1 2 Trade rows action=auto_close_finalize`); }
  if (logs.length !== 2) {
    fail("S1 2 BalanceLog rows type=trade_close", `got ${logs.length}`);
  } else { pass(`S1 2 BalanceLog rows type=trade_close`); }
  if ((chAfter?.realizedBalance ?? 0) <= 9_800) {
    fail("S1 challenge.realizedBalance bumped", `got ${chAfter?.realizedBalance}`);
  } else { pass(`S1 challenge.realizedBalance=${chAfter?.realizedBalance} (bumped from 9800)`); }
}

async function scenario2(userIds: number[], marketIds: string[]): Promise<void> {
  console.log("\n[Scenario 2] cron end-of-day-check → auto-close on no activity:");
  const user = await seedUser("s2"); userIds.push(user.id);
  const m    = await seedMarket("s2", 0.40, 0.60); marketIds.push(m.id);

  // startedAt set well in the past so grace day does not apply.
  const ch = await prisma.challenge.create({
    data: {
      userId:          user.id,
      stage:           "evaluation",
      status:          "active",
      startBalance:    10_000,
      realizedBalance: 9_900,
      peakBalance:     10_000,
      profitTargetPct: 10,
      maxDailyDdPct:   5,
      maxTotalDdPct:   10,
      minTradingDays:  10,
      startedAt:       new Date(Date.now() - 5 * 24 * 3600 * 1000),
    },
  });
  await seedChallengeStartLog(user.id, ch.id, 10_000);
  await prisma.balanceLog.create({
    data: {
      userId: user.id, challengeId: ch.id, type: "trade_open",
      amount: -100, balanceBefore: 10_000, balanceAfter: 9_900, runningBalance: 9_900,
    },
  });
  const pos = await seedPosition({ userId: user.id, marketId: m.id, challengeId: ch.id, side: "yes", shares: 200, avgPrice: 0.50 });

  const res = await fetchJson("GET", "/api/cron/end-of-day-check", {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  if (res.status !== 200) {
    fail("S2 cron returned 200", `status=${res.status} body=${JSON.stringify(res.body)}`);
    return;
  }

  const chAfter = await prisma.challenge.findUnique({ where: { id: ch.id } });
  const pAfter  = await prisma.position.findUnique({ where: { id: pos.id } });
  const trades  = await prisma.trade.findMany({ where: { challengeId: ch.id, action: "auto_close_finalize" } });

  if (chAfter?.status !== "failed") {
    fail("S2 challenge.status=failed", `got ${chAfter?.status}`);
  } else { pass("S2 challenge.status=failed"); }
  if (pAfter?.status !== "closed") {
    fail("S2 position closed", `got ${pAfter?.status}`);
  } else { pass("S2 position closed"); }
  if (trades.length !== 1) {
    fail("S2 1 Trade row action=auto_close_finalize", `got ${trades.length}`);
  } else { pass("S2 1 Trade row action=auto_close_finalize"); }
}

async function scenario3(userIds: number[], marketIds: string[]): Promise<void> {
  console.log("\n[Scenario 3] sell drawdown error → auto-close in catch:");
  const user = await seedUser("s3"); userIds.push(user.id);
  const mA   = await seedMarket("s3a", 0.50, 0.50); marketIds.push(mA.id);
  const mB   = await seedMarket("s3b", 0.50, 0.50); marketIds.push(mB.id);

  // Challenge already below MLL boundary by enough that selling pA still
  // leaves newRealizedBalance below mll. Sell always adds proceeds to
  // realizedBalance (regardless of PnL sign), so to trigger mll_breach we
  // must seed realizedBalance + proceeds < mll.
  // peakBalance=10500, maxTotalDdPct=10 → mll=10500 - 1000 = 9500.
  // realizedBalance=9300. After sell (proceeds≈96): 9396 < 9500 → mll_breach.
  const ch = await prisma.challenge.create({
    data: {
      userId:          user.id,
      stage:           "evaluation",
      status:          "active",
      startBalance:    10_000,
      realizedBalance: 9_300,
      peakBalance:     10_500,
      profitTargetPct: 10,
      maxDailyDdPct:   100,
      maxTotalDdPct:   10,
      minTradingDays:  10,
    },
  });
  await seedChallengeStartLog(user.id, ch.id, 10_000);
  await prisma.balanceLog.create({
    data: {
      userId: user.id, challengeId: ch.id, type: "trade_open",
      amount: -700, balanceBefore: 10_000, balanceAfter: 9_300, runningBalance: 9_300,
    },
  });

  // Position A — current market.yesPrice 0.50, avg 0.90 → proceeds 100 vs cost 180 → loss 80
  const pA = await seedPosition({ userId: user.id, marketId: mA.id, challengeId: ch.id, side: "yes", shares: 200, avgPrice: 0.90 });
  // Position B — unrelated, will also get auto-closed
  const pB = await seedPosition({ userId: user.id, marketId: mB.id, challengeId: ch.id, side: "yes", shares: 200, avgPrice: 0.50 });

  const token = signToken({ userId: user.id });
  const res = await fetchJson("POST", "/api/trade/sell", {
    headers: { Authorization: `Bearer ${token}` },
    body: { marketId: mA.id, side: "yes", amount: 200, clientPrice: 0.50 },
  });

  if (res.status !== 409 || res.body.error_code !== "CHALLENGE_FAILED_PRE_TRADE") {
    fail("S3 sell returned 409 CHALLENGE_FAILED_PRE_TRADE", `status=${res.status} body=${JSON.stringify(res.body)}`);
  } else { pass("S3 sell returned 409 CHALLENGE_FAILED_PRE_TRADE"); }

  const chAfter = await prisma.challenge.findUnique({ where: { id: ch.id } });
  const pAAfter = await prisma.position.findUnique({ where: { id: pA.id } });
  const pBAfter = await prisma.position.findUnique({ where: { id: pB.id } });
  const autoCloseTrades = await prisma.trade.findMany({ where: { challengeId: ch.id, action: "auto_close_finalize" } });

  if (chAfter?.status !== "failed") {
    fail("S3 challenge.status=failed", `got ${chAfter?.status}`);
  } else { pass("S3 challenge.status=failed"); }
  if (pAAfter?.status !== "closed" || pBAfter?.status !== "closed") {
    fail("S3 both positions auto-closed", `pA=${pAAfter?.status} pB=${pBAfter?.status}`);
  } else { pass("S3 both positions auto-closed"); }
  if (autoCloseTrades.length !== 2) {
    fail("S3 2 auto_close_finalize Trade rows", `got ${autoCloseTrades.length}`);
  } else { pass("S3 2 auto_close_finalize Trade rows"); }
}

async function scenario4(userIds: number[], marketIds: string[]): Promise<void> {
  console.log("\n[Scenario 4] checkAndMarkPassed → auto-close on auto-pass:");
  const user = await seedUser("s4"); userIds.push(user.id);
  const m    = await seedMarket("s4", 0.50, 0.50); marketIds.push(m.id);

  // Build a challenge that already meets every pass condition except
  // open-position cleanup. Avoid market resolves (which would touch
  // ChallengeDailyPnL and complicate consistency). We exercise the
  // auto-pass path by calling checkAndMarkPassed directly inside a tx
  // after seeding the dailyPnL row to satisfy consistency.
  const ch = await prisma.challenge.create({
    data: {
      userId:                     user.id,
      stage:                      "evaluation",
      status:                     "active",
      startBalance:               10_000,
      realizedBalance:            11_500,
      peakBalance:                11_500,
      profitTargetPct:            10,
      maxDailyDdPct:              5,
      maxTotalDdPct:              10,
      minTradingDays:              1,
      qualifyingTradingDaysCount:  5,
      resolvedPositionsCount:     MIN_RESOLVED_POSITIONS,
      uniqueEventsCount:          MIN_UNIQUE_EVENTS,
      profitTargetMet:            true,
    },
  });
  await seedChallengeStartLog(user.id, ch.id, 10_000);

  // Single dailyPnL row so biggestDayPct == 1.0 == totalProfit — passes consistency.
  await prisma.challengeDailyPnL.create({
    data: {
      challengeId: ch.id,
      date:        new Date(Date.UTC(2026, 0, 1)),
      dailyPnl:    "1500",
      dailyTrades: 1,
      isWinningDay: true,
    },
  });

  const pos = await seedPosition({ userId: user.id, marketId: m.id, challengeId: ch.id, side: "yes", shares: 100, avgPrice: 0.50 });

  const marked = await prisma.$transaction(async (tx) => {
    return checkAndMarkPassed(tx, ch.id);
  }, { timeout: 30000 });

  if (!marked) {
    fail("S4 checkAndMarkPassed returned true", `returned ${marked}`);
    return;
  }
  pass("S4 checkAndMarkPassed returned true");

  const chAfter = await prisma.challenge.findUnique({ where: { id: ch.id } });
  const pAfter  = await prisma.position.findUnique({ where: { id: pos.id } });
  const trades  = await prisma.trade.findMany({ where: { challengeId: ch.id, action: "auto_close_finalize" } });

  if (chAfter?.status !== "passed") {
    fail("S4 challenge.status=passed", `got ${chAfter?.status}`);
  } else { pass("S4 challenge.status=passed"); }
  if (pAfter?.status !== "closed") {
    fail("S4 position closed", `got ${pAfter?.status}`);
  } else { pass("S4 position closed"); }
  if (trades.length !== 1) {
    fail("S4 1 auto_close_finalize Trade row", `got ${trades.length}`);
  } else { pass("S4 1 auto_close_finalize Trade row"); }
}

async function scenario5(userIds: number[], marketIds: string[]): Promise<void> {
  console.log("\n[Scenario 5] sell guard — isolation error (old failed challenge):");
  const user = await seedUser("s5"); userIds.push(user.id);
  const m    = await seedMarket("s5", 0.50, 0.50); marketIds.push(m.id);

  // Old failed challenge with an open position still attached
  // (simulates orphan from before Phase 4.B). Then a new active
  // challenge. Sell on the orphan must be rejected with
  // challenge_isolation, leaving the position untouched.
  const oldCh = await seedChallenge({ userId: user.id, status: "failed", endedAt: new Date(Date.now() - 3600_000) });
  const newCh = await seedChallenge({ userId: user.id, status: "active" });
  await seedChallengeStartLog(user.id, oldCh.id, 10_000);
  await seedChallengeStartLog(user.id, newCh.id, 10_000);
  const orphan = await seedPosition({ userId: user.id, marketId: m.id, challengeId: oldCh.id, side: "yes", shares: 100, avgPrice: 0.50 });

  const token = signToken({ userId: user.id });
  const res = await fetchJson("POST", "/api/trade/sell", {
    headers: { Authorization: `Bearer ${token}` },
    body: { marketId: m.id, side: "yes", amount: 100, clientPrice: 0.50 },
  });

  if (res.status !== 403 || res.body.error_code !== "challenge_isolation") {
    fail("S5 sell returned 403 challenge_isolation", `status=${res.status} body=${JSON.stringify(res.body)}`);
  } else { pass("S5 sell returned 403 challenge_isolation"); }
  if (res.body.positionChallengeId !== oldCh.id || res.body.activeChallengeId !== newCh.id) {
    fail("S5 error payload carries ids", `payload=${JSON.stringify(res.body)}`);
  } else { pass("S5 error payload carries position+active challenge ids"); }

  const orphanAfter = await prisma.position.findUnique({ where: { id: orphan.id } });
  if (orphanAfter?.status !== "open" || orphanAfter.shares !== 100) {
    fail("S5 orphan position unchanged", `status=${orphanAfter?.status} shares=${orphanAfter?.shares}`);
  } else { pass("S5 orphan position unchanged"); }
}

async function scenario6(userIds: number[], marketIds: string[]): Promise<void> {
  console.log("\n[Scenario 6] sell guard — sandbox position while challenge active:");
  const user = await seedUser("s6"); userIds.push(user.id);
  const m    = await seedMarket("s6", 0.50, 0.50); marketIds.push(m.id);

  // Sandbox position (challengeId=null) left over from before user
  // bought a challenge plan. User now has an active challenge. Sell
  // on the sandbox position must be rejected.
  await prisma.balanceLog.create({
    data: {
      userId: user.id, challengeId: null, type: "challenge_start",
      amount: 50, balanceBefore: 0, balanceAfter: 50, runningBalance: 50,
    },
  });
  const newCh = await seedChallenge({ userId: user.id, status: "active" });
  await seedChallengeStartLog(user.id, newCh.id, 10_000);
  const sandboxPos = await seedPosition({ userId: user.id, marketId: m.id, challengeId: null, side: "yes", shares: 50, avgPrice: 0.50 });

  const token = signToken({ userId: user.id });
  const res = await fetchJson("POST", "/api/trade/sell", {
    headers: { Authorization: `Bearer ${token}` },
    body: { marketId: m.id, side: "yes", amount: 50, clientPrice: 0.50 },
  });

  if (res.status !== 403 || res.body.error_code !== "challenge_isolation") {
    fail("S6 sandbox sell returned 403 challenge_isolation", `status=${res.status} body=${JSON.stringify(res.body)}`);
  } else { pass("S6 sandbox sell returned 403 challenge_isolation"); }
  if (res.body.positionChallengeId !== null || res.body.activeChallengeId !== newCh.id) {
    fail("S6 payload positionChallengeId=null, activeChallengeId=newCh.id", `payload=${JSON.stringify(res.body)}`);
  } else { pass("S6 payload positionChallengeId=null, activeChallengeId=newCh.id"); }

  const sbAfter = await prisma.position.findUnique({ where: { id: sandboxPos.id } });
  if (sbAfter?.status !== "open" || sbAfter.shares !== 50) {
    fail("S6 sandbox position unchanged", `status=${sbAfter?.status} shares=${sbAfter?.shares}`);
  } else { pass("S6 sandbox position unchanged"); }
}

async function scenario7(userIds: number[], marketIds: string[]): Promise<void> {
  console.log("\n[Scenario 7] sell guard — happy path:");
  const user = await seedUser("s7"); userIds.push(user.id);
  const m    = await seedMarket("s7", 0.60, 0.40); marketIds.push(m.id);

  const ch = await seedChallenge({ userId: user.id, status: "active", realizedBalance: 9_900 });
  await seedChallengeStartLog(user.id, ch.id, 10_000);
  await prisma.balanceLog.create({
    data: {
      userId: user.id, challengeId: ch.id, type: "trade_open",
      amount: -100, balanceBefore: 10_000, balanceAfter: 9_900, runningBalance: 9_900,
    },
  });
  const pos = await seedPosition({ userId: user.id, marketId: m.id, challengeId: ch.id, side: "yes", shares: 200, avgPrice: 0.50 });

  const token = signToken({ userId: user.id });
  const res = await fetchJson("POST", "/api/trade/sell", {
    headers: { Authorization: `Bearer ${token}` },
    body: { marketId: m.id, side: "yes", amount: 200, clientPrice: 0.60 },
  });

  if (res.status !== 200 || res.body.success !== true) {
    fail("S7 sell returned 200 success", `status=${res.status} body=${JSON.stringify(res.body)}`);
    return;
  }
  pass("S7 sell returned 200 success");

  const pAfter = await prisma.position.findUnique({ where: { id: pos.id } });
  if (pAfter?.status !== "closed" || pAfter.shares !== 0) {
    fail("S7 position closed", `status=${pAfter?.status} shares=${pAfter?.shares}`);
  } else { pass("S7 position closed"); }
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const userIds:   number[] = [];
  const marketIds: string[] = [];

  if (!CRON_SECRET) {
    console.error("CRON_SECRET env var is empty — scenarios 1, 2 will fail.");
  }

  try {
    await scenario1(userIds, marketIds);
    await scenario2(userIds, marketIds);
    await scenario3(userIds, marketIds);
    await scenario4(userIds, marketIds);
    await scenario5(userIds, marketIds);
    await scenario6(userIds, marketIds);
    await scenario7(userIds, marketIds);
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
