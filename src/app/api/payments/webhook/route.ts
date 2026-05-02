export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { recordAffiliateConversionFromPayment } from "@/lib/affiliate/conversions";

function verifySignature(body: string, signature: string): boolean {
  const hmac = crypto.createHmac("sha512", process.env.NOWPAYMENTS_IPN_SECRET!);
  hmac.update(body);
  return hmac.digest("hex") === signature;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-nowpayments-sig") ?? "";

  if (!verifySignature(rawBody, signature)) {
    console.error("[WEBHOOK] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  try {
    data = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { order_id, payment_status, actually_paid, pay_currency, payment_id } = data;
  if (!order_id) return NextResponse.json({ ok: true });
  if (!payment_id) {
    console.error("[WEBHOOK] Missing payment_id, cannot dedup");
    return NextResponse.json({ error: "Missing payment_id" }, { status: 400 });
  }

  // Idempotency: dedup by composite event key (payment_id + status).
  // NOWPayments sends multiple webhooks per payment as status progresses
  // (waiting -> confirming -> confirmed -> finished), and we want to process
  // each status transition once, but never the same transition twice.
  const eventKey = `nowpayments:${payment_id}:${payment_status}`;
  try {
    await prisma.processedStripeEvent.create({ data: { eventId: eventKey } });
  } catch {
    // Unique constraint failed — event already processed
    console.log(`[WEBHOOK] Duplicate event skipped: ${eventKey}`);
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const payment = await prisma.payment.findUnique({ where: { orderId: order_id } });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  await prisma.payment.update({
    where: { orderId: order_id },
    data: {
      status: payment_status,
      nowPaymentId: String(payment_id),
      payAmount: actually_paid,
      payCurrency: pay_currency,
    },
  });

  if (["confirmed", "finished"].includes(payment_status) && payment.planId) {
    const existing = await prisma.challenge.findFirst({
      where: { userId: payment.userId, status: { in: ["active", "passed"] } },
    });
    if (!existing) {
      const plan = await prisma.challengePlan.findUnique({ where: { id: payment.planId } });
      if (plan) {
        const startBalance = plan.accountSize;
        await prisma.challenge.create({
          data: {
            userId: payment.userId,
            planId: plan.id,
            stage: "evaluation",
            status: "active",
            startBalance,
            realizedBalance: startBalance,
            peakBalance: startBalance,
            profitTargetPct: plan.profitTargetPct,
            maxDailyDdPct: plan.dailyLossPct,
            maxTotalDdPct: plan.maxLossPct,
            maxPositionSizePct: plan.maxPositionSizePct,
            minTradingDays: plan.minTradingDays,
            expiresAt: new Date(Date.now() + plan.challengePeriodDays * 24 * 60 * 60 * 1000),
            payoutCapCents: plan.maxPayoutCapCents,
            minPayoutCents: plan.minPayoutCents,
            profitSharePct: plan.profitSharePct,
            refundableFeeCents: plan.refundableFeeCents,
            payoutCooldownDays: plan.payoutCooldownDays,
          },
        });
        await prisma.balanceLog.create({
          data: {
            userId: payment.userId,
            type: "challenge_start",
            amount: startBalance,
            balanceBefore: 0,
            balanceAfter: startBalance,
            runningBalance: startBalance,
          },
        });
        try {
          await recordAffiliateConversionFromPayment(payment.id);
        } catch (err) {
          console.warn("[AFFILIATE_CONVERSION] webhook hook failed", err);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
