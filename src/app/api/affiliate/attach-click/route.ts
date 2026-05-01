export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function auth(req: NextRequest): number | null {
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = auth(request);
  if (!userId) {
    return NextResponse.json(
      { error: "unauthorized", message: "Authentication required" },
      { status: 401 },
    );
  }

  const cookieId = request.cookies.get("aff_id")?.value;
  if (!cookieId) {
    return NextResponse.json({ attached: false, reason: "no_cookie" });
  }

  try {
    const click = await prisma.affiliateClick.findFirst({
      where:   { cookieId },
      orderBy: { createdAt: "desc" },
      include: {
        affiliate: {
          select: { userId: true, status: true },
        },
      },
    });

    if (!click) {
      return NextResponse.json({ attached: false, reason: "click_not_found" });
    }

    if (click.expiresAt <= new Date()) {
      return NextResponse.json({ attached: false, reason: "expired" });
    }

    if (click.convertedToUserId === userId) {
      return NextResponse.json({ attached: true, reason: "already_attached" });
    }

    if (click.convertedToUserId !== null) {
      return NextResponse.json({ attached: false, reason: "already_attached_to_other_user" });
    }

    if (click.affiliate.status !== "approved") {
      return NextResponse.json({ attached: false, reason: "affiliate_not_approved" });
    }

    if (click.affiliate.userId === userId) {
      return NextResponse.json({ attached: false, reason: "self_referral" });
    }

    await prisma.affiliateClick.update({
      where: { id: click.id },
      data:  { convertedToUserId: userId },
    });

    return NextResponse.json({ attached: true });
  } catch (err) {
    console.warn("[AFFILIATE_ATTACH] failed", err);
    return NextResponse.json(
      { error: "affiliate_attach_failed", message: "Failed to attach affiliate click" },
      { status: 500 },
    );
  }
}
