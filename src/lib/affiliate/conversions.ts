import { prisma } from "@/lib/prisma";
import {
  Prisma,
  AffiliateConversionStatus,
  AffiliateLedgerType,
  AffiliateLedgerBucket,
} from "@prisma/client";
import { writeLedgerEntries } from "./ledger";
import { getTierRate, getHoldDays, calculateCommission } from "./constants";

const SUCCESSFUL_STATUSES = ["confirmed", "finished"] as const;

export async function recordAffiliateConversionFromPayment(paymentId: number): Promise<{
  created:      boolean;
  reason:       string;
  conversionId?: number;
}> {
  // 1. Load Payment
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { created: false, reason: "payment_not_found" };

  // 1.5 Guard: AffiliateConversion.planId is NOT NULL — skip silently if no plan.
  // Extract to local const so TypeScript narrowing survives across async closures.
  const planId = payment.planId;
  if (planId === null) return { created: false, reason: "no_plan_id" };

  // 2. Status must be successful
  if (!(SUCCESSFUL_STATUSES as readonly string[]).includes(payment.status)) {
    return { created: false, reason: "payment_not_successful" };
  }

  // 3. Idempotency — paymentId is @unique on AffiliateConversion
  const existing = await prisma.affiliateConversion.findUnique({
    where:  { paymentId },
    select: { id: true },
  });
  if (existing) return { created: false, reason: "already_exists", conversionId: existing.id };

  // 4. Load User
  const user = await prisma.user.findUnique({
    where:  { id: payment.userId },
    select: { id: true },
  });
  if (!user) return { created: false, reason: "user_not_found" };

  // 5. First-purchase rule — count prior successful payments (exclude current, only earlier)
  const priorCount = await prisma.payment.count({
    where: {
      userId:    payment.userId,
      id:        { not: payment.id },
      status:    { in: [...SUCCESSFUL_STATUSES] },
      createdAt: { lt: payment.createdAt },
    },
  });
  if (priorCount > 0) return { created: false, reason: "not_first_purchase" };

  // 6. Last-click attribution
  const click = await prisma.affiliateClick.findFirst({
    where: {
      convertedToUserId: payment.userId,
      expiresAt:         { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    include: {
      affiliate: {
        select: {
          id:                   true,
          userId:               true,
          status:               true,
          tier:                 true,
          customCommissionRate: true,
          suspiciousFlag:       true,
          isVerified:           true,
        },
      },
    },
  });
  if (!click) return { created: false, reason: "no_attribution" };

  // 7. Validate affiliate
  if (click.affiliate.status !== "approved") {
    return { created: false, reason: "affiliate_not_approved" };
  }
  if (click.affiliate.userId === payment.userId) {
    return { created: false, reason: "self_referral" };
  }

  // 8. Calculate amounts
  const netAmount        = payment.amount;
  const rate             = getTierRate(click.affiliate);
  const commissionAmount = calculateCommission(netAmount, rate);
  const holdDays         = getHoldDays(click.affiliate);
  const pendingUntil     = new Date();
  pendingUntil.setDate(pendingUntil.getDate() + holdDays);
  const now = new Date();

  // 9. Atomic transaction: conversion row + ledger entry
  try {
    const conversion = await prisma.$transaction(async (tx) => {
      // 9a. Create AffiliateConversion
      const conv = await tx.affiliateConversion.create({
        data: {
          affiliateId:             click.affiliate.id,
          referredUserId:          payment.userId,
          paymentId,
          planId,
          clickId:                 click.id,
          grossAmount:             payment.amount,
          discountAmount:          0,
          processorFeeAmount:      0,
          netAmount,
          commissionRate:          rate,
          commissionAmount,
          status:                  AffiliateConversionStatus.pending,
          pendingUntil,
          paymentStatusAtCreation: payment.status,
          lastStatusChangeAt:      now,
        },
      });

      // 9b. Write ledger entry inside the same transaction
      await writeLedgerEntries(
        click.affiliate.id,
        [
          {
            type:         AffiliateLedgerType.commission_pending,
            bucket:       AffiliateLedgerBucket.pending,
            amount:       commissionAmount,
            conversionId: conv.id,
            reason:       "first_purchase_commission",
          },
        ],
        tx,
      );

      return conv;
    });

    return { created: true, reason: "ok", conversionId: conversion.id };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { created: false, reason: "already_exists" };
    }
    console.error("[AFFILIATE_CONVERSION] failed", err);
    throw err;
  }
}
