export const dynamic = 'force-dynamic'
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchActiveMarkets, parseYesPrice, parseNoPrice, inferCategory } from "@/lib/polymarket";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));
    const offset = parseInt(body.offset ?? 0);
    const limit = 30;
    const markets = await fetchActiveMarkets(limit, offset);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const m of markets) {
      if (m.closed || !m.active || !m.conditionId || !m.endDateIso) { skipped++; continue; }
      const yesPrice = parseYesPrice(m);
      const noPrice = parseNoPrice(m);
      if (yesPrice <= 0 || yesPrice >= 1 || noPrice <= 0 || noPrice >= 1) { skipped++; continue; }
      const endDate = new Date(m.endDateIso);
      if (endDate < new Date()) { skipped++; continue; }
      const category = inferCategory(m);
      try {
        const existing = await prisma.market.findUnique({ where: { id: m.id } });
        if (existing) {
          await prisma.market.update({
            where: { id: m.id },
            data: { yesPrice, noPrice, volume24h: m.volume24hr ?? 0, lastSyncedAt: new Date(), status: "live" },
          });
          updated++;
        } else {
          await prisma.market.create({
            data: {
              id: m.id, conditionId: m.conditionId, slug: m.slug,
              title: m.question || m.events?.[0]?.title || "Unknown",
              description: m.description ?? null,
              category, imageUrl: m.image ?? null,
              yesPrice, noPrice,
              volume24h: m.volume24hr ?? 0,
              endDate, status: "live",
              negRisk: m.negRisk ?? false,
              isRestricted: m.restricted ?? false,
              lastSyncedAt: new Date(),
            },
          });
          created++;
        }
      } catch { skipped++; }
    }
    return NextResponse.json({ success: true, total: markets.length, created, updated, skipped, offset, nextOffset: offset + limit });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
