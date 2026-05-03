export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { writeLedgerEntries, LedgerOperation } from "@/lib/affiliate/ledger";

const VALID_SCOPES = ["pending_only", "pending_and_available"] as const;
type ForfeitScope = typeof VALID_SCOPES[number];

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "forbidden", message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const affiliateId = parseInt(id, 10);
  if (isNaN(affiliateId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid affiliate id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Invalid JSON" }, { status: 400 });
  }

  const { adminLabel, reason, scope } = body as Record<string, unknown>;

  if (typeof adminLabel !== "string" || adminLabel.trim() === "") {
    return NextResponse.json({ error: "invalid_body", message: "adminLabel is required" }, { status: 400 });
  }

  if (typeof reason !== "string" || reason.trim() === "") {
    return NextResponse.json({ error: "invalid_body", message: "reason is required" }, { status: 400 });
  }

  if (!VALID_SCOPES.includes(scope as ForfeitScope)) {
    return NextResponse.json(
      { error: "invalid_scope", message: "scope must be 'pending_only' or 'pending_and_available'" },
      { status: 400 },
    );
  }

  const forfeitScope = scope as ForfeitScope;

  const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
  if (!affiliate) {
    return NextResponse.json({ error: "not_found", message: "Affiliate not found" }, { status: 404 });
  }
  if (["pending", "rejected"].includes(affiliate.status)) {
    return NextResponse.json({ error: "invalid_status_for_forfeit", currentStatus: affiliate.status }, { status: 400 });
  }

  const { updated, pendingForfeited, availableForfeited } = await prisma.$transaction(async (tx) => {
    const current = await tx.affiliate.findUniqueOrThrow({
      where:  { id: affiliateId },
      select: { balancePending: true, balanceAvailable: true },
    });

    const pendingAmount   = current.balancePending;
    const availableAmount = forfeitScope === "pending_and_available" ? current.balanceAvailable : 0;

    const operations: LedgerOperation[] = [];

    if (pendingAmount > 0) {
      operations.push({
        type:   "adjustment_debit",
        bucket: "pending",
        amount: -pendingAmount,
        reason: `admin_forfeit_${forfeitScope}`,
      });
    }

    if (forfeitScope === "pending_and_available" && availableAmount > 0) {
      operations.push({
        type:   "adjustment_debit",
        bucket: "available",
        amount: -availableAmount,
        reason: `admin_forfeit_${forfeitScope}`,
      });
    }

    if (operations.length > 0) {
      await writeLedgerEntries(affiliateId, operations, tx);
    }

    await tx.auditLog.create({
      data: {
        actorId:    null,
        targetType: "Affiliate",
        targetId:   String(affiliateId),
        category:   "affiliate",
        action:     forfeitScope === "pending_only" ? "forfeit_pending" : "forfeit_pending_and_available",
        metadata:   {
          adminLabel:         adminLabel.trim(),
          reason:             reason.trim(),
          scope:              forfeitScope,
          pendingForfeited:   pendingAmount,
          availableForfeited: availableAmount,
        } as Prisma.InputJsonValue,
      },
    });

    const aff = await tx.affiliate.findUniqueOrThrow({ where: { id: affiliateId } });
    return { updated: aff, pendingForfeited: pendingAmount, availableForfeited: availableAmount };
  });

  return NextResponse.json({
    affiliate: updated,
    forfeited: {
      pending:   pendingForfeited,
      available: availableForfeited,
    },
  });
}
