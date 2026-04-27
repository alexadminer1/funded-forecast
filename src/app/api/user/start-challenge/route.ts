export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyToken(authHeader.slice(7));
  if (!payload?.userId) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const userId = payload.userId as number;

  let planId: number | null = null;
  let startBalance = 10000;
  let profitTargetPct = 10;
  let maxTotalDdPct = 10;
  let maxDailyDdPct = 5;
  let maxPositionSizePct = 2;
  let minTradingDays = 10;

  try {
    const body = await req.json().catch(() => ({}));
    if (body.planId) {
      const plan = await prisma.challengePlan.findFirst({
        where: { id: Number(body.planId), isActive: true },
      });
      if (!plan) {
        return NextResponse.json({ error: "Plan not found" }, { status: 400 });
      }
      planId = plan.id;
      startBalance = plan.accountSize;
      profitTargetPct = plan.profitTargetPct;
      maxTotalDdPct = plan.maxLossPct;
      maxDailyDdPct = plan.dailyLossPct;
      maxPositionSizePct = plan.maxPositionSizePct;
      minTradingDays = plan.minTradingDays;
    }

    const existing = await prisma.challenge.findFirst({
      where: { userId, status: "active" },
    });
    if (existing) {
      return NextResponse.json({ error: "Challenge already active" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const challenge = await tx.challenge.create({
        data: {
          userId,
          planId,
          stage: "evaluation",
          status: "active",
          startBalance,
          realizedBalance: startBalance,
          peakBalance: startBalance,
          profitTargetPct,
          maxDailyDdPct,
          maxTotalDdPct,
          maxPositionSizePct,
          minTradingDays,
        },
      });

      await tx.balanceLog.create({
        data: {
          userId,
          tradeId: null,
          challengeId: challenge.id,
          type: "challenge_start",
          amount: startBalance,
          balanceBefore: 0,
          balanceAfter: startBalance,
          runningBalance: startBalance,
        },
      });

      return challenge;
    });

    return NextResponse.json({ success: true, challenge: result });

  } catch (error) {
    console.error("[START-CHALLENGE]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
