export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "forbidden", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const affiliateId = parseInt(id, 10);
  if (isNaN(affiliateId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid affiliate id" }, { status: 400 });
  }

  // Round 1: everything keyed by affiliateId
  const [affiliate, conversionsRaw, ledger, referredUsers, clicksRaw, auditLog] = await Promise.all([
    prisma.affiliate.findUnique({ where: { id: affiliateId } }),
    prisma.affiliateConversion.findMany({
      where:   { affiliateId },
      orderBy: { createdAt: "desc" },
      take:    50,
    }),
    prisma.affiliateLedger.findMany({
      where:   { affiliateId },
      orderBy: { createdAt: "desc" },
      take:    50,
    }),
    prisma.user.findMany({
      where:   { referredByAffiliateId: affiliateId },
      select:  { id: true, email: true, username: true, createdAt: true, registrationIpHash: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.affiliateClick.findMany({
      where:  { affiliateId },
      select: { ipHash: true, convertedToUserId: true },
    }),
    prisma.auditLog.findMany({
      where:   { targetType: "Affiliate", targetId: String(affiliateId) },
      orderBy: { createdAt: "desc" },
      take:    30,
    }),
  ]);

  if (!affiliate) {
    return NextResponse.json({ error: "not_found", message: "Affiliate not found" }, { status: 404 });
  }

  // Round 2: user lookups that depend on round 1
  const conversionReferredIds = [...new Set(conversionsRaw.map((c) => c.referredUserId))];
  const [affiliateUser, conversionUsersArr] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: affiliate.userId },
      select: { id: true, email: true, username: true, createdAt: true, registrationIpHash: true },
    }),
    conversionReferredIds.length > 0
      ? prisma.user.findMany({
          where:  { id: { in: conversionReferredIds } },
          select: { id: true, email: true },
        })
      : Promise.resolve([]),
  ]);

  const convUserMap = new Map(conversionUsersArr.map((u) => [u.id, u]));
  const conversions = conversionsRaw.map((c) => ({
    ...c,
    referredUser: convUserMap.get(c.referredUserId) ?? null,
  }));

  // Click stats
  const clickStats = {
    totalClicks:    clicksRaw.length,
    uniqueIpHashes: new Set(clicksRaw.map((c) => c.ipHash)).size,
    withConversion: clicksRaw.filter((c) => c.convertedToUserId !== null).length,
  };

  // Risk flags
  const oneDayAgo = new Date(Date.now() - 86_400_000);
  const riskFlags = {
    sameIpAtRegistration:      affiliate.suspiciousFlag,
    reason:                    affiliate.suspiciousReason,
    hasNegativeBalance:        affiliate.balanceNegative > 0,
    negativeBalanceOverLimit:  affiliate.balanceNegative > 1000,
    manyClicksZeroConversions: clickStats.totalClicks > 50 && conversions.length === 0,
    recentVelocity24h:         conversions.filter((c) => c.createdAt > oneDayAgo).length,
  };

  return NextResponse.json({
    affiliate:    { ...affiliate, user: affiliateUser },
    conversions,
    ledger,
    referredUsers,
    clickStats,
    auditLog,
    riskFlags,
  });
}
