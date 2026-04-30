# TASK QUEUE

## Done
- Auth redirect: planId → /checkout
- Markets page: categories visible (no min count threshold), "other" at end
- Markets page: total counts via /api/markets/stats endpoint
- Showcase leaderboard: LeaderboardEntry table, admin section, public API merge, 20 seeded entries
- Supabase RLS enabled on all public tables (Prisma uses postgres role with BYPASSRLS)

## Open backend bugs

### B1. Open admin endpoint
`/api/admin/sync-markets/route.ts` does not check x-admin-key (unlike sync-prices, resolve-markets). Anyone can trigger sync.

### B2. Payment webhook not idempotent
`/api/payments/webhook/route.ts` updates Payment and may create Challenge. ProcessedStripeEvent table exists in Prisma but is not used for dedup. Risk: double-processing on retry.

### B3. force_resolve doesn't close positions
`/api/admin/markets/[id]/action/route.ts` on force_resolve only changes Market.status / winningOutcome, doesn't compute payouts / close positions like admin/resolve-markets does.

### B4. AuditLog.targetId type mismatch
AuditLog.targetId is Int, but in `/api/admin/resolve-markets/route.ts` polyMarket.id (string) is cast to it. Audit log breaks for market actions.

### B5. Daily drawdown not enforced
Challenge.maxDailyDdPct exists in schema but no checks in buy/sell or on resolve. Only total drawdown is enforced.

### B6. Trading days not counted
Challenge.minTradingDays and tradingDaysCount exist but no logic increments tradingDaysCount or uses minTradingDays for status transitions.

### B7. Payout validation missing
`/api/user/payout/route.ts` doesn't validate amount strictly (type / positivity / rounding) beyond "not exceed profit".

### B8. negRisk markets blocked in trade logic
DB allows negRisk: true markets, but buy/sell routes block them with NEG_RISK_NOT_SUPPORTED.

## Open features

### F1. Sync markets through admin
5 batches × 30 markets. Blocked by Polymarket IP block from Vercel.

### F2. Reset password flow
Email-based reset, token, /reset-password page.

### F3. Error boundaries + loading states
Global error.tsx, loading.tsx in App Router.

### F4. /about and /how-it-works pages

### F5. PnL / balance / drawdown audit
Manual review of all calculations.

### F6. Google login (OAuth)

### F7. Email notifications
After custom domain is configured (Resend).

### F8. Affiliate system

### F9. VPS migration
Hosting + cron jobs (currently unavailable on Vercel free).

## Recommended execution order
1. B1 (5 min, real security hole)
2. B2 (critical when real payments come)
3. F2 (users will ask)
4. B7 (before payouts go live)
5. B8 (negRisk markets are sitting unused)
6. B5, B6 (challenge rules incomplete)
7. B3, B4 (cleanup)
8. Features F3-F9 in any order

Также создай файл .gitignore (если он уже есть — добавь в конец недостающие строки):

# Working notes / temp files
cursor_test.txt
*.local.md

Затем выполни:
git add . && git commit -m "cleanup: remove stale docs, update task queue, add gitignore patterns" && git push