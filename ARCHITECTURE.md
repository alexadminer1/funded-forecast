# Funded Forecast — Architecture
## 1. Project Architecture
- Next.js 16 App Router + TypeScript
- PostgreSQL on Supabase
- Prisma ORM
- JWT Auth + bcryptjs
- Vercel deploy
- GitHub CI/CD
- Upstash Redis for rate limiting
- NOWPayments for crypto payments
## 2. Backend Modules
- /api/auth — login, register, refresh
- /api/user — me, profile, stats, payout, positions, balance, mode, start-challenge
- /api/markets — list, detail, sync
- /api/trade — BUY/SELL engine
- /api/payments — create, webhook, status
- /api/admin — users, challenges, trades, balance-logs, markets, plans, content, faq, reviews, payouts, sync-markets, sync-prices, resolve-markets
- /api/leaderboard — public rankings
- /api/faq — public FAQ
- /api/reviews — public reviews
- /api/cron/sync — auto sync, disabled on Vercel free plan
## 3. Completed Parts
- Auth with JWT + refresh
- Trade engine: BUY / SELL + sandbox / challenge
- Balance log as source of truth
- Dashboard + positions + history
- Challenge system: start / fail / pass / resolve
- Challenge plans: Starter / Pro / Elite
- Admin panel: users, challenges, trades, markets, plans, content, FAQ, reviews, payouts, system
- FAQ system: DB + API + landing + admin
- Reviews carousel
- Leaderboard with realized PnL and filters
- Markets page with infinite scroll, filters, sorting
- Checkout page + NOWPayments integration
- Webhook with HMAC verification + auto challenge start
- Payout system: request + admin management
- Account page: profile, password, payout, plan management
- Rate limiting with Upstash Redis
- Landing page
- Header / footer
- Basic mobile adaptation
- Legal/public pages
- Cookie consent
- Custom 404
## 4. Unfinished Parts
- Reset password form
- Google login
- Email notifications via Resend, pending domain
- Error boundaries + loading states
- /about page
- /how-it-works page
- Affiliate system
- PnL calculation audit
- Branding: logo, name, domain
- Own hosting migration from Vercel/Supabase
- Stripe, deferred
- Leaderboard real data, because there are no passed challenges yet
## 5. Critical Issues
1. Polymarket IP block after many sync requests
2. Markets sync only Sports category
3. Auth redirect bug: after login with planId returns to /login instead of /checkout
4. Cron jobs unavailable on Vercel free plan
5. negRisk markets allowed but trade logic not verified
## 6. Next Steps
1. Wait for Polymarket IP unblock
2. Sync markets via admin: 5 batches x 30
3. Fix auth redirect: planId to /checkout
4. Add reset password
5. Migrate to VPS + PostgreSQL
6. Set up cron sync on VPS
7. Add error boundaries
8. Add /about and /how-it-works
9. Audit PnL calculations
10. Configure email after domain
11. Add affiliate system

## 7. Historical Notes

Earlier project summary listed these parts as unfinished:
- legal pages
- contact page
- cookie consent
- crypto payments
- manual payouts
- reviews block
- infinite scroll markets
- rate limiting
- custom 404

Most of these items are now marked as completed in the latest project summary.

Use sections 1–6 of this file as the current source of truth.
