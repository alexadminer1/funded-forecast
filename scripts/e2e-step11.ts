import { PrismaClient }   from "@prisma/client";
import { createHmac }     from "node:crypto";
import { readFileSync }   from "node:fs";
import * as nodeHttp      from "node:http";
import * as nodeHttps     from "node:https";

// ── Load .env (no dotenv dependency) ─────────────────────────────────────────
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

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL               = (process.env.BASE_URL ?? "https://funded-forecast.vercel.app").replace(/\/$/, "");
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET ?? "";
const ADMIN_API_KEY          = process.env.ADMIN_API_KEY           ?? "";
const CRON_SECRET            = process.env.CRON_SECRET             ?? "";
const AFFILIATE_PASSWORD     = process.env.AFFILIATE_PASSWORD      ?? "";

// ── Constants ─────────────────────────────────────────────────────────────────
const AFFILIATE_USER_ID  = 2;   // safety guard — never delete this user
const AFFILIATE_ID       = 23;
const AFFILIATE_REF_CODE = "tesssettre";
const TEST_PLAN_ID       = 2;
const TEST_AMOUNT        = 1000;
const BUYER_EMAIL_PREFIX = "e2e-step11-";
const BUYER_PASSWORD     = "TestBuyer123!";

const prisma = new PrismaClient();

// ── Result tracking ───────────────────────────────────────────────────────────
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

// ── State (top-level for cleanup access) ──────────────────────────────────────
let testStartTime:   Date                                   = new Date();
let buyerId:         number | null                          = null;
let buyerJwt:        string | null                          = null;
let affiliateJwt:    string | null                          = null;
let cookieId:        string | null                          = null;
let clickId:         number | null                          = null;
let payment:         { id: number; orderId: string } | null = null;
let conversionId:    number | null                          = null;
let payoutId:        number | null                          = null;
let webhookEventKey: string | null                          = null;

// ── RawGet — no redirect follow, full header access ───────────────────────────
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
        res.on("end",  () =>
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function decodeJwt(token: string): Record<string, unknown> {
  const part   = token.split(".")[1] ?? "";
  const padded = part.padEnd(part.length + (4 - (part.length % 4)) % 4, "=");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
}

async function login(email: string, password: string): Promise<string> {
  const res  = await fetch(`${BASE_URL}/api/login`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ email, password }),
  });
  const body = await res.json() as Record<string, unknown>;
  if (!res.ok || typeof body.token !== "string") {
    throw new Error(`Login failed (HTTP ${res.status}): ${JSON.stringify(body)}`);
  }
  return body.token;
}

async function postJson(
  url:     string,
  body:    unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res  = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body:    JSON.stringify(body),
  });
  const json = await res.json() as Record<string, unknown>;
  return { status: res.status, body: json };
}

async function dbAffiliate() {
  return prisma.affiliate.findUnique({ where: { id: AFFILIATE_ID } });
}

// ── Cleanup (always runs in finally) ──────────────────────────────────────────
async function cleanup(): Promise<void> {
  console.log("\n── CLEANUP ────────────────────────────────────────────────────");

  try {
    const r = await prisma.affiliateLedger.deleteMany({
      where: { affiliateId: AFFILIATE_ID, createdAt: { gte: testStartTime } },
    });
    console.log(`  [CLEANUP] AffiliateLedger: deleted ${r.count} rows`);
  } catch (e) { console.warn("  [CLEANUP] WARNING AffiliateLedger failed:", e); }

  try {
    const r = await prisma.affiliatePayout.deleteMany({
      where: { affiliateId: AFFILIATE_ID, createdAt: { gte: testStartTime } },
    });
    console.log(`  [CLEANUP] AffiliatePayout: deleted ${r.count} rows`);
  } catch (e) { console.warn("  [CLEANUP] WARNING AffiliatePayout failed:", e); }

  try {
    const r = await prisma.affiliateConversion.deleteMany({
      where: { affiliateId: AFFILIATE_ID, createdAt: { gte: testStartTime } },
    });
    console.log(`  [CLEANUP] AffiliateConversion: deleted ${r.count} rows`);
  } catch (e) { console.warn("  [CLEANUP] WARNING AffiliateConversion failed:", e); }

  try {
    const r = await prisma.affiliateClick.deleteMany({
      where: { affiliateId: AFFILIATE_ID, createdAt: { gte: testStartTime } },
    });
    console.log(`  [CLEANUP] AffiliateClick: deleted ${r.count} rows`);
  } catch (e) { console.warn("  [CLEANUP] WARNING AffiliateClick failed:", e); }

  if (webhookEventKey !== null) {
    try {
      const r = await prisma.processedStripeEvent.deleteMany({
        where: { eventId: webhookEventKey },
      });
      console.log(`  [CLEANUP] ProcessedStripeEvent: deleted ${r.count} rows`);
    } catch (e) { console.warn("  [CLEANUP] WARNING ProcessedStripeEvent failed:", e); }
  }

  if (buyerId !== null) {
    try {
      const r = await prisma.challenge.deleteMany({ where: { userId: buyerId } });
      console.log(`  [CLEANUP] Challenge: deleted ${r.count} rows`);
    } catch (e) { console.warn("  [CLEANUP] WARNING Challenge failed:", e); }

    try {
      const r = await prisma.payment.deleteMany({ where: { userId: buyerId } });
      console.log(`  [CLEANUP] Payment: deleted ${r.count} rows`);
    } catch (e) { console.warn("  [CLEANUP] WARNING Payment failed:", e); }

    try {
      const r = await prisma.balanceLog.deleteMany({ where: { userId: buyerId } });
      console.log(`  [CLEANUP] BalanceLog: deleted ${r.count} rows`);
    } catch (e) { console.warn("  [CLEANUP] WARNING BalanceLog failed:", e); }

    try {
      const r = await prisma.userConsent.deleteMany({ where: { userId: buyerId } });
      console.log(`  [CLEANUP] UserConsent: deleted ${r.count} rows`);
    } catch (e) { console.warn("  [CLEANUP] WARNING UserConsent failed:", e); }

    try {
      const r = await prisma.auditLog.deleteMany({ where: { actorId: buyerId } });
      console.log(`  [CLEANUP] AuditLog: deleted ${r.count} rows`);
    } catch (e) { console.warn("  [CLEANUP] WARNING AuditLog failed:", e); }

    if (buyerId !== AFFILIATE_USER_ID) {
      try {
        await prisma.user.delete({ where: { id: buyerId } });
        console.log(`  [CLEANUP] User: deleted buyer id=${buyerId}`);
      } catch (e) { console.warn(`  [CLEANUP] WARNING User delete failed (FK?):`, e); }
    }
  }

  try {
    await prisma.affiliate.update({
      where: { id: AFFILIATE_ID },
      data:  {
        balancePending:     0,
        balanceAvailable:   0,
        balanceFrozen:      0,
        balanceNegative:    0,
        lifetimePaid:       0,
        lifetimeEarned:     0,
        lifetimeClawedBack: 0,
        salesCount30d:      0,
        suspiciousFlag:     false,
        suspiciousReason:   null,
      },
    });
    console.log(`  [CLEANUP] Affiliate id=${AFFILIATE_ID}: balances reset to baseline`);
  } catch (e) { console.warn("  [CLEANUP] WARNING Affiliate reset failed:", e); }

  await prisma.$disconnect();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("══════════════════════════════════════════════════════════════");
  console.log(" E2E STEP 11 — Full affiliate flow on production");
  console.log(`  BASE_URL: ${BASE_URL}`);
  console.log("══════════════════════════════════════════════════════════════");

  // ── PHASE 0: PREFLIGHT ─────────────────────────────────────────────────────
  console.log("\n── PHASE 0: PREFLIGHT ─────────────────────────────────────────");

  const missingEnv: string[] = [];
  if (!NOWPAYMENTS_IPN_SECRET) missingEnv.push("NOWPAYMENTS_IPN_SECRET");
  if (!ADMIN_API_KEY)          missingEnv.push("ADMIN_API_KEY");
  if (!CRON_SECRET)            missingEnv.push("CRON_SECRET");
  if (!AFFILIATE_PASSWORD)     missingEnv.push("AFFILIATE_PASSWORD");

  if (missingEnv.length > 0) {
    console.error("\n  ERROR: Missing required env vars:");
    for (const k of missingEnv) console.error(`    ${k}`);
    console.error("\n  Add them to .env or pass via environment before running.");
    process.exit(1);
  }

  const preflightAff = await dbAffiliate();
  if (!preflightAff) {
    console.error(`  ERROR: Affiliate id=${AFFILIATE_ID} not found in DB`);
    process.exit(1);
  }
  if (preflightAff.status !== "approved") {
    console.error(`  ERROR: Affiliate status=${preflightAff.status} (expected approved)`);
    process.exit(1);
  }
  if (preflightAff.walletLockUntil !== null) {
    console.error(`\n  ERROR: walletLockUntil is not null (${preflightAff.walletLockUntil})`);
    console.error("  Fix with SQL:");
    console.error('  UPDATE "Affiliate" SET "walletLockUntil"=NULL WHERE id=23;');
    process.exit(1);
  }

  testStartTime = new Date();
  pass("T0 PREFLIGHT: env vars OK, affiliate approved, walletLockUntil=null");

  // ── PHASE 1: AFFILIATE LOGIN ───────────────────────────────────────────────
  console.log("\n── PHASE 1: AFFILIATE LOGIN ───────────────────────────────────");

  try {
    affiliateJwt = await login("root@alexadminer.com", AFFILIATE_PASSWORD);
    pass("T1 affiliate logged in");
  } catch (e) {
    fail("T1 affiliate login", String(e));
    throw e;
  }

  // ── PHASE 2: TEMP BUYER REGISTRATION ──────────────────────────────────────
  console.log("\n── PHASE 2: TEMP BUYER REGISTRATION ──────────────────────────");

  const nowTs         = Date.now();
  const buyerEmail    = BUYER_EMAIL_PREFIX + nowTs + "@test.local";
  const buyerUsername = "e2estep11" + nowTs.toString().slice(-6);

  try {
    const res  = await fetch(`${BASE_URL}/api/register`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        email:               buyerEmail,
        password:            BUYER_PASSWORD,
        username:            buyerUsername,
        firstName:           "E2E",
        lastName:            "Buyer",
        acceptedPayoutRules: true,
        acceptedPrivacy:     true,
      }),
    });
    const body = await res.json() as Record<string, unknown>;
    if (res.status !== 200 || body.success !== true || typeof body.token !== "string") {
      fail("T2 buyer registered", `status=${res.status} body=${JSON.stringify(body)}`);
      throw new Error("Buyer registration failed");
    }
    buyerJwt = body.token;
    buyerId  = decodeJwt(buyerJwt).userId as number;
    pass(`T2 buyer registered (id=${buyerId})`);
  } catch (e) {
    if (results[results.length - 1]?.passed === false) throw e;
    fail("T2 buyer registered", String(e));
    throw e;
  }

  // ── PHASE 3: CLICK ────────────────────────────────────────────────────────
  console.log("\n── PHASE 3: CLICK ─────────────────────────────────────────────");

  try {
    const r         = await rawGet(`${BASE_URL}/r/${AFFILIATE_REF_CODE}`);
    const rawCookie = r.headers["set-cookie"];
    const cookieStr = Array.isArray(rawCookie) ? rawCookie.join(" ") : (rawCookie ?? "");
    const m         = cookieStr.match(/aff_id=([^;,\s]+)/);
    cookieId        = m?.[1] ?? null;

    if (r.status !== 302 || !cookieId) {
      fail("T3 click → 302 + aff_id cookie", `status=${r.status} cookie="${cookieStr}"`);
      throw new Error("Click redirect failed");
    }
    pass("T3 click → 302 + aff_id cookie set");
  } catch (e) {
    if (results[results.length - 1]?.passed === false) throw e;
    fail("T3 click", String(e));
    throw e;
  }

  // T4: DB check click
  try {
    const click = await prisma.affiliateClick.findFirst({ where: { cookieId: cookieId! } });
    if (!click) {
      fail("T4 AffiliateClick in DB", `no row for cookieId=${cookieId}`);
    } else if (click.affiliateId !== AFFILIATE_ID) {
      fail("T4 AffiliateClick in DB", `affiliateId=${click.affiliateId} (expected ${AFFILIATE_ID})`);
    } else if (click.convertedToUserId !== null) {
      fail("T4 AffiliateClick in DB", `convertedToUserId=${click.convertedToUserId} (expected null)`);
    } else {
      clickId = click.id;
      pass(`T4 AffiliateClick row in DB (id=${clickId})`);
    }
  } catch (e) { fail("T4 AffiliateClick in DB", String(e)); }

  // ── PHASE 4: ATTACH-CLICK ─────────────────────────────────────────────────
  console.log("\n── PHASE 4: ATTACH-CLICK ──────────────────────────────────────");

  if (!cookieId || !buyerJwt) {
    fail("T5 attach-click", "skipped — no cookieId or buyerJwt");
    fail("T6 click.convertedToUserId", "skipped — no cookieId or buyerJwt");
    fail("T7 user.referredByAffiliateId", "skipped — no cookieId or buyerJwt");
    fail("T8 suspiciousFlag", "skipped — no cookieId or buyerJwt");
  } else {
    // T5
    try {
      const res  = await fetch(`${BASE_URL}/api/affiliate/attach-click`, {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${buyerJwt}`,
          "Cookie":        `aff_id=${cookieId}`,
          "Content-Type":  "application/json",
        },
      });
      const body = await res.json() as Record<string, unknown>;
      if (res.status === 200 && body.attached === true) {
        pass("T5 attach-click → attached:true");
      } else {
        fail("T5 attach-click", `status=${res.status} body=${JSON.stringify(body)}`);
      }
    } catch (e) { fail("T5 attach-click", String(e)); }

    // T6
    if (clickId && buyerId) {
      try {
        const click = await prisma.affiliateClick.findUnique({ where: { id: clickId } });
        if (click?.convertedToUserId === buyerId) {
          pass(`T6 click.convertedToUserId=${buyerId}`);
        } else {
          fail("T6 click.convertedToUserId", `got ${click?.convertedToUserId} (expected ${buyerId})`);
        }
      } catch (e) { fail("T6 click.convertedToUserId", String(e)); }
    } else {
      fail("T6 click.convertedToUserId", "skipped — no clickId or buyerId");
    }

    // T7
    if (buyerId) {
      try {
        const user = await prisma.user.findUnique({ where: { id: buyerId } });
        if (user?.referredByAffiliateId === AFFILIATE_ID) {
          pass(`T7 user.referredByAffiliateId=${AFFILIATE_ID}`);
        } else {
          fail("T7 user.referredByAffiliateId", `got ${user?.referredByAffiliateId} (expected ${AFFILIATE_ID})`);
        }
      } catch (e) { fail("T7 user.referredByAffiliateId", String(e)); }
    } else {
      fail("T7 user.referredByAffiliateId", "skipped — no buyerId");
    }

    // T8: suspiciousFlag — WARN if false, never fail
    try {
      const a  = await dbAffiliate();
      const sf = a?.suspiciousFlag ?? false;
      console.log(`  suspiciousFlag=${sf}, suspiciousReason=${a?.suspiciousReason}`);
      if (!sf) {
        console.warn("  WARN: suspiciousFlag=false — production same-IP detection may not have fired");
      }
      pass(`T8 suspiciousFlag observed: ${sf}`);
    } catch (e) { fail("T8 suspiciousFlag", String(e)); }
  }

  // Capture wasSuspicious for hold-day calculation
  let wasSuspicious = false;
  try {
    const a = await dbAffiliate();
    wasSuspicious = a?.suspiciousFlag ?? false;
  } catch {}

  // ── PHASE 5: CREATE PAYMENT (direct DB) ───────────────────────────────────
  console.log("\n── PHASE 5: CREATE PAYMENT ────────────────────────────────────");

  if (!buyerId) {
    fail("T9 Payment created", "skipped — no buyerId");
    throw new Error("Cannot continue without buyerId");
  }

  try {
    const p = await prisma.payment.create({
      data: {
        userId:   buyerId,
        planId:   TEST_PLAN_ID,
        orderId:  `E2E-STEP11-${Date.now()}`,
        amount:   TEST_AMOUNT,
        currency: "USD",
        status:   "pending",
      },
    });
    payment = { id: p.id, orderId: p.orderId };
    pass(`T9 Payment created (id=${p.id}, orderId=${p.orderId})`);
  } catch (e) {
    fail("T9 Payment created", String(e));
    throw e;
  }

  // ── PHASE 6: WEBHOOK SIMULATION ───────────────────────────────────────────
  console.log("\n── PHASE 6: WEBHOOK SIMULATION ────────────────────────────────");

  const webhookPaymentId = Date.now();
  const webhookPayload   = {
    order_id:       payment.orderId,
    payment_id:     webhookPaymentId,
    payment_status: "finished",
    actually_paid:  TEST_AMOUNT,
    pay_currency:   "usdttrc20",
  };
  const rawBody = JSON.stringify(webhookPayload);
  const sig     = createHmac("sha512", NOWPAYMENTS_IPN_SECRET).update(rawBody).digest("hex");
  webhookEventKey = `nowpayments:${webhookPaymentId}:finished`;

  try {
    const res     = await fetch(`${BASE_URL}/api/payments/webhook`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-nowpayments-sig": sig },
      body:    rawBody,
    });
    const rawText = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = rawText.length > 0 ? JSON.parse(rawText) as Record<string, unknown> : {};
    } catch {
      fail("T10 webhook → 200 ok:true", `status=${res.status} non-JSON body="${rawText.slice(0, 500)}"`);
      throw new Error("Webhook returned non-JSON");
    }
    if (res.status !== 200 || body.ok !== true || body.duplicate === true) {
      fail("T10 webhook → 200 ok:true", `status=${res.status} body=${JSON.stringify(body)}`);
      throw new Error("Webhook failed or returned duplicate");
    }
    pass("T10 webhook → 200 ok:true");
  } catch (e) {
    if (results[results.length - 1]?.passed === false) throw e;
    fail("T10 webhook", String(e));
    throw e;
  }

  // T11: Payment.status=finished
  try {
    const p = await prisma.payment.findUnique({ where: { id: payment.id } });
    if (p?.status === "finished" && p.nowPaymentId === String(webhookPaymentId)) {
      pass("T11 Payment.status=finished");
    } else {
      fail("T11 Payment.status", `status=${p?.status}, nowPaymentId=${p?.nowPaymentId} (expected "${String(webhookPaymentId)}")`);
    }
  } catch (e) { fail("T11 Payment.status", String(e)); }

  // T12: Challenge created for buyer
  try {
    const challenge = await prisma.challenge.findFirst({
      where: { userId: buyerId, planId: TEST_PLAN_ID },
    });
    if (challenge) {
      pass(`T12 Challenge created for buyer (id=${challenge.id})`);
    } else {
      fail("T12 Challenge created", "no Challenge row found for buyer+plan");
    }
  } catch (e) { fail("T12 Challenge created", String(e)); }

  // T13: AffiliateConversion
  let convCommission = 0;
  try {
    const c = await prisma.affiliateConversion.findUnique({
      where: { paymentId: payment.id },
    });
    if (!c) {
      fail("T13 AffiliateConversion", `no conversion row for paymentId=${payment.id}`);
    } else if (c.status !== "pending") {
      fail("T13 AffiliateConversion", `status=${c.status} (expected pending)`);
    } else if (c.affiliateId !== AFFILIATE_ID) {
      fail("T13 AffiliateConversion", `affiliateId=${c.affiliateId} (expected ${AFFILIATE_ID})`);
    } else if (c.commissionAmount <= 0) {
      fail("T13 AffiliateConversion", `commissionAmount=${c.commissionAmount} (expected > 0)`);
    } else {
      conversionId   = c.id;
      convCommission = c.commissionAmount;
      const pendingDays      = Math.round((c.pendingUntil.getTime() - testStartTime.getTime()) / 86400000);
      const expectedHoldDays = wasSuspicious ? 45 : 30;
      console.log(`  commissionAmount=${convCommission}, pendingDays=${pendingDays}, expectedHoldDays=${expectedHoldDays}`);
      if (pendingDays >= expectedHoldDays - 1 && pendingDays <= expectedHoldDays + 1) {
        pass(`T13 AffiliateConversion: status=pending, commission=$${convCommission}, hold=${pendingDays}d (expected=${expectedHoldDays}d, suspicious=${wasSuspicious})`);
      } else {
        // still store ids for cleanup
        conversionId   = c.id;
        convCommission = c.commissionAmount;
        fail("T13 AffiliateConversion hold", `pendingDays=${pendingDays} not within 1d of expected=${expectedHoldDays}`);
      }
    }
  } catch (e) { fail("T13 AffiliateConversion", String(e)); }

  // T14: AffiliateLedger commission_pending entry
  if (conversionId) {
    try {
      const ledger = await prisma.affiliateLedger.findFirst({
        where: { conversionId, type: "commission_pending" },
      });
      if (ledger && ledger.bucket === "pending" && Math.abs(ledger.amount - convCommission) <= 0.01) {
        pass("T14 Ledger commission_pending entry created");
      } else {
        fail(
          "T14 Ledger commission_pending",
          `ledger=${JSON.stringify(ledger ? { type: ledger.type, bucket: ledger.bucket, amount: ledger.amount } : null)}`,
        );
      }
    } catch (e) { fail("T14 Ledger commission_pending", String(e)); }
  } else {
    fail("T14 Ledger commission_pending", "skipped — no conversionId");
  }

  // T15: Affiliate.balancePending
  try {
    const a        = await dbAffiliate();
    const bPending = a?.balancePending ?? 0;
    if (Math.abs(bPending - convCommission) <= 0.01) {
      pass(`T15 Affiliate.balancePending=${bPending}`);
    } else {
      fail("T15 Affiliate.balancePending", `got ${bPending}, expected ${convCommission}`);
    }
  } catch (e) { fail("T15 Affiliate.balancePending", String(e)); }

  // ── PHASE 7: CRON ADVANCE ─────────────────────────────────────────────────
  console.log("\n── PHASE 7: CRON ADVANCE ──────────────────────────────────────");

  if (!conversionId) {
    fail("T16 pendingUntil patched", "skipped — no conversionId");
    fail("T17 cron triggered",       "skipped — no conversionId");
    fail("T18 AffiliateConversion.status=approved", "skipped — no conversionId");
    fail("T19 Ledger advance entries",              "skipped — no conversionId");
    fail("T20 Affiliate balances after cron",       "skipped — no conversionId");
  } else {
    // T16: patch pendingUntil to the past
    try {
      await prisma.affiliateConversion.update({
        where: { id: conversionId },
        data:  { pendingUntil: new Date(Date.now() - 1000) },
      });
      pass("T16 pendingUntil patched to past");
    } catch (e) { fail("T16 pendingUntil patched", String(e)); }

    // T17: trigger cron
    try {
      const res  = await fetch(`${BASE_URL}/api/cron/affiliate-hold`, {
        method:  "GET",
        headers: { "Authorization": `Bearer ${CRON_SECRET}` },
      });
      const body = await res.json() as Record<string, unknown>;
      if (res.status === 200 && typeof body.processed === "number" && body.processed >= 1) {
        pass(`T17 cron triggered, processed=${body.processed}`);
      } else {
        fail("T17 cron", `status=${res.status} body=${JSON.stringify(body)}`);
      }
    } catch (e) { fail("T17 cron", String(e)); }

    // T18: AffiliateConversion.status=approved
    try {
      const c = await prisma.affiliateConversion.findUnique({ where: { id: conversionId } });
      if (c?.status === "approved" && c.approvedAt !== null) {
        pass("T18 AffiliateConversion.status=approved");
      } else {
        fail("T18 AffiliateConversion.status", `status=${c?.status} approvedAt=${c?.approvedAt}`);
      }
    } catch (e) { fail("T18 AffiliateConversion.status", String(e)); }

    // T19: 3 ledger entries total (1 pending + 2 from cron)
    try {
      const ledgers = await prisma.affiliateLedger.findMany({
        where:   { conversionId },
        orderBy: { createdAt: "asc" },
      });
      const hasPendingDebit = ledgers.some(
        l => l.type === "commission_pending" && l.bucket === "pending" && l.amount < 0,
      );
      const hasAvailCredit  = ledgers.some(
        l => l.type === "commission_approved" && l.bucket === "available" && l.amount > 0,
      );
      if (ledgers.length >= 3 && hasPendingDebit && hasAvailCredit) {
        pass(`T19 Ledger advance entries created (${ledgers.length} total)`);
      } else {
        fail(
          "T19 Ledger advance",
          `count=${ledgers.length} pendingDebit=${hasPendingDebit} availCredit=${hasAvailCredit}`,
        );
      }
    } catch (e) { fail("T19 Ledger advance", String(e)); }

    // T20: Affiliate balances after cron
    try {
      const a        = await dbAffiliate();
      const bPending   = a?.balancePending   ?? 0;
      const bAvailable = a?.balanceAvailable ?? 0;
      if (Math.abs(bPending) <= 0.01 && Math.abs(bAvailable - convCommission) <= 0.01) {
        pass(`T20 Affiliate balances: pending=${bPending}, available=${bAvailable}`);
      } else {
        fail(
          "T20 Affiliate balances",
          `pending=${bPending} (expected ~0), available=${bAvailable} (expected ${convCommission})`,
        );
      }
    } catch (e) { fail("T20 Affiliate balances", String(e)); }
  }

  // ── PHASE 8: PAYOUT REQUEST ───────────────────────────────────────────────
  console.log("\n── PHASE 8: PAYOUT REQUEST ────────────────────────────────────");

  if (!affiliateJwt) {
    fail("T21 payout requested",    "skipped — no affiliateJwt");
    fail("T22 AffiliatePayout row", "skipped — no affiliateJwt");
  } else {
    // T21
    try {
      const { status, body } = await postJson(
        `${BASE_URL}/api/affiliate/payouts`,
        {},
        { "Authorization": `Bearer ${affiliateJwt}` },
      );
      if (status === 429) {
        console.error("  ERROR: 429 Rate limit on payout request (1/day).");
        console.error("  Wait 24h or reset the Upstash rate-limit key to re-run.");
        fail("T21 payout requested", "rate limit 429 — 1/day limit hit");
      } else if (status === 200 && body.ok === true) {
        const payout = body.payout as Record<string, unknown> | undefined;
        if (typeof payout?.id === "number") {
          payoutId = payout.id;
          pass(`T21 payout requested (id=${payoutId}, status=requested)`);
        } else {
          fail("T21 payout requested", `body.payout.id missing: ${JSON.stringify(body)}`);
        }
      } else {
        fail("T21 payout requested", `status=${status} body=${JSON.stringify(body)}`);
      }
    } catch (e) { fail("T21 payout requested", String(e)); }

    // T22: AffiliatePayout DB row
    if (payoutId) {
      try {
        const p = await prisma.affiliatePayout.findUnique({ where: { id: payoutId } });
        if (
          p?.status === "requested" &&
          Math.abs(p.amount - convCommission) <= 0.01 &&
          p.affiliateId === AFFILIATE_ID
        ) {
          pass("T22 AffiliatePayout row created");
        } else {
          fail("T22 AffiliatePayout row", `status=${p?.status} amount=${p?.amount} affiliateId=${p?.affiliateId}`);
        }
      } catch (e) { fail("T22 AffiliatePayout row", String(e)); }
    } else {
      fail("T22 AffiliatePayout row", "skipped — no payoutId");
    }
  }

  // ── PHASE 9: ADMIN APPROVE ────────────────────────────────────────────────
  console.log("\n── PHASE 9: ADMIN APPROVE ─────────────────────────────────────");

  if (!payoutId) {
    fail("T23 payout approved by admin", "skipped — no payoutId");
  } else {
    try {
      const { status, body } = await postJson(
        `${BASE_URL}/api/admin/affiliate/payouts/${payoutId}/approve`,
        { adminLabel: "E2E-Step11", reason: "E2E test approve" },
        { "x-admin-key": ADMIN_API_KEY },
      );
      const payoutBody = body.payout as Record<string, unknown> | undefined;
      if (status === 200 && body.ok === true && payoutBody?.status === "approved") {
        pass("T23 payout approved by admin");
      } else {
        fail("T23 payout approved by admin", `status=${status} body=${JSON.stringify(body)}`);
      }
    } catch (e) { fail("T23 payout approved by admin", String(e)); }
  }

  // ── PHASE 10: ADMIN COMPLETE ──────────────────────────────────────────────
  console.log("\n── PHASE 10: ADMIN COMPLETE ───────────────────────────────────");

  if (!payoutId) {
    fail("T24 payout completed",              "skipped — no payoutId");
    fail("T25 AffiliateConversion.status=paid", "skipped — no payoutId");
    fail("T26 Final affiliate state",           "skipped — no payoutId");
  } else {
    const txHash = `e2e-step11-${Date.now()}`;

    // T24
    try {
      const { status, body } = await postJson(
        `${BASE_URL}/api/admin/affiliate/payouts/${payoutId}/complete`,
        {
          adminLabel:      "E2E-Step11",
          reason:          "E2E test complete",
          transactionHash: txHash,
          adminNote:       "automated E2E test",
        },
        { "x-admin-key": ADMIN_API_KEY },
      );
      const payoutBody = body.payout    as Record<string, unknown> | undefined;
      const affBody    = body.affiliate as Record<string, unknown> | undefined;
      if (
        status === 200 &&
        body.ok &&
        payoutBody?.status === "completed" &&
        Number(affBody?.lifetimePaid ?? 0) > 0
      ) {
        pass(`T24 payout completed, lifetimePaid=${affBody?.lifetimePaid}`);
      } else {
        fail("T24 payout completed", `status=${status} body=${JSON.stringify(body)}`);
      }
    } catch (e) { fail("T24 payout completed", String(e)); }

    // T25: AffiliateConversion.status=paid
    if (conversionId) {
      try {
        const c = await prisma.affiliateConversion.findUnique({ where: { id: conversionId } });
        if (c?.status === "paid" && c.payoutId === payoutId) {
          pass("T25 AffiliateConversion.status=paid");
        } else {
          fail("T25 AffiliateConversion.status=paid", `status=${c?.status} payoutId=${c?.payoutId} (expected ${payoutId})`);
        }
      } catch (e) { fail("T25 AffiliateConversion.status=paid", String(e)); }
    } else {
      fail("T25 AffiliateConversion.status=paid", "skipped — no conversionId");
    }

    // T26: Final affiliate state
    try {
      const a          = await dbAffiliate();
      const avail      = a?.balanceAvailable ?? 0;
      const ltPaid     = a?.lifetimePaid     ?? 0;
      console.log(
        `  Final affiliate: balancePending=${a?.balancePending}, balanceAvailable=${avail}, lifetimePaid=${ltPaid}`,
      );
      pass(`T26 Final affiliate state: avail=${avail}, lifetimePaid=${ltPaid}`);
    } catch (e) { fail("T26 Final affiliate state", String(e)); }
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
(async () => {
  try {
    await main();
  } catch (e) {
    console.error("\n  FATAL:", e);
  } finally {
    await cleanup();

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
    const failCount = results.filter(r => !r.passed).length;
    console.log("══════════════════════════════════════════════════════════════");
    console.log(allPassed ? " ALL PASSED" : ` ${failCount} FAILED`);
    console.log("══════════════════════════════════════════════════════════════\n");
    process.exit(allPassed ? 0 : 1);
  }
})();
