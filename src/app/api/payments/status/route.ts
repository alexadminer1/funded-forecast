export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  const userId = payload?.userId as number;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payments = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, orderId: true, amount: true, currency: true, status: true, planId: true, createdAt: true, paymentUrl: true },
  });

  return NextResponse.json({ success: true, payments });
}
