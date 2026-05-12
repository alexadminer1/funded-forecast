export interface PolymarketMarket {
  id: string;
  conditionId: string;
  slug: string;
  question: string;
  description: string;
  image: string;
  active: boolean;
  closed: boolean;
  negRisk: boolean;
  restricted: boolean;
  endDateIso: string;
  outcomePrices: string;
  volume24hr: number;
  bestBid: number;
  bestAsk: number;
  events: Array<{
    id?: string;
    title: string;
  }>;
}

const POLYMARKET_API = "https://gamma-api.polymarket.com";

export async function fetchActiveMarkets(limit = 100, offset = 0): Promise<PolymarketMarket[]> {
  const url = `${POLYMARKET_API}/markets?limit=${limit}&offset=${offset}&active=true&closed=false&order=volume24hr&ascending=false`;

  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Polymarket API error: ${res.status}`);
  }

  const data: PolymarketMarket[] = await res.json();
  return data;
}

export function parseYesPrice(market: PolymarketMarket): number {
  try {
    const prices = JSON.parse(market.outcomePrices);
    return parseFloat(prices[0]);
  } catch {
    return market.bestAsk ?? 0.5;
  }
}

export function parseNoPrice(market: PolymarketMarket): number {
  try {
    const prices = JSON.parse(market.outcomePrices);
    return parseFloat(prices[1]);
  } catch {
    return market.bestBid ?? 0.5;
  }
}

export function inferCategory(market: PolymarketMarket): string {
  const title = (market.question + " " + (market.events?.[0]?.title ?? "")).toLowerCase();

  if (/bitcoin|crypto|eth|solana|btc|token/.test(title)) return "crypto";
  if (/election|president|senate|congress|vote|trump|biden|harris|political/.test(title)) return "politics";
  if (/nba|nfl|fifa|soccer|football|tennis|sport|league|championship|world cup/.test(title)) return "sports";
  if (/fed|rate|inflation|gdp|economy|recession|market|nasdaq|s&p/.test(title)) return "economy";
  if (/ai|openai|google|apple|microsoft|tech|gpt|model/.test(title)) return "tech";
  if (/war|ceasefire|ukraine|russia|conflict|nato|military/.test(title)) return "geopolitics";
  if (/climate|science|nasa|space|temperature|co2/.test(title)) return "climate";
  if (/film|music|oscar|grammy|culture|album|artist/.test(title)) return "culture";

  return "other";
}

export interface PolymarketResolvedMarket {
  id: string;
  closed: boolean;
  umaResolutionStatus: string | null;
  outcomes: string;
  outcomePrices: string;
}

export async function fetchMarketById(id: string): Promise<PolymarketResolvedMarket | null> {
  try {
    const res = await fetch(`${POLYMARKET_API}/markets/${id}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: String(data.id),
      closed: Boolean(data.closed),
      umaResolutionStatus: data.umaResolutionStatus ?? null,
      outcomes: data.outcomes ?? '[]',
      outcomePrices: data.outcomePrices ?? '[]',
    };
  } catch {
    return null;
  }
}

export function getWinningOutcome(market: PolymarketResolvedMarket): "yes" | "no" | null {
  if (!market.closed) return null;
  if (market.umaResolutionStatus !== "resolved") return null;

  let prices: string[];
  try {
    prices = JSON.parse(market.outcomePrices);
  } catch {
    return null;
  }

  if (!Array.isArray(prices) || prices.length !== 2) return null;
  const yesPrice = parseFloat(prices[0]);
  const noPrice = parseFloat(prices[1]);

  const TOLERANCE = 0.01;
  if (Math.abs(yesPrice - 1) < TOLERANCE && Math.abs(noPrice) < TOLERANCE) return "yes";
  if (Math.abs(yesPrice) < TOLERANCE && Math.abs(noPrice - 1) < TOLERANCE) return "no";

  return null;
}
