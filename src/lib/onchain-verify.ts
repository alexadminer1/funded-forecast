/**
 * On-chain USDC transfer verification for admin payout flow.
 *
 * Verifies that a given txHash represents a valid USDC Transfer to the
 * expected recipient with the correct amount on the configured chain.
 * Used synchronously by the admin payout endpoint and by the retry cron.
 *
 * Six checks (returns earliest failure):
 *   1. tx_already_used  — another PayoutRequest already claims this txHash
 *   2. tx_not_found     — txHash does not exist on the configured chain
 *   3. wrong_chain      — tx found but receipt is reverted (invalid transfer)
 *   4. wrong_token      — receipt contains no Transfer from USDC contract
 *   5. wrong_recipient  — USDC Transfer found but `to` ≠ expectedRecipient
 *   6. wrong_amount     — Transfer to correct address but amount out of ±0.01 USDC tolerance
 *   → insufficient_confirmations — all checks pass, <5 confirmations
 *   → ok                         — all checks pass, ≥5 confirmations
 *
 * Chain and USDC contract are resolved from getPaymentConfig(), not hardcoded.
 */

import { createPublicClient, http, parseAbiItem, decodeEventLog, type Hex } from "viem";
import { baseSepolia, base } from "viem/chains";
import { getPaymentConfig } from "@/lib/payment/config";
import { prisma } from "@/lib/prisma";

export type VerifyResult =
  | { ok: true; confirmations: number; txHash: string }
  | { ok: false; reason: VerifyFailReason; confirmations?: number };

export type VerifyFailReason =
  | "tx_not_found"
  | "wrong_chain"
  | "wrong_recipient"
  | "wrong_token"
  | "wrong_amount"
  | "tx_already_used"
  | "insufficient_confirmations"
  | "rpc_error";

const TRANSFER_ABI_ITEM = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

// ±0.01 USDC tolerance expressed in 6-decimal token units (1 cent = 10_000 units)
const AMOUNT_TOLERANCE_UNITS = 10_000n;

const REQUIRED_CONFIRMATIONS = 5;

export async function verifyPayoutTx(opts: {
  txHash: string;
  expectedRecipient: string;
  expectedAmountCents: number;
  payoutRequestId: number;
}): Promise<VerifyResult> {
  const { txHash, expectedRecipient, expectedAmountCents, payoutRequestId } = opts;

  // 1. tx_already_used: another payout already claims this txHash
  try {
    const conflict = await prisma.payoutRequest.findFirst({
      where: { txHash, NOT: { id: payoutRequestId } },
      select: { id: true },
    });
    if (conflict) {
      return { ok: false, reason: "tx_already_used" };
    }
  } catch (err) {
    console.error("[VERIFY_PAYOUT] DB duplicate-check failed:", err);
    return { ok: false, reason: "rpc_error" };
  }

  // Resolve chain config
  let config: ReturnType<typeof getPaymentConfig>;
  try {
    config = getPaymentConfig();
  } catch (err) {
    console.error("[VERIFY_PAYOUT] Config error:", err);
    return { ok: false, reason: "rpc_error" };
  }

  const chain = config.chainId === 84532 ? baseSepolia : base;
  const client = createPublicClient({
    chain,
    transport: http(config.alchemyRpcUrl),
  });

  // 2. tx_not_found / wrong_chain: query configured chain's RPC
  //    If receipt is null → tx doesn't exist on this chain.
  //    If receipt.status is 'reverted' → transfer never executed.
  let receipt: Awaited<ReturnType<typeof client.getTransactionReceipt>> | null;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash as Hex });
  } catch (err) {
    console.error("[VERIFY_PAYOUT] getTransactionReceipt error:", err);
    return { ok: false, reason: "rpc_error" };
  }

  if (!receipt) {
    return { ok: false, reason: "tx_not_found" };
  }

  if (receipt.status === "reverted") {
    // Reverted tx: transfer never happened → treat as not found
    return { ok: false, reason: "tx_not_found" };
  }

  // 3/4. wrong_token: no Transfer events from the USDC contract address
  const usdcAddress = config.usdcAddress.toLowerCase();
  const usdcLogs = receipt.logs.filter(
    (l) => l.address.toLowerCase() === usdcAddress
  );

  if (usdcLogs.length === 0) {
    return { ok: false, reason: "wrong_token" };
  }

  // 5. wrong_recipient: find Transfer to expectedRecipient
  let matchedAmountUnits: bigint | null = null;

  for (const log of usdcLogs) {
    try {
      const decoded = decodeEventLog({
        abi: [TRANSFER_ABI_ITEM],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Transfer") continue;
      const args = decoded.args as { from: `0x${string}`; to: `0x${string}`; value: bigint };
      if (args.to.toLowerCase() === expectedRecipient.toLowerCase()) {
        matchedAmountUnits = args.value;
        break;
      }
    } catch {
      // Not a Transfer log — skip
    }
  }

  if (matchedAmountUnits === null) {
    return { ok: false, reason: "wrong_recipient" };
  }

  // 6. wrong_amount: check ±0.01 USDC tolerance
  // expectedAmountCents is integer cents; USDC has 6 decimals so 1 cent = 10_000 units
  const expectedUnits = BigInt(expectedAmountCents) * 10_000n;
  const diff =
    matchedAmountUnits > expectedUnits
      ? matchedAmountUnits - expectedUnits
      : expectedUnits - matchedAmountUnits;

  if (diff > AMOUNT_TOLERANCE_UNITS) {
    return { ok: false, reason: "wrong_amount" };
  }

  // 7. insufficient_confirmations
  let currentBlock: bigint;
  try {
    currentBlock = await client.getBlockNumber();
  } catch (err) {
    console.error("[VERIFY_PAYOUT] getBlockNumber error:", err);
    return { ok: false, reason: "rpc_error" };
  }

  const confirmations = Number(currentBlock - receipt.blockNumber + 1n);

  if (confirmations < REQUIRED_CONFIRMATIONS) {
    return { ok: false, reason: "insufficient_confirmations", confirmations };
  }

  return { ok: true, confirmations, txHash };
}
