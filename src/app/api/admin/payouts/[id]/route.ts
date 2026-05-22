export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPayoutTx } from "@/lib/onchain-verify";

const ALLOWED_STATUSES = ["pending", "approved", "rejected", "paid"] as const;
type Status = (typeof ALLOWED_STATUSES)[number];

// Allowed transitions: from -> to[]
// pending_verification is set programmatically (not directly by admin via status field)
const TRANSITIONS: Record<Status, Status[]> = {
  pending: ["approved", "rejected"],
  approved: ["paid", "rejected"],
  rejected: [],
  paid: [],
};

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid payout id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { status, txHash, rejectionReason } = body as {
    status?: unknown;
    txHash?: unknown;
    rejectionReason?: unknown;
  };

  // Validate status
  if (typeof status !== "string" || !ALLOWED_STATUSES.includes(status as Status)) {
    return NextResponse.json(
      { error: `Status must be one of: ${ALLOWED_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }
  const newStatus = status as Status;

  // Load current payout
  const current = await prisma.payoutRequest.findUnique({ where: { id } });
  if (!current) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }

  // pending_verification is a system state — treat it as approved for transition purposes
  const effectiveCurrentStatus =
    current.status === "pending_verification" ? "approved" : (current.status as Status);

  // Validate transition
  if (effectiveCurrentStatus === newStatus) {
    return NextResponse.json(
      { error: `Already in status: ${newStatus}` },
      { status: 400 }
    );
  }
  if (!TRANSITIONS[effectiveCurrentStatus]?.includes(newStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from ${current.status} to ${newStatus}` },
      { status: 400 }
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // PAID transition: on-chain verification required
  // ─────────────────────────────────────────────────────────────────────
  if (newStatus === "paid") {
    if (typeof txHash !== "string" || txHash.trim().length < 10) {
      return NextResponse.json(
        { error: "txHash required (min 10 chars)" },
        { status: 400 }
      );
    }
    const cleanTxHash = txHash.trim().slice(0, 200);

    if (!current.walletAddress) {
      return NextResponse.json(
        { error: "PayoutRequest has no walletAddress — cannot verify on-chain transfer" },
        { status: 400 }
      );
    }

    // Pre-check: reject if another payout already uses this txHash
    const conflicting = await prisma.payoutRequest.findFirst({
      where: { txHash: cleanTxHash, NOT: { id } },
      select: { id: true },
    });
    if (conflicting) {
      return NextResponse.json({ error: "tx_already_used" }, { status: 400 });
    }

    const expectedAmountCents =
      current.finalAmountCents ?? Math.round(current.netAmount * 100);

    const now = new Date();

    // Stage: save txHash and move to pending_verification
    await prisma.payoutRequest.update({
      where: { id },
      data: {
        txHash: cleanTxHash,
        status: "pending_verification",
        processedAt: current.processedAt ?? now,
        lastVerifyAttemptAt: now,
      },
    });

    // Run synchronous on-chain verification
    const result = await verifyPayoutTx({
      txHash: cleanTxHash,
      expectedRecipient: current.walletAddress,
      expectedAmountCents,
      payoutRequestId: id,
    });

    if (result.ok) {
      // Verification passed → complete the payout
      const [payout] = await prisma.$transaction([
        prisma.payoutRequest.update({
          where: { id },
          data: {
            status: "paid",
            paidAt: now,
          },
        }),
        prisma.challenge.update({
          where: { id: current.challengeId },
          data: { lastApprovedPayoutAt: now },
        }),
        prisma.auditLog.create({
          data: {
            actorId: null,
            targetType: "PayoutRequest",
            targetId: String(id),
            category: "payout",
            action: "payout_completed",
            metadata: {
              txHash: cleanTxHash,
              confirmations: result.confirmations,
              source: "admin_sync",
            },
          },
        }),
      ]);
      return NextResponse.json(payout);
    }

    if (result.reason === "insufficient_confirmations") {
      // Not enough confirmations yet — leave in pending_verification, cron will retry
      await prisma.payoutRequest.update({
        where: { id },
        data: { verificationAttempts: { increment: 1 } },
      });
      return NextResponse.json(
        {
          status: "pending_verification",
          message: "Transaction found but needs more confirmations. Cron will retry.",
          confirmations: result.confirmations,
        },
        { status: 202 }
      );
    }

    if (result.reason === "rpc_error") {
      // Transient RPC failure — leave in pending_verification, do not count attempt
      return NextResponse.json(
        {
          status: "pending_verification",
          message: "RPC error during verification. Will retry automatically.",
        },
        { status: 503 }
      );
    }

    // Hard verification failure — roll back to approved, clear txHash
    await prisma.$transaction([
      prisma.payoutRequest.update({
        where: { id },
        data: {
          status: "approved",
          txHash: null,
          lastVerifyAttemptAt: now,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: null,
          targetType: "PayoutRequest",
          targetId: String(id),
          category: "payout",
          action: "payout_verification_rejected",
          metadata: {
            txHash: cleanTxHash,
            reason: result.reason,
          },
        },
      }),
    ]);

    return NextResponse.json(
      { error: result.reason },
      { status: 400 }
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // Other transitions (pending→approved, pending/approved→rejected)
  // ─────────────────────────────────────────────────────────────────────
  const data: Record<string, unknown> = { status: newStatus };

  if (newStatus === "rejected") {
    if (typeof rejectionReason !== "string" || rejectionReason.trim().length < 3) {
      return NextResponse.json(
        { error: "rejectionReason required (min 3 chars)" },
        { status: 400 }
      );
    }
    data.rejectionReason = rejectionReason.trim().slice(0, 500);
  }

  if (newStatus === "approved") {
    data.processedAt = new Date();
  }

  const payout = await prisma.payoutRequest.update({ where: { id }, data });
  return NextResponse.json(payout);
}
