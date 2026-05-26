import {
  BUY_SPREAD_TIERS,
  BUY_PRICE_CAP,
  SELL_SPREAD_PCT,
} from "./constants";

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Apply buy spread to raw Polymarket price.
 * Caller MUST verify checkBuyCap(rawPrice) === true first.
 * Throws if no tier matches (i.e., rawPrice >= BUY_PRICE_CAP).
 */
export function applyBuySpread(
  rawPrice: number,
): { effectivePrice: number; spreadPct: number } {
  for (const tier of BUY_SPREAD_TIERS) {
    if (rawPrice >= tier.minPrice && rawPrice < tier.maxPriceExclusive) {
      const effectivePrice = round6(rawPrice * (1 + tier.spreadPct / 100));
      return { effectivePrice, spreadPct: tier.spreadPct };
    }
  }
  throw new Error(
    `No buy spread tier matches rawPrice ${rawPrice}. checkBuyCap must be called first.`,
  );
}

/**
 * Apply flat sell spread to raw Polymarket price. No cap on sell.
 */
export function applySellSpread(
  rawPrice: number,
): { effectivePrice: number; spreadPct: number } {
  const effectivePrice = round6(rawPrice * (1 - SELL_SPREAD_PCT / 100));
  return { effectivePrice, spreadPct: SELL_SPREAD_PCT };
}

/** Returns true if rawPrice is allowed for buy (< BUY_PRICE_CAP). */
export function checkBuyCap(rawPrice: number): boolean {
  return rawPrice < BUY_PRICE_CAP;
}
