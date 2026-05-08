export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();

  // Dollar fields sent by frontend — convert to cents
  const data: Record<string, unknown> = {};
  const numFields = ["price", "accountSize", "profitTargetPct", "maxLossPct", "dailyLossPct",
    "maxPositionSizePct", "minTradingDays", "profitSharePct", "challengePeriodDays",
    "payoutCooldownDays", "order"] as const;
  for (const f of numFields) {
    if (body[f] !== undefined) data[f] = Number(body[f]);
  }
  if (body.name !== undefined) data.name = String(body.name);
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.isPopular !== undefined) data.isPopular = Boolean(body.isPopular);

  if (body.maxPayoutCapDollars !== undefined)
    data.maxPayoutCapCents = Math.round(Number(body.maxPayoutCapDollars) * 100);
  if (body.minPayoutDollars !== undefined)
    data.minPayoutCents = Math.round(Number(body.minPayoutDollars) * 100);
  if (body.refundableFeeDollars !== undefined)
    data.refundableFeeCents = Math.round(Number(body.refundableFeeDollars) * 100);
  if (body.price !== undefined)
    data.priceCents = Math.round(Number(body.price) * 100);

  const plan = await prisma.challengePlan.update({ where: { id: Number(id) }, data });
  return NextResponse.json({ success: true, plan });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await prisma.challengePlan.update({ where: { id: Number(id) }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
