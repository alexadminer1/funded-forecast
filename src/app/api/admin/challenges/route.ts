export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = req.nextUrl.searchParams.get("status") ?? undefined;

  const challenges = await prisma.challenge.findMany({
    where: status ? { status } : undefined,
    include: { user: { select: { email: true, username: true } } },
    orderBy: { id: "desc" },
    take: 50,
  });

  return NextResponse.json({ success: true, challenges });
}
