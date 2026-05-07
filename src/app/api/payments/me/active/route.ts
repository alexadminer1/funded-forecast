export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { unitsToUsdString } from "@/lib/payment/amount";

function auth(req: NextRequest): number | null {
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

const ACTIVE_STATUSES = [
  PaymentStatus.AWAITING_PAYMENT,
  PaymentStatus.SEEN_ON_CHAIN,
  PaymentStatus.CONFIRMING,
  PaymentStatus.UNDERPAID,
];

/**
 * GET /api/payments/me/active
 *
 * Returns the most recent non-terminal Payment owned by the current user,
 * if any. Used by /account/plans to show a "You have a pending payment"
 * banner so the user can resume or cancel without going through the
 * plan-selection flow again.
 *
 * Returns:
 *   200 { success: true, hasPending: false } — no active invoice
 *   200 { success: true, hasPending: true, payment: {...} } — has one
 *   401 — no auth
 *
 * Filters: status in (AWAITING/SEEN/CONFIRMING/UNDERPAID) AND expiresAt > now.
 * Stale AWAITING_PAYMENT rows (expiresAt past, not yet flipped by cron)
 * are NOT returned — banner would be misleading and the cron will
 * clean them up within 60 seconds anyway.
 */
export async function GET(req: NextRequest) {
  const userId = auth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const payment = await prisma.payment.findFirst({
    where: {
      userId,
      status: { in: ACTIVE_STATUSES },
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
    include: {
      plan: {
        select: { id: true, name: true, priceCents: true },
      },
    },
  });

  if (!payment) {
    return NextResponse.json({ success: true, hasPending: false });
  }

  return NextResponse.json({
    success: true,
    hasPending: true,
    payment: {
      paymentId: payment.id,
      planId: payment.planId,
      planName: payment.plan?.name ?? "Unknown plan",
      status: payment.status,
      amountUsdc: unitsToUsdString(payment.expectedAmountUnits, payment.tokenDecimals),
      planAmountUsd: payment.planAmountUsd.toFixed(2),
      expiresAt: payment.expiresAt.toISOString(),
    },
  });
}
