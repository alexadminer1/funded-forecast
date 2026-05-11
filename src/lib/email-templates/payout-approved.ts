// Email template: Payout approved
// Triggered on: admin/payouts/[id] approve action (status: pending → approved)
// Status: DRAFT — TFP-style, awaiting заказчик copywriting review
// P0.10 — Wave 3 integration

import { buildBrandTemplate, buildKeyValueTable, escapeHtml } from "@/lib/email";

export interface PayoutApprovedEmailData {
  username: string;
  amountUsdc: number;        // approved amount in USDC
  walletAddress: string;
  walletNetwork: string;     // "ERC20" | "POLYGON" etc.
  expectedDeliveryHours?: number; // default 24
  accountUrl: string;
}

function formatUsdc(n: number): string {
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
}

function shortenAddress(addr: string): string {
  if (addr.length < 14) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function renderPayoutApprovedEmail(data: PayoutApprovedEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const expectedHours = data.expectedDeliveryHours ?? 24;

  const detailsHtml = buildKeyValueTable([
    { label: "Amount", value: formatUsdc(data.amountUsdc) },
    { label: "Network", value: data.walletNetwork },
    { label: "Wallet", value: shortenAddress(data.walletAddress) },
    { label: "Expected delivery", value: `within ${expectedHours}h` },
  ]);

  const bodyHtml = `
    <p>Hi ${escapeHtml(data.username)},</p>
    <p>Your payout request has been approved and is queued for on-chain transfer.</p>
    ${detailsHtml}
    <p>You will receive a separate confirmation email once the USDC transfer is broadcast on-chain
    with the transaction hash.</p>
    <p style="margin:24px 0">
      <a href="${escapeHtml(data.accountUrl)}"
         style="display:inline-block;background:#22C55E;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
        View Payout History
      </a>
    </p>
  `;

  const bodyText = [
    `Hi ${data.username},`,
    ``,
    `Your payout request has been approved and is queued for on-chain transfer.`,
    ``,
    `Amount: ${formatUsdc(data.amountUsdc)}`,
    `Network: ${data.walletNetwork}`,
    `Wallet: ${shortenAddress(data.walletAddress)}`,
    `Expected delivery: within ${expectedHours}h`,
    ``,
    `You will receive a separate confirmation email once the USDC transfer is broadcast on-chain.`,
    ``,
    `Account: ${data.accountUrl}`,
  ].join("\n");

  const { html, text } = buildBrandTemplate({
    heading: "Payout approved",
    bodyHtml,
    bodyText,
  });

  return {
    subject: `Payout approved — ${formatUsdc(data.amountUsdc)}`,
    html,
    text,
  };
}
