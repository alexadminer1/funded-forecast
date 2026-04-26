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
