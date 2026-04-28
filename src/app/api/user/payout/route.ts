export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function auth(req: NextRequest) {
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId as number | null;
}

export async function GET(req: NextRequest) {
  const userId = auth(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requests = await prisma.payoutRequest.findMany({
    where: { userId },
    orderBy: { requestedAt: "desc" },
    select: { id: true, amount: true, netAmount: true, status: true, requestedAt: true, processedAt: true, paidAt: true, walletAddress: true, walletNetwork: true, txHash: true, currency: true, rejectionReason: true },
  });
  return NextResponse.json({ success: true, requests });
}

export async function POST(req: NextRequest) {
  const userId = auth(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { challengeId, amount, walletAddress, walletNetwork } = await req.json();

  if (!walletAddress || !walletNetwork) {
    return NextResponse.json({ error: "Wallet address and network required" }, { status: 400 });
  }

  // Check challenge passed
  const challenge = await prisma.challenge.findFirst({
    where: { id: challengeId, userId, status: "passed" },
  });
  if (!challenge) return NextResponse.json({ error: "Challenge not found or not passed" }, { status: 400 });

  // Check no pending payout for this challenge
  const existing = await prisma.payoutRequest.findFirst({
    where: { challengeId, status: { in: ["pending", "approved"] } },
  });
  if (existing) return NextResponse.json({ error: "Payout already requested for this challenge" }, { status: 400 });

  const feePct = 20;
  const platformFee = parseFloat((amount * feePct / 100).toFixed(2));
  const netAmount = parseFloat((amount - platformFee).toFixed(2));
  const maxPayoutAmount = challenge.realizedBalance - challenge.startBalance;

  if (amount > maxPayoutAmount) {
    return NextResponse.json({ error: `Max payout is $${maxPayoutAmount.toFixed(2)}` }, { status: 400 });
  }

  const payout = await prisma.payoutRequest.create({
    data: { userId, challengeId, amount, maxPayoutAmount, feePct, platformFee, netAmount, walletAddress, walletNetwork, currency: "USDT" },
  });

  return NextResponse.json({ success: true, payout });
}
