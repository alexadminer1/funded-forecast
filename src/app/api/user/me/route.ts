export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const userId = payload.userId as number;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        membershipStatus: true,
        isBlocked: true,
        lastTradeAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.isBlocked) {
      return NextResponse.json({ error: "Account is blocked" }, { status: 403 });
    }

    // Get current balance from last balance_log entry
    const lastLog = await prisma.balanceLog.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { runningBalance: true },
    });

    // Get open positions count
    const openPositionsCount = await prisma.position.count({
      where: { userId, status: "open" },
    });

    // Get active challenge if any
    const activeChallenge = await prisma.challenge.findFirst({
      where: { userId, status: "active" },
      select: {
        id: true,
        stage: true,
        startBalance: true,
        realizedBalance: true,
        peakBalance: true,
        profitTargetPct: true,
        maxTotalDdPct: true,
        maxDailyDdPct: true,
        profitTargetMet: true,
        tradingDaysCount: true,
        minTradingDays: true,
        startedAt: true,
        planId: true,
        plan: { select: { name: true } },
      },
    });

    // Balance fallback: if no BalanceLog yet (new challenge, no trades),
    // use the challenge's realizedBalance so the header doesn't show $0.
    const balance = lastLog?.runningBalance ?? activeChallenge?.realizedBalance ?? 0;

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        balance,
        openPositionsCount,
        activeChallenge,
      },
    });

  } catch (error) {
    console.error("[ME]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
