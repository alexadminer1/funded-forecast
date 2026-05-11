// Email template: Challenge passed
// Triggered on: trade/sell auto-pass logic OR cron/expire-challenges (when targets met)
// Status: DRAFT — TFP-style, awaiting заказчик copywriting review
// P0.10 — Wave 3 integration (replaces existing draft in trade/sell/route.ts:323)

import { buildBrandTemplate, buildKeyValueTable, escapeHtml } from "@/lib/email";

export interface ChallengePassedEmailData {
  username: string;
  planName: string;
  accountSize: number;
  profitEarned: number;        // in USD, e.g. 152.43
  profitTargetPct: number;     // e.g. 15
  tradingDaysCompleted: number;
  resolvedPositionsCount: number;
  uniqueEventsCount: number;
  payoutRequestUrl: string;    // /account/payouts or similar
}

function formatUsd(n: number): string {
  const sign = n >= 0 ? "" : "-";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function renderChallengePassedEmail(data: ChallengePassedEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const detailsHtml = buildKeyValueTable([
    { label: "Plan", value: data.planName },
    { label: "Account size", value: `$${data.accountSize.toLocaleString("en-US")}` },
    { label: "Profit earned", value: formatUsd(data.profitEarned) },
    { label: "Profit target", value: `${data.profitTargetPct}%` },
    { label: "Trading days", value: String(data.tradingDaysCompleted) },
    { label: "Resolved positions", value: String(data.resolvedPositionsCount) },
    { label: "Unique events", value: String(data.uniqueEventsCount) },
  ]);

  const bodyHtml = `
    <p>Congratulations, ${escapeHtml(data.username)}.</p>
    <p>You have successfully passed your <strong>${escapeHtml(data.planName)}</strong> evaluation challenge.</p>
    ${detailsHtml}
    <p>Your account is now eligible for payout. Request your first payout from the account page.</p>
    <p style="margin:24px 0">
      <a href="${escapeHtml(data.payoutRequestUrl)}"
         style="display:inline-block;background:#22C55E;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
        Request Payout
      </a>
    </p>
    <p style="color:#6B7280;font-size:14px">
      Payouts are subject to KYC verification and consistency checks.
    </p>
  `;

  const bodyText = [
    `Congratulations, ${data.username}.`,
    ``,
    `You have successfully passed your ${data.planName} evaluation challenge.`,
    ``,
    `Plan: ${data.planName}`,
    `Account size: $${data.accountSize.toLocaleString("en-US")}`,
    `Profit earned: ${formatUsd(data.profitEarned)}`,
    `Profit target: ${data.profitTargetPct}%`,
    `Trading days: ${data.tradingDaysCompleted}`,
    `Resolved positions: ${data.resolvedPositionsCount}`,
    `Unique events: ${data.uniqueEventsCount}`,
    ``,
    `Request payout: ${data.payoutRequestUrl}`,
    ``,
    `Payouts are subject to KYC verification and consistency checks.`,
  ].join("\n");

  const { html, text } = buildBrandTemplate({
    heading: "Challenge passed",
    bodyHtml,
    bodyText,
  });

  return {
    subject: `You passed the ${data.planName} challenge`,
    html,
    text,
  };
}
