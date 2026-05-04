export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AffiliatePayoutStatus } from "@prisma/client";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "forbidden", message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
  const statusParam = searchParams.get("status");
  const affiliateIdParam = searchParams.get("affiliateId");

  const statusFilter =
    statusParam && Object.values(AffiliatePayoutStatus).includes(statusParam as AffiliatePayoutStatus)
      ? (statusParam as AffiliatePayoutStatus)
      : undefined;

  const where: any = {};
  if (statusFilter) where.status = statusFilter;
  if (affiliateIdParam) {
    const aid = parseInt(affiliateIdParam, 10);
    if (isNaN(aid)) {
      return NextResponse.json({ error: "invalid_affiliate_id", message: "Invalid affiliateId" }, { status: 400 });
    }
    where.affiliateId = aid;
  }

  const [payoutsRaw, total] = await Promise.all([
    prisma.affiliatePayout.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        affiliateId: true,
        status: true,
        amount: true,
        amountAfterFee: true,
        paymentMethod: true,
        paymentWallet: true,
        network: true,
        requestedAt: true,
        approvedAt: true,
        approvedBy: true,
        completedAt: true,
        failedAt: true,
        cancelledAt: true,
        failureReason: true,
        adminNote: true,
        transactionHash: true,
        affiliate: {
          select: {
            id: true,
            refCode: true,
            userId: true,
          },
        },
      },
    }),
    prisma.affiliatePayout.count({ where }),
  ]);

  const userIds = Array.from(new Set(payoutsRaw.map((p) => p.affiliate?.userId).filter((u): u is number => typeof u === "number")));
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.email]));

  const items = payoutsRaw.map((p) => ({
    id: p.id,
    affiliateId: p.affiliateId,
    affiliateRefCode: p.affiliate?.refCode ?? null,
    affiliateEmail: p.affiliate?.userId ? (userMap.get(p.affiliate.userId) ?? null) : null,
    status: p.status,
    amount: p.amount,
    amountAfterFee: p.amountAfterFee,
    paymentMethod: p.paymentMethod,
    paymentWallet: p.paymentWallet,
    network: p.network,
    requestedAt: p.requestedAt,
    approvedAt: p.approvedAt,
    approvedBy: p.approvedBy,
    completedAt: p.completedAt,
    failedAt: p.failedAt,
    cancelledAt: p.cancelledAt,
    failureReason: p.failureReason,
    adminNote: p.adminNote,
    transactionHash: p.transactionHash,
  }));

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  });
}
