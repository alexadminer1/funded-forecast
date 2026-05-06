/**
 * Payment input validators.
 *
 * Used by /api/payments/create and other payment routes to validate
 * untrusted input from API clients.
 */

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Validate Ethereum-format address (case-insensitive hex, no checksum check).
 *
 * Note: We do NOT enforce EIP-55 checksum here — receiver addresses come from
 * env vars set by ops, not user input. Checksum validation would reject
 * lowercase addresses, which are still valid.
 */
export function isValidEthAddress(addr: unknown): addr is string {
  return typeof addr === "string" && ETH_ADDRESS_REGEX.test(addr);
}

/**
 * Parse and validate planId from request body.
 *
 * Accepts: positive integer.
 * Rejects: non-number, non-integer, zero, negative, NaN, Infinity.
 *
 * Returns parsed integer or null if invalid.
 */
export function parsePlanId(raw: unknown): number | null {
  if (typeof raw !== "number") return null;
  if (!Number.isFinite(raw)) return null;
  if (!Number.isInteger(raw)) return null;
  if (raw <= 0) return null;
  if (raw > Number.MAX_SAFE_INTEGER) return null;
  return raw;
}

/**
 * Parse and validate paymentId from URL params.
 *
 * Accepts: cuid string (24 chars, lowercase alphanumeric, starts with 'c').
 * Cuid format: c + 24 chars total. We allow [c-z][a-z0-9]{23,30} for safety
 * (cuid2 has variable length, original cuid has 25 chars).
 *
 * Returns the validated string or null if invalid.
 */
export function parsePaymentId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length < 20 || raw.length > 40) return null;
  if (!/^[a-z0-9]+$/.test(raw)) return null;
  return raw;
}
