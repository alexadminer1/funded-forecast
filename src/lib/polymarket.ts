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
    title: string;
  }>;
}

const POLYMARKET_API = "https://gamma-api.polymarket.com";

export async function fetchActiveMarkets(limit = 100): Promise<PolymarketMarket[]> {
  const url = `${POLYMARKET_API}/markets?limit=${limit}&active=true&closed=false`;

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
