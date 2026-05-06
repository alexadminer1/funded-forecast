/**
 * Payment configuration loader.
 *
 * Reads on-chain payment env vars, validates them at module load (fail fast),
 * caches the result. All API routes must call getPaymentConfig() — never
 * read process.env directly.
 *
 * Required env vars:
 *   PAYMENT_RECEIVER_ADDRESS           - 0x... receiver wallet
 *   PAYMENT_CHAIN                      - "base_sepolia" or "base_mainnet"
 *   USDC_CONTRACT_ADDRESS_DEV          - USDC contract on the active chain
 *   USDC_DECIMALS                      - integer (6 for USDC)
 *   PAYMENT_INVOICE_WINDOW_MINUTES     - integer (30 default)
 *   PAYMENT_AMOUNT_OFFSET_CENTS        - integer (50 = ±$0.50)
 *   PAYMENT_CONFIRMATIONS_REQUIRED     - integer (6 default)
 *   ALCHEMY_API_URL_BASE_SEPOLIA       - https://... (for watcher Step 4, validated here too)
 */

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

const CHAIN_ID_MAP: Record<string, number> = {
  base_sepolia: 84532,
  base_mainnet: 8453,
};

export interface PaymentConfig {
  receiverAddress: string;
  chainId: number;
  chainName: string;
  usdcAddress: string;
  usdcDecimals: number;
  usdcSymbol: string;
  invoiceWindowMinutes: number;
  amountOffsetCents: number;
  confirmationsRequired: number;
  alchemyRpcUrl: string;
}

let cached: PaymentConfig | null = null;

function readEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

function readEnvInt(name: string, min: number, max: number): number {
  const raw = readEnv(name);
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`Env var ${name} must be an integer, got: ${raw}`);
  }
  if (n < min || n > max) {
    throw new Error(`Env var ${name}=${n} out of range [${min}, ${max}]`);
  }
  return n;
}

function loadConfig(): PaymentConfig {
  const receiverAddress = readEnv("PAYMENT_RECEIVER_ADDRESS");
  if (!ETH_ADDRESS_REGEX.test(receiverAddress)) {
    throw new Error(
      `PAYMENT_RECEIVER_ADDRESS is not a valid Ethereum address: ${receiverAddress}`
    );
  }

  const chainName = readEnv("PAYMENT_CHAIN");
  const chainId = CHAIN_ID_MAP[chainName];
  if (!chainId) {
    throw new Error(
      `Invalid PAYMENT_CHAIN=${chainName}. Allowed: ${Object.keys(CHAIN_ID_MAP).join(", ")}`
    );
  }

  // For now (Step 2), only DEV chain has its own USDC env var.
  // PROD switch later by adding USDC_CONTRACT_ADDRESS_PROD + branching here.
  const usdcAddress = readEnv("USDC_CONTRACT_ADDRESS_DEV");
  if (!ETH_ADDRESS_REGEX.test(usdcAddress)) {
    throw new Error(
      `USDC_CONTRACT_ADDRESS_DEV is not a valid Ethereum address: ${usdcAddress}`
    );
  }

  const usdcDecimals = readEnvInt("USDC_DECIMALS", 0, 18);
  const invoiceWindowMinutes = readEnvInt("PAYMENT_INVOICE_WINDOW_MINUTES", 1, 1440);
  const amountOffsetCents = readEnvInt("PAYMENT_AMOUNT_OFFSET_CENTS", 0, 1000);
  const confirmationsRequired = readEnvInt("PAYMENT_CONFIRMATIONS_REQUIRED", 1, 100);

  // Alchemy URL - validated as URL only (key not exposed here).
  const alchemyRpcUrl = readEnv("ALCHEMY_API_URL_BASE_SEPOLIA");
  if (!alchemyRpcUrl.startsWith("https://")) {
    throw new Error("ALCHEMY_API_URL_BASE_SEPOLIA must start with https://");
  }

  return {
    receiverAddress,
    chainId,
    chainName,
    usdcAddress,
    usdcDecimals,
    usdcSymbol: "USDC",
    invoiceWindowMinutes,
    amountOffsetCents,
    confirmationsRequired,
    alchemyRpcUrl,
  };
}

/**
 * Returns cached payment config. Throws on first call if any env var is missing/invalid.
 * Subsequent calls reuse the cached object.
 */
export function getPaymentConfig(): PaymentConfig {
  if (cached) return cached;
  cached = loadConfig();
  return cached;
}

/**
 * For tests only — clears the cache. Do not call in production code.
 */
export function _resetPaymentConfigCache(): void {
  cached = null;
}
