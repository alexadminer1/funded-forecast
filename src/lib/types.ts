export interface Market {
  id: string;
  title: string;
  category: string;
  imageUrl: string | null;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  endDate: string;
  status: string;
  slug: string;
}

export interface MarketDetail extends Market {
  description: string | null;
  negRisk: boolean;
  winningOutcome: string | null;
  lastSyncedAt: string;
}

export interface Position {
  id: number;
  marketId: string;
  marketTitle: string;
  marketCategory: string;
  marketEndDate: string;
  marketStatus: string;
  side: "yes" | "no";
  shares: number;
  avgPrice: number;
  currentPrice: number;
  costBasis: number;
  currentValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
  openedAt: string;
}

export interface User {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  membershipStatus: string;
  isBlocked: boolean;
  lastTradeAt: string | null;
  createdAt: string;
  balance: number;
  openPositionsCount: number;
  activeChallenge: null | {
    id: number;
    stage: string;
    startBalance: number;
    realizedBalance: number;
    peakBalance: number;
    profitTargetPct: number;
    maxTotalDdPct: number;
    maxDailyDdPct: number;
    profitTargetMet: boolean;
    tradingDaysCount: number;
    minTradingDays: number;
    startedAt: string;
    planId: number | null;
    plan: { name: string; id?: number; price?: number } | null;

    // Phase 3 dashboard overlay — optional so old cached responses still type-check.
    status?: string;
    isPassed?: boolean;
    consistency?: number;
    daysRemaining?: number;
    daysTraded?: number;
    dailyLossLimitPercent?: number;
    maxLossLimitPercent?: number;
    currentDrawdownPercent?: number;
    dailyDrawdownPercent?: number;
    minPositionPercent?: number;
    maxAggregatePositionPercent?: number;
    maxDailyVolumeUsd?: number;
  };
}

export interface TradeResult {
  success: boolean;
  tradeId: number;
  positionId: number;
  balanceAfter: number;
  proceeds?: number;
  realizedPnl?: number;
  positionClosed?: boolean;
}
