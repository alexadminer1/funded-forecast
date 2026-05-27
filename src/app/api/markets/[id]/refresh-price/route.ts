export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { limiters } from "@/lib/ratelimit";
import { fetchMarketLivePrice } from "@/lib/polymarket";

// One-shot user-triggered live price fetch for a single market.
// Used by the market page initial load, 10s auto-refresh, and manual refresh button.
// Does NOT write the Redis cache — that is the background sync's job.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(authHeader.slice(7));
  if (!payload?.userId) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  const userId = payload.userId as number;

  const { id: marketId } = await params;
  if (!marketId) {
    return NextResponse.json({ error: "Market ID required" }, { status: 400 });
  }

  // 1 request / 5s per user per market.
  const rl = await limiters.refresh.limit(`${userId}:${marketId}`);
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Please wait before refreshing again" },
      { status: 429, headers: { "Retry-After": Math.ceil((rl.reset - Date.now()) / 1000).toString() } },
    );
  }

  const prices = await fetchMarketLivePrice(marketId, 3000);
  if (!prices) {
    return NextResponse.json(
      { success: false, error: "Market temporarily unavailable", retryAfter: 20 },
      { status: 503 },
    );
  }

  return NextResponse.json({
    success: true,
    yesPrice: prices.yesPrice,
    noPrice: prices.noPrice,
    updatedAt: Date.now(),
  });
}
