/**
 * BigInt USDC amount math + free-amount search.
 *
 * USDC has 6 decimals: 1 USDC = 1_000_000 base units (smallest indivisible unit).
 * All on-chain math uses BigInt to avoid float precision loss.
 *
 * Conventions:
 *   "cents" = USD * 100 (integer, e.g. 39.97 USD = 3997 cents). From ChallengePlan.priceCents.
 *   "units" = USDC base units (BigInt). 1 cent of USDC = 10^(decimals-2) units.
 */

/**
 * Convert USD cents to USDC base units (BigInt).
 *
 * Example: cents=3997, decimals=6 → 39_970_000n
 *
 * Math: units = cents * 10^(decimals - 2)
 * Throws if decimals < 2 (USD has 2 fractional digits, can't represent cents).
 */
export function centsToUnits(cents: number, decimals: number): bigint {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`centsToUnits: cents must be non-negative integer, got ${cents}`);
  }
  if (!Number.isInteger(decimals) || decimals < 2) {
    throw new Error(`centsToUnits: decimals must be integer >= 2, got ${decimals}`);
  }
  const multiplier = 10n ** BigInt(decimals - 2);
  return BigInt(cents) * multiplier;
}

/**
 * Convert USDC base units (BigInt) to USD cents (number).
 *
 * Example: units=39_970_000n, decimals=6 → 3997
 *
 * Throws if conversion has fractional remainder (units is not a whole-cent amount).
 * Rationale: payment amounts must be representable in cents for accounting.
 */
export function unitsToCents(units: bigint, decimals: number): number {
  if (units < 0n) {
    throw new Error(`unitsToCents: units must be non-negative, got ${units}`);
  }
  if (!Number.isInteger(decimals) || decimals < 2) {
    throw new Error(`unitsToCents: decimals must be integer >= 2, got ${decimals}`);
  }
  const divisor = 10n ** BigInt(decimals - 2);
  if (units % divisor !== 0n) {
    throw new Error(
      `unitsToCents: units=${units} is not whole-cent at decimals=${decimals}`
    );
  }
  const cents = units / divisor;
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`unitsToCents: result ${cents} exceeds MAX_SAFE_INTEGER`);
  }
  return Number(cents);
}

/**
 * Format USDC base units as a human-readable USD string.
 *
 * Example: units=39_970_000n, decimals=6 → "39.97"
 *
 * Always returns 2 decimal places (USD convention).
 */
export function unitsToUsdString(units: bigint, decimals: number): string {
  const cents = unitsToCents(units, decimals);
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  return `${dollars}.${remainder.toString().padStart(2, "0")}`;
}

/**
 * Find a free USDC amount within ±offsetCents of target, avoiding occupied amounts.
 *
 * Search order: target, target-1, target+1, target-2, target+2, ... up to ±offsetCents.
 * This biases toward the exact plan price when possible (better UX).
 *
 * Returns null if all 2*offsetCents+1 candidates are occupied.
 *
 * @param targetCents - desired amount in cents (e.g. 3999 for $39.99 plan)
 * @param offsetCents - max deviation from target in cents (e.g. 50 = ±$0.50)
 * @param decimals - token decimals (6 for USDC)
 * @param occupied - Set of BigInt unit values already taken by active payments
 * @returns { cents, units } of first free amount, or null if none free
 */
export function findFreeAmount(
  targetCents: number,
  offsetCents: number,
  decimals: number,
  occupied: Set<bigint>
): { cents: number; units: bigint } | null {
  if (!Number.isInteger(targetCents) || targetCents <= 0) {
    throw new Error(`findFreeAmount: targetCents must be positive integer, got ${targetCents}`);
  }
  if (!Number.isInteger(offsetCents) || offsetCents < 0) {
    throw new Error(`findFreeAmount: offsetCents must be non-negative integer, got ${offsetCents}`);
  }

  // Candidate order: 0, -1, +1, -2, +2, ..., -offsetCents, +offsetCents
  for (let delta = 0; delta <= offsetCents; delta++) {
    const candidates: number[] = delta === 0 ? [targetCents] : [targetCents - delta, targetCents + delta];
    for (const candidateCents of candidates) {
      if (candidateCents <= 0) continue; // skip non-positive (e.g. target=10 cents, offset=50)
      const units = centsToUnits(candidateCents, decimals);
      if (!occupied.has(units)) {
        return { cents: candidateCents, units };
      }
    }
  }
  return null;
}
