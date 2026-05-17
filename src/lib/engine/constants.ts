/**
 * Engine constants.
 *
 * MIN_RESOLVED_POSITIONS / MIN_UNIQUE_EVENTS — challenge pass thresholds.
 * P0.4 — position mechanics: BUY_SPREAD_TIERS, BUY_PRICE_CAP, SELL_SPREAD_PCT.
 * Phase 2.A — pre-trade position size rules: MIN_POSITION_PCT, MAX_AGGREGATE_POSITION_PCT.
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
 * Phase 2.A — Min position size as percent of Challenge.startBalance.
 * Hard reject if trade cost (after buy spread) < startBalance × MIN_POSITION_PCT/100.
 * Applied only in challenge mode, NOT in sandbox.
 * See docs/BUSINESS_RULES.md rule #2.
 *
 * Note: value coincides with MIN_DAILY_VOLUME_PCT below (both = 2), but these
 * are distinct rules. Do not consolidate.
 */
export const MIN_POSITION_PCT = 2;

/**
 * Phase 2.A — Max aggregate position size as percent of Challenge.startBalance.
 * Hard reject if (existing_position.costBasis + new_trade.cost) > startBalance × MAX_AGGREGATE_POSITION_PCT/100.
 * Applied per (marketId, side) pair, in challenge mode only.
 * Closes the "split into small purchases" workaround for position size limits.
 * See docs/BUSINESS_RULES.md rule #3.
 */
export const MAX_AGGREGATE_POSITION_PCT = 5;

/**
 * P0.4.next — minimum daily buy volume (as percent of Challenge.startBalance)
 * required for a UTC day to qualify toward Challenge.qualifyingTradingDaysCount.
 * Counted by the daily-pnl-aggregate cron, not at trade submission time.
 * minDailyVolumeUsd = startBalance * MIN_DAILY_VOLUME_PCT / 100.
 */
export const MIN_DAILY_VOLUME_PCT = 2;

/**
 * Phase 2.B — Max daily buy volume as percent of Challenge.startBalance.
 * Hard reject if (todayBuyVolume + new_trade.cost) > startBalance × MAX_DAILY_VOLUME_PCT / 100.
 * todayBuyVolume = SUM(Trade.cost) WHERE action='buy' AND DATE(createdAt)=today UTC
 *                  scoped to the user's active challenge.
 * Applied only in challenge mode (i.e. when an active Challenge exists).
 * See docs/BUSINESS_RULES.md rule #4.
 */
export const MAX_DAILY_VOLUME_PCT = 5;
