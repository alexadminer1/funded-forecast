export const dynamic = 'force-dynamic'
export const maxDuration = 30;
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = [];
    for (let offset = 0; offset < 300; offset += 100) {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://funded-forecast.vercel.app"}/api/admin/sync-markets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": process.env.ADMIN_API_KEY! },
        body: JSON.stringify({ offset }),
      });
      const data = await res.json();
      results.push(data);
    }

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://funded-forecast.vercel.app"}/api/admin/sync-prices`, {
      method: "POST",
      headers: { "x-admin-key": process.env.ADMIN_API_KEY! },
    });

    return NextResponse.json({ success: true, sync: results });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
