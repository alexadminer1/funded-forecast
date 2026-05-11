// Email template: Challenge failed + Instant Reset CTA
// Triggered on: trade/buy or trade/sell (DrawdownViolatedError) OR cron/expire-challenges
// Status: DRAFT — TFP-style, awaiting заказчик copywriting review
// P0.10 — Wave 3 integration
//
// Failure reasons covered: drawdown_violated | expired | (NOT inactivity — P1)

import { buildBrandTemplate, buildKeyValueTable, escapeHtml } from "@/lib/email";

export type ChallengeFailReason =
  | "max_total_drawdown"
  | "max_daily_drawdown"
  | "expired";

export interface ChallengeFailedEmailData {
  username: string;
  planName: string;
  accountSize: number;
  reason: ChallengeFailReason;
  reasonDetail?: string; // human-readable: "Account fell below $4,600 (–8%)"
  instantResetUrl: string;
  instantResetPriceUsd: number; // 30% off — $27.99 / $69.99 / $139.99
}

const REASON_LABELS: Record<ChallengeFailReason, string> = {
  max_total_drawdown: "Max total drawdown exceeded",
  max_daily_drawdown: "Max daily drawdown exceeded",
  expired: "Challenge period expired before targets were met",
};

export function renderChallengeFailedEmail(data: ChallengeFailedEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const reasonLabel = REASON_LABELS[data.reason];

  const detailsRows = [
    { label: "Plan", value: data.planName },
    { label: "Account size", value: `$${data.accountSize.toLocaleString("en-US")}` },
    { label: "Reason", value: reasonLabel },
  ];
  if (data.reasonDetail) {
    detailsRows.push({ label: "Details", value: data.reasonDetail });
  }

  const detailsHtml = buildKeyValueTable(detailsRows);

  const resetPrice = `$${data.instantResetPriceUsd.toFixed(2)}`;

  const bodyHtml = `
    <p>Hi ${escapeHtml(data.username)},</p>
    <p>Your <strong>${escapeHtml(data.planName)}</strong> evaluation challenge has ended.</p>
    ${detailsHtml}
    <p>Don't let this stop you. Restart with a fresh account at a discounted price using Instant Reset:</p>
    <p style="margin:24px 0">
      <a href="${escapeHtml(data.instantResetUrl)}"
         style="display:inline-block;background:#22C55E;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
        Instant Reset — ${escapeHtml(resetPrice)}
      </a>
    </p>
    <p style="color:#6B7280;font-size:14px">
      Instant Reset gives you a new challenge with the same plan at 30% off the standard price.
      The risk parameters and rules stay the same.
    </p>
  `;

  const bodyText = [
    `Hi ${data.username},`,
    ``,
    `Your ${data.planName} evaluation challenge has ended.`,
    ``,
    `Plan: ${data.planName}`,
    `Account size: $${data.accountSize.toLocaleString("en-US")}`,
    `Reason: ${reasonLabel}`,
    data.reasonDetail ? `Details: ${data.reasonDetail}` : null,
    ``,
    `Restart with Instant Reset (30% off): ${resetPrice}`,
    data.instantResetUrl,
    ``,
    `Instant Reset gives you a new challenge with the same plan at a discounted price.`,
  ]
    .filter(Boolean)
    .join("\n");

  const { html, text } = buildBrandTemplate({
    heading: "Challenge ended",
    bodyHtml,
    bodyText,
  });

  return {
    subject: `Your ${data.planName} challenge has ended`,
    html,
    text,
  };
}
