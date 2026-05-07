export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { parsePaymentId } from "@/lib/payment/validators";

function auth(req: NextRequest): number | null {
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

/**
 * POST /api/payments/[id]/cancel
 *
 * Allow a user to cancel their own AWAITING_PAYMENT or UNDERPAID invoice.
 * Releases the amount slot in the partial unique index immediately.
 *
 * Cannot cancel:
 *   - SEEN_ON_CHAIN / CONFIRMING — transaction is on-chain, watcher must finish.
 *   - CONFIRMED / EXPIRED / CANCELLED / FAILED — already terminal.
 *
 * Returns:
 *   200 — { success: true, paymentId, status: 'CANCELLED' }
 *   400 — invalid id
 *   401 — no auth or not the owner
 *   404 — payment not found
 *   409 — payment in non-cancellable state (with current status)
 *
 * Auth: same JWT pattern as other user routes. Filters by userId so
 * a user cannot cancel another user's invoice.
 */
export async function POST(
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
    select: { id: true, status: true },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  // Only AWAITING_PAYMENT and UNDERPAID can be cancelled by user.
  // SEEN_ON_CHAIN/CONFIRMING have on-chain tx; watcher decides their fate.
  // Terminal states (CONFIRMED/EXPIRED/CANCELLED/FAILED/MANUAL_REVIEW) are not cancellable.
  const cancellable: PaymentStatus[] = [
    PaymentStatus.AWAITING_PAYMENT,
    PaymentStatus.UNDERPAID,
  ];
  if (!cancellable.includes(payment.status)) {
    return NextResponse.json(
      {
        error: "Cannot cancel payment in current state",
        currentStatus: payment.status,
      },
      { status: 409 }
    );
  }

  const now = new Date();
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: PaymentStatus.CANCELLED,
      expiredAt: now,
      updatedAt: now,
    },
  });

  return NextResponse.json({
    success: true,
    paymentId,
    status: PaymentStatus.CANCELLED,
  });
}
