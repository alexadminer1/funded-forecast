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
    const activeChallenge = await prisma.challenge.findFirst({
      where: { userId, status: "active" },
    });

    const mode = activeChallenge ? "challenge" : "sandbox";

    const lastLog = await prisma.balanceLog.findFirst({
      where: activeChallenge
        ? { userId, challengeId: activeChallenge.id }
        : { userId, challengeId: null },
      orderBy: { createdAt: "desc" },
    });

    const currentBalance = lastLog ? lastLog.runningBalance : 0;

    // If no active challenge, fetch the most recent terminal one (passed/failed)
    const lastChallenge = activeChallenge ? null : await prisma.challenge.findFirst({
      where:   { userId, status: { in: ["passed", "failed"] } },
      orderBy: [{ endedAt: "desc" }, { startedAt: "desc" }],
      select: {
        id:              true,
        status:          true,
        violationReason: true,
        profitTargetMet: true,
        endedAt:         true,
      },
    });

    return NextResponse.json({
      success: true,
      mode,
      currentBalance,
      challenge:     activeChallenge ?? null,
      lastChallenge,
    });

  } catch (error) {
    console.error("[MODE]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
