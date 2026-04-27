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

  try {
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
          stage: "evaluation",
          status: "active",
          startBalance: 10000,
          realizedBalance: 10000,
          peakBalance: 10000,
          profitTargetPct: 10,
          maxDailyDdPct: 5,
          maxTotalDdPct: 10,
          maxPositionSizePct: 2,
          minTradingDays: 10,
        },
      });

      await tx.balanceLog.create({
        data: {
          userId,
          tradeId: null,
          challengeId: challenge.id,
          type: "challenge_start",
          amount: 10000,
          balanceBefore: 0,
          balanceAfter: 10000,
          runningBalance: 10000,
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
