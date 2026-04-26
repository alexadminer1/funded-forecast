export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const category = searchParams.get("category");
  const sort = searchParams.get("sort") ?? "volume";
  const search = searchParams.get("search");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const where = {
    status: "live",
    negRisk: false,
    ...(category && category !== "all" ? { category } : {}),
    ...(search ? {
      title: { contains: search, mode: "insensitive" as const },
    } : {}),
  };

  const orderBy = (() => {
    switch (sort) {
      case "volume":    return { volume24h: "desc" as const };
      case "ending":    return { endDate: "asc" as const };
      case "newest":    return { createdAt: "desc" as const };
      default:          return { volume24h: "desc" as const };
    }
  })();

  try {
    const markets = await prisma.market.findMany({
      where,
      orderBy,
      take: limit,
      select: {
        id: true,
        title: true,
        category: true,
        imageUrl: true,
        yesPrice: true,
        noPrice: true,
        volume24h: true,
        endDate: true,
        status: true,
        slug: true,
      },
    });

    return NextResponse.json({ success: true, markets });

  } catch (error) {
    console.error("[MARKETS] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
