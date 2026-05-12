export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const EVALUATION_THRESHOLD_HOURS = 72;
const FUNDED_THRESHOLD_HOURS = 120;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checkedAt = new Date();
  const evaluationCutoff = new Date(checkedAt.getTime() - EVALUATION_THRESHOLD_HOURS * 3600 * 1000);
  const fundedCutoff = new Date(checkedAt.getTime() - FUNDED_THRESHOLD_HOURS * 3600 * 1000);

  const updatedChallengeIds: number[] = [];
  const errors: number[] = [];

  try {
    const stale = await prisma.challenge.findMany({
      where: {
        status: "active",
        lastNewPositionAt: { not: null },
        OR: [
          { stage: "evaluation", lastNewPositionAt: { lt: evaluationCutoff } },
          { stage: "funded",     lastNewPositionAt: { lt: fundedCutoff } },
        ],
      },
      select: { id: true, stage: true },
      take: 500,
    });

    for (const c of stale) {
      try {
        const reason = c.stage === "funded" ? "inactivity_120h" : "inactivity_72h";
        await prisma.challenge.update({
          where: { id: c.id },
          data: {
            status:          "failed",
            violationReason: reason,
            endedAt:         checkedAt,
          },
        });
        updatedChallengeIds.push(c.id);
      } catch (err) {
        console.error(`[INACTIVITY_CHECK] failed to update challenge ${c.id}`, err);
        errors.push(c.id);
      }
    }

    return NextResponse.json({
      checkedAt:           checkedAt.toISOString(),
      failedCount:         updatedChallengeIds.length,
      updatedChallengeIds,
      errors,
    });
  } catch (err) {
    console.error("[INACTIVITY_CHECK] batch query failed", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
