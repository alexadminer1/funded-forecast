export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchActiveMarkets, parseYesPrice, parseNoPrice, inferCategory } from "@/lib/polymarket";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");

  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const markets = await fetchActiveMarkets(50);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const m of markets) {
      // Filter out invalid markets
      if (m.closed || !m.active || !m.conditionId || !m.endDateIso) {
        skipped++;
        continue;
      }

      const yesPrice = parseYesPrice(m);
      const noPrice = parseNoPrice(m);

      // Skip if prices are invalid
      if (yesPrice <= 0 || yesPrice >= 1 || noPrice <= 0 || noPrice >= 1) {
        skipped++;
        continue;
      }

      const category = inferCategory(m);
      const endDate = new Date(m.endDateIso);

      // Skip if already ended
      if (endDate < new Date()) {
        skipped++;
        continue;
      }

      const existing = await prisma.market.findUnique({
        where: { id: m.id },
      });

      if (existing) {
        await prisma.market.update({
          where: { id: m.id },
          data: {
            yesPrice,
            noPrice,
            volume24h: m.volume24hr ?? 0,
            status: "live",
            lastSyncedAt: new Date(),
          },
        });
        updated++;
      } else {
        await prisma.market.create({
          data: {
            id: m.id,
            conditionId: m.conditionId,
            slug: m.slug,
            title: m.question,
            description: m.description ?? null,
            category,
            imageUrl: m.image ?? null,
            yesPrice,
            noPrice,
            volume24h: m.volume24hr ?? 0,
            endDate,
            status: "live",
            negRisk: m.negRisk ?? false,
            isRestricted: m.restricted ?? false,
            lastSyncedAt: new Date(),
          },
        });
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      total: markets.length,
      created,
      updated,
      skipped,
    });

  } catch (error) {
    console.error("[SYNC] Error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
