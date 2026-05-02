/**
 * Isolated integration test for recordAffiliateConversionFromPayment.
 * Run: npx tsx scripts/test-affiliate-conversion.ts
 * Requires: real DB (DATABASE_URL in .env)
 */

import { prisma } from "../src/lib/prisma";
import { recordAffiliateConversionFromPayment } from "../src/lib/affiliate/conversions";

// ─── helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(label: string) {
  console.log(`  ✓ ${label}`);
  passed++;
}

function fail(label: string, detail?: string) {
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  failed++;
}

function section(title: string) {
  console.log(`\n── ${title}`);
}

// ─── tracked IDs for cleanup ──────────────────────────────────────────────────

const userIds:       number[] = [];
const affiliateIds:  number[] = [];
const clickIds:      number[] = [];
const paymentIds:    number[] = [];
const conversionIds: number[] = [];

// ─── seed helpers ─────────────────────────────────────────────────────────────

async function makeUser(email: string) {
  const username = `tst_${Math.random().toString(36).slice(2, 10)}`;
  const u = await prisma.user.create({
    data: { email, username, password: "hashed", firstName: "Test", lastName: "User" },
  });
  userIds.push(u.id);
  return u;
}

async function makeAffiliate(userId: number, tier = "starter") {
  const code = `TESTCODE${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const a = await prisma.affiliate.create({
    data: {
      userId,
      refCode:         code,
      status:          "approved",
      tier,
      applicationData: {},
      acceptedTermsAt: new Date(),
    },
  });
  affiliateIds.push(a.id);
  return a;
}

async function makeClick(
  affiliate: { id: number; refCode: string },
  convertedToUserId: number,
  expiredDaysAgo?: number,
) {
  const cookieId = `ck_${Math.random().toString(36).slice(2)}`;
  const expiresAt = expiredDaysAgo
    ? new Date(Date.now() - expiredDaysAgo * 86_400_000)
    : new Date(Date.now() + 60 * 86_400_000);
  const c = await prisma.affiliateClick.create({
    data: {
      affiliateId:      affiliate.id,
      refCode:          affiliate.refCode,
      cookieId,
      ipHash:           "testhash",
      expiresAt,
      convertedToUserId,
    },
  });
  clickIds.push(c.id);
  return c;
}

async function makePayment(
  userId: number,
  planId: number,
  status = "confirmed",
  createdAt?: Date,
) {
  const orderId = `TEST-${Math.random().toString(36).slice(2)}`;
  const p = await prisma.payment.create({
    data: {
      userId,
      planId,
      orderId,
      amount:   100,
      currency: "USD",
      status,
      ...(createdAt ? { createdAt } : {}),
    },
  });
  paymentIds.push(p.id);
  return p;
}

// ─── cleanup ──────────────────────────────────────────────────────────────────

async function cleanup() {
  if (conversionIds.length) {
    await prisma.affiliateLedger.deleteMany({
      where: { conversionId: { in: conversionIds } },
    });
    await prisma.affiliateConversion.deleteMany({
      where: { id: { in: conversionIds } },
    });
  }
  if (paymentIds.length)
    await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
  if (clickIds.length)
    await prisma.affiliateClick.deleteMany({ where: { id: { in: clickIds } } });
  if (affiliateIds.length)
    await prisma.affiliate.deleteMany({ where: { id: { in: affiliateIds } } });
  if (userIds.length)
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Resolve a real planId
  const plan = await prisma.challengePlan.findFirst({ where: { isActive: true } });
  if (!plan) {
    console.error("FATAL: no active ChallengePlan found — seed one first");
    process.exit(1);
  }
  const PLAN_ID = plan.id;

  // shared affiliate for most scenarios
  const userA     = await makeUser(`aff_a_${Date.now()}@test.local`);
  const affiliateA = await makeAffiliate(userA.id, "starter");

  // ── S1: Happy path ──────────────────────────────────────────────────────────
  section("S1: happy path — first purchase, valid click, approved affiliate");
  {
    const buyer  = await makeUser(`buyer1_${Date.now()}@test.local`);
    await makeClick(affiliateA, buyer.id);
    const pmt    = await makePayment(buyer.id, PLAN_ID, "confirmed");
    const r1     = await recordAffiliateConversionFromPayment(pmt.id);

    if (r1.created) {
      pass("S1.1 created = true");
    } else {
      fail("S1.1 created = true", `reason: ${r1.reason}`);
    }

    if (r1.reason === "ok") {
      pass("S1.2 reason = ok");
    } else {
      fail("S1.2 reason = ok", `got ${r1.reason}`);
    }

    if (r1.conversionId) {
      pass("S1.3 conversionId present");
      conversionIds.push(r1.conversionId);
    } else {
      fail("S1.3 conversionId present");
    }

    const convS1 = r1.conversionId
      ? await prisma.affiliateConversion.findUnique({ where: { id: r1.conversionId } })
      : null;

    if (convS1 && Math.abs(convS1.commissionAmount - 10) < 0.01) {
      pass("S1.4 Commission amount = 10 (10% of $100, starter tier)");
    } else {
      fail("S1.4 Commission amount", `got ${convS1?.commissionAmount}, expected 10`);
    }

    // Ledger entry created
    const ledgerCount = await prisma.affiliateLedger.count({
      where: {
        affiliateId:  affiliateA.id,
        type:         "commission_pending",
        conversionId: r1.conversionId,
      },
    });
    if (ledgerCount === 1) {
      pass("S2 ledger entry created");
    } else {
      fail("S2 ledger entry created", `count = ${ledgerCount}`);
    }
  }

  // ── S3: Idempotency ─────────────────────────────────────────────────────────
  section("S3: idempotency — calling twice returns already_exists");
  {
    const buyer  = await makeUser(`buyer3_${Date.now()}@test.local`);
    await makeClick(affiliateA, buyer.id);
    const pmt    = await makePayment(buyer.id, PLAN_ID, "confirmed");

    const first  = await recordAffiliateConversionFromPayment(pmt.id);
    if (first.created) {
      if (first.conversionId) conversionIds.push(first.conversionId);
    } else {
      fail("S3.0 first call should succeed", `reason: ${first.reason}`);
    }

    const second = await recordAffiliateConversionFromPayment(pmt.id);
    if (!second.created && second.reason === "already_exists") {
      pass("S3.1 second call: created=false, reason=already_exists");
    } else {
      fail("S3.1 second call: created=false, reason=already_exists", `got created=${second.created} reason=${second.reason}`);
    }
  }

  // ── S4: Not first purchase ──────────────────────────────────────────────────
  section("S4: not_first_purchase — prior successful payment exists");
  {
    const buyer     = await makeUser(`buyer4_${Date.now()}@test.local`);
    await makeClick(affiliateA, buyer.id);
    const earlier   = await makePayment(buyer.id, PLAN_ID, "confirmed", new Date(Date.now() - 86_400_000));
    const laterPmt  = await makePayment(buyer.id, PLAN_ID, "confirmed");

    const r4 = await recordAffiliateConversionFromPayment(laterPmt.id);
    if (!r4.created && r4.reason === "not_first_purchase") {
      pass("S4.1 reason = not_first_purchase");
    } else {
      fail("S4.1 reason = not_first_purchase", `got created=${r4.created} reason=${r4.reason}`);
    }

    // also test first payment (no prior) succeeds
    const r4b = await recordAffiliateConversionFromPayment(earlier.id);
    if (r4b.created) {
      pass("S4.2 first payment still converts");
      if (r4b.conversionId) conversionIds.push(r4b.conversionId);
    } else {
      fail("S4.2 first payment still converts", `reason: ${r4b.reason}`);
    }
  }

  // ── S5: Self-referral ───────────────────────────────────────────────────────
  section("S5: self_referral — affiliate buying own link");
  {
    // userA is the affiliate; make a click where userA is the buyer
    await makeClick(affiliateA, userA.id);
    const pmt  = await makePayment(userA.id, PLAN_ID, "confirmed");
    const r5   = await recordAffiliateConversionFromPayment(pmt.id);
    if (!r5.created && r5.reason === "self_referral") {
      pass("S5.1 reason = self_referral");
    } else {
      fail("S5.1 reason = self_referral", `got created=${r5.created} reason=${r5.reason}`);
    }
  }

  // ── S6: No attribution ──────────────────────────────────────────────────────
  section("S6: no_attribution — no matching click");
  {
    const buyer = await makeUser(`buyer6_${Date.now()}@test.local`);
    // no click created for this buyer
    const pmt   = await makePayment(buyer.id, PLAN_ID, "confirmed");
    const r6    = await recordAffiliateConversionFromPayment(pmt.id);
    if (!r6.created && r6.reason === "no_attribution") {
      pass("S6.1 reason = no_attribution");
    } else {
      fail("S6.1 reason = no_attribution", `got created=${r6.created} reason=${r6.reason}`);
    }
  }

  // ─── summary ─────────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("SOME TESTS FAILED");
    process.exitCode = 1;
  } else {
    console.log("ALL TESTS PASSED");
  }
}

main()
  .catch((err) => {
    console.error("Unexpected error:", err);
    process.exitCode = 1;
  })
  .finally(() => cleanup().then(() => prisma.$disconnect()));
