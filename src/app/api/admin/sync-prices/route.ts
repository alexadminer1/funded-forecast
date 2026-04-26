export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchActiveMarkets, parseYesPrice, parseNoPrice } from "@/lib/polymarket";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");

  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const markets = await fetchActiveMarkets(100);

    // Get existing IDs in one query
    const existingMarkets = await prisma.market.findMany({
      where: { status: "live" },
      select: { id: true },
    });

    const existingIds = new Set(existingMarkets.map((m) => m.id));

    // Filter and validate in memory
    const validUpdates = markets
      .filter((m) => existingIds.has(m.id))
      .map((m) => ({
        id: m.id,
        yesPrice: parseYesPrice(m),
        noPrice: parseNoPrice(m),
        volume24h: m.volume24hr ?? 0,
      }))
      .filter(
        (m) =>
          m.yesPrice > 0 &&
          m.yesPrice < 1 &&
          m.noPrice > 0 &&
          m.noPrice < 1
      );

    if (validUpdates.length === 0) {
      return NextResponse.json({ success: true, updated: 0, skipped: markets.length });
    }

    // Batch update via raw SQL — single query for all markets
    const now = new Date().toISOString();

    const ids = validUpdates.map((m) => m.id);
    const yesPrices = validUpdates.map((m) => m.yesPrice);
    const noPrices = validUpdates.map((m) => m.noPrice);
    const volumes = validUpdates.map((m) => m.volume24h);

    await prisma.$executeRawUnsafe(`
      UPDATE "Market" AS m
      SET
        "yesPrice"     = v."yesPrice",
        "noPrice"      = v."noPrice",
        "volume24h"    = v."volume24h",
        "lastSyncedAt" = '${now}'
      FROM (
        SELECT
          unnest($1::text[])    AS id,
          unnest($2::float8[])  AS "yesPrice",
          unnest($3::float8[])  AS "noPrice",
          unnest($4::float8[])  AS "volume24h"
      ) AS v
      WHERE m.id = v.id
    `, ids, yesPrices, noPrices, volumes);

    return NextResponse.json({
      success: true,
      updated: validUpdates.length,
      skipped: markets.length - validUpdates.length,
      total: markets.length,
    });

  } catch (error) {
    console.error("[SYNC-PRICES]", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
