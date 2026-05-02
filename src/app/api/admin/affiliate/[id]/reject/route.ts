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
    return NextResponse.json({ error: "invalid_id", message: "Невалидный id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Невалидный JSON" }, { status: 400 });
  }

  const { adminLabel, rejectionReason } = body as Record<string, unknown>;

  if (typeof adminLabel !== "string" || adminLabel.trim() === "") {
    return NextResponse.json({ error: "invalid_body", message: "adminLabel обязателен" }, { status: 400 });
  }

  if (typeof rejectionReason !== "string") {
    return NextResponse.json({ error: "invalid_body", message: "rejectionReason обязателен" }, { status: 400 });
  }
  const reason = rejectionReason.trim();
  if (reason.length < 3 || reason.length > 500) {
    return NextResponse.json({ error: "invalid_body", message: "rejectionReason должен быть от 3 до 500 символов" }, { status: 400 });
  }

  const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
  if (!affiliate) {
    return NextResponse.json({ error: "not_found", message: "Заявка не найдена" }, { status: 404 });
  }
  if (affiliate.status !== "pending") {
    return NextResponse.json({ error: "not_pending", currentStatus: affiliate.status }, { status: 400 });
  }

  const updated = await prisma.affiliate.update({
    where: { id: affiliateId },
    data: {
      status: "rejected",
      rejectionReason: reason,
      approvedAt: null,
      approvedBy: null,
    },
  });

  // rejectionReason дублируется в metadata намеренно — AuditLog хранит снимок на момент действия
  await prisma.auditLog.create({
    data: {
      actorId: null,
      targetType: "Affiliate",
      targetId: String(affiliateId),
      category: "affiliate",
      action: "reject",
      metadata: {
        adminLabel: adminLabel.trim(),
        rejectionReason: reason,
      } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ affiliate: updated });
}
