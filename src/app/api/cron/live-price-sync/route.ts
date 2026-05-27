export const dynamic = "force-dynamic";
export const maxDuration = 70;

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { fetchMarketLivePrice } from "@/lib/polymarket";
import { redis, setLivePrices } from "@/lib/livePrice";

const LOCK_KEY = "live:lock";
const TICKS = 6;
const TICK_INTERVAL_MS = 10_000;
const FETCH_CONCURRENCY = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchAllPrices(marketIds: string[]): Promise<Map<string, { yesPrice: number; noPrice: number }>> {
  const out = new Map<string, { yesPrice: number; noPrice: number }>();
  for (let i = 0; i < marketIds.length; i += FETCH_CONCURRENCY) {
    const chunk = marketIds.slice(i, i + FETCH_CONCURRENCY);
    const results = await Promise.all(chunk.map((id) => fetchMarketLivePrice(id, 3000)));
    chunk.forEach((id, idx) => {
      const p = results[idx];
      if (p) out.set(id, p);
    });
  }
  return out;
}

// Background sync of Polymarket prices for markets with open positions.
// Coolify fires this every minute (`* * * * *`); it runs 6 internal ticks
// (10s apart) for ~10s freshness, guarded by a Redis lock against overlap.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lockToken = randomUUID();
  const acquired = await redis.set(LOCK_KEY, lockToken, { nx: true, ex: 70 });
  if (acquired !== "OK") {
    return NextResponse.json({ success: false, reason: "locked" });
  }

  let totalMarketsSynced = 0;
  try {
    for (let tick = 1; tick <= TICKS; tick++) {
      const rows = await prisma.position.findMany({
        where: { status: "open" },
        distinct: ["marketId"],
        select: { marketId: true },
      });
      const marketIds = rows.map((r) => r.marketId);

      if (marketIds.length === 0) {
        console.log(`[live-price-sync] tick ${tick}: no open-position markets`);
      } else {
        const prices = await fetchAllPrices(marketIds);
        await setLivePrices(prices);
        totalMarketsSynced += prices.size;
        console.log(
          `[live-price-sync] tick ${tick}: fetched ${prices.size} markets, ${marketIds.length - prices.size} failed`,
        );
      }

      if (tick < TICKS) await sleep(TICK_INTERVAL_MS);
    }
    return NextResponse.json({ success: true, ticks: TICKS, totalMarketsSynced });
  } catch (error) {
    console.error("[live-price-sync] failed:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  } finally {
    // Release the lock only if we still own it, so the next minute's run can
    // start immediately (the 70s ex is just a safety net if the process dies).
    const current = await redis.get(LOCK_KEY);
    if (current === lockToken) await redis.del(LOCK_KEY);
  }
}
