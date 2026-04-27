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

  const [usersCount, activeChallenges, tradesToday, tradeOpenSum, tradeCloseSum, marketResolveSum] = await Promise.all([
    prisma.user.count(),
    prisma.challenge.count({ where: { status: "active" } }),
    prisma.trade.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.balanceLog.aggregate({ _sum: { amount: true }, where: { type: "trade_open" } }),
    prisma.balanceLog.aggregate({ _sum: { amount: true }, where: { type: "trade_close" } }),
    prisma.balanceLog.aggregate({ _sum: { amount: true }, where: { type: "market_resolve" } }),
  ]);

  const systemPnl = parseFloat((
    (tradeOpenSum._sum.amount ?? 0) +
    (tradeCloseSum._sum.amount ?? 0) +
    (marketResolveSum._sum.amount ?? 0)
  ).toFixed(2));

  return NextResponse.json({
    success: true,
    usersCount,
    activeChallenges,
    tradesToday,
    systemPnl,
    pnlBreakdown: {
      tradeOpen: tradeOpenSum._sum.amount ?? 0,
      tradeClose: tradeCloseSum._sum.amount ?? 0,
      marketResolve: marketResolveSum._sum.amount ?? 0,
    },
  });
}
