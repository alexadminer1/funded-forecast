export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const trades = await prisma.trade.findMany({
    include: {
      user: { select: { email: true } },
      market: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ success: true, trades });
}
