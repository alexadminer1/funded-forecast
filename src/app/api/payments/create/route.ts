export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import crypto from "crypto";
import { attachAffiliateClickIfNeeded } from "@/lib/affiliate/attribution";

function auth(req: NextRequest) {
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId as number | null;
}

export async function POST(req: NextRequest) {
  const userId = auth(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await req.json();
  if (!planId) return NextResponse.json({ error: "planId required" }, { status: 400 });

  const plan = await prisma.challengePlan.findUnique({ where: { id: planId, isActive: true } });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const orderId = `FF-${userId}-${planId}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;

  try {
    const affCookieId = req.cookies.get("aff_id")?.value;
    await attachAffiliateClickIfNeeded(userId, affCookieId);
  } catch (err) {
    console.warn("[AFFILIATE_ATTACH] payment/create attach failed", err);
  }

  // Create payment record
  const payment = await prisma.payment.create({
    data: { userId, planId, orderId, amount: plan.price, currency: "USD", status: "pending" },
  });

  // Create NOWPayments invoice
  const res = await fetch("https://api.nowpayments.io/v1/invoice", {
    method: "POST",
    headers: {
      "x-api-key": process.env.NOWPAYMENTS_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: plan.price,
      price_currency: "usd",
      order_id: orderId,
      order_description: `FundedForecast - ${plan.name} Challenge ($${plan.accountSize.toLocaleString()})`,
      ipn_callback_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://funded-forecast.vercel.app"}/api/payments/webhook`,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://funded-forecast.vercel.app"}/dashboard?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://funded-forecast.vercel.app"}/login?mode=register`,
    }),
  });

  const invoice = await res.json();

  if (!invoice.invoice_url) {
    return NextResponse.json({ error: "Payment provider error", details: invoice }, { status: 500 });
  }

  // Update payment with nowpayments data
  await prisma.payment.update({
    where: { id: payment.id },
    data: { nowPaymentId: String(invoice.id), paymentUrl: invoice.invoice_url },
  });

  return NextResponse.json({ success: true, paymentUrl: invoice.invoice_url, orderId });
}
