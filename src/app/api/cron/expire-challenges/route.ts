export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
        await prisma.challenge.update({
          where: { id: c.id },
          data: {
            status:          "failed",
            violationReason: "Challenge period expired",
            endedAt:         checkedAt,
          },
        });
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
