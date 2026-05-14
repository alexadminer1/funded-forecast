/**
 * Engine constants.
 *
 * MIN_RESOLVED_POSITIONS / MIN_UNIQUE_EVENTS — challenge pass thresholds.
 * P0.4 — position mechanics: BUY_SPREAD_TIERS, BUY_PRICE_CAP, SELL_SPREAD_PCT, MIN_POSITION_PCT.
 *
 * Per Architect (P0.4 Q1): constants live here, NOT in EngineSettings DB.
 */

export const MIN_RESOLVED_POSITIONS = 35;
export const MIN_UNIQUE_EVENTS = 30;

/**
 * Buy spread tiers indexed by raw Polymarket price (0..1).
 * A tier matches when: minPrice <= rawPrice < maxPriceExclusive.
 * Spread is applied AGAINST user: effectivePrice = rawPrice * (1 + spreadPct/100).
 * rawPrice at or above BUY_PRICE_CAP — order rejected, no tier applies.
 */
export const BUY_SPREAD_TIERS: ReadonlyArray<{
  readonly minPrice: number;
  readonly maxPriceExclusive: number;
  readonly spreadPct: number;
}> = [
  { minPrice: 0.00, maxPriceExclusive: 0.60, spreadPct: 0 },
  { minPrice: 0.60, maxPriceExclusive: 0.70, spreadPct: 2 },
  { minPrice: 0.70, maxPriceExclusive: 0.80, spreadPct: 4 },
  { minPrice: 0.80, maxPriceExclusive: 0.85, spreadPct: 7 },
];

/**
 * Maximum raw buy price (exclusive). rawPrice >= BUY_PRICE_CAP → reject.
 * Cap is checked on RAW price, not effective. Sell has no cap.
 */
export const BUY_PRICE_CAP = 0.85;

/**
 * Fixed sell spread, percent. Applied against user:
 * effectiveSellPrice = rawPrice * (1 - SELL_SPREAD_PCT/100).
 */
export const SELL_SPREAD_PCT = 4;

/**
 * Minimum position size as percent of Challenge.startBalance.
 * Enforced only in challenge mode (sandbox skips).
 * minPositionUsd = startBalance * MIN_POSITION_PCT / 100.
 */
export const MIN_POSITION_PCT = 2;
