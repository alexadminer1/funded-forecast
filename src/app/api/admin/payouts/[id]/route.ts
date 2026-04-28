export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  const { status, txHash, rejectionReason } = await req.json();

  const data: Record<string, unknown> = { status };
  if (txHash) data.txHash = txHash;
  if (rejectionReason) data.rejectionReason = rejectionReason;
  if (status === "approved") data.processedAt = new Date();
  if (status === "paid") data.paidAt = new Date();

  const payout = await prisma.payoutRequest.update({ where: { id }, data });
  return NextResponse.json(payout);
}
