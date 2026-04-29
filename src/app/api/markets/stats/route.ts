export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CATEGORY_MAP: Record<string, string> = {
  crypto: "crypto", cryptocurrency: "crypto", bitcoin: "crypto", ethereum: "crypto",
  politics: "politics", election: "politics", government: "politics",
  sports: "sports", sport: "sports", football: "sports", basketball: "sports",
  tech: "tech", technology: "tech", ai: "tech", science: "tech",
};

function normalizeCategory(cat: string): string {
  const lower = (cat ?? "").toLowerCase();
  return CATEGORY_MAP[lower] ?? "other";
}

export async function GET() {
  try {
    const where = {
      status: "live",
      yesPrice: { gte: 0.02, lte: 0.98 },
      volume24h: { gte: 1000 },
    };

    const [total, grouped] = await Promise.all([
      prisma.market.count({ where }),
      prisma.market.groupBy({
        by: ["category"],
        where,
        _count: { _all: true },
      }),
    ]);

    const byCategory: Record<string, number> = {};
    for (const row of grouped) {
      const norm = normalizeCategory(row.category ?? "");
      byCategory[norm] = (byCategory[norm] ?? 0) + row._count._all;
    }

    return NextResponse.json({ success: true, total, byCategory });
  } catch (error) {
    console.error("[MARKETS_STATS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
