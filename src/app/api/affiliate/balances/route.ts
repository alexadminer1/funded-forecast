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
    select: {
      status: true,
      balancePending: true,
      balanceAvailable: true,
      balanceFrozen: true,
      balanceNegative: true,
    },
  });

  if (!affiliate || affiliate.status !== "approved") {
    return NextResponse.json({ error: "no_active_affiliate", message: "У вас нет активной affiliate-программы" }, { status: 403 });
  }

  return NextResponse.json({
    balancePending:   affiliate.balancePending,
    balanceAvailable: affiliate.balanceAvailable,
    balanceFrozen:    affiliate.balanceFrozen,
    balanceNegative:  affiliate.balanceNegative,
  });
}
