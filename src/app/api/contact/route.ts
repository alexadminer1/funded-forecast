export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDR = "FundedForecast <onboarding@resend.dev>";
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

  // 2. Email delivery via Resend (best-effort — don't fail user if it fails)
  if (resend && RECIPIENT) {
    try {
      const safeName    = name.replace(/[<>]/g, "");
      const safeSubject = subject.replace(/[<>\r\n]/g, "");
      const safeMessage = message.replace(/[<>]/g, "").replace(/\n/g, "<br>");

      const result = await resend.emails.send({
        from:     FROM_ADDR,
        to:       [RECIPIENT],
        replyTo:  email,
        subject:  `[Contact form] ${safeSubject}`,
        html: `
<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#1F2937">
  <h2 style="color:#22C55E;margin:0 0 16px">New contact form submission</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <tr><td style="padding:8px 0;color:#6B7280;width:100px">From:</td><td style="padding:8px 0"><strong>${safeName}</strong></td></tr>
    <tr><td style="padding:8px 0;color:#6B7280">Email:</td><td style="padding:8px 0"><a href="mailto:${email}" style="color:#22C55E">${email}</a></td></tr>
    <tr><td style="padding:8px 0;color:#6B7280">Subject:</td><td style="padding:8px 0">${safeSubject}</td></tr>
  </table>
  <div style="background:#F9FAFB;padding:16px;border-radius:8px;border-left:3px solid #22C55E">
    <div style="color:#374151;line-height:1.6">${safeMessage}</div>
  </div>
  <p style="color:#9CA3AF;font-size:12px;margin-top:24px">Sent via FundedForecast contact form</p>
</div>`,
        text: `New contact form submission\n\nFrom: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
      });

      if (result.error) {
        console.error("[CONTACT] Resend error", result.error);
      } else {
        console.log("[CONTACT] Email sent", result.data?.id);
      }
    } catch (e) {
      console.error("[CONTACT] Email send failed", e);
    }
  } else {
    console.warn("[CONTACT] Resend not configured (RESEND_API_KEY or CONTACT_RECIPIENT_EMAIL missing) — submission logged to AuditLog only");
  }

  return NextResponse.json({ ok: true });
}
