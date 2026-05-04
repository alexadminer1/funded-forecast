export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  let body: { name?: string; email?: string; subject?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name    = (body.name    ?? "").trim();
  const email   = (body.email   ?? "").trim();
  const subject = (body.subject ?? "").trim();
  const message = (body.message ?? "").trim();

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }
  if (name.length > 100 || email.length > 200 || subject.length > 200 || message.length > 5000) {
    return NextResponse.json({ error: "Field too long" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // MVP: log to AuditLog. Email delivery (Resend/SES) — follow-up step.
  try {
    await prisma.auditLog.create({
      data: {
        actorId:    null,
        targetType: "contact_form",
        targetId:   email,
        category:   "contact",
        action:     "contact_form_submitted",
        metadata:   { name, email, subject, message: message.slice(0, 5000) },
      },
    });
  } catch (e) {
    console.error("[CONTACT] AuditLog failed", e);
    // Don't fail the user — they did their part. Still return ok.
  }

  return NextResponse.json({ ok: true });
}
