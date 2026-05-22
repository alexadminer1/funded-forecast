export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPayoutTx } from "@/lib/onchain-verify";

/**
 * Cron: retry on-chain verification for payouts stuck in pending_verification.
 *
 * Schedule: every 10 minutes via Coolify Scheduled Task.
 * Auth: Bearer CRON_SECRET.
 * Max attempts: 24 (~4 hours). After 24 failures → manualReview = true.
 *
 * On success  → status = 'paid', paidAt = NOW()
 * On soft fail (insufficient_confirmations) → increment verificationAttempts
 * On hard fail → increment verificationAttempts; if >= 24 → manualReview = true
 * On rpc_error → do NOT increment (transient, will retry next cycle)
 */

const MAX_ATTEMPTS = 24;
const BATCH_SIZE = 50;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let pending: {
    id: number;
    txHash: string | null;
    walletAddress: string | null;
    finalAmountCents: number | null;
    netAmount: number;
    verificationAttempts: number;
    challengeId: number;
  }[];

  try {
    pending = await prisma.payoutRequest.findMany({
      where: {
        status: "pending_verification",
        verificationAttempts: { lt: MAX_ATTEMPTS },
        txHash: { not: null },
      },
      select: {
        id: true,
        txHash: true,
        walletAddress: true,
        finalAmountCents: true,
        netAmount: true,
        verificationAttempts: true,
        challengeId: true,
      },
      take: BATCH_SIZE,
      orderBy: { requestedAt: "asc" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[VERIFY_PENDING_PAYOUTS] Query failed:", err);
    return NextResponse.json({ success: false, error: "Query failed", message }, { status: 500 });
  }

  if (pending.length === 0) {
    return NextResponse.json({ success: true, processed: 0, completed: 0, retried: 0, failed: 0, manualReviewFlagged: 0 });
  }

  let completed = 0;
  let retried = 0;
  let failed = 0;
  let manualReviewFlagged = 0;

  for (const payout of pending) {
    if (!payout.txHash || !payout.walletAddress) {
      console.warn(`[VERIFY_PENDING_PAYOUTS] Payout #${payout.id} missing txHash or walletAddress — skipping`);
      continue;
    }

    const expectedAmountCents =
      payout.finalAmountCents ?? Math.round(payout.netAmount * 100);

    const result = await verifyPayoutTx({
      txHash: payout.txHash,
      expectedRecipient: payout.walletAddress,
      expectedAmountCents,
      payoutRequestId: payout.id,
    });

    const now = new Date();

    if (result.ok) {
      // Success → mark as paid
      try {
        await prisma.$transaction([
          prisma.payoutRequest.update({
            where: { id: payout.id },
            data: {
              status: "paid",
              paidAt: now,
              lastVerifyAttemptAt: now,
            },
          }),
          prisma.challenge.update({
            where: { id: payout.challengeId },
            data: { lastApprovedPayoutAt: now },
          }),
          prisma.auditLog.create({
            data: {
              actorId: null,
              targetType: "PayoutRequest",
              targetId: String(payout.id),
              category: "payout",
              action: "payout_completed",
              metadata: {
                txHash: payout.txHash,
                confirmations: result.confirmations,
                source: "cron_verify",
              },
            },
          }),
        ]);
        completed++;
        console.log(`[VERIFY_PENDING_PAYOUTS] Payout #${payout.id} completed (${result.confirmations} confirmations)`);
      } catch (err) {
        console.error(`[VERIFY_PENDING_PAYOUTS] Failed to mark payout #${payout.id} as paid:`, err);
      }
      continue;
    }

    // rpc_error → transient, do not count attempt
    if (result.reason === "rpc_error") {
      console.warn(`[VERIFY_PENDING_PAYOUTS] RPC error for payout #${payout.id} — skipping attempt increment`);
      continue;
    }

    // All other outcomes: increment attempt counter
    const newAttempts = payout.verificationAttempts + 1;
    const reachedMax = newAttempts >= MAX_ATTEMPTS;

    const isSoftFail = result.reason === "insufficient_confirmations";

    try {
      await prisma.payoutRequest.update({
        where: { id: payout.id },
        data: {
          verificationAttempts: newAttempts,
          lastVerifyAttemptAt: now,
          ...(reachedMax ? { manualReview: true } : {}),
        },
      });

      if (!isSoftFail || reachedMax) {
        await prisma.auditLog.create({
          data: {
            actorId: null,
            targetType: "PayoutRequest",
            targetId: String(payout.id),
            category: "payout",
            action: "payout_verification_failed",
            metadata: {
              txHash: payout.txHash,
              reason: result.reason,
              attempt: newAttempts,
              manualReview: reachedMax,
            },
          },
        });
      }

      if (isSoftFail) {
        retried++;
        console.log(`[VERIFY_PENDING_PAYOUTS] Payout #${payout.id} not yet confirmed (attempt ${newAttempts}/${MAX_ATTEMPTS}, confirmations: ${result.confirmations ?? 0})`);
      } else {
        failed++;
        console.warn(`[VERIFY_PENDING_PAYOUTS] Payout #${payout.id} hard fail: ${result.reason} (attempt ${newAttempts}/${MAX_ATTEMPTS})`);
      }

      if (reachedMax) {
        manualReviewFlagged++;
        console.error(`[VERIFY_PENDING_PAYOUTS] Payout #${payout.id} flagged for manual review after ${newAttempts} attempts`);
      }
    } catch (err) {
      console.error(`[VERIFY_PENDING_PAYOUTS] Failed to update payout #${payout.id}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    processed: pending.length,
    completed,
    retried,
    failed,
    manualReviewFlagged,
  });
}
