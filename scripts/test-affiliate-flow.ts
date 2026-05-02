/**
 * Affiliate flow integration test — Step 5A verification
 *
 * Run:  npx tsx scripts/test-affiliate-flow.ts
 * Env:  TEST_USER_EMAIL    (required)
 *       TEST_USER_PASSWORD (required)
 *       BASE_URL           (default: http://localhost:3000)
 *       TEST_PLAN_ID       (default: 1)
 */

import { readFileSync } from "node:fs";
import * as nodeHttp    from "node:http";
import * as nodeHttps   from "node:https";
import { randomUUID }   from "node:crypto";
import { PrismaClient } from "@prisma/client";

// ── Load .env (no dotenv dependency) ──────────────────────────────────────────
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

// ── Config ─────────────────────────────────────────────────────────────────────
const BASE_URL      = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const USER_EMAIL    = process.env.TEST_USER_EMAIL    ?? "";
const USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? "";
const TEST_PLAN_ID  = parseInt(process.env.TEST_PLAN_ID ?? "1", 10);
const TEST_REF_CODE = "test-aff-flow";

const prisma = new PrismaClient();

// ── Result tracking ────────────────────────────────────────────────────────────
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

// ── State shared between main / cleanup ───────────────────────────────────────
let currentUserId:     number        = 0;
let createdTestUserId: number | null = null;
let testStartTime:     Date          = new Date();

// ── Cleanup (always runs via finally) ─────────────────────────────────────────
async function cleanup(): Promise<void> {
  console.log("\n── CLEANUP ────────────────────────────────────────────────────");

  try {
    const r = await prisma.affiliateClick.deleteMany({
      where: { refCode: { startsWith: "test-aff-" } },
    });
    console.log(`  AffiliateClick  deleted ${r.count} row(s)`);
  } catch (e) { console.warn("  WARNING AffiliateClick cleanup:", e); }

  try {
    const r = await prisma.affiliate.deleteMany({
      where: { refCode: { startsWith: "test-aff-" } },
    });
    console.log(`  Affiliate       deleted ${r.count} row(s)`);
  } catch (e) { console.warn("  WARNING Affiliate cleanup:", e); }

  if (currentUserId) {
    try {
      const r = await prisma.payment.deleteMany({
        where: { userId: currentUserId, createdAt: { gte: testStartTime } },
      });
      console.log(`  Payment         deleted ${r.count} row(s)`);
    } catch (e) { console.warn("  WARNING Payment cleanup:", e); }
  }

  if (createdTestUserId !== null) {
    try {
      await prisma.user.delete({ where: { id: createdTestUserId } });
      console.log(`  User            deleted test user id=${createdTestUserId}`);
    } catch (e) { console.warn("  WARNING User cleanup:", e); }
  }
}

// ── Raw HTTP GET (no redirect follow, full header access) ──────────────────────
type RawResponse = {
  status:  number;
  headers: Record<string, string | string[] | undefined>;
  body:    string;
};

function rawGet(urlStr: string): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const u   = new URL(urlStr);
    const mod = u.protocol === "https:" ? nodeHttps : nodeHttp;
    const req = mod.request(
      {
        hostname: u.hostname,
        port:     u.port || (u.protocol === "https:" ? 443 : 80),
        path:     u.pathname + u.search,
        method:   "GET",
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
        res.on("end", () =>
          resolve({
            status:  res.statusCode ?? 0,
            headers: res.headers as Record<string, string | string[] | undefined>,
            body,
          })
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

// ── JWT decode (no library needed) ────────────────────────────────────────────
function decodeJwt(token: string): Record<string, unknown> {
  const part   = token.split(".")[1] ?? "";
  const padded = part.padEnd(part.length + (4 - (part.length % 4)) % 4, "=");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("══════════════════════════════════════════════════════════════");
  console.log(" AFFILIATE FLOW TEST — Step 5A verification");
  console.log(`  BASE_URL:     ${BASE_URL}`);
  console.log(`  TEST_PLAN_ID: ${TEST_PLAN_ID}`);
  console.log("══════════════════════════════════════════════════════════════");

  // ── PHASE 1: SETUP ──────────────────────────────────────────────────────────
  console.log("\n── PHASE 1: SETUP ─────────────────────────────────────────────");

  if (!USER_EMAIL || !USER_PASSWORD) {
    console.error("\n  ERROR: Missing credentials.");
    console.error("  Set TEST_USER_EMAIL and TEST_USER_PASSWORD to a real account.");
    console.error("  Example:");
    console.error("    TEST_USER_EMAIL=you@example.com TEST_USER_PASSWORD=secret \\");
    console.error("    npx tsx scripts/test-affiliate-flow.ts");
    process.exit(1);
  }

  // 1.1 Login → JWT
  let jwt = "";
  try {
    const res  = await fetch(`${BASE_URL}/api/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD }),
    });
    const body = await res.json() as Record<string, unknown>;
    if (!res.ok || typeof body.token !== "string") {
      console.error(`\n  ERROR: Login failed (HTTP ${res.status}): ${JSON.stringify(body)}`);
      console.error("  Make sure TEST_USER_EMAIL / TEST_USER_PASSWORD are correct.");
      process.exit(1);
    }
    jwt = body.token;
    console.log("  1.1  Login OK");
  } catch {
    console.error(`\n  ERROR: Cannot reach ${BASE_URL}/api/login`);
    console.error("  Is the dev server running?  →  npm run dev");
    process.exit(1);
  }

  // 1.2 Decode userId, safety check (not admin id=1)
  try {
    const payload = decodeJwt(jwt);
    currentUserId = payload.userId as number;
  } catch {
    console.error("  ERROR: Could not decode JWT payload");
    process.exit(1);
  }
  if (currentUserId === 1) {
    console.error("  ERROR: TEST_USER_EMAIL resolves to userId=1 (admin). Use a non-admin account.");
    process.exit(1);
  }
  console.log(`  1.2  userId=${currentUserId} — not admin OK`);

  // 1.3 Find/create another user as affiliate owner (to avoid self-referral)
  let affiliateOwnerId: number;
  const otherUser = await prisma.user.findFirst({
    where:  { id: { not: currentUserId } },
    select: { id: true },
  });
  if (otherUser) {
    affiliateOwnerId = otherUser.id;
    console.log(`  1.3  Affiliate owner → existing user id=${affiliateOwnerId}`);
  } else {
    const u = await prisma.user.create({
      data: {
        email:     "test-aff-dummy@test-aff.local",
        username:  "test-aff-dummy",
        firstName: "Test",
        lastName:  "Affiliate",
      },
    });
    affiliateOwnerId  = u.id;
    createdTestUserId = u.id;
    console.log(`  1.3  Affiliate owner → created test user id=${affiliateOwnerId}`);
  }

  // 1.4 Create test Affiliate (clean leftovers from previous run first)
  await prisma.affiliateClick.deleteMany({ where: { refCode: TEST_REF_CODE } });
  await prisma.affiliate.deleteMany({ where: { refCode: TEST_REF_CODE } });
  await prisma.affiliate.create({
    data: {
      userId:          affiliateOwnerId,
      refCode:         TEST_REF_CODE,
      status:          "approved",
      applicationData: {},
      acceptedTermsAt: new Date(),
    },
  });
  console.log(`  1.4  Created Affiliate refCode="${TEST_REF_CODE}" status=approved`);
  console.log("  SETUP DONE");

  testStartTime = new Date();

  // ── PHASE 2: TESTS ──────────────────────────────────────────────────────────
  console.log("\n── PHASE 2: TESTS ─────────────────────────────────────────────");

  let affCookieId: string | null = null;
  let clickId:     number | null = null;

  // ── T1: GET /r/[code] ── expect 302 + Location:/ + Set-Cookie aff_id ────────
  console.log("\n  T1: GET /r/test-aff-flow");
  try {
    const r         = await rawGet(`${BASE_URL}/r/${TEST_REF_CODE}`);
    const location  = (r.headers["location"] as string | undefined) ?? "";
    const rawCookie = r.headers["set-cookie"];
    const cookieStr = Array.isArray(rawCookie) ? rawCookie.join(" ") : (rawCookie ?? "");
    const cookieMatch = cookieStr.match(/aff_id=([^;,\s]+)/);
    affCookieId = cookieMatch?.[1] ?? null;

    const statusOk   = r.status === 302;
    const locationOk = location === `${BASE_URL}/` || location === "/";
    const cookieOk   = affCookieId !== null;

    if (statusOk && locationOk && cookieOk) {
      pass("T1 GET /r/[code] → 302 + aff_id cookie");
    } else {
      const parts = [
        !statusOk   ? `status=${r.status} (want 302)` : "",
        !locationOk ? `location="${location}" (want "${BASE_URL}/")` : "",
        !cookieOk   ? `aff_id cookie absent — Set-Cookie: "${cookieStr}"` : "",
      ].filter(Boolean);
      fail("T1 GET /r/[code]", parts.join(" | "));
    }
  } catch (e) { fail("T1 GET /r/[code]", String(e)); }

  // ── T2: AffiliateClick row in DB ─────────────────────────────────────────────
  console.log("\n  T2: AffiliateClick created in DB");
  try {
    const click = await prisma.affiliateClick.findFirst({
      where:   { refCode: TEST_REF_CODE },
      orderBy: { createdAt: "desc" },
    });

    if (!click) {
      fail("T2 AffiliateClick created", "no row found for refCode=test-aff-flow");
    } else if (affCookieId && click.cookieId !== affCookieId) {
      fail(
        "T2 AffiliateClick created",
        `cookieId mismatch — DB="${click.cookieId}" header="${affCookieId}"`,
      );
    } else if (click.convertedToUserId !== null) {
      fail("T2 AffiliateClick created", `convertedToUserId=${click.convertedToUserId} (expected null)`);
    } else {
      clickId = click.id;
      if (!affCookieId) affCookieId = click.cookieId; // recover for T3 if T1 parsing failed
      pass("T2 AffiliateClick created (cookieId matches, convertedToUserId=null)");
    }
  } catch (e) { fail("T2 AffiliateClick created", String(e)); }

  // ── T3: POST /api/affiliate/attach-click ─────────────────────────────────────
  console.log("\n  T3: POST /api/affiliate/attach-click");
  if (!affCookieId) {
    fail("T3 attach-click", "skipped — no cookie from T1/T2");
  } else {
    try {
      const r    = await fetch(`${BASE_URL}/api/affiliate/attach-click`, {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${jwt}`,
          "Cookie":        `aff_id=${affCookieId}`,
          "Content-Type":  "application/json",
        },
      });
      const body = await r.json() as Record<string, unknown>;

      if (r.status === 200 && body.attached === true) {
        pass("T3 attach-click → 200 attached:true");
      } else {
        fail("T3 attach-click", `status=${r.status} body=${JSON.stringify(body)}`);
      }
    } catch (e) { fail("T3 attach-click", String(e)); }
  }

  // ── T4: convertedToUserId in DB ──────────────────────────────────────────────
  console.log("\n  T4: convertedToUserId updated in DB");
  if (!clickId) {
    fail("T4 convertedToUserId", "skipped — no clickId from T2");
  } else {
    try {
      const click = await prisma.affiliateClick.findUnique({ where: { id: clickId } });
      if (!click) {
        fail("T4 convertedToUserId", "click row not found");
      } else if (click.convertedToUserId === currentUserId) {
        pass(`T4 convertedToUserId=${currentUserId} OK`);
      } else {
        fail("T4 convertedToUserId", `got ${click.convertedToUserId} (expected ${currentUserId})`);
      }
    } catch (e) { fail("T4 convertedToUserId", String(e)); }
  }

  // ── T5: POST /api/payments/create — no affiliate cookie ──────────────────────
  console.log("\n  T5: POST /api/payments/create (no affiliate cookie)");
  try {
    const r    = await fetch(`${BASE_URL}/api/payments/create`, {
      method:  "POST",
      headers: { "Authorization": `Bearer ${jwt}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ planId: TEST_PLAN_ID }),
    });
    const body = await r.json() as Record<string, unknown>;

    if (r.status === 200) {
      pass("T5 payment/create (no cookie) → 200");
    } else {
      fail("T5 payment/create (no cookie)", `status=${r.status} body=${JSON.stringify(body)}`);
    }
  } catch (e) { fail("T5 payment/create (no cookie)", String(e)); }

  // ── T6: POST /api/payments/create — invalid affiliate cookie ─────────────────
  console.log("\n  T6: POST /api/payments/create (invalid aff_id cookie)");
  try {
    const r    = await fetch(`${BASE_URL}/api/payments/create`, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${jwt}`,
        "Content-Type":  "application/json",
        "Cookie":        `aff_id=${randomUUID()}`,
      },
      body: JSON.stringify({ planId: TEST_PLAN_ID }),
    });
    const body = await r.json() as Record<string, unknown>;

    if (r.status === 200) {
      pass("T6 payment/create (invalid cookie) → 200");
    } else {
      fail("T6 payment/create (invalid cookie)", `status=${r.status} body=${JSON.stringify(body)}`);
    }
  } catch (e) { fail("T6 payment/create (invalid cookie)", String(e)); }

  // ── T7: Payment rows in DB (optional) ────────────────────────────────────────
  console.log("\n  T7: Payment rows in DB (optional)");
  try {
    const count = await prisma.payment.count({
      where: { userId: currentUserId, createdAt: { gte: testStartTime } },
    });
    if (count > 0) {
      pass(`T7 Payment rows in DB (${count} found)`);
    } else {
      console.log("  ~  T7 No Payment rows — NOWPayments may not be configured in this env");
    }
  } catch (e) { console.log(`  ~  T7 skipped: ${e}`); }
}

// ── Entry point ────────────────────────────────────────────────────────────────
(async () => {
  try {
    await main();
  } catch (e) {
    console.error("\n  FATAL:", e);
  } finally {
    await cleanup();
    await prisma.$disconnect();

    console.log("\n══════════════════════════════════════════════════════════════");
    console.log(" SUMMARY");
    console.log("══════════════════════════════════════════════════════════════");
    let allPassed = true;
    for (const r of results) {
      const mark = r.passed ? "PASS" : "FAIL";
      console.log(`  ${mark.padEnd(4)}  ${r.label}`);
      if (!r.passed && r.detail) console.log(`        ${r.detail}`);
      if (!r.passed) allPassed = false;
    }
    console.log("══════════════════════════════════════════════════════════════");
    console.log(allPassed ? " ALL TESTS PASSED" : " SOME TESTS FAILED");
    console.log("══════════════════════════════════════════════════════════════\n");
    process.exit(allPassed ? 0 : 1);
  }
})();
