export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

const PLANS = ["Starter", "Pro", "Elite"];

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const entries = await prisma.leaderboardEntry.findMany({
    orderBy: { totalPnl: "desc" },
  });
  return NextResponse.json({ success: true, entries });
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();

  const username = String(body.username ?? "").trim();
  const plan = String(body.plan ?? "");
  const totalPnl = Number(body.totalPnl);
  const winRate = Number(body.winRate);
  const trades = Number(body.trades);
  const avatarUrl = body.avatarUrl ? String(body.avatarUrl) : null;
  const isActive = body.isActive !== false;

  if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });
  if (!PLANS.includes(plan)) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  if (Number.isNaN(totalPnl)) return NextResponse.json({ error: "totalPnl must be a number" }, { status: 400 });
  if (Number.isNaN(winRate) || winRate < 0 || winRate > 100) return NextResponse.json({ error: "winRate must be 0–100" }, { status: 400 });
  if (Number.isNaN(trades) || trades < 0) return NextResponse.json({ error: "trades must be ≥ 0" }, { status: 400 });

  const existsInLb = await prisma.leaderboardEntry.findUnique({ where: { username } });
  if (existsInLb) return NextResponse.json({ error: "Username already exists in leaderboard" }, { status: 409 });
  const existsInUsers = await prisma.user.findUnique({ where: { username } });
  if (existsInUsers) return NextResponse.json({ error: "Username already taken by a real user" }, { status: 409 });

  const entry = await prisma.leaderboardEntry.create({
    data: { username, plan, totalPnl, winRate, trades, avatarUrl, isActive },
  });
  return NextResponse.json({ success: true, entry });
}
