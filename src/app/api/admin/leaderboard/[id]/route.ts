export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

const PLANS = ["Starter", "Pro", "Elite"];

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.username !== undefined) {
    const username = String(body.username).trim();
    if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });
    const dup = await prisma.leaderboardEntry.findFirst({ where: { username, NOT: { id } } });
    if (dup) return NextResponse.json({ error: "Username already exists in leaderboard" }, { status: 409 });
    const dupUser = await prisma.user.findUnique({ where: { username } });
    if (dupUser) return NextResponse.json({ error: "Username already taken by a real user" }, { status: 409 });
    data.username = username;
  }
  if (body.plan !== undefined) {
    if (!PLANS.includes(body.plan)) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    data.plan = body.plan;
  }
  if (body.totalPnl !== undefined) {
    const v = Number(body.totalPnl);
    if (Number.isNaN(v)) return NextResponse.json({ error: "totalPnl must be a number" }, { status: 400 });
    data.totalPnl = v;
  }
  if (body.winRate !== undefined) {
    const v = Number(body.winRate);
    if (Number.isNaN(v) || v < 0 || v > 100) return NextResponse.json({ error: "winRate must be 0–100" }, { status: 400 });
    data.winRate = v;
  }
  if (body.trades !== undefined) {
    const v = Number(body.trades);
    if (Number.isNaN(v) || v < 0) return NextResponse.json({ error: "trades must be ≥ 0" }, { status: 400 });
    data.trades = v;
  }
  if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl ? String(body.avatarUrl) : null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const entry = await prisma.leaderboardEntry.update({ where: { id }, data });
  return NextResponse.json({ success: true, entry });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  await prisma.leaderboardEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
