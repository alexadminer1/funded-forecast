/**
 * Returns the price-change threshold for "significant" determination.
 * Threshold = max(5% of price, 2¢).
 */
export function priceChangeThreshold(price: number): number {
  return Math.max(0.05 * price, 0.02);
}

/**
 * Returns true if the price change from old to new is significant.
 * Strict greater-than comparison (boundary value is NOT significant).
 */
export function isSignificantPriceChange(oldPrice: number, newPrice: number): boolean {
  return Math.abs(newPrice - oldPrice) > priceChangeThreshold(oldPrice);
}
