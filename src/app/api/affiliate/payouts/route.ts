export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { limiters } from "@/lib/ratelimit";
import {
  getPayoutBlockingReason,
  getAvailableConversionsForPayout,
  getNetworkForMethod,
  getMinPayoutForMethod,
} from "@/lib/affiliate/payout";
import { maskWallet } from "@/lib/affiliate/wallet";

function getRawIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  return (forwarded ? forwarded.split(",")[0].trim() : null)
    ?? req.headers.get("x-real-ip")
    ?? null;
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

  // Rate limit: 1 request per day per user
  const rl = await limiters.payoutRequest.limit(`user:${userId}`);
  if (!rl.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // Body must be empty object {} per MVP design
  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.trim().length > 0) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Pre-load affiliate
  const affiliate = await prisma.affiliate.findUnique({
    where: { userId },
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      paymentWallet: true,
      walletLockUntil: true,
      balanceAvailable: true,
    },
  });

  if (!affiliate) {
    return NextResponse.json({ error: "not_an_affiliate" }, { status: 403 });
  }
  if (affiliate.status !== "approved") {
    return NextResponse.json({ error: "affiliate_not_approved" }, { status: 403 });
  }

  // Eligibility check (outside tx for fast-fail)
  const { reason, minRequired } = await getPayoutBlockingReason(affiliate, prisma);
  if (reason) {
    return NextResponse.json({ error: reason, minRequired }, { status: 409 });
  }

  // From here all DB work is atomic
  const ipAddress = getRawIp(req);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-fetch inside tx to avoid TOCTOU
      const fresh = await tx.affiliate.findUnique({
        where: { id: affiliate.id },
        select: {
          id: true,
          status: true,
          paymentMethod: true,
          paymentWallet: true,
          walletLockUntil: true,
          balanceAvailable: true,
        },
      });
      if (!fresh || fresh.status !== "approved") {
        throw new Error("affiliate_state_changed");
      }

      const recheck = await getPayoutBlockingReason(fresh, tx);
      if (recheck.reason) {
        throw new Error(`blocking:${recheck.reason}`);
      }

      const { ids, totalAmount } = await getAvailableConversionsForPayout(fresh.id, tx);
      if (ids.length === 0 || totalAmount <= 0) {
        throw new Error("blocking:no_approved_conversions");
      }
      if (totalAmount < recheck.minRequired) {
        throw new Error("blocking:balance_below_min");
      }

      const network = getNetworkForMethod(fresh.paymentMethod!);

      const payout = await tx.affiliatePayout.create({
        data: {
          affiliateId: fresh.id,
          amount: totalAmount,
          networkFee: 0,
          amountAfterFee: totalAmount,
          paymentMethod: fresh.paymentMethod!,
          paymentWallet: fresh.paymentWallet!,
          network,
          status: "requested",
          requestedAt: new Date(),
          includedConversionIds: ids,
        },
        select: {
          id: true,
          amount: true,
          status: true,
          paymentMethod: true,
          paymentWallet: true,
          network: true,
          requestedAt: true,
        },
      });

      await tx.affiliateConversion.updateMany({
        where: { id: { in: ids } },
        data: { payoutId: payout.id },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          targetType: "affiliate_payout",
          targetId: String(payout.id),
          category: "affiliate_payout",
          action: "payout_requested",
          metadata: {
            affiliateId: fresh.id,
            amount: totalAmount,
            method: fresh.paymentMethod,
            wallet: maskWallet(fresh.paymentWallet!),
            network,
            conversionsCount: ids.length,
          },
          ipAddress,
        },
      });

      return payout;
    });

    return NextResponse.json({
      ok: true,
      payout: {
        id: result.id,
        amount: result.amount,
        status: result.status,
        paymentMethod: result.paymentMethod,
        paymentWallet: maskWallet(result.paymentWallet),
        network: result.network,
        requestedAt: result.requestedAt,
      },
    });
  } catch (e: any) {
    const msg = e?.message ?? "";
    if (msg.startsWith("blocking:")) {
      return NextResponse.json(
        { error: msg.slice("blocking:".length) },
        { status: 409 },
      );
    }
    if (msg === "affiliate_state_changed") {
      return NextResponse.json({ error: "affiliate_state_changed" }, { status: 409 });
    }
    // Unique constraint violation from partial index → race condition
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "active_payout_exists" }, { status: 409 });
    }
    console.error("payout_request_error", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
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
  const { userId } = payload;

  const affiliate = await prisma.affiliate.findUnique({
    where: { userId },
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      paymentWallet: true,
      walletLockUntil: true,
      walletRequiresReview: true,
      balanceAvailable: true,
    },
  });

  if (!affiliate) {
    return NextResponse.json({ error: "not_an_affiliate" }, { status: 404 });
  }
  if (affiliate.status !== "approved") {
    return NextResponse.json({ error: "affiliate_not_approved" }, { status: 403 });
  }

  const { reason: blockingReason, minRequired: minPayoutForCurrentMethod } =
    await getPayoutBlockingReason(affiliate, prisma);

  const payouts = await prisma.affiliatePayout.findMany({
    where: { affiliateId: affiliate.id },
    orderBy: { requestedAt: "desc" },
    select: {
      id: true,
      status: true,
      amount: true,
      networkFee: true,
      amountAfterFee: true,
      paymentMethod: true,
      paymentWallet: true,
      network: true,
      requestedAt: true,
      approvedAt: true,
      processedAt: true,
      completedAt: true,
      failedAt: true,
      cancelledAt: true,
      failureReason: true,
      adminNote: true,
      transactionHash: true,
      includedConversionIds: true,
    },
  });

  const payoutsView = payouts.map((p) => {
    const conversionsCount = Array.isArray(p.includedConversionIds)
      ? (p.includedConversionIds as unknown[]).length
      : 0;
    return {
      id: p.id,
      status: p.status,
      amount: p.amount,
      networkFee: p.networkFee,
      amountAfterFee: p.amountAfterFee,
      paymentMethod: p.paymentMethod,
      paymentWallet: maskWallet(p.paymentWallet),
      network: p.network,
      requestedAt: p.requestedAt,
      approvedAt: p.approvedAt,
      processedAt: p.processedAt,
      completedAt: p.completedAt,
      failedAt: p.failedAt,
      cancelledAt: p.cancelledAt,
      failureReason: p.failureReason,
      adminNote: p.adminNote,
      transactionHash: p.transactionHash,
      conversionsCount,
    };
  });

  return NextResponse.json({
    availableBalance: affiliate.balanceAvailable,
    minPayoutForCurrentMethod,
    canRequestPayout: blockingReason === null,
    blockingReason,
    paymentMethod: affiliate.paymentMethod,
    paymentWallet: affiliate.paymentWallet ? maskWallet(affiliate.paymentWallet) : null,
    walletLockUntil: affiliate.walletLockUntil,
    walletRequiresReview: affiliate.walletRequiresReview,
    payouts: payoutsView,
  });
}
