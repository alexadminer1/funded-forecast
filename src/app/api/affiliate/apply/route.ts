export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { limiters } from "@/lib/ratelimit";
import { TERMS } from "@/lib/affiliate/constants";
import { validateRefCode, validateApplicationData } from "@/lib/affiliate/validation";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized", message: "Требуется авторизация" }, { status: 401 });
  }
  const payload = verifyToken(authHeader.slice(7));
  if (!payload) {
    return NextResponse.json({ error: "unauthorized", message: "Невалидный токен" }, { status: 401 });
  }
  const { userId } = payload;

  const rl = await limiters.affiliateApply.limit(`user:${userId}`);
  if (!rl.success) {
    return NextResponse.json({ error: "rate_limited", message: "Слишком много запросов. Попробуйте позже" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Невалидный JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid_body", message: "Тело запроса должно быть объектом" }, { status: 400 });
  }

  const { refCode: rawRefCode, applicationData } = body as Record<string, unknown>;

  if (typeof rawRefCode !== "string" || rawRefCode.trim() === "") {
    return NextResponse.json({ error: "invalid_refcode", message: "refCode обязателен" }, { status: 400 });
  }

  const refCode = rawRefCode.toLowerCase();

  const refCodeCheck = validateRefCode(refCode);
  if (!refCodeCheck.ok) {
    return NextResponse.json({ error: refCodeCheck.reason, message: refCodeCheck.message }, { status: 400 });
  }

  const appDataCheck = validateApplicationData(applicationData);
  if (!appDataCheck.ok) {
    return NextResponse.json({ error: appDataCheck.reason, message: appDataCheck.message }, { status: 400 });
  }

  const existing = await prisma.affiliate.findUnique({ where: { userId } });
  if (existing) {
    return NextResponse.json({ error: "already_applied", message: "У вас уже подана заявка" }, { status: 400 });
  }

  try {
    const affiliate = await prisma.affiliate.create({
      data: {
        userId,
        refCode,
        status: "pending",
        applicationData: applicationData as Prisma.InputJsonValue,
        acceptedTermsVersion: TERMS.currentVersion,
        acceptedTermsAt: new Date(),
        // parentId handled in later step
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        targetType: "Affiliate",
        targetId: String(affiliate.id),
        category: "affiliate",
        action: "apply",
        metadata: { refCode, applicationData } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(
      { affiliate: { id: affiliate.id, status: affiliate.status, refCode: affiliate.refCode, createdAt: affiliate.createdAt } },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const fields = (err.meta?.target as string[] | undefined) ?? [];
      if (fields.includes("refCode") || fields.includes("ref_code")) {
        return NextResponse.json({ error: "refcode_taken", message: "Этот реферальный код уже занят" }, { status: 409 });
      }
      if (fields.includes("userId") || fields.includes("user_id")) {
        return NextResponse.json({ error: "already_applied", message: "У вас уже подана заявка" }, { status: 400 });
      }
      return NextResponse.json({ error: "refcode_taken", message: "Этот реферальный код уже занят" }, { status: 409 });
    }
    throw err;
  }
}
