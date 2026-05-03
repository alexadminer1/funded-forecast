export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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

  const { adminLabel, reason } = body as Record<string, unknown>;

  if (typeof adminLabel !== "string" || adminLabel.trim() === "") {
    return NextResponse.json({ error: "invalid_body", message: "adminLabel is required" }, { status: 400 });
  }

  if (typeof reason !== "string" || reason.trim() === "") {
    return NextResponse.json({ error: "invalid_body", message: "reason is required" }, { status: 400 });
  }

  const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
  if (!affiliate) {
    return NextResponse.json({ error: "not_found", message: "Affiliate not found" }, { status: 404 });
  }
  if (affiliate.status !== "approved") {
    return NextResponse.json({ error: "invalid_status_for_suspend", currentStatus: affiliate.status }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const aff = await tx.affiliate.update({
      where: { id: affiliateId },
      data: {
        status:      "suspended",
        suspendedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId:    null,
        targetType: "Affiliate",
        targetId:   String(affiliateId),
        category:   "affiliate",
        action:     "suspend",
        metadata:   { adminLabel: adminLabel.trim(), reason: reason.trim() } as Prisma.InputJsonValue,
      },
    });

    return aff;
  });

  return NextResponse.json({ affiliate: updated });
}
