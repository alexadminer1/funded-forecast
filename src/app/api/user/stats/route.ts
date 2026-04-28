export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  const userId = payload?.userId as number;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const trades = await prisma.trade.findMany({ where: { userId }, select: { pnl: true, status: true } });
  const closed = trades.filter(t => t.status === "closed" && t.pnl !== null);
  const total = closed.length;
  const wins = closed.filter(t => (t.pnl ?? 0) > 0).length;
  const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const bestTrade = closed.reduce((best, t) => (t.pnl ?? 0) > (best.pnl ?? 0) ? t : best, { pnl: 0 } as { pnl: number | null });

  const challenges = await prisma.challenge.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    select: { id: true, status: true, startedAt: true, startBalance: true, realizedBalance: true, profitTargetPct: true, maxTotalDdPct: true, planId: true },
  });

  return NextResponse.json({
    success: true,
    stats: {
      totalTrades: total,
      winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
      totalPnl: totalPnl.toFixed(2),
      bestTrade: (bestTrade.pnl ?? 0).toFixed(2),
    },
    challengeHistory: challenges,
  });
}
