export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
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
    const challenges = await prisma.challenge.findMany({
      where: {
        userId,
        status: { in: ["passed", "failed", "expired"] },
      },
      select: {
        id:               true,
        status:           true,
        startBalance:     true,
        realizedBalance:  true,
        profitTargetPct:  true,
        maxTotalDdPct:    true,
        tradingDaysCount: true,
        minTradingDays:   true,
        profitTargetMet:  true,
        drawdownViolated: true,
        violationReason:  true,
        startedAt:        true,
        endedAt:          true,
        plan:             { select: { name: true } },
        _count:           { select: { positions: true } },
      },
      orderBy: { startedAt: "desc" },
    });

    const result = challenges.map((c) => {
      const pnl = parseFloat((c.realizedBalance - c.startBalance).toFixed(2));
      const profitTargetAmount = c.startBalance * (c.profitTargetPct / 100);
      const profitTargetProgress = profitTargetAmount > 0
        ? parseFloat(Math.min(100, Math.max(0, (pnl / profitTargetAmount) * 100)).toFixed(1))
        : 0;
      const maxDrawdownAmount = c.startBalance * (c.maxTotalDdPct / 100);
      const drawdownUsed = maxDrawdownAmount > 0
        ? parseFloat(Math.min(100, Math.max(0, (Math.max(0, c.startBalance - c.realizedBalance) / maxDrawdownAmount) * 100)).toFixed(1))
        : 0;

      return {
        id:                   c.id,
        planName:             c.plan?.name ?? null,
        status:               c.status,
        startedAt:            c.startedAt,
        endedAt:              c.endedAt,
        startBalance:         c.startBalance,
        finalBalance:         c.realizedBalance,
        pnl,
        profitTargetPct:      c.profitTargetPct,
        profitTargetProgress,
        maxTotalDdPct:        c.maxTotalDdPct,
        drawdownUsed,
        tradingDaysCount:     c.tradingDaysCount,
        minTradingDays:       c.minTradingDays,
        profitTargetMet:      c.profitTargetMet,
        drawdownViolated:     c.drawdownViolated,
        violationReason:      c.violationReason,
        positionsCount:       c._count.positions,
      };
    });

    return NextResponse.json({ success: true, challenges: result });

  } catch (error) {
    console.error("[USER_CHALLENGES]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
