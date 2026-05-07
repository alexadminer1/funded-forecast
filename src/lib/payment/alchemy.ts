/**
 * Alchemy RPC client for the on-chain payment watcher.
 *
 * Uses viem (Base Sepolia chain definition + http transport pointed at our
 * Alchemy URL). Wraps two operations:
 *   - getCurrentBlock() : latest block number on the chain
 *   - getTransferLogs(receiver, fromBlock, toBlock) : ERC-20 Transfer events
 *     where 'to' equals our receiver address, in the given block range.
 *
 * Why a thin wrapper instead of using viem directly in watcher.ts:
 *   - keeps watcher.ts focused on business logic (matching, status flips)
 *   - easy to mock in unit tests later (single seam)
 *   - if we ever swap Alchemy for another RPC provider, only this file changes
 *
 * Returns viem types directly (Block, Log) — no internal DTOs. The watcher
 * adapts them to PaymentTransaction shape.
 */

import { createPublicClient, http, parseAbiItem, type Address } from "viem";
import { baseSepolia, base } from "viem/chains";
import { getPaymentConfig } from "./config";

/**
 * Standard ERC-20 Transfer event signature.
 * Indexed: from, to. Non-indexed: value (uint256).
 */
const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

function makeClient() {
  const config = getPaymentConfig();
  const chain = config.chainId === 84532 ? baseSepolia : base;
  return createPublicClient({ chain, transport: http(config.alchemyRpcUrl) });
}

type WatcherClient = ReturnType<typeof makeClient>;
let cachedClient: WatcherClient | null = null;

/**
 * Returns a singleton viem PublicClient for the configured chain.
 * Lazy-initialised so config errors surface only when watcher actually runs.
 */
function getClient(): WatcherClient {
  if (cachedClient) return cachedClient;
  cachedClient = makeClient();
  return cachedClient;
}

/**
 * Returns the latest block number from the chain.
 * Throws on RPC failure — caller should catch and increment errorCount in
 * PaymentWatcherState.
 */
export async function getCurrentBlock(): Promise<bigint> {
  const client = getClient();
  return client.getBlockNumber();
}

/**
 * Fetches ERC-20 Transfer events for the configured USDC token where
 * 'to' equals the given receiver address, in the inclusive block range
 * [fromBlock, toBlock].
 *
 * Alchemy limits: max 10,000 blocks per query, max 1,000 logs returned.
 * Watcher caller should chunk if range is too large (we enforce 500 blocks
 * per call to stay well under both limits).
 *
 * Returns an array of normalised log entries with the fields the watcher
 * needs. BigInt values stay as BigInt.
 */
export interface TransferLog {
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  blockTimestamp: Date;
  fromAddress: string;
  toAddress: string;
  amountUnits: bigint;
}

export async function getTransferLogs(
  receiverAddress: string,
  fromBlock: bigint,
  toBlock: bigint
): Promise<TransferLog[]> {
  const client = getClient();
  const config = getPaymentConfig();

  const logs = await client.getLogs({
    address: config.usdcAddress as Address,
    event: TRANSFER_EVENT,
    args: {
      to: receiverAddress as Address,
    },
    fromBlock,
    toBlock,
  });

  // Each log carries blockNumber but not the timestamp — fetch each block once.
  // Cache by blockNumber to avoid repeat lookups when many tx land in same block.
  const blockTimestampCache = new Map<bigint, Date>();
  async function getBlockTimestamp(blockNumber: bigint): Promise<Date> {
    const cached = blockTimestampCache.get(blockNumber);
    if (cached) return cached;
    const block = await client.getBlock({ blockNumber });
    const ts = new Date(Number(block.timestamp) * 1000);
    blockTimestampCache.set(blockNumber, ts);
    return ts;
  }

  const result: TransferLog[] = [];
  for (const log of logs) {
    if (
      log.transactionHash === null ||
      log.logIndex === null ||
      log.blockNumber === null ||
      log.args.from === undefined ||
      log.args.to === undefined ||
      log.args.value === undefined
    ) {
      // Pending or partial log entry — skip.
      continue;
    }

    const blockTimestamp = await getBlockTimestamp(log.blockNumber);

    result.push({
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      blockNumber: log.blockNumber,
      blockTimestamp,
      fromAddress: log.args.from,
      toAddress: log.args.to,
      amountUnits: log.args.value,
    });
  }

  return result;
}

/**
 * For tests only — clears the cached client.
 */
export function _resetAlchemyClientCache(): void {
  cachedClient = null;
}
