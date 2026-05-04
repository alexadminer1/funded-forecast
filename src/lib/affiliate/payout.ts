import type { Prisma, AffiliatePaymentMethod, AffiliatePayoutStatus } from "@prisma/client";
import { PAYOUT } from "./constants";

export type BlockingReason =
  | "no_wallet"
  | "wallet_locked"
  | "active_payout_exists"
  | "balance_below_min"
  | "no_approved_conversions"
  | null;

const ACTIVE_PAYOUT_STATUSES: AffiliatePayoutStatus[] = ["requested", "approved", "processing"];

const ERC20_METHODS = new Set<AffiliatePaymentMethod>([
  "usdt_erc20" as AffiliatePaymentMethod,
  "usdc_erc20" as AffiliatePaymentMethod,
]);

/**
 * Returns minimum payout USD for the given payment method.
 * ERC20 methods (usdt_erc20, usdc_erc20): $200
 * Others (usdt_trc20, usdc_polygon): $100
 */
export function getMinPayoutForMethod(method: AffiliatePaymentMethod | null): number {
  if (!method) return PAYOUT.minUsdDefault;
  return ERC20_METHODS.has(method) ? PAYOUT.minUsdErc20 : PAYOUT.minUsdDefault;
}

/**
 * Returns the network for a given payment method.
 */
export function getNetworkForMethod(method: AffiliatePaymentMethod): string {
  switch (method) {
    case "usdt_trc20":
      return "TRC20";
    case "usdt_erc20":
    case "usdc_erc20":
      return "ERC20";
    case "usdc_polygon":
      return "Polygon";
    default:
      return "unknown";
  }
}

interface AffiliateForEligibility {
  id: number;
  status: string;
  paymentMethod: AffiliatePaymentMethod | null;
  paymentWallet: string | null;
  walletLockUntil: Date | null;
  balanceAvailable: number;
}

/**
 * Validates whether an affiliate can request a payout right now.
 * Performs DB queries via the provided client (tx or prisma) for active payout and approved conversions.
 *
 * Order of checks (first failure wins):
 *  1. paymentWallet === null              → no_wallet
 *  2. walletLockUntil > now               → wallet_locked
 *  3. active payout exists                → active_payout_exists
 *  4. balanceAvailable < min              → balance_below_min
 *  5. no approved conversions w/ payoutId=null → no_approved_conversions
 *  6. otherwise                            → null (can request)
 *
 * Note: caller MUST verify affiliate.status === 'approved' BEFORE calling this.
 */
export async function getPayoutBlockingReason(
  affiliate: AffiliateForEligibility,
  client: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma,
): Promise<{ reason: BlockingReason; minRequired: number }> {
  const minRequired = getMinPayoutForMethod(affiliate.paymentMethod);

  if (!affiliate.paymentWallet || !affiliate.paymentMethod) {
    return { reason: "no_wallet", minRequired };
  }

  if (affiliate.walletLockUntil && affiliate.walletLockUntil > new Date()) {
    return { reason: "wallet_locked", minRequired };
  }

  const activePayout = await client.affiliatePayout.findFirst({
    where: {
      affiliateId: affiliate.id,
      status: { in: ACTIVE_PAYOUT_STATUSES },
    },
    select: { id: true },
  });
  if (activePayout) {
    return { reason: "active_payout_exists", minRequired };
  }

  if (affiliate.balanceAvailable < minRequired) {
    return { reason: "balance_below_min", minRequired };
  }

  const approvedCount = await client.affiliateConversion.count({
    where: {
      affiliateId: affiliate.id,
      status: "approved",
      payoutId: null,
    },
  });
  if (approvedCount === 0) {
    return { reason: "no_approved_conversions", minRequired };
  }

  return { reason: null, minRequired };
}

/**
 * Fetches all approved conversions for affiliate ready to be included in a payout.
 * Returns IDs and total commission amount.
 *
 * IMPORTANT: caller is expected to invoke this inside a transaction together with
 * the payout creation, so that conversion.payoutId update happens atomically.
 */
export async function getAvailableConversionsForPayout(
  affiliateId: number,
  client: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma,
): Promise<{ ids: number[]; totalAmount: number }> {
  const rows = await client.affiliateConversion.findMany({
    where: {
      affiliateId,
      status: "approved",
      payoutId: null,
    },
    select: {
      id: true,
      commissionAmount: true,
    },
  });

  const ids = rows.map((r) => r.id);
  const totalAmount = rows.reduce((sum, r) => sum + r.commissionAmount, 0);

  return { ids, totalAmount };
}
