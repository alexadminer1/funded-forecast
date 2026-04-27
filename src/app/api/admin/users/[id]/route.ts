export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, username: true, firstName: true, lastName: true,
      membershipStatus: true, createdAt: true, lastTradeAt: true,
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [challenges, balanceLogs, positions] = await Promise.all([
    prisma.challenge.findMany({
      where: { userId },
      orderBy: { id: "desc" },
    }),
    prisma.balanceLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.position.findMany({
      where: { userId, status: "open" },
      include: { market: { select: { title: true } } },
    }),
  ]);

  return NextResponse.json({ success: true, user, challenges, balanceLogs, positions });
}
