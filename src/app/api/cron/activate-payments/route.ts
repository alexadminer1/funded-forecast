export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@prisma/client";
import { activatePayment } from "@/lib/payment/activation";

/**
 * Cron-triggered activation sweep.
 *
 * Schedule: every minute via Coolify Scheduled Task.
 * Auth: Bearer CRON_SECRET.
 *
 * Finds all CONFIRMED payments without a challengeId and calls
 * activatePayment() for each. Activation is idempotent — safe to
 * re-run on rows that were already activated between discovery and call.
 *
 * Results are aggregated and returned as JSON for Coolify log inspection.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let pending: { id: string }[] = [];
  try {
    pending = await prisma.payment.findMany({
      where: {
        status: PaymentStatus.CONFIRMED,
        challengeId: null,
      },
      select: { id: true },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ACTIVATE_PAYMENTS] failed to query pending:", err);
    return NextResponse.json(
      { success: false, error: "Query failed", message },
      { status: 500 }
    );
  }

  if (pending.length === 0) {
    return NextResponse.json({ success: true, processed: 0, activated: 0, failed: 0 });
  }

  let activated = 0;
  let failed = 0;
  const errors: { paymentId: string; reason: string }[] = [];

  for (const { id } of pending) {
    try {
      const result = await activatePayment(id);
      if (result.activated) {
        activated++;
        console.log(`[ACTIVATE_PAYMENTS] activated ${id} → challenge ${result.challengeId}`);
      } else {
        failed++;
        errors.push({ paymentId: id, reason: result.reason });
        console.warn(`[ACTIVATE_PAYMENTS] not activated ${id}: ${result.reason}`);
      }
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ paymentId: id, reason: message });
      console.error(`[ACTIVATE_PAYMENTS] unexpected error for ${id}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    processed: pending.length,
    activated,
    failed,
    ...(errors.length > 0 ? { errors } : {}),
  });
}
