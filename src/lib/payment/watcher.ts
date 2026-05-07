/**
 * Payment watcher — ERC-20 Transfer event reader and matcher.
 *
 * Run periodically (cron every minute via /api/cron/watch-payments).
 * Reads new Transfer events from Alchemy, persists each to
 * PaymentTransaction (idempotent via @@unique on chainId+txHash+logIndex),
 * matches against active Payment rows by amountUnits, and advances
 * Payment.status from AWAITING_PAYMENT through SEEN_ON_CHAIN to CONFIRMED
 * once confirmations >= required (6 by config).
 *
 * Match outcomes:
 *   exact amount  -> PaymentTransaction MATCHED, Payment SEEN_ON_CHAIN
 *   overpayment   -> PaymentTransaction MATCHED, Payment SEEN_ON_CHAIN + flag
 *   underpayment  -> PaymentTransaction MATCHED, Payment UNDERPAID
 *   no matching invoice -> PaymentTransaction IGNORED
 *
 * Confirmation logic runs on every poll for all DETECTED/MATCHED rows.
 * When a MATCHED tx reaches confirmationsRequired, Payment.status becomes
 * CONFIRMED and primary fields (txHash, blockNumber, actualAmountUnits)
 * are stamped.
 *
 * NOT in MVP scope (deferred):
 *   - Multiple partial transactions aggregating to one Payment
 *   - Reorg detection / blockNumber rollback
 *   - Payment.status = MANUAL_REVIEW for ambiguous matches (e.g. two
 *     simultaneous transfers with same amount — first wins, second IGNORED)
 *   - Activation flow (Challenge create + affiliate conversion) — Step 5
 *
 * Step 5 will hook a callback after Payment.status -> CONFIRMED to create
 * the Challenge and record AffiliateConversion.
 */

import { Prisma, PaymentStatus, PaymentTransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPaymentConfig } from "./config";
import { getCurrentBlock, getTransferLogs, type TransferLog } from "./alchemy";

/**
 * Maximum block range per Alchemy getLogs call.
 *
 * Alchemy Free tier limits eth_getLogs to 10 blocks per request.
 * To catch up to current block we call getLogs in a loop with 10-block
 * chunks (see runWatcher below).
 *
 * Paid Alchemy tier raises this to 10,000 blocks. To use bigger chunks
 * (faster catch-up after long downtime), upgrade Alchemy plan and bump
 * this constant — no other code changes needed.
 */
const MAX_BLOCK_CHUNK = 9n;

/**
 * Maximum number of getLogs chunks per single watcher run.
 *
 * Bounds the worst-case work per cron tick. With cron every minute and
 * Base Sepolia ~2s block time, 30 chunks * 10 blocks = 300 blocks per
 * minute is enough headroom for ~10 minutes of catch-up per run, leaving
 * time for retries on RPC failures within Alchemy's tier rate limits
 * (300 CU/s on Free).
 */
const MAX_CHUNKS_PER_RUN = 30;

/**
 * Initial lookback when watcher state row does not exist yet.
 *
 * Free Alchemy tier limits eth_getLogs to 10 blocks per call, so on
 * a fresh deploy we start from currentBlock - 10 (~20 seconds on
 * Base Sepolia). Anything older won't be picked up on first run;
 * subsequent runs catch up via MAX_CHUNKS_PER_RUN loop.
 *
 * Trade-off: a payment made >20s before the very first cron tick
 * will be missed on this watcher, but every payment after that is
 * fully covered by the rolling window.
 */
const INITIAL_LOOKBACK_BLOCKS = 9n;

export interface WatcherRunSummary {
  startedAt: string;
  finishedAt: string;
  fromBlock: string;
  toBlock: string;
  currentBlock: string;
  logsFound: number;
  newTransactions: number;
  matchedTransactions: number;
  ignoredTransactions: number;
  confirmedPayments: number;
  errors: string[];
}

/**
 * Main entry point. Returns a summary suitable for the cron's JSON response.
 * Errors during a single Transfer log are caught and pushed to summary.errors;
 * the watcher continues with the next log so one bad event doesn't halt
 * the whole run.
 */
export async function runWatcher(): Promise<WatcherRunSummary> {
  const startedAt = new Date();
  const errors: string[] = [];

  const config = getPaymentConfig();
  const receiverAddress = config.receiverAddress.toLowerCase();
  const tokenAddress = config.usdcAddress.toLowerCase();

  // 1. Load or create watcher state row.
  // Stored lowercase to match how viem returns addresses in logs.
  const state = await prisma.paymentWatcherState.upsert({
    where: {
      chainId_tokenAddress_receiverAddress: {
        chainId: config.chainId,
        tokenAddress,
        receiverAddress,
      },
    },
    update: {},
    create: {
      chainId: config.chainId,
      tokenAddress,
      receiverAddress,
      // Will be replaced below before any logs are processed.
      lastProcessedBlock: 0n,
    },
  });

  // 2. Get current block from chain.
  let currentBlock: bigint;
  try {
    currentBlock = await getCurrentBlock();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.paymentWatcherState.update({
      where: { id: state.id },
      data: {
        errorCount: { increment: 1 },
        lastError: `getCurrentBlock failed: ${msg}`,
      },
    });
    throw err;
  }

  // 3. Decide fromBlock.
  let fromBlock: bigint;
  if (state.lastProcessedBlock === 0n) {
    // First-ever run for this receiver — use bounded lookback.
    fromBlock = currentBlock > INITIAL_LOOKBACK_BLOCKS
      ? currentBlock - INITIAL_LOOKBACK_BLOCKS
      : 0n;
  } else {
    fromBlock = state.lastProcessedBlock + 1n;
  }

  // 4. Nothing new to process.
  if (fromBlock > currentBlock) {
    // Still advance confirmations on existing in-flight transactions.
    const confirmedPayments = await advanceConfirmations(currentBlock, config.confirmationsRequired);
    return makeSummary({
      startedAt,
      currentBlock,
      fromBlock,
      toBlock: currentBlock,
      logsFound: 0,
      newTransactions: 0,
      matchedTransactions: 0,
      ignoredTransactions: 0,
      confirmedPayments,
      errors,
    });
  }

  // 5+6. Fetch Transfer events in chunks bounded by Alchemy Free tier
  //      (10 blocks per getLogs call). Loop until we either reach
  //      currentBlock or hit MAX_CHUNKS_PER_RUN to bound run time.
  //
  //      toBlock starts as fromBlock + chunk and advances by chunk each
  //      iteration. After the loop, toBlock holds the highest block we
  //      successfully processed; that's what we persist as
  //      lastProcessedBlock at the end.
  let logs: TransferLog[] = [];
  let toBlock = fromBlock;
  let chunksProcessed = 0;

  console.log(`[WATCHER] starting loop: fromBlock=${fromBlock}, currentBlock=${currentBlock}, lastProcessed=${state.lastProcessedBlock}`);

  while (toBlock < currentBlock && chunksProcessed < MAX_CHUNKS_PER_RUN) {
    const chunkFrom = chunksProcessed === 0 ? fromBlock : toBlock + 1n;
    const chunkTo = chunkFrom + MAX_BLOCK_CHUNK > currentBlock
      ? currentBlock
      : chunkFrom + MAX_BLOCK_CHUNK;

    console.log(`[WATCHER] chunk ${chunksProcessed}: ${chunkFrom} -> ${chunkTo}`);

    try {
      const chunkLogs = await getTransferLogs(receiverAddress, chunkFrom, chunkTo);
      console.log(`[WATCHER] chunk ${chunksProcessed} got ${chunkLogs.length} logs`);
      logs.push(...chunkLogs);
      toBlock = chunkTo;
      chunksProcessed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[WATCHER] chunk ${chunksProcessed} FAILED: ${msg}`);
      await prisma.paymentWatcherState.update({
        where: { id: state.id },
        data: {
          errorCount: { increment: 1 },
          lastError: `getTransferLogs failed at chunk ${chunkFrom}-${chunkTo}: ${msg}`,
        },
      });
      break;
    }
  }

  console.log(`[WATCHER] loop done: chunksProcessed=${chunksProcessed}, finalToBlock=${toBlock}, totalLogs=${logs.length}`);

  // 7. Process each Transfer event idempotently.
  let newTransactions = 0;
  let matchedTransactions = 0;
  let ignoredTransactions = 0;

  for (const log of logs) {
    try {
      const result = await processTransferLog(log, config.chainId, tokenAddress, config.amountOffsetCents);
      if (result === "new_matched") {
        newTransactions++;
        matchedTransactions++;
      } else if (result === "new_ignored") {
        newTransactions++;
        ignoredTransactions++;
      }
      // "duplicate" outcome — no counters bumped, log already in DB.
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`tx ${log.txHash} log ${log.logIndex}: ${msg}`);
    }
  }

  // 8. Advance confirmations on all in-flight transactions (including
  //    those just inserted above and ones from previous runs).
  const confirmedPayments = await advanceConfirmations(currentBlock, config.confirmationsRequired);

  // 9. Persist progress.
  await prisma.paymentWatcherState.update({
    where: { id: state.id },
    data: {
      lastProcessedBlock: toBlock,
      latestSeenBlock: currentBlock,
      lastHealthyAt: new Date(),
      errorCount: 0,
      lastError: null,
    },
  });

  return makeSummary({
    startedAt,
    currentBlock,
    fromBlock,
    toBlock,
    logsFound: logs.length,
    newTransactions,
    matchedTransactions,
    ignoredTransactions,
    confirmedPayments,
    errors,
  });
}

type ProcessResult = "new_matched" | "new_ignored" | "duplicate";

/**
 * Idempotent: insert PaymentTransaction; if (chainId, txHash, logIndex) already
 * exists, return "duplicate" and do nothing. Otherwise match against active
 * Payment by amount and update Payment.status accordingly.
 *
 * Returns:
 *   "new_matched"  — new tx inserted and matched to a Payment
 *   "new_ignored"  — new tx inserted but no matching Invoice found
 *   "duplicate"    — already in DB
 */
async function processTransferLog(
  log: TransferLog,
  chainId: number,
  tokenAddress: string,
  amountOffsetCents: number
): Promise<ProcessResult> {
  // Single transaction so all writes commit/rollback together.
  return prisma.$transaction(async (tx) => {
    // Idempotency check.
    const existing = await tx.paymentTransaction.findUnique({
      where: {
        chainId_txHash_logIndex: {
          chainId,
          txHash: log.txHash,
          logIndex: log.logIndex,
        },
      },
      select: { id: true },
    });
    if (existing) return "duplicate";

    // Find matching Payment by exact amount among active invoices.
    const exactMatch = await tx.payment.findFirst({
      where: {
        chainId,
        tokenAddress: { equals: tokenAddress, mode: "insensitive" },
        receiverAddress: { equals: log.toAddress, mode: "insensitive" },
        expectedAmountUnits: log.amountUnits,
        status: { in: [PaymentStatus.AWAITING_PAYMENT, PaymentStatus.UNDERPAID] },
      },
      orderBy: { createdAt: "asc" },
    });

    let matchedPaymentId: string | null = null;
    let txStatus: PaymentTransactionStatus = PaymentTransactionStatus.IGNORED;
    let matchReason: string | null = "no matching invoice";
    let paymentNewStatus: PaymentStatus | null = null;
    let paymentFlagReason: string | null = null;

    if (exactMatch) {
      matchedPaymentId = exactMatch.id;
      txStatus = PaymentTransactionStatus.MATCHED;
      matchReason = "exact amount";
      paymentNewStatus = PaymentStatus.SEEN_ON_CHAIN;
    } else {
      // Try fuzzy match within the offset range to catch under/overpayment
      // routed to one of our active invoices on this receiver+token.
      // We look for the closest expectedAmountUnits within ±offsetCents range.
      // (offsetCents is already what the invoice generator used to spread amounts.)
      const offsetUnits = BigInt(amountOffsetCents) * 10000n; // cents -> usdc units (decimals=6, so $0.01 = 10_000 units)

      const fuzzyMatch = await tx.payment.findFirst({
        where: {
          chainId,
          tokenAddress: { equals: tokenAddress, mode: "insensitive" },
          receiverAddress: { equals: log.toAddress, mode: "insensitive" },
          status: { in: [PaymentStatus.AWAITING_PAYMENT, PaymentStatus.UNDERPAID] },
          expectedAmountUnits: {
            gte: log.amountUnits - offsetUnits,
            lte: log.amountUnits + offsetUnits,
          },
        },
        orderBy: { createdAt: "asc" },
      });

      if (fuzzyMatch) {
        matchedPaymentId = fuzzyMatch.id;
        txStatus = PaymentTransactionStatus.MATCHED;
        if (log.amountUnits < fuzzyMatch.expectedAmountUnits) {
          matchReason = "underpayment";
          paymentNewStatus = PaymentStatus.UNDERPAID;
          paymentFlagReason = "underpaid";
        } else if (log.amountUnits > fuzzyMatch.expectedAmountUnits) {
          matchReason = "overpayment";
          paymentNewStatus = PaymentStatus.SEEN_ON_CHAIN;
          paymentFlagReason = "overpaid";
        }
      }
    }

    // Insert PaymentTransaction.
    await tx.paymentTransaction.create({
      data: {
        chainId,
        txHash: log.txHash,
        logIndex: log.logIndex,
        blockNumber: log.blockNumber,
        blockTimestamp: log.blockTimestamp,
        tokenAddress,
        receiverAddress: log.toAddress,
        fromAddress: log.fromAddress,
        amountUnits: log.amountUnits,
        status: txStatus,
        matchReason,
        paymentId: matchedPaymentId,
        confirmations: 0,
      },
    });

    // Update Payment if matched.
    if (matchedPaymentId && paymentNewStatus) {
      await tx.payment.update({
        where: { id: matchedPaymentId },
        data: {
          status: paymentNewStatus,
          seenAt: new Date(),
          updatedAt: new Date(),
          ...(paymentFlagReason ? { flagReason: paymentFlagReason } : {}),
        },
      });
    }

    return matchedPaymentId ? "new_matched" : "new_ignored";
  });
}

/**
 * For all DETECTED and MATCHED PaymentTransaction rows, recompute confirmations
 * = currentBlock - blockNumber + 1 (inclusive of the mining block itself).
 *
 * If a MATCHED tx reaches confirmationsRequired AND its Payment is still in
 * SEEN_ON_CHAIN or CONFIRMING (ie not already CONFIRMED/UNDERPAID/etc), promote:
 *   PaymentTransaction.status -> CONFIRMED
 *   Payment.status -> CONFIRMED
 *   Payment.confirmedAt, actualAmountUnits, confirmationsSeen, primaryTxHash etc.
 *
 * Returns count of Payments newly promoted to CONFIRMED.
 */
async function advanceConfirmations(currentBlock: bigint, requiredConfirmations: number): Promise<number> {
  const inFlight = await prisma.paymentTransaction.findMany({
    where: {
      status: { in: [PaymentTransactionStatus.DETECTED, PaymentTransactionStatus.MATCHED] },
    },
    include: {
      payment: {
        select: { id: true, status: true, expectedAmountUnits: true },
      },
    },
  });

  let confirmedCount = 0;
  const now = new Date();

  for (const ptx of inFlight) {
    // confirmations = blocks-deep including the mining block.
    // Tx mined at block N, currentBlock = N -> 1 confirmation.
    const confirmations = Number(currentBlock - ptx.blockNumber + 1n);
    const safeConfirmations = Math.max(0, confirmations);

    // Always update the count for visibility (even if not yet promoted).
    await prisma.paymentTransaction.update({
      where: { id: ptx.id },
      data: { confirmations: safeConfirmations },
    });

    // Only consider promotion if MATCHED + has a Payment + Payment is not
    // already terminal/confirmed/underpaid.
    if (
      ptx.status !== PaymentTransactionStatus.MATCHED ||
      !ptx.payment ||
      safeConfirmations < requiredConfirmations
    ) {
      continue;
    }

    // Payment must be in a state we can promote from.
    // Don't touch UNDERPAID — those wait for top-up or expiry.
    // Don't touch CONFIRMED/CANCELLED/EXPIRED/etc — already terminal.
    if (
      ptx.payment.status !== PaymentStatus.SEEN_ON_CHAIN &&
      ptx.payment.status !== PaymentStatus.CONFIRMING
    ) {
      continue;
    }

    // Promote both atomically.
    await prisma.$transaction([
      prisma.paymentTransaction.update({
        where: { id: ptx.id },
        data: { status: PaymentTransactionStatus.CONFIRMED },
      }),
      prisma.payment.update({
        where: { id: ptx.payment.id },
        data: {
          status: PaymentStatus.CONFIRMED,
          confirmedAt: now,
          confirmationsSeen: safeConfirmations,
          actualAmountUnits: ptx.amountUnits,
          primaryTxHash: ptx.txHash,
          primaryBlockNumber: ptx.blockNumber,
          primaryLogIndex: ptx.logIndex,
          updatedAt: now,
        },
      }),
    ]);

    confirmedCount++;
  }

  return confirmedCount;
}

/**
 * Helper to build summary JSON. BigInts are stringified for JSON.stringify
 * compatibility (consumers will parse them back if needed).
 */
function makeSummary(opts: {
  startedAt: Date;
  currentBlock: bigint;
  fromBlock: bigint;
  toBlock: bigint;
  logsFound: number;
  newTransactions: number;
  matchedTransactions: number;
  ignoredTransactions: number;
  confirmedPayments: number;
  errors: string[];
}): WatcherRunSummary {
  return {
    startedAt: opts.startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    currentBlock: opts.currentBlock.toString(),
    fromBlock: opts.fromBlock.toString(),
    toBlock: opts.toBlock.toString(),
    logsFound: opts.logsFound,
    newTransactions: opts.newTransactions,
    matchedTransactions: opts.matchedTransactions,
    ignoredTransactions: opts.ignoredTransactions,
    confirmedPayments: opts.confirmedPayments,
    errors: opts.errors,
  };
}

// Suppress ESLint unused warning for Prisma type used only in JSDoc context.
export type _PrismaUnused = Prisma.JsonValue;
