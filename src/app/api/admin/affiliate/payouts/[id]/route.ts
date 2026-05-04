export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "forbidden", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const payoutId = parseInt(id, 10);
  if (isNaN(payoutId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid payout id" }, { status: 400 });
  }

  const payout = await prisma.affiliatePayout.findUnique({
    where: { id: payoutId },
    select: {
      id: true,
      affiliateId: true,
      status: true,
      amount: true,
      networkFee: true,
      amountAfterFee: true,
      paymentMethod: true,
      paymentWallet: true,
      network: true,
      includedConversionIds: true,
      transactionHash: true,
      nowpaymentsBatchId: true,
      requestedAt: true,
      approvedAt: true,
      approvedBy: true,
      processedAt: true,
      completedAt: true,
      failedAt: true,
      cancelledAt: true,
      failureReason: true,
      adminNote: true,
      createdAt: true,
      updatedAt: true,
      affiliate: {
        select: {
          id: true,
          refCode: true,
          status: true,
          tier: true,
          balancePending: true,
          balanceAvailable: true,
          balanceFrozen: true,
          balanceNegative: true,
          lifetimeEarned: true,
          lifetimePaid: true,
          paymentMethod: true,
          paymentWallet: true,
          walletLockUntil: true,
          walletRequiresReview: true,
          userId: true,
        },
      },
      conversions: {
        select: {
          id: true,
          paymentId: true,
          referredUserId: true,
          commissionRate: true,
          commissionAmount: true,
          status: true,
          pendingUntil: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!payout) {
    return NextResponse.json({ error: "not_found", message: "Payout not found" }, { status: 404 });
  }

  const affiliateUser = payout.affiliate?.userId
    ? await prisma.user.findUnique({
        where: { id: payout.affiliate.userId },
        select: { id: true, email: true },
      })
    : null;

  const payoutWithUser = {
    ...payout,
    affiliate: payout.affiliate
      ? { ...payout.affiliate, user: affiliateUser }
      : null,
  };

  return NextResponse.json({ payout: payoutWithUser });
}
