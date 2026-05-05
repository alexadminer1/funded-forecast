export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const PAGE_SIZE = 20;

function maskUsername(username: string): string {
  if (!username) return "***";
  if (username.length >= 3) return username.slice(0, 3) + "***";
  return username.slice(0, 1) + "***";
}

function deriveChallengeActivity(statuses: string[]): string {
  if (statuses.length === 0) return "No challenge";
  if (statuses.length > 1) return "Multiple challenges";
  const s = statuses[0];
  if (s === "active") return "Challenge active";
  if (s === "passed") return "Challenge passed";
  if (s === "frozen") return "Challenge frozen";
  if (s === "failed" || s === "expired") return "Challenge failed";
  return "No challenge";
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(authHeader.slice(7));
  if (!payload) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = payload.userId;

  const affiliate = await prisma.affiliate.findUnique({
    where:  { userId },
    select: { id: true, status: true },
  });
  if (!affiliate) {
    return NextResponse.json({ error: "not_an_affiliate" }, { status: 403 });
  }
  if (affiliate.status !== "approved") {
    return NextResponse.json({ error: "affiliate_not_approved" }, { status: 403 });
  }

  const url = new URL(req.url);
  const pageRaw = parseInt(url.searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  const skip = (page - 1) * PAGE_SIZE;

  const totalReferred = await prisma.user.count({
    where: { referredByAffiliateId: affiliate.id },
  });

  const commissionAgg = await prisma.affiliateConversion.aggregate({
    where: {
      affiliateId: affiliate.id,
      status:      { in: ["approved", "paid"] },
    },
    _sum: { commissionAmount: true },
  });
  const totalCommission = commissionAgg._sum.commissionAmount ?? 0;

  const convertedCount = await prisma.affiliateConversion.count({
    where: {
      affiliateId: affiliate.id,
      status:      { not: "rejected" },
    },
  });

  const users = await prisma.user.findMany({
    where:   { referredByAffiliateId: affiliate.id },
    orderBy: { createdAt: "desc" },
    skip,
    take:    PAGE_SIZE,
    select: {
      id:        true,
      username:  true,
      createdAt: true,
    },
  });

  if (users.length === 0) {
    return NextResponse.json({
      summary: {
        totalReferred,
        converted:      convertedCount,
        conversionRate: totalReferred > 0 ? convertedCount / totalReferred : 0,
        totalCommission,
      },
      pagination: { page, pageSize: PAGE_SIZE, totalPages: Math.ceil(totalReferred / PAGE_SIZE) },
      rows: [],
    });
  }

  const userIds = users.map(u => u.id);

  const conversions = await prisma.affiliateConversion.findMany({
    where:  { affiliateId: affiliate.id, referredUserId: { in: userIds } },
    select: {
      referredUserId:   true,
      status:           true,
      commissionAmount: true,
      pendingUntil:     true,
    },
  });
  const convByUser = new Map<number, typeof conversions[0]>();
  for (const c of conversions) convByUser.set(c.referredUserId, c);

  const challenges = await prisma.challenge.findMany({
    where:  { userId: { in: userIds } },
    select: { userId: true, status: true },
  });
  const challengeStatusesByUser = new Map<number, string[]>();
  for (const ch of challenges) {
    const arr = challengeStatusesByUser.get(ch.userId) ?? [];
    arr.push(ch.status);
    challengeStatusesByUser.set(ch.userId, arr);
  }

  const rows = users.map(u => {
    const conv = convByUser.get(u.id);
    const chs  = challengeStatusesByUser.get(u.id) ?? [];

    let status: string;
    if (!conv)                        status = "Registered";
    else if (conv.status === "pending")  status = "Pending hold";
    else if (conv.status === "approved") status = "Approved";
    else if (conv.status === "paid")     status = "Paid";
    else if (conv.status === "rejected") status = "Rejected";
    else                               status = "Unknown";

    return {
      maskedUsername:    maskUsername(u.username),
      joinedAt:          u.createdAt,
      status,
      commissionAmount:  conv?.commissionAmount ?? null,
      pendingUntil:      conv?.status === "pending" ? conv.pendingUntil : null,
      challengeActivity: deriveChallengeActivity(chs),
    };
  });

  return NextResponse.json({
    summary: {
      totalReferred,
      converted:      convertedCount,
      conversionRate: totalReferred > 0 ? convertedCount / totalReferred : 0,
      totalCommission,
    },
    pagination: {
      page,
      pageSize:   PAGE_SIZE,
      totalPages: Math.ceil(totalReferred / PAGE_SIZE),
    },
    rows,
  });
}
