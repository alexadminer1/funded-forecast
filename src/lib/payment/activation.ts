import { prisma } from "@/lib/prisma";
import { PaymentStatus, Prisma } from "@prisma/client";
import { recordAffiliateConversionFromPayment } from "@/lib/affiliate/conversions";

const MAX_ACTIVATION_ATTEMPTS = 3;

type ActivationResult =
  | { activated: true; challengeId: number; attempts: number }
  | { activated: false; reason: string; attempts: number };

/**
 * Advisory lock helper — same pattern as create/route.ts.
 * Hashes paymentId to bigint for pg_advisory_xact_lock.
 */
function paymentLockKey(paymentId: string): bigint {
  // FNV-1a 64-bit hash → fits in BIGINT signed
  let hash = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;
  const MASK = 0xffffffffffffffffn;
  for (let i = 0; i < paymentId.length; i++) {
    hash ^= BigInt(paymentId.charCodeAt(i));
    hash = (hash * FNV_PRIME) & MASK;
  }
  // Convert to signed BIGINT range
  if (hash >= 0x8000000000000000n) {
    hash -= 0x10000000000000000n;
  }
  return hash;
}

/**
 * Persist activation_attempts increment in a SEPARATE transaction
 * so that errors inside the main transaction don't lose the counter.
 */
async function bumpAttempts(
  paymentId: string,
  attempts: number,
  lastError: string | null,
  newStatus: PaymentStatus | null,
): Promise<void> {
  const existing = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { metadata: true },
  });
  const meta = (existing?.metadata as Record<string, unknown> | null) ?? {};
  const updatedMeta: Record<string, unknown> = {
    ...meta,
    activation_attempts: attempts,
  };
  if (lastError !== null) {
    updatedMeta.activation_last_error = lastError;
    updatedMeta.activation_last_error_at = new Date().toISOString();
  }
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      metadata: updatedMeta as Prisma.InputJsonValue,
      ...(newStatus ? { status: newStatus } : {}),
    },
  });
}

/**
 * Activate a CONFIRMED Payment:
 *   1. Create Challenge from Payment.plan
 *   2. Link Payment.challengeId → new challenge
 *   3. Record affiliate conversion (fire-and-forget)
 *
 * Idempotent: safe to call multiple times.
 * Retry-limited: after MAX_ACTIVATION_ATTEMPTS failures → status=MANUAL_REVIEW.
 */
export async function activatePayment(paymentId: string): Promise<ActivationResult> {
  // Pre-load to read current attempts (outside lock to keep tx short)
  const pre = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { metadata: true, status: true, challengeId: true },
  });
  if (!pre) {
    return { activated: false, reason: "payment_not_found", attempts: 0 };
  }
  if (pre.status !== PaymentStatus.CONFIRMED) {
    return { activated: false, reason: "payment_not_confirmed", attempts: 0 };
  }
  if (pre.challengeId !== null) {
    return { activated: false, reason: "already_activated", attempts: 0 };
  }

  const preMeta = (pre.metadata as Record<string, unknown> | null) ?? {};
  const prevAttempts = typeof preMeta.activation_attempts === "number" ? preMeta.activation_attempts : 0;
  const newAttempts = prevAttempts + 1;

  if (newAttempts > MAX_ACTIVATION_ATTEMPTS) {
    await bumpAttempts(paymentId, prevAttempts, "max_retries_exceeded", PaymentStatus.MANUAL_REVIEW);
    return { activated: false, reason: "max_retries_exceeded", attempts: prevAttempts };
  }

  let challengeId: number | null = null;

  try {
    challengeId = await prisma.$transaction(async (tx) => {
      // Advisory lock — serialize concurrent activations of the same payment
      const lockKey = paymentLockKey(paymentId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;

      // Re-read inside transaction
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { plan: true },
      });
      if (!payment) throw new Error("payment_disappeared");
      if (payment.status !== PaymentStatus.CONFIRMED) throw new Error("status_changed_under_lock");
      if (payment.challengeId !== null) {
        // Race: another worker already activated. Return existing.
        return payment.challengeId;
      }
      if (payment.planId === null) throw new Error("payment_has_no_plan");
      if (!payment.plan) throw new Error("plan_not_found");

      const plan = payment.plan;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + plan.challengePeriodDays * 24 * 60 * 60 * 1000);

      const challenge = await tx.challenge.create({
        data: {
          userId: payment.userId,
          planId: plan.id,
          stage: "evaluation",
          status: "active",
          startBalance: plan.accountSize,
          realizedBalance: plan.accountSize,
          peakBalance: plan.accountSize,
          profitTargetPct: plan.profitTargetPct,
          maxDailyDdPct: plan.dailyLossPct,
          maxTotalDdPct: plan.maxLossPct,
          maxPositionSizePct: plan.maxPositionSizePct,
          minTradingDays: plan.minTradingDays,
          profitSharePct: plan.profitSharePct,
          payoutCooldownDays: plan.payoutCooldownDays,
          minPayoutCents: plan.minPayoutCents,
          refundableFeeCents: plan.refundableFeeCents,
          payoutCapCents: plan.maxPayoutCapCents > 0 ? plan.maxPayoutCapCents : null,
          expiresAt,
          startedAt: now,
        },
      });

      const updatedMeta: Record<string, unknown> = {
        ...preMeta,
        activation_attempts: newAttempts,
        activated_at: now.toISOString(),
        activated_challenge_id: challenge.id,
      };

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          challengeId: challenge.id,
          metadata: updatedMeta as Prisma.InputJsonValue,
        },
      });

      return challenge.id;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const flipToManual = newAttempts >= MAX_ACTIVATION_ATTEMPTS;
    await bumpAttempts(
      paymentId,
      newAttempts,
      message,
      flipToManual ? PaymentStatus.MANUAL_REVIEW : null,
    );
    console.error(`[ACTIVATION] failed attempt ${newAttempts}/${MAX_ACTIVATION_ATTEMPTS} for ${paymentId}:`, err);
    return { activated: false, reason: message, attempts: newAttempts };
  }

  // Affiliate conversion — fire-and-forget outside the main transaction.
  // A failure here must NOT roll back the challenge creation.
  try {
    await recordAffiliateConversionFromPayment(paymentId);
  } catch (err) {
    console.error("[ACTIVATION] affiliate conversion failed (non-fatal):", err);
  }

  return { activated: true, challengeId: challengeId!, attempts: newAttempts };
}
