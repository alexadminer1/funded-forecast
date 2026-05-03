import { AffiliatePaymentMethod } from "@prisma/client";

export const SUPPORTED_METHODS = Object.values(AffiliatePaymentMethod) as string[];

export function isWalletLocked(walletLockUntil: Date | null): boolean {
  if (!walletLockUntil) return false;
  return walletLockUntil > new Date();
}

export function validateWalletAddress(
  method: AffiliatePaymentMethod,
  address: string,
): { ok: boolean; error?: string } {
  switch (method) {
    case AffiliatePaymentMethod.usdt_trc20:
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)
        ? { ok: true }
        : { ok: false, error: "invalid_tron_address" };
    case AffiliatePaymentMethod.usdt_erc20:
    case AffiliatePaymentMethod.usdc_erc20:
    case AffiliatePaymentMethod.usdc_polygon:
      return /^0x[a-fA-F0-9]{40}$/.test(address)
        ? { ok: true }
        : { ok: false, error: "invalid_evm_address" };
    default:
      return { ok: false, error: "unsupported_method" };
  }
}

export function maskWallet(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}
