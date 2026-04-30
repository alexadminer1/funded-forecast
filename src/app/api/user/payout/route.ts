export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

const MIN_PAYOUT = 10;
const ALLOWED_NETWORKS = ["TRC20", "ERC20", "BEP20", "POLYGON"] as const;
type Network = typeof ALLOWED_NETWORKS[number];

const ADDRESS_REGEX: Record<Network, RegExp> = {
  TRC20: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  ERC20: /^0x[a-fA-F0-9]{40}$/,
  BEP20: /^0x[a-fA-F0-9]{40}$/,
  POLYGON: /^0x[a-fA-F0-9]{40}$/,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { challengeId, amount, walletAddress, walletNetwork } = body as {
    challengeId?: unknown;
    amount?: unknown;
    walletAddress?: unknown;
    walletNetwork?: unknown;
  };

  // challengeId
  if (typeof challengeId !== "number" || !Number.isInteger(challengeId) || challengeId <= 0) {
    return NextResponse.json({ error: "Invalid challengeId" }, { status: 400 });
  }

  // amount: only number, finite, positive, min, max 2 decimals
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return NextResponse.json({ error: "Amount must be a finite number" }, { status: 400 });
  }
  if (amount < MIN_PAYOUT) {
    return NextResponse.json({ error: `Minimum payout is $${MIN_PAYOUT}` }, { status: 400 });
  }
  if (Math.round(amount * 100) !== amount * 100) {
    return NextResponse.json({ error: "Amount cannot have more than 2 decimal places" }, { status: 400 });
  }

  // walletNetwork: normalize + whitelist
  if (typeof walletNetwork !== "string") {
    return NextResponse.json({ error: "Wallet network required" }, { status: 400 });
  }
  const network = walletNetwork.trim().toUpperCase() as Network;
  if (!ALLOWED_NETWORKS.includes(network)) {
    return NextResponse.json(
      { error: `Network must be one of: ${ALLOWED_NETWORKS.join(", ")}` },
      { status: 400 }
    );
  }

  // walletAddress: strict regex per network
  if (typeof walletAddress !== "string") {
    return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
  }
  const address = walletAddress.trim();
  if (!ADDRESS_REGEX[network].test(address)) {
    return NextResponse.json(
      { error: `Invalid ${network} wallet address format` },
      { status: 400 }
    );
  }

  // Check challenge passed
  const challenge = await prisma.challenge.findFirst({
    where: { id: challengeId, userId, status: "passed" },
  });
  if (!challenge) {
    return NextResponse.json({ error: "Challenge not found or not passed" }, { status: 400 });
  }

  // Check no pending payout for this challenge
  const existing = await prisma.payoutRequest.findFirst({
    where: { challengeId, status: { in: ["pending", "approved"] } },
  });
  if (existing) {
    return NextResponse.json({ error: "Payout already requested for this challenge" }, { status: 400 });
  }

  const maxPayoutAmount = round2(challenge.realizedBalance - challenge.startBalance);
  if (maxPayoutAmount < MIN_PAYOUT) {
    return NextResponse.json({ error: "Insufficient profit for payout" }, { status: 400 });
  }
  if (amount > maxPayoutAmount) {
    return NextResponse.json({ error: `Max payout is $${maxPayoutAmount.toFixed(2)}` }, { status: 400 });
  }

  const feePct = 20;
  const platformFee = round2(amount * feePct / 100);
  const netAmount = round2(amount - platformFee);

  const payout = await prisma.payoutRequest.create({
    data: {
      userId,
      challengeId,
      amount: round2(amount),
      maxPayoutAmount,
      feePct,
      platformFee,
      netAmount,
      walletAddress: address,
      walletNetwork: network,
      currency: "USDT",
    },
  });

  return NextResponse.json({ success: true, payout });
}
