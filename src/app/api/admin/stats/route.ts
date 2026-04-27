export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [usersCount, activeChallenges, tradesToday, systemPnlAgg] = await Promise.all([
    prisma.user.count(),
    prisma.challenge.count({ where: { status: "active" } }),
    prisma.trade.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.balanceLog.aggregate({
      _sum: { amount: true },
      where: { type: { in: ["trade_close", "market_resolve"] } },
    }),
  ]);

  return NextResponse.json({
    success: true,
    usersCount,
    activeChallenges,
    tradesToday,
    systemPnl: systemPnlAgg._sum.amount ?? 0,
  });
}
