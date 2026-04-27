export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, username: true, createdAt: true },
  });

  const result = await Promise.all(users.map(async (u) => {
    const activeChallenge = await prisma.challenge.findFirst({
      where: { userId: u.id, status: "active" },
    });

    const lastLog = await prisma.balanceLog.findFirst({
      where: activeChallenge
        ? { userId: u.id, challengeId: activeChallenge.id }
        : { userId: u.id, challengeId: null },
      orderBy: { createdAt: "desc" },
    });

    return {
      ...u,
      mode: activeChallenge ? "challenge" : "sandbox",
      currentBalance: lastLog?.runningBalance ?? 0,
      activeChallenge,
    };
  }));

  return NextResponse.json({ success: true, users: result });
}
