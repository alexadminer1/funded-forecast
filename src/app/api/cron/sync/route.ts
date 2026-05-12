export const dynamic = 'force-dynamic'
export const maxDuration = 60;  // P0.2.d: было 30, увеличено для 10 вызовов
import { NextRequest, NextResponse } from "next/server";

function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error(
      "[cron/sync] NEXT_PUBLIC_APP_URL env var is not set. " +
      "Cron cannot dispatch to admin endpoints without a base URL."
    );
  }
  return url;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = getBaseUrl();
    const adminKey = process.env.ADMIN_API_KEY;
    if (!adminKey) {
      throw new Error("[cron/sync] ADMIN_API_KEY env var is not set");
    }

    const LIMIT = 100;
    const MAX_OFFSET = 1000;  // safety ceiling: до top-1000 по volume24hr
    const results = [];

    // P0.2.d: paginate до пустого ответа ИЛИ до MAX_OFFSET safety ceiling
    for (let offset = 0; offset < MAX_OFFSET; offset += LIMIT) {
      const res = await fetch(`${baseUrl}/api/admin/sync-markets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ offset }),
      });
      const data = await res.json();
      results.push(data);

      // Stop early если sync-markets вернул меньше чем limit (конец feed)
      if (data.hasMore === false) {
        break;
      }
    }

    const pricesRes = await fetch(`${baseUrl}/api/admin/sync-prices`, {
      method: "POST",
      headers: { "x-admin-key": adminKey },
    });
    const pricesData = await pricesRes.json();

    const totalCreated = results.reduce((s, r) => s + (r.created ?? 0), 0);
    const totalUpdated = results.reduce((s, r) => s + (r.updated ?? 0), 0);
    const totalSkipped = results.reduce((s, r) => s + (r.skipped ?? 0), 0);

    return NextResponse.json({
      success: true,
      iterations: results.length,
      totalCreated,
      totalUpdated,
      totalSkipped,
      sync: results,
      prices: pricesData
    });
  } catch (error) {
    console.error("[cron/sync] failed:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
