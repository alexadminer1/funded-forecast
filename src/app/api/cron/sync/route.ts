export const dynamic = 'force-dynamic'
export const maxDuration = 30;
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

    const results = [];
    for (let offset = 0; offset < 300; offset += 100) {
      const res = await fetch(`${baseUrl}/api/admin/sync-markets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ offset }),
      });
      const data = await res.json();
      results.push(data);
    }

    const pricesRes = await fetch(`${baseUrl}/api/admin/sync-prices`, {
      method: "POST",
      headers: { "x-admin-key": adminKey },
    });
    const pricesData = await pricesRes.json();

    return NextResponse.json({
      success: true,
      sync: results,
      prices: pricesData
    });
  } catch (error) {
    console.error("[cron/sync] failed:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
