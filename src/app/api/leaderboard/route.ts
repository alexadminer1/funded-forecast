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

  // Real users
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

  const userMap = new Map<number, {
    username: string;
    plan: string;
    totalPnl: number;
    wins: number;
    trades: number;
  }>();

  for (const c of challenges) {
    const closed = c.positions.filter(p => p.realizedPnl !== null);
    if (closed.length < 5) continue;

    const pnl = closed.reduce((s, p) => s + (p.realizedPnl ?? 0), 0);
    const wins = closed.filter(p => (p.realizedPnl ?? 0) > 0).length;

    const existing = userMap.get(c.userId);
    if (existing) {
      existing.totalPnl += pnl;
      existing.wins += wins;
      existing.trades += closed.length;
    } else {
      userMap.set(c.userId, {
        username: c.user.username,
        plan: c.plan?.name ?? "Starter",
        totalPnl: pnl,
        wins,
        trades: closed.length,
      });
    }
  }

  const realEntries = Array.from(userMap.values()).map(u => ({
    username: u.username,
    plan: u.plan,
    totalPnl: parseFloat(u.totalPnl.toFixed(2)),
    winRate: u.trades > 0 ? Math.round((u.wins / u.trades) * 100) : 0,
    trades: u.trades,
  }));

  // Showcase entries (active only)
  const showcase = await prisma.leaderboardEntry.findMany({
    where: { isActive: true },
    select: {
      username: true,
      plan: true,
      totalPnl: true,
      winRate: true,
      trades: true,
    },
  });

  // Merge and sort by totalPnl DESC
  const merged = [...realEntries, ...showcase].sort((a, b) => b.totalPnl - a.totalPnl);

  const leaderboard = merged.slice(0, limit).map((u, i) => ({
    rank: i + 1,
    username: u.username,
    plan: u.plan,
    totalPnl: parseFloat(u.totalPnl.toFixed(2)),
    winRate: u.winRate,
    trades: u.trades,
  }));

  return NextResponse.json({ success: true, leaderboard });
}
