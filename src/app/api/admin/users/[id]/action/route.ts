export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let body: { action: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { action } = body;

  try {
    if (action === "reset_balance") {
      await prisma.$transaction(async (tx) => {
        const activeChallenge = await tx.challenge.findFirst({ where: { userId, status: "active" } });

        await tx.balanceLog.create({
          data: {
            userId,
            tradeId: null,
            challengeId: activeChallenge?.id ?? null,
            type: "adjustment",
            amount: 10000,
            balanceBefore: 0,
            balanceAfter: 10000,
            runningBalance: 10000,
          },
        });

        if (activeChallenge) {
          await tx.challenge.update({
            where: { id: activeChallenge.id },
            data: { realizedBalance: 10000, peakBalance: 10000 },
          });
        }
      });
      return NextResponse.json({ success: true, action });
    }

    if (action === "fail_challenge") {
      const challenge = await prisma.challenge.findFirst({ where: { userId, status: "active" } });
      if (!challenge) return NextResponse.json({ error: "No active challenge" }, { status: 400 });

      await prisma.challenge.update({
        where: { id: challenge.id },
        data: { status: "failed", drawdownViolated: true, violationReason: "Admin action", endedAt: new Date() },
      });
      return NextResponse.json({ success: true, action });
    }

    if (action === "pass_challenge") {
      const challenge = await prisma.challenge.findFirst({ where: { userId, status: "active" } });
      if (!challenge) return NextResponse.json({ error: "No active challenge" }, { status: 400 });

      await prisma.challenge.update({
        where: { id: challenge.id },
        data: { status: "passed", profitTargetMet: true, endedAt: new Date() },
      });
      return NextResponse.json({ success: true, action });
    }

    if (action === "start_challenge") {
      const existing = await prisma.challenge.findFirst({ where: { userId, status: "active" } });
      if (existing) return NextResponse.json({ error: "Challenge already active" }, { status: 400 });

      await prisma.$transaction(async (tx) => {
        const challenge = await tx.challenge.create({
          data: {
            userId, stage: "evaluation", status: "active",
            startBalance: 10000, realizedBalance: 10000, peakBalance: 10000,
            profitTargetPct: 10, maxDailyDdPct: 5, maxTotalDdPct: 10,
            maxPositionSizePct: 2, minTradingDays: 10,
          },
        });
        await tx.balanceLog.create({
          data: {
            userId, tradeId: null, challengeId: challenge.id,
            type: "challenge_start", amount: 10000,
            balanceBefore: 0, balanceAfter: 10000, runningBalance: 10000,
          },
        });
      });
      return NextResponse.json({ success: true, action });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  } catch (error) {
    console.error("[ADMIN ACTION]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
