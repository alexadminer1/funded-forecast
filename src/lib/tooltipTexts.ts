export const TOOLTIP_TEXTS = {
  availableBalance: `The amount available for opening new positions.

Formula: Starting balance − Cost of open positions`,

  unrealizedPnl: `Current profit or loss on open positions if they were closed at current prices.

Formula: Σ (shares × (current price − avg buy price))

Updates every 10 seconds based on Polymarket prices.`,

  dailyPnl: `Change in balance during the current day (since 00:00 UTC).

Limit: −4% of starting balance.`,

  mllBuffer: `Remaining buffer until the total challenge loss limit is reached.

Limit: −8% of starting balance.`,

  resolvedPositions: `Number of closed positions with confirmed outcomes on Polymarket.

Target: 35.`,

  uniqueEvents: `Number of different markets traded during the challenge.

Target: 30.`,

  consistency: `Share of profit earned on the most profitable day.

Formula: (best day profit / total profit) × 100%

Limit: 25%.`,

  daysRemaining: `Days left until the challenge ends.

Duration: 10 days.`,

  availableToWithdraw: `Amount in USDC available for withdrawal on this challenge.

Formula: (realized profit × profit share %) − already withdrawn

Minimum: $50. Cooldown: 14 days between requests.`,
} as const;

export type TooltipTextId = keyof typeof TOOLTIP_TEXTS;
