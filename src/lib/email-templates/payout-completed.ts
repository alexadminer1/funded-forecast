// Email template: Payout completed (with txHash + BaseScan link)
// Triggered on: admin/payouts/[id]/complete OR cron/verify-pending-payouts (on-chain verified)
// Status: DRAFT — TFP-style, awaiting заказчик copywriting review
// P0.10 — Wave 3 integration

import { buildBrandTemplate, buildKeyValueTable, escapeHtml } from "@/lib/email";

export interface PayoutCompletedEmailData {
  username: string;
  amountUsdc: number;
  walletAddress: string;
  walletNetwork: string; // "ERC20" | "POLYGON"
  txHash: string;
  chainId: number;       // 8453 mainnet | 84532 sepolia | 137 polygon | 80001 mumbai
  accountUrl: string;
}

function formatUsdc(n: number): string {
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
}

function shortenAddress(addr: string): string {
  if (addr.length < 14) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function explorerUrl(txHash: string, chainId: number): string {
  switch (chainId) {
    case 8453:
      return `https://basescan.org/tx/${txHash}`;
    case 84532:
      return `https://sepolia.basescan.org/tx/${txHash}`;
    case 137:
      return `https://polygonscan.com/tx/${txHash}`;
    case 80001:
      return `https://mumbai.polygonscan.com/tx/${txHash}`;
    default:
      // Fallback — empty string, valueHtml будет без ссылки
      return "";
  }
}

function explorerName(chainId: number): string {
  switch (chainId) {
    case 8453:
    case 84532:
      return "BaseScan";
    case 137:
    case 80001:
      return "PolygonScan";
    default:
      return "Explorer";
  }
}

export function renderPayoutCompletedEmail(data: PayoutCompletedEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const url = explorerUrl(data.txHash, data.chainId);
  const explorer = explorerName(data.chainId);
  const shortTx = `${data.txHash.slice(0, 10)}...${data.txHash.slice(-8)}`;

  const txCellHtml = url
    ? `<a href="${escapeHtml(url)}" style="color:#22C55E;text-decoration:none">${escapeHtml(shortTx)}</a>`
    : escapeHtml(shortTx);

  const detailsHtml = buildKeyValueTable([
    { label: "Amount", value: formatUsdc(data.amountUsdc) },
    { label: "Network", value: data.walletNetwork },
    { label: "Wallet", value: shortenAddress(data.walletAddress) },
    { label: "Transaction", value: shortTx, valueHtml: txCellHtml },
    { label: "Explorer", value: explorer },
  ]);

  const bodyHtml = `
    <p>Hi ${escapeHtml(data.username)},</p>
    <p>Your payout has been completed. The USDC transfer is now confirmed on-chain.</p>
    ${detailsHtml}
    ${
      url
        ? `<p style="margin:24px 0">
            <a href="${escapeHtml(url)}"
               style="display:inline-block;background:#22C55E;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              View on ${escapeHtml(explorer)}
            </a>
          </p>`
        : ""
    }
    <p style="color:#6B7280;font-size:14px">
      Funds should appear in your wallet within minutes. If you do not see them after 1 hour,
      verify the transaction on ${escapeHtml(explorer)} and contact support.
    </p>
  `;

  const bodyText = [
    `Hi ${data.username},`,
    ``,
    `Your payout has been completed. The USDC transfer is now confirmed on-chain.`,
    ``,
    `Amount: ${formatUsdc(data.amountUsdc)}`,
    `Network: ${data.walletNetwork}`,
    `Wallet: ${shortenAddress(data.walletAddress)}`,
    `Transaction: ${data.txHash}`,
    url ? `Explorer: ${url}` : `Explorer: ${explorer}`,
    ``,
    `Funds should appear in your wallet within minutes.`,
    `Account: ${data.accountUrl}`,
  ].join("\n");

  const { html, text } = buildBrandTemplate({
    heading: "Payout completed",
    bodyHtml,
    bodyText,
  });

  return {
    subject: `Payout sent — ${formatUsdc(data.amountUsdc)}`,
    html,
    text,
  };
}
