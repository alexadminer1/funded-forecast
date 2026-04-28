export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const category = searchParams.get("category");
  const sort = searchParams.get("sort") ?? "volume";
  const search = searchParams.get("search");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const where = {
    status: "live",
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
      skip: offset,
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

    const total = await prisma.market.count({ where });
    return NextResponse.json({ success: true, markets, total, hasMore: offset + limit < total });

  } catch (error) {
    console.error("[MARKETS] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
