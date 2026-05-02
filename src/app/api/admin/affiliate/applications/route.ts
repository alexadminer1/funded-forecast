export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AffiliateStatus } from "@prisma/client";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "forbidden", message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
  const statusParam = searchParams.get("status");

  const statusFilter =
    statusParam && Object.values(AffiliateStatus).includes(statusParam as AffiliateStatus)
      ? (statusParam as AffiliateStatus)
      : undefined;

  const where = statusFilter ? { status: statusFilter } : {};

  const [affiliates, total] = await Promise.all([
    prisma.affiliate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.affiliate.count({ where }),
  ]);

  const userIds = affiliates.map((a) => a.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const items = affiliates.map((a) => ({
    ...a,
    user: userMap.get(a.userId) ?? null,
  }));

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  });
}
