export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveMarketPositions } from "@/lib/marketResolve";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: marketId } = await params;

  let body: { action: string; winningOutcome?: "yes" | "no" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, winningOutcome } = body;

  if (action === "disable") {
    await prisma.market.update({
      where: { id: marketId },
      data: { status: "closed" },
    });
    return NextResponse.json({ success: true, action });
  }

  if (action === "force_resolve") {
    if (winningOutcome !== "yes" && winningOutcome !== "no") {
      return NextResponse.json(
        { error: "winningOutcome must be 'yes' or 'no'" },
        { status: 400 }
      );
    }

    const market = await prisma.market.findUnique({ where: { id: marketId } });
    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    if (market.status === "resolved" && market.winningOutcome && market.winningOutcome !== winningOutcome) {
      return NextResponse.json(
        {
          error: `Market already resolved with outcome "${market.winningOutcome}", cannot override to "${winningOutcome}"`,
        },
        { status: 400 }
      );
    }

    if (market.status !== "resolved") {
      await prisma.market.update({
        where: { id: marketId },
        data: {
          status: "resolved",
          winningOutcome,
          resolutionSource: "admin",
          resolvedExternalAt: new Date(),
        },
      });
    }

    const { positionsProcessed, positionsSkipped } = await resolveMarketPositions(
      marketId,
      winningOutcome
    );

    await prisma.auditLog.create({
      data: {
        actorId: null,
        targetType: "market",
        targetId: marketId as unknown as number,
        category: "market",
        action: "market_force_resolved",
        metadata: {
          winningOutcome,
          positionsProcessed,
          positionsSkipped,
          wasAlreadyResolved: market.status === "resolved",
        },
      },
    });

    return NextResponse.json({
      success: true,
      action,
      positionsProcessed,
      positionsSkipped,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
