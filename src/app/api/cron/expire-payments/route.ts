export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Auto-expire stale Payment invoices.
 *
 * Flips:
 *   AWAITING_PAYMENT (expiresAt < now) -> EXPIRED
 *   UNDERPAID        (expiresAt < now) -> EXPIRED_UNDERPAID
 *
 * Does NOT touch SEEN_ON_CHAIN or CONFIRMING — those have on-chain
 * transactions in flight; the watcher (Step 4) advances them based
 * on confirmations or moves to MANUAL_REVIEW.
 *
 * Why we need this cron:
 *   The partial unique index Payment_active_amount_unique includes
 *   AWAITING_PAYMENT/SEEN_ON_CHAIN/CONFIRMING/UNDERPAID without an
 *   expiresAt predicate (Postgres partial indexes can't use now()).
 *   Stale AWAITING_PAYMENT rows therefore keep their amount slot
 *   "occupied" in the index even after expiresAt has passed,
 *   blocking new invoice creation with P2002 -> 503 to the user.
 *
 * Auth: Bearer CRON_SECRET (same pattern as affiliate-hold).
 * Schedule: every minute via Coolify Scheduled Tasks.
 *
 * Idempotent: re-running within the same minute does nothing.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checkedAt = new Date();
  let expiredAwaitingCount = 0;
  let expiredUnderpaidCount = 0;
  const errors: string[] = [];

  try {
    // Single-statement updateMany for each transition.
    // Using updateMany (not findMany + loop) for atomicity and speed.
    const awaitingResult = await prisma.payment.updateMany({
      where: {
        status: PaymentStatus.AWAITING_PAYMENT,
        expiresAt: { lt: checkedAt },
      },
      data: {
        status: PaymentStatus.EXPIRED,
        expiredAt: checkedAt,
        updatedAt: checkedAt,
      },
    });
    expiredAwaitingCount = awaitingResult.count;

    const underpaidResult = await prisma.payment.updateMany({
      where: {
        status: PaymentStatus.UNDERPAID,
        expiresAt: { lt: checkedAt },
      },
      data: {
        status: PaymentStatus.EXPIRED_UNDERPAID,
        expiredAt: checkedAt,
        updatedAt: checkedAt,
      },
    });
    expiredUnderpaidCount = underpaidResult.count;

    return NextResponse.json({
      checkedAt: checkedAt.toISOString(),
      expiredAwaitingCount,
      expiredUnderpaidCount,
      totalExpired: expiredAwaitingCount + expiredUnderpaidCount,
      errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[EXPIRE_PAYMENTS] failed", err);
    return NextResponse.json(
      {
        error: "Cron failed",
        message,
        partialResult: {
          expiredAwaitingCount,
          expiredUnderpaidCount,
        },
      },
      { status: 500 }
    );
  }
}
