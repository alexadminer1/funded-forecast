export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") ?? "all";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50"), 50);

  const dateFilter = period === "7d"
    ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    : period === "30d"
    ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    : null;

  // Get completed challenges only
  const challenges = await prisma.challenge.findMany({
    where: {
      status: "passed",
      ...(dateFilter ? { endedAt: { gte: dateFilter } } : {}),
    },
    include: {
      user: { select: { username: true } },
      plan: { select: { name: true } },
      positions: {
        where: { status: "closed" },
        select: { realizedPnl: true },
      },
    },
  });

  // Aggregate per user
  const userMap = new Map<number, {
    userId: number;
    username: string;
    plan: string;
    totalPnl: number;
    wins: number;
    trades: number;
  }>();

  for (const c of challenges) {
    const closed = c.positions.filter(p => p.realizedPnl !== null);
    if (closed.length < 5) continue; // min 5 trades

    const pnl = closed.reduce((s, p) => s + (p.realizedPnl ?? 0), 0);
    const wins = closed.filter(p => (p.realizedPnl ?? 0) > 0).length;

    const existing = userMap.get(c.userId);
    if (existing) {
      existing.totalPnl += pnl;
      existing.wins += wins;
      existing.trades += closed.length;
    } else {
      userMap.set(c.userId, {
        userId: c.userId,
        username: c.user.username,
        plan: c.plan?.name ?? "Starter",
        totalPnl: pnl,
        wins,
        trades: closed.length,
      });
    }
  }

  const leaderboard = Array.from(userMap.values())
    .sort((a, b) => b.totalPnl - a.totalPnl)
    .slice(0, limit)
    .map((u, i) => ({
      rank: i + 1,
      username: u.username,
      plan: u.plan,
      totalPnl: parseFloat(u.totalPnl.toFixed(2)),
      winRate: u.trades > 0 ? Math.round((u.wins / u.trades) * 100) : 0,
      trades: u.trades,
    }));

  return NextResponse.json({ success: true, leaderboard });
}
