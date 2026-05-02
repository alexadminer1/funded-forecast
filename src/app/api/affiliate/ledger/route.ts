export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized", message: "Требуется авторизация" }, { status: 401 });
  }
  const payload = verifyToken(authHeader.slice(7));
  if (!payload) {
    return NextResponse.json({ error: "unauthorized", message: "Невалидный токен" }, { status: 401 });
  }

  const affiliate = await prisma.affiliate.findUnique({
    where: { userId: payload.userId },
    select: { id: true, status: true },
  });

  if (!affiliate || affiliate.status !== "approved") {
    return NextResponse.json({ error: "no_active_affiliate", message: "У вас нет активной affiliate-программы" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

  const [items, total] = await Promise.all([
    prisma.affiliateLedger.findMany({
      where:   { affiliateId: affiliate.id },
      orderBy: { createdAt: "desc" },
      skip:    (page - 1) * limit,
      take:    limit,
      select: {
        id:          true,
        type:        true,
        bucket:      true,
        amount:      true,
        balanceAfter: true,
        reason:      true,
        createdAt:   true,
      },
    }),
    prisma.affiliateLedger.count({ where: { affiliateId: affiliate.id } }),
  ]);

  return NextResponse.json({ items, total, page, limit, hasMore: page * limit < total });
}
