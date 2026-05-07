import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@prisma/client";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES: PaymentStatus[] = [
  PaymentStatus.AWAITING_PAYMENT,
  PaymentStatus.SEEN_ON_CHAIN,
  PaymentStatus.CONFIRMING,
  PaymentStatus.UNDERPAID,
];

const RECENT_CONFIRMED_WINDOW_MS = 10 * 60 * 1000; // 10 min

export async function GET(req: NextRequest) {
  // Auth
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ success: false, error: "no_token" }, { status: 401 });
  }
  const payload = verifyToken(token);
  if (!payload || typeof payload.userId !== "number") {
    return NextResponse.json({ success: false, error: "invalid_token" }, { status: 401 });
  }
  const userId = payload.userId;

  const now = new Date();

  // 1. Active pending payment
  const pending = await prisma.payment.findFirst({
    where: {
      userId,
      status: { in: ACTIVE_STATUSES },
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
    include: {
      plan: { select: { name: true } },
    },
  });

  // 2. Recent CONFIRMED payment (within 10-min window)
  const recentConfirmedRaw = await prisma.payment.findFirst({
    where: {
      userId,
      status: PaymentStatus.CONFIRMED,
      confirmedAt: { gt: new Date(now.getTime() - RECENT_CONFIRMED_WINDOW_MS) },
    },
    orderBy: { confirmedAt: "desc" },
    select: {
      id: true,
      challengeId: true,
      confirmedAt: true,
      planId: true,
    },
  });

  const recentConfirmed = recentConfirmedRaw
    ? {
        paymentId: recentConfirmedRaw.id,
        challengeId: recentConfirmedRaw.challengeId,
        confirmedAt: recentConfirmedRaw.confirmedAt?.toISOString() ?? null,
        planId: recentConfirmedRaw.planId,
      }
    : null;

  if (!pending) {
    return NextResponse.json({
      success: true,
      hasPending: false,
      recentConfirmed,
    });
  }

  return NextResponse.json({
    success: true,
    hasPending: true,
    payment: {
      paymentId: pending.id,
      planId: pending.planId,
      planName: pending.plan?.name ?? null,
      status: pending.status,
      amountUsdc: pending.expectedAmountUnits.toString(),
      planAmountUsd: pending.planAmountUsd.toString(),
      expiresAt: pending.expiresAt.toISOString(),
    },
    recentConfirmed,
  });
}
