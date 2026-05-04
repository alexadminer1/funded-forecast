export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { writeLedgerEntries, LedgerOperation } from "@/lib/affiliate/ledger";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

function getRawIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  return (forwarded ? forwarded.split(",")[0].trim() : null)
    ?? req.headers.get("x-real-ip")
    ?? null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "forbidden", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const payoutId = parseInt(id, 10);
  if (isNaN(payoutId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid payout id" }, { status: 400 });
  }

  let body: any = {};
  try {
    const text = await req.text();
    if (text.trim().length > 0) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON" }, { status: 400 });
  }

  const adminLabel = typeof body?.adminLabel === "string" && body.adminLabel.trim().length > 0
    ? body.adminLabel.trim()
    : null;
  if (!adminLabel) {
    return NextResponse.json({ error: "admin_label_required", message: "adminLabel required" }, { status: 400 });
  }

  const transactionHash = typeof body?.transactionHash === "string" && body.transactionHash.trim().length > 0
    ? body.transactionHash.trim()
    : null;
  const adminNote = typeof body?.adminNote === "string" && body.adminNote.trim().length > 0
    ? body.adminNote.trim()
    : null;
  const reason = typeof body?.reason === "string" && body.reason.trim().length > 0
    ? body.reason.trim()
    : null;

  // Pre-check: transactionHash uniqueness (fast-fail outside tx)
  if (transactionHash) {
    const existing = await prisma.affiliatePayout.findUnique({
      where: { transactionHash },
      select: { id: true },
    });
    if (existing && existing.id !== payoutId) {
      return NextResponse.json(
        { error: "transaction_hash_already_used", message: "transactionHash already used by another payout" },
        { status: 409 },
      );
    }
  }

  const ipAddress = getRawIp(req);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payout = await tx.affiliatePayout.findUnique({
        where: { id: payoutId },
        select: {
          id: true,
          status: true,
          affiliateId: true,
          amount: true,
          paymentMethod: true,
          paymentWallet: true,
          network: true,
          includedConversionIds: true,
        },
      });
      if (!payout) {
        throw new Error("not_found");
      }
      if (payout.status !== "approved") {
        throw new Error(`invalid_transition:${payout.status}`);
      }
      if (payout.amount <= 0) {
        throw new Error("zero_amount");
      }

      const conversionIds = Array.isArray(payout.includedConversionIds)
        ? (payout.includedConversionIds as unknown[]).filter((x): x is number => typeof x === "number")
        : [];

      // 1. Update payout to completed
      const updated = await tx.affiliatePayout.update({
        where: { id: payoutId },
        data: {
          status: "completed",
          completedAt: new Date(),
          ...(transactionHash !== null ? { transactionHash } : {}),
          ...(adminNote !== null ? { adminNote } : {}),
        },
        select: {
          id: true,
          status: true,
          amount: true,
          completedAt: true,
          transactionHash: true,
          adminNote: true,
        },
      });

      // 2. Ledger: payout_paid in available bucket, amount = -payout.amount
      const operations: LedgerOperation[] = [{
        type: "payout_paid",
        bucket: "available",
        amount: -payout.amount,
        payoutId: payout.id,
        reason: `payout_completed`,
        createdByAdmin: adminLabel,
      }];
      const { operationGroupId } = await writeLedgerEntries(payout.affiliateId, operations, tx);

      // 3. Increment lifetimePaid
      await tx.affiliate.update({
        where: { id: payout.affiliateId },
        data: { lifetimePaid: { increment: payout.amount } },
      });

      // 4. Move included conversions to status=paid
      let conversionsPaidCount = 0;
      if (conversionIds.length > 0) {
        const result = await tx.affiliateConversion.updateMany({
          where: { id: { in: conversionIds }, payoutId },
          data: { status: "paid" },
        });
        conversionsPaidCount = result.count;
      }

      // 5. Audit
      await tx.auditLog.create({
        data: {
          actorId: null,
          targetType: "affiliate_payout",
          targetId: String(payoutId),
          category: "affiliate_payout",
          action: "payout_completed",
          metadata: {
            affiliateId: payout.affiliateId,
            amount: payout.amount,
            adminLabel,
            transactionHash: transactionHash || null,
            adminNote: adminNote || null,
            reason: reason || null,
            paymentMethod: payout.paymentMethod,
            network: payout.network,
            conversionsPaidCount,
            operationGroupId,
          } as Prisma.InputJsonValue,
          ipAddress,
        },
      });

      // 6. Re-fetch affiliate for return
      const affiliateAfter = await tx.affiliate.findUniqueOrThrow({
        where: { id: payout.affiliateId },
        select: {
          id: true,
          balancePending: true,
          balanceAvailable: true,
          balanceFrozen: true,
          balanceNegative: true,
          lifetimePaid: true,
          lifetimeEarned: true,
        },
      });

      return { payout: updated, affiliate: affiliateAfter, conversionsPaidCount, operationGroupId };
    });

    return NextResponse.json({
      ok: true,
      payout: result.payout,
      affiliate: result.affiliate,
      conversionsPaidCount: result.conversionsPaidCount,
      operationGroupId: result.operationGroupId,
    });
  } catch (e: any) {
    const msg = e?.message ?? "";
    if (msg === "not_found") {
      return NextResponse.json({ error: "not_found", message: "Payout not found" }, { status: 404 });
    }
    if (msg.startsWith("invalid_transition:")) {
      const current = msg.slice("invalid_transition:".length);
      return NextResponse.json(
        { error: "invalid_transition", message: `Cannot complete payout in status: ${current}`, currentStatus: current },
        { status: 409 },
      );
    }
    if (msg === "zero_amount") {
      return NextResponse.json({ error: "zero_amount", message: "Payout amount is zero" }, { status: 409 });
    }
    // Race on transactionHash unique constraint inside tx
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "transaction_hash_already_used", message: "transactionHash already used" },
        { status: 409 },
      );
    }
    console.error("payout_complete_error", e);
    return NextResponse.json({ error: "internal", message: "Internal error" }, { status: 500 });
  }
}
