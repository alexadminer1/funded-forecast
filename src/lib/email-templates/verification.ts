// Email template: Email verification (registration)
// Triggered on: POST /api/register (after user creation)
// Status: DRAFT — TFP-style, awaiting заказчик copywriting review
// P0.10 — Wave 3 integration

import { buildBrandTemplate, buildKeyValueTable, escapeHtml } from "@/lib/email";

export interface VerificationEmailData {
  username: string;
  verificationUrl: string;
  expiresInHours?: number; // default 24
}

export function renderVerificationEmail(data: VerificationEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const expiresInHours = data.expiresInHours ?? 24;

  const bodyHtml = `
    <p>Welcome to FundedForecast, ${escapeHtml(data.username)}.</p>
    <p>Please confirm your email address to activate your account and start trading.</p>
    <p style="margin:24px 0">
      <a href="${escapeHtml(data.verificationUrl)}"
         style="display:inline-block;background:#22C55E;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
        Verify Email
      </a>
    </p>
    <p style="color:#6B7280;font-size:14px">
      Or copy this link into your browser:<br>
      <span style="color:#1F2937;word-break:break-all">${escapeHtml(data.verificationUrl)}</span>
    </p>
    <p style="color:#6B7280;font-size:14px">This link expires in ${expiresInHours} hours.</p>
  `;

  const bodyText = [
    `Welcome to FundedForecast, ${data.username}.`,
    ``,
    `Please confirm your email address to activate your account and start trading.`,
    ``,
    `Verify your email: ${data.verificationUrl}`,
    ``,
    `This link expires in ${expiresInHours} hours.`,
  ].join("\n");

  const { html, text } = buildBrandTemplate({
    heading: "Verify your email",
    bodyHtml,
    bodyText,
  });

  return {
    subject: "Verify your FundedForecast email",
    html,
    text,
  };
}
