export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { unitsToUsdString } from "@/lib/payment/amount";
import { parsePaymentId } from "@/lib/payment/validators";

function auth(req: NextRequest): number | null {
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

/**
 * GET /api/payments/[id]/status
 *
 * Returns current state of a Payment invoice. Used by /checkout UI
 * to poll for status transitions: AWAITING_PAYMENT → SEEN_ON_CHAIN →
 * CONFIRMING → CONFIRMED.
 *
 * In Step 2, status remains AWAITING_PAYMENT — only the watcher (Step 4)
 * advances it. This endpoint is wired now so /checkout UI in Step 3 can
 * be built against a real shape.
 *
 * Auth: user can only see their own payments (filter by userId from JWT).
 *
 * Note: Next.js 15+ requires `params` to be a Promise (async dynamic routes).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = auth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const paymentId = parsePaymentId(id);
  if (!paymentId) {
    return NextResponse.json({ error: "Invalid paymentId" }, { status: 400 });
  }

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
    select: {
      id: true,
      status: true,
      chainId: true,
      tokenAddress: true,
      tokenSymbol: true,
      tokenDecimals: true,
      receiverAddress: true,
      planAmountUsd: true,
      expectedAmountUnits: true,
      actualAmountUnits: true,
      confirmationsSeen: true,
      confirmationsRequired: true,
      expiresAt: true,
      seenAt: true,
      confirmedAt: true,
      expiredAt: true,
      primaryTxHash: true,
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  // Note: `expired` is a derived flag based on expiresAt vs now, separate from
  // status=EXPIRED. Watcher may not have run yet, so expiresAt < now is not
  // the same as status=EXPIRED. UI uses this for countdown display.
  const now = new Date();
  const isExpired =
    payment.expiresAt < now &&
    payment.status === PaymentStatus.AWAITING_PAYMENT;

  const amountString = unitsToUsdString(payment.expectedAmountUnits, payment.tokenDecimals);

  return NextResponse.json({
    success: true,
    paymentId: payment.id,
    status: payment.status,
    isExpired,
    chainId: payment.chainId,
    tokenAddress: payment.tokenAddress,
    tokenSymbol: payment.tokenSymbol,
    tokenDecimals: payment.tokenDecimals,
    address: payment.receiverAddress,
    planAmountUsd: payment.planAmountUsd.toFixed(2),
    amountUsd: amountString,
    amountUsdc: amountString,
    expectedAmountUnits: payment.expectedAmountUnits.toString(),
    actualAmountUnits: payment.actualAmountUnits?.toString() ?? null,
    confirmationsSeen: payment.confirmationsSeen,
    confirmationsRequired: payment.confirmationsRequired,
    expiresAt: payment.expiresAt.toISOString(),
    seenAt: payment.seenAt?.toISOString() ?? null,
    confirmedAt: payment.confirmedAt?.toISOString() ?? null,
    expiredAt: payment.expiredAt?.toISOString() ?? null,
    primaryTxHash: payment.primaryTxHash,
  });
}
