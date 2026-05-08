import { Resend } from "resend";

const FROM_ADDR = "FundedForecast <noreply@tradepredictions.online>";

let _resend: Resend | null | undefined;
function getResend(): Resend | null {
  if (_resend !== undefined) return _resend;
  _resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  return _resend;
}

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type SendEmailResult = { ok: true; id?: string } | { ok: false; error: string };

/**
 * Send an email via Resend. Best-effort — never throws.
 * Returns { ok: false, error } if RESEND_API_KEY missing or Resend rejects.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const resend = getResend();
  if (!resend) {
    console.warn("[EMAIL] RESEND_API_KEY not configured — skipping send");
    return { ok: false, error: "no_api_key" };
  }

  try {
    const result = await resend.emails.send({
      from: FROM_ADDR,
      to: Array.isArray(params.to) ? params.to : [params.to],
      replyTo: params.replyTo,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (result.error) {
      console.error("[EMAIL] Resend error", result.error);
      return { ok: false, error: String(result.error.message ?? result.error) };
    }

    console.log("[EMAIL] sent", result.data?.id);
    return { ok: true, id: result.data?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[EMAIL] send failed", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Wrap content in FundedForecast brand template (light theme, green accent).
 * Returns both html and text variants.
 */
export type EmailTemplateParams = {
  heading: string;
  /** HTML body (already escaped). Inserted between heading and footer. */
  bodyHtml: string;
  /** Plain text body, used for text/plain variant. */
  bodyText: string;
  /** Footer line (default: "Sent automatically by FundedForecast"). */
  footer?: string;
};

export function buildBrandTemplate(params: EmailTemplateParams): { html: string; text: string } {
  const footer = params.footer ?? "Sent automatically by FundedForecast";
  const html = `
<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#1F2937">
  <h2 style="color:#22C55E;margin:0 0 16px">${escapeHtml(params.heading)}</h2>
  ${params.bodyHtml}
  <p style="color:#9CA3AF;font-size:12px;margin-top:24px">${escapeHtml(footer)}</p>
</div>`.trim();

  const text = `${params.heading}\n\n${params.bodyText}\n\n${footer}`;

  return { html, text };
}

/** Escape HTML special chars in user-provided strings. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Build the standard key-value table used in transactional emails. */
export function buildKeyValueTable(rows: Array<{ label: string; value: string; valueHtml?: string }>): string {
  const cells = rows
    .map(
      (r) => `
    <tr>
      <td style="padding:8px 0;color:#6B7280;width:140px">${escapeHtml(r.label)}</td>
      <td style="padding:8px 0"><strong>${r.valueHtml ?? escapeHtml(r.value)}</strong></td>
    </tr>`
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:16px">${cells}</table>`;
}
