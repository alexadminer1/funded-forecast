export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

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
    select: { id: true, amount: true, netAmount: true, status: true, requestedAt: true, processedAt: true, paidAt: true, walletAddress: true, walletNetwork: true, txHash: true, currency: true, rejectionReason: true, baseAmountCents: true, refundableFeeBonusCents: true, finalAmountCents: true },
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

  // amount: only number, finite, positive, max 2 decimals
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return NextResponse.json({ error: "Amount must be a finite number" }, { status: 400 });
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
  const addr = walletAddress.trim();
  if (!ADDRESS_REGEX[network].test(addr)) {
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

  // Reject payouts for challenges not backed by a real payment
  if (!challenge.planId) {
    return NextResponse.json(
      { error: "This challenge is not eligible for payouts" },
      { status: 400 }
    );
  }
  const verifiedPayment = await prisma.payment.findFirst({
    where: {
      userId,
      planId: challenge.planId,
      status: { in: ["confirmed", "finished"] },
    },
  });
  if (!verifiedPayment) {
    return NextResponse.json(
      { error: "No verified payment found for this challenge" },
      { status: 400 }
    );
  }

  // 1. Min payout check (plan-level or fallback $10)
  const minPayout = challenge.minPayoutCents != null ? challenge.minPayoutCents / 100 : 10;
  if (amount < minPayout) {
    return NextResponse.json({ error: `Minimum payout is $${minPayout.toFixed(2)}` }, { status: 400 });
  }

  // 2. Max payout cap check
  if (challenge.payoutCapCents != null) {
    const maxCap = challenge.payoutCapCents / 100;
    if (amount > maxCap) {
      return NextResponse.json({ error: `Maximum payout per request is $${maxCap.toFixed(2)}` }, { status: 400 });
    }
  }

  // 3. Cooldown check
  if (challenge.lastApprovedPayoutAt) {
    const cooldownMs = (challenge.payoutCooldownDays ?? 14) * 24 * 60 * 60 * 1000;
    const eligibleAt = new Date(challenge.lastApprovedPayoutAt.getTime() + cooldownMs);
    if (new Date() < eligibleAt) {
      return NextResponse.json(
        { error: `Next payout available on ${eligibleAt.toISOString().slice(0, 10)}` },
        { status: 400 }
      );
    }
  }

  // 4. Profit share calculation
  const profitShare = challenge.profitSharePct ?? 80;
  const profit = round2(challenge.realizedBalance - challenge.startBalance);
  const baseAmount = round2(profit * profitShare / 100);
  if (baseAmount <= 0) {
    return NextResponse.json({ error: "Insufficient profit for payout" }, { status: 400 });
  }
  if (amount > baseAmount) {
    return NextResponse.json({ error: `Available payout is $${baseAmount.toFixed(2)}` }, { status: 400 });
  }

  // Check no pending payout for this challenge
  const existing = await prisma.payoutRequest.findFirst({
    where: { challengeId, status: { in: ["pending", "approved"] } },
  });
  if (existing) {
    return NextResponse.json({ error: "Payout already requested for this challenge" }, { status: 400 });
  }

  // 5. Refundable fee bonus (only on first payout — no prior paid requests)
  const priorPaid = await prisma.payoutRequest.findFirst({
    where: { challengeId, status: "paid" },
  });
  const bonus = (priorPaid === null && challenge.refundableFeeCents != null)
    ? challenge.refundableFeeCents / 100
    : 0;
  const finalAmount = round2(amount + bonus);

  const maxPayoutAmount = baseAmount;
  const feePct = 0;
  const platformFee = 0;
  const netAmount = finalAmount;

  const payout = await prisma.payoutRequest.create({
    data: {
      userId,
      challengeId,
      amount: round2(amount),
      maxPayoutAmount,
      feePct,
      platformFee,
      netAmount,
      walletAddress: addr,
      walletNetwork: network,
      currency: "USDT",
      baseAmountCents: Math.round(amount * 100),
      refundableFeeBonusCents: Math.round(bonus * 100),
      finalAmountCents: Math.round(finalAmount * 100),
    },
  });

  return NextResponse.json({ success: true, payout });
}
