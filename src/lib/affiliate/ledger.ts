import { prisma } from "@/lib/prisma";
import { Prisma, AffiliateLedgerType, AffiliateLedgerBucket } from "@prisma/client";
import crypto from "crypto";
import { EPSILON } from "./constants";

export type LedgerOperation = {
  type:            AffiliateLedgerType;
  bucket:          AffiliateLedgerBucket;
  amount:          number;
  conversionId?:   number;
  payoutId?:       number;
  reason?:         string;
  createdByAdmin?: string;
};

function bucketToBalanceField(
  bucket: AffiliateLedgerBucket,
): "balancePending" | "balanceAvailable" | "balanceFrozen" | "balanceNegative" {
  switch (bucket) {
    case "pending":   return "balancePending";
    case "available": return "balanceAvailable";
    case "frozen":    return "balanceFrozen";
    case "negative":  return "balanceNegative";
  }
}

export async function writeLedgerEntries(
  affiliateId: number,
  operations: LedgerOperation[],
  tx?: Prisma.TransactionClient,
): Promise<{ operationGroupId: string }> {
  const operationGroupId = crypto.randomUUID();

  const run = async (client: Prisma.TransactionClient): Promise<void> => {
    const affiliate = await client.affiliate.findUniqueOrThrow({
      where:  { id: affiliateId },
      select: {
        balancePending:   true,
        balanceAvailable: true,
        balanceFrozen:    true,
        balanceNegative:  true,
      },
    });

    const balances = {
      pending:   affiliate.balancePending,
      available: affiliate.balanceAvailable,
      frozen:    affiliate.balanceFrozen,
      negative:  affiliate.balanceNegative,
    };

    for (const op of operations) {
      const field     = bucketToBalanceField(op.bucket);
      const bucketKey = op.bucket as keyof typeof balances;

      balances[bucketKey] = Math.round((balances[bucketKey] + op.amount) * 100) / 100;

      await client.affiliateLedger.create({
        data: {
          affiliateId,
          type:            op.type,
          bucket:          op.bucket,
          amount:          op.amount,
          balanceAfter:    balances[bucketKey],
          operationGroupId,
          conversionId:    op.conversionId ?? null,
          payoutId:        op.payoutId ?? null,
          reason:          op.reason ?? null,
          createdByAdmin:  op.createdByAdmin ?? null,
        },
      });

      await client.affiliate.update({
        where: { id: affiliateId },
        data:  { [field]: balances[bucketKey] },
      });
    }
  };

  try {
    if (tx) {
      await run(tx);
    } else {
      await prisma.$transaction(run);
    }
  } catch (err) {
    console.error("[AFFILIATE_LEDGER] writeLedgerEntries failed", err);
    throw err;
  }

  return { operationGroupId };
}

export async function getCachedBalances(affiliateId: number): Promise<{
  pending:   number;
  available: number;
  frozen:    number;
  negative:  number;
}> {
  const affiliate = await prisma.affiliate.findUniqueOrThrow({
    where:  { id: affiliateId },
    select: {
      balancePending:   true,
      balanceAvailable: true,
      balanceFrozen:    true,
      balanceNegative:  true,
    },
  });

  return {
    pending:   affiliate.balancePending,
    available: affiliate.balanceAvailable,
    frozen:    affiliate.balanceFrozen,
    negative:  affiliate.balanceNegative,
  };
}

export async function computeBalanceFromLedger(
  affiliateId: number,
  bucket: AffiliateLedgerBucket,
): Promise<number> {
  const result = await prisma.affiliateLedger.aggregate({
    where: { affiliateId, bucket },
    _sum:  { amount: true },
  });

  return Math.round((result._sum.amount ?? 0) * 100) / 100;
}

export async function reconcileAffiliate(affiliateId: number): Promise<{
  mismatches: Array<{ bucket: string; cached: number; computed: number; diff: number }>;
}> {
  const buckets: AffiliateLedgerBucket[] = ["pending", "available", "frozen", "negative"];

  const cached     = await getCachedBalances(affiliateId);
  const mismatches: Array<{ bucket: string; cached: number; computed: number; diff: number }> = [];

  for (const bucket of buckets) {
    const computed  = await computeBalanceFromLedger(affiliateId, bucket);
    const cachedVal = cached[bucket as keyof typeof cached];
    const diff      = Math.round(Math.abs(cachedVal - computed) * 100) / 100;

    if (diff > EPSILON) {
      mismatches.push({ bucket, cached: cachedVal, computed, diff });
    }
  }

  return { mismatches };
}
