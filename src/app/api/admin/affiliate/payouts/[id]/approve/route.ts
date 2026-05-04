export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  const reason = typeof body?.reason === "string" ? body.reason.trim() : null;
  const ipAddress = getRawIp(req);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payout = await tx.affiliatePayout.findUnique({
        where: { id: payoutId },
        select: { id: true, status: true, affiliateId: true, amount: true },
      });
      if (!payout) {
        throw new Error("not_found");
      }
      if (payout.status !== "requested") {
        throw new Error(`invalid_transition:${payout.status}`);
      }

      const updated = await tx.affiliatePayout.update({
        where: { id: payoutId },
        data: {
          status: "approved",
          approvedAt: new Date(),
          approvedBy: adminLabel,
        },
        select: {
          id: true,
          status: true,
          amount: true,
          approvedAt: true,
          approvedBy: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: null,
          targetType: "affiliate_payout",
          targetId: String(payoutId),
          category: "affiliate_payout",
          action: "payout_approved",
          metadata: {
            affiliateId: payout.affiliateId,
            amount: payout.amount,
            adminLabel,
            reason: reason || null,
          },
          ipAddress,
        },
      });

      return updated;
    });

    return NextResponse.json({ ok: true, payout: result });
  } catch (e: any) {
    const msg = e?.message ?? "";
    if (msg === "not_found") {
      return NextResponse.json({ error: "not_found", message: "Payout not found" }, { status: 404 });
    }
    if (msg.startsWith("invalid_transition:")) {
      const current = msg.slice("invalid_transition:".length);
      return NextResponse.json(
        { error: "invalid_transition", message: `Cannot approve payout in status: ${current}`, currentStatus: current },
        { status: 409 },
      );
    }
    console.error("payout_approve_error", e);
    return NextResponse.json({ error: "internal", message: "Internal error" }, { status: 500 });
  }
}
