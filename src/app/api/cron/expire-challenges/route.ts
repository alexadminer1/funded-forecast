export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { closeOpenPositionsForChallenge } from "@/lib/closeChallengePositions";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checkedAt = new Date();
  const updatedChallengeIds: number[] = [];
  const errors: number[] = [];

  try {
    const expired = await prisma.challenge.findMany({
      where: {
        status:          "active",
        expiresAt:       { lt: checkedAt },
        profitTargetMet: false,
      },
      select: { id: true },
      take:   500,
    });

    for (const c of expired) {
      try {
        // Phase 4.B Task 2 site #1 — close open positions inside the same
        // tx as the status flip (audit finding #3).
        await prisma.$transaction(async (tx) => {
          await closeOpenPositionsForChallenge(tx, c.id, "expired");
          await tx.challenge.update({
            where: { id: c.id },
            data: {
              status:          "failed",
              violationReason: "Challenge period expired",
              endedAt:         checkedAt,
            },
          });
        }, { timeout: 30000 });
        updatedChallengeIds.push(c.id);
      } catch (err) {
        console.error(`[EXPIRE_CHALLENGES] failed to update challenge ${c.id}`, err);
        errors.push(c.id);
      }
    }

    return NextResponse.json({
      checkedAt:           checkedAt.toISOString(),
      expiredCount:        updatedChallengeIds.length,
      updatedChallengeIds,
      errors,
    });
  } catch (err) {
    console.error("[EXPIRE_CHALLENGES] batch query failed", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
