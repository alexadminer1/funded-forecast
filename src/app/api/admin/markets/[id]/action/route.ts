export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: marketId } = await params;
  let body: { action: string; winningOutcome?: "yes" | "no" };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { action, winningOutcome } = body;

  if (action === "disable") {
    await prisma.market.update({ where: { id: marketId }, data: { status: "closed" } });
    return NextResponse.json({ success: true, action });
  }

  if (action === "force_resolve") {
    if (!winningOutcome) return NextResponse.json({ error: "winningOutcome required" }, { status: 400 });
    await prisma.market.update({
      where: { id: marketId },
      data: { status: "resolved", winningOutcome, resolutionSource: "admin" },
    });
    return NextResponse.json({ success: true, action });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
