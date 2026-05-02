export const TIER_CONFIG = {
  starter: { rate: 0.10, minSales: 0,   maxSales: 25 },
  bronze:  { rate: 0.15, minSales: 26,  maxSales: 75 },
  silver:  { rate: 0.20, minSales: 76,  maxSales: 200 },
  gold:    { rate: 0.25, minSales: 201, maxSales: null },
} as const;

export const HOLD_DAYS = {
  default:    30,
  verified:   14,
  suspicious: 45,
} as const;

export const VERIFIED_THRESHOLD = {
  minAgeDays:        90,
  minSales:          10,
  maxFraudRate:      0.02,
  maxConfirmedFraud: 0,
} as const;

export const ACTIVITY_CHECK = {
  minDays:        7,
  minTrades:      5,
  staleAfterDays: 60,
} as const;

export const COMMISSION = {
  hardCapPercentOfNet: 0.30,
} as const;

export const ATTRIBUTION = {
  model:            "last_click",
  windowDays:       60,
  graceMinutes:     10,
  cleanupAfterDays: 90,
} as const;

export const PAYOUT = {
  minUsdDefault: 100,
  minUsdErc20:   200,
  scheduleDays:  [1, 15] as const,
  networkFees: {
    usdt_trc20:   1.0,
    usdc_polygon: 0.5,
    usdt_erc20:   15.0,
    usdc_erc20:   15.0,
  },
  networkFeePolicy: "company_pays",
  autoApproval:     false,
} as const;

export const WALLET = {
  changeLockDays:       7,
  changeRequiresReview: true,
} as const;

export const KYC = {
  triggerFirstPayoutUsd: 500,
  triggerLifetimeUsd:    1000,
} as const;

export const SUB_AFFILIATE = {
  enabled:      false,
  rate:         0.05,
  durationDays: 365,
} as const;

export const REFCODE = {
  minLength: 4,
  maxLength: 20,
  pattern:   /^[a-zA-Z0-9_-]+$/,
} as const;

export const RESERVED_REFCODES: ReadonlySet<string> = new Set([
  "admin", "api", "app", "auth", "login", "logout", "register",
  "dashboard", "account", "settings", "support", "help", "terms",
  "privacy", "affiliate", "affiliates", "r", "ref", "payment",
  "payments", "checkout", "success", "cancel", "webhook", "cron",
  "static", "assets", "_next", "test", "system", "null", "undefined",
  "none",
]);

export const RECONCILE = {
  epsilon: 0.01,
  alertTo: "admin",
} as const;

export const RATE_LIMIT = {
  clickPerIp24h:       100,
  applyPerIpHour:      5,
  payoutRequestPerDay: 1,
} as const;

export const TERMS = {
  currentVersion: "1.0",
  lastUpdated:    "2026-05-01",
} as const;

export const EPSILON = 0.01;

export function getHoldDays(affiliate: {
  suspiciousFlag: boolean;
  isVerified: boolean;
}): number {
  if (affiliate.suspiciousFlag) return HOLD_DAYS.suspicious;
  if (affiliate.isVerified) return HOLD_DAYS.verified;
  return HOLD_DAYS.default;
}

export function getTierRate(affiliate: {
  tier: string;
  customCommissionRate: number | null;
}): number {
  if (affiliate.customCommissionRate != null) return affiliate.customCommissionRate;
  const config = TIER_CONFIG[affiliate.tier as keyof typeof TIER_CONFIG];
  return config?.rate ?? TIER_CONFIG.starter.rate;
}

export function calculateCommission(netAmount: number, rate: number): number {
  const rawCommission = netAmount * rate;
  const maxCommission = netAmount * COMMISSION.hardCapPercentOfNet;
  const result = Math.min(rawCommission, maxCommission);
  return Math.round(result * 100) / 100;
}
