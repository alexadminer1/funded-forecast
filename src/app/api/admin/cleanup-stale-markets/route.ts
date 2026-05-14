export const dynamic = 'force-dynamic'
export const maxDuration = 120;
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchMarketById, getWinningOutcome } from "@/lib/polymarket";
import { resolveMarketPositions } from "@/lib/marketResolve";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 200;
const STALE_HOURS = 24;

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const staleMarkets = await prisma.market.findMany({
      where: {
        status: "live",
        lastSyncedAt: { lt: new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000) },
      },
      select: { id: true, title: true, yesPrice: true, noPrice: true },
    });

    let resolved = 0;
    let disputed = 0;
    let stillActive = 0;
    let errors = 0;
    let totalPositionsProcessed = 0;
    const resolvedIds: string[] = [];
    const disputedIds: string[] = [];

    for (let i = 0; i < staleMarkets.length; i += BATCH_SIZE) {
      const batch = staleMarkets.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (m) => {
        try {
          const polyMarket = await fetchMarketById(m.id);
          if (!polyMarket) {
            errors++;
            return;
          }

          if (!polyMarket.closed) {
            stillActive++;
            return;
          }

          const winner = getWinningOutcome(polyMarket);
          if (!winner) {
            disputed++;
            disputedIds.push(m.id);
            return;
          }

          await prisma.market.update({
            where: { id: m.id },
            data: {
              status: "resolved",
              winningOutcome: winner,
              resolvedExternalAt: new Date(),
              lastSyncedAt: new Date(),
            },
          });

          // m.yesPrice / m.noPrice — last-synced live values from staleMarkets findMany
          // (the update above writes status only, doesn't touch the price snapshot).
          const result = await resolveMarketPositions(m.id, winner, m.yesPrice, m.noPrice);
          totalPositionsProcessed += result.positionsProcessed;
          resolved++;
          resolvedIds.push(m.id);
        } catch (err) {
          console.error(`[CLEANUP] Market ${m.id} failed:`, err);
          errors++;
        }
      }));

      if (i + BATCH_SIZE < staleMarkets.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    return NextResponse.json({
      success: true,
      checked: staleMarkets.length,
      resolved,
      disputed,
      stillActive,
      errors,
      totalPositionsProcessed,
      resolvedIds: resolvedIds.slice(0, 20),
      disputedIds: disputedIds.slice(0, 20),
    });
  } catch (error) {
    console.error("[CLEANUP] Top-level failure:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
