export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const plans = await prisma.challengePlan.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ success: true, plans });
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();

  const plan = await prisma.challengePlan.create({
    data: {
      name: String(body.name),
      price: Number(body.price),
      priceCents: Math.round(Number(body.price) * 100),
      accountSize: Number(body.accountSize),
      profitTargetPct: Number(body.profitTargetPct),
      maxLossPct: Number(body.maxLossPct),
      dailyLossPct: Number(body.dailyLossPct),
      maxPositionSizePct: Number(body.maxPositionSizePct ?? 2),
      minTradingDays: Number(body.minTradingDays ?? 10),
      profitSharePct: Number(body.profitSharePct ?? 80),
      challengePeriodDays: Number(body.challengePeriodDays ?? 30),
      maxPayoutCapCents: Math.round(Number(body.maxPayoutCapDollars ?? 0) * 100),
      minPayoutCents: Math.round(Number(body.minPayoutDollars ?? 50) * 100),
      payoutCooldownDays: Number(body.payoutCooldownDays ?? 14),
      refundableFeeCents: Math.round(Number(body.refundableFeeDollars ?? 0) * 100),
      isPopular: Boolean(body.isPopular ?? false),
      isActive: Boolean(body.isActive ?? true),
      order: Number(body.order ?? 0),
    },
  });
  return NextResponse.json({ success: true, plan });
}
