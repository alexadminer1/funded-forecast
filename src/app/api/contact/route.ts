export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildBrandTemplate, buildKeyValueTable, escapeHtml } from "@/lib/email";

const RECIPIENT = process.env.CONTACT_RECIPIENT_EMAIL ?? "";

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

  // 1. Audit log (always, even if email fails)
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
  }

  // 2. Email delivery via shared helper (best-effort)
  if (RECIPIENT) {
    const messageHtml = escapeHtml(message).replace(/\n/g, "<br>");

    const bodyHtml = `
${buildKeyValueTable([
  { label: "From",    value: name },
  { label: "Email",   valueHtml: `<a href="mailto:${escapeHtml(email)}" style="color:#22C55E">${escapeHtml(email)}</a>`, value: email },
  { label: "Subject", value: subject },
])}
<div style="background:#F9FAFB;padding:16px;border-radius:8px;border-left:3px solid #22C55E">
  <div style="color:#374151;line-height:1.6">${messageHtml}</div>
</div>`;

    const bodyText = `From: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`;

    const tpl = buildBrandTemplate({
      heading: "New contact form submission",
      bodyHtml,
      bodyText,
      footer: "Sent via FundedForecast contact form",
    });

    await sendEmail({
      to: RECIPIENT,
      replyTo: email,
      subject: `[Contact form] ${subject.replace(/[\r\n]/g, "")}`,
      html: tpl.html,
      text: tpl.text,
    });
  } else {
    console.warn("[CONTACT] CONTACT_RECIPIENT_EMAIL missing — submission logged to AuditLog only");
  }

  return NextResponse.json({ ok: true });
}
