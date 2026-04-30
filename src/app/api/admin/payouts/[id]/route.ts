export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_STATUSES = ["pending", "approved", "rejected", "paid"] as const;
type Status = typeof ALLOWED_STATUSES[number];

// Allowed transitions: from -> to[]
const TRANSITIONS: Record<Status, Status[]> = {
  pending: ["approved", "rejected"],
  approved: ["paid", "rejected"],
  rejected: [],
  paid: [],
};

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const currentStatus = current.status as Status;

  // Validate transition
  if (currentStatus === newStatus) {
    return NextResponse.json({ error: `Already in status: ${newStatus}` }, { status: 400 });
  }
  if (!TRANSITIONS[currentStatus]?.includes(newStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from ${currentStatus} to ${newStatus}` },
      { status: 400 }
    );
  }

  // Field requirements per target status
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

  if (newStatus === "paid") {
    if (typeof txHash !== "string" || txHash.trim().length < 10) {
      return NextResponse.json(
        { error: "txHash required (min 10 chars)" },
        { status: 400 }
      );
    }
    data.txHash = txHash.trim().slice(0, 200);
    data.paidAt = new Date();
    if (!current.processedAt) {
      data.processedAt = new Date();
    }
  }

  const payout = await prisma.payoutRequest.update({ where: { id }, data });
  return NextResponse.json(payout);
}
