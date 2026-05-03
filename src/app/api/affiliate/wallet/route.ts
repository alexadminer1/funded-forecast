export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { limiters } from "@/lib/ratelimit";
import { WALLET } from "@/lib/affiliate/constants";
import {
  isWalletLocked,
  validateWalletAddress,
  SUPPORTED_METHODS,
  maskWallet,
} from "@/lib/affiliate/wallet";
import { AffiliatePaymentMethod } from "@prisma/client";

function getRawIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  return (forwarded ? forwarded.split(",")[0].trim() : null) ??
    req.headers.get("x-real-ip") ??
    null;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(authHeader.slice(7));
  if (!payload) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const affiliate = await prisma.affiliate.findUnique({
    where: { userId: payload.userId },
    select: {
      status: true,
      paymentMethod: true,
      paymentWallet: true,
      walletChangedAt: true,
      walletLockUntil: true,
      walletRequiresReview: true,
    },
  });

  if (!affiliate) {
    return NextResponse.json({ error: "not_an_affiliate" }, { status: 404 });
  }
  if (affiliate.status !== "approved") {
    return NextResponse.json({ error: "affiliate_not_approved" }, { status: 403 });
  }

  return NextResponse.json({
    paymentMethod: affiliate.paymentMethod,
    paymentWallet: affiliate.paymentWallet,
    walletChangedAt: affiliate.walletChangedAt,
    walletLockUntil: affiliate.walletLockUntil,
    walletRequiresReview: affiliate.walletRequiresReview,
    isLocked: isWalletLocked(affiliate.walletLockUntil),
    supportedMethods: SUPPORTED_METHODS,
  });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(authHeader.slice(7));
  if (!payload) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { userId } = payload;

  const rl = await limiters.walletUpdate.limit(`user:${userId}`);
  if (!rl.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { paymentMethod, paymentWallet } = body as Record<string, unknown>;
  if (typeof paymentMethod !== "string" || typeof paymentWallet !== "string" || paymentWallet.trim() === "") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // a) affiliate exists & approved
  const affiliate = await prisma.affiliate.findUnique({
    where: { userId },
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      paymentWallet: true,
      walletLockUntil: true,
    },
  });

  if (!affiliate) {
    return NextResponse.json({ error: "not_an_affiliate" }, { status: 403 });
  }
  if (affiliate.status !== "approved") {
    return NextResponse.json({ error: "affiliate_not_approved" }, { status: 403 });
  }

  // b) wallet lock check
  if (isWalletLocked(affiliate.walletLockUntil)) {
    return NextResponse.json(
      { error: "wallet_locked", until: affiliate.walletLockUntil },
      { status: 423 },
    );
  }

  // c) supported method
  if (!SUPPORTED_METHODS.includes(paymentMethod)) {
    return NextResponse.json({ error: "unsupported_method" }, { status: 400 });
  }

  // d) address format validation
  const validation = validateWalletAddress(paymentMethod as AffiliatePaymentMethod, paymentWallet.trim());
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const walletTrimmed = paymentWallet.trim();

  // e) noop check
  if (
    paymentMethod === affiliate.paymentMethod &&
    walletTrimmed === affiliate.paymentWallet
  ) {
    return NextResponse.json({
      ok: true,
      noop: true,
      paymentMethod: affiliate.paymentMethod,
      paymentWallet: affiliate.paymentWallet,
      walletLockUntil: affiliate.walletLockUntil,
    });
  }

  const oldWallet = affiliate.paymentWallet;
  const oldMethod = affiliate.paymentMethod;
  const now = new Date();
  const lockUntil = new Date(now.getTime() + WALLET.changeLockDays * 24 * 60 * 60 * 1000);
  const walletRequiresReview = oldWallet === null ? false : WALLET.changeRequiresReview;
  const action = oldWallet === null ? "wallet_set" : "wallet_changed";
  const ipAddress = getRawIp(req);

  const [updated] = await prisma.$transaction([
    prisma.affiliate.update({
      where: { id: affiliate.id },
      data: {
        paymentMethod: paymentMethod as AffiliatePaymentMethod,
        paymentWallet: walletTrimmed,
        walletChangedAt: now,
        walletLockUntil: lockUntil,
        walletRequiresReview,
      },
      select: {
        paymentMethod: true,
        paymentWallet: true,
        walletLockUntil: true,
        walletRequiresReview: true,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId: userId,
        targetType: "affiliate",
        targetId: String(affiliate.id),
        category: "affiliate_wallet",
        action,
        metadata: {
          oldMethod: oldMethod ?? null,
          oldWallet: oldWallet ? maskWallet(oldWallet) : null,
          newMethod: paymentMethod,
          newWallet: maskWallet(walletTrimmed),
          lockUntil,
        },
        ipAddress,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    paymentMethod: updated.paymentMethod,
    paymentWallet: updated.paymentWallet,
    walletLockUntil: updated.walletLockUntil,
    walletRequiresReview: updated.walletRequiresReview,
  });
}
