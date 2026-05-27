import { Redis } from "@upstash/redis";

// Live Polymarket price cache + per-user/market trade cooldown.
// Reuses the same Upstash instance as rate limiting (disjoint key prefixes).
//   live:prices                      → hash, field per marketId → {yesPrice,noPrice,updatedAt}, whole-hash TTL 15s
//   live:cooldown:{userId}:{marketId}→ 20s fail-closed cooldown after a failed live fetch on the trade path
//   live:lock                        → background-sync overlap lock (set/read by the cron route)
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const PRICES_KEY = "live:prices";
const PRICES_TTL_SECONDS = 15;
const COOLDOWN_SECONDS = 20;

export interface LivePrice {
  yesPrice: number;
  noPrice: number;
  updatedAt: number;
}

// marketId is the gamma market id (Market.id is a String in the schema), so keys are strings.
export async function getLivePrice(marketId: string): Promise<LivePrice | null> {
  const raw = await redis.hget<LivePrice | string>(PRICES_KEY, marketId);
  if (raw == null) return null;
  const parsed = typeof raw === "string" ? (JSON.parse(raw) as LivePrice) : raw;
  if (typeof parsed?.yesPrice !== "number" || typeof parsed?.noPrice !== "number") return null;
  return parsed;
}

export async function setLivePrices(
  prices: Map<string, { yesPrice: number; noPrice: number }>,
): Promise<void> {
  if (prices.size === 0) return;
  const updatedAt = Date.now();
  const fields: Record<string, string> = {};
  for (const [marketId, p] of prices) {
    fields[marketId] = JSON.stringify({ yesPrice: p.yesPrice, noPrice: p.noPrice, updatedAt });
  }
  // One HSET command for all fields + refresh whole-hash TTL each tick.
  await redis.hset(PRICES_KEY, fields);
  await redis.expire(PRICES_KEY, PRICES_TTL_SECONDS);
}

export async function setTradeCooldown(userId: number, marketId: string): Promise<void> {
  await redis.set(`live:cooldown:${userId}:${marketId}`, 1, { ex: COOLDOWN_SECONDS });
}

// Returns remaining cooldown seconds if active, else null.
export async function getTradeCooldown(userId: number, marketId: string): Promise<number | null> {
  const ttl = await redis.ttl(`live:cooldown:${userId}:${marketId}`);
  return typeof ttl === "number" && ttl > 0 ? ttl : null;
}
