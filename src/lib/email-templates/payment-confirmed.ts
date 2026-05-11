// Email template: Payment confirmed → challenge active
// Triggered on: cron/activate-payments (after CONFIRMED payment creates Challenge)
// Status: DRAFT — TFP-style, awaiting заказчик copywriting review
// P0.10 — Wave 3 integration

import { buildBrandTemplate, buildKeyValueTable, escapeHtml } from "@/lib/email";

export interface PaymentConfirmedEmailData {
  username: string;
  planName: string;        // e.g. "Pro"
  accountSize: number;     // e.g. 5000 (USD)
  profitTargetPct: number; // e.g. 15
  maxLossPct: number;      // e.g. 8
  dailyLossPct: number;    // e.g. 4
  minTradingDays: number;  // e.g. 15
  challengePeriodDays: number; // e.g. 30
  dashboardUrl: string;
  txHash: string;
  chainId: number;         // 8453 (mainnet) | 84532 (sepolia)
}

function formatUsd(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

function basescanUrl(txHash: string, chainId: number): string {
  const base = chainId === 8453 ? "https://basescan.org" : "https://sepolia.basescan.org";
  return `${base}/tx/${txHash}`;
}

export function renderPaymentConfirmedEmail(data: PaymentConfirmedEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const explorerUrl = basescanUrl(data.txHash, data.chainId);
  const shortTx = `${data.txHash.slice(0, 10)}...${data.txHash.slice(-8)}`;

  const detailsHtml = buildKeyValueTable([
    { label: "Plan", value: data.planName },
    { label: "Account size", value: formatUsd(data.accountSize) },
    { label: "Profit target", value: `${data.profitTargetPct}%` },
    { label: "Max total loss", value: `${data.maxLossPct}%` },
    { label: "Max daily loss", value: `${data.dailyLossPct}%` },
    { label: "Min trading days", value: String(data.minTradingDays) },
    { label: "Challenge period", value: `${data.challengePeriodDays} days` },
    {
      label: "Payment tx",
      value: shortTx,
      valueHtml: `<a href="${escapeHtml(explorerUrl)}" style="color:#22C55E;text-decoration:none">${escapeHtml(shortTx)}</a>`,
    },
  ]);

  const bodyHtml = `
    <p>Hi ${escapeHtml(data.username)},</p>
    <p>Your payment is confirmed on-chain and your evaluation challenge is now active.</p>
    ${detailsHtml}
    <p style="margin:24px 0">
      <a href="${escapeHtml(data.dashboardUrl)}"
         style="display:inline-block;background:#22C55E;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
        Go to Dashboard
      </a>
    </p>
    <p style="color:#6B7280;font-size:14px">
      Good luck. Trade carefully — the drawdown rules are enforced automatically.
    </p>
  `;

  const bodyText = [
    `Hi ${data.username},`,
    ``,
    `Your payment is confirmed on-chain and your evaluation challenge is now active.`,
    ``,
    `Plan: ${data.planName}`,
    `Account size: ${formatUsd(data.accountSize)}`,
    `Profit target: ${data.profitTargetPct}%`,
    `Max total loss: ${data.maxLossPct}%`,
    `Max daily loss: ${data.dailyLossPct}%`,
    `Min trading days: ${data.minTradingDays}`,
    `Challenge period: ${data.challengePeriodDays} days`,
    `Payment tx: ${explorerUrl}`,
    ``,
    `Dashboard: ${data.dashboardUrl}`,
    ``,
    `Good luck. Trade carefully — the drawdown rules are enforced automatically.`,
  ].join("\n");

  const { html, text } = buildBrandTemplate({
    heading: "Challenge activated",
    bodyHtml,
    bodyText,
  });

  return {
    subject: `Your ${data.planName} challenge is active`,
    html,
    text,
  };
}
