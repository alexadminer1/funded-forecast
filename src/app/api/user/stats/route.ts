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

  const totalTrades = await prisma.trade.count({ where: { userId } });

  const positions = await prisma.position.findMany({
    where: { userId, status: "closed" },
    select: { realizedPnl: true },
  });

  const totalPnl = positions.reduce((s, p) => s + (p.realizedPnl ?? 0), 0);
  const wins = positions.filter(p => (p.realizedPnl ?? 0) > 0).length;
  const winRate = positions.length > 0 ? Math.round((wins / positions.length) * 100) : 0;
  const bestTrade = positions.reduce((best, p) => (p.realizedPnl ?? 0) > best ? (p.realizedPnl ?? 0) : best, 0);

  const challenges = await prisma.challenge.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    select: { id: true, status: true, startedAt: true, startBalance: true, realizedBalance: true, profitTargetPct: true, maxTotalDdPct: true, planId: true },
  });

  return NextResponse.json({
    success: true,
    stats: { totalTrades, winRate, totalPnl: totalPnl.toFixed(2), bestTrade: bestTrade.toFixed(2) },
    challengeHistory: challenges,
  });
}
