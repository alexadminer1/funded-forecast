# PROJECT STATE
STATE_VERSION: v2026-05-04
LAST_UPDATED: 2026-05-04
PROJECT_NAME: FundedForecast Affiliate Program
WORKING_DIRECTORY: /Users/alexadminer/funded-app

## CURRENT STATE
Affiliate Program MVP в production на funded-forecast.vercel.app, branch main.

Что работает end-to-end:
- Apply form + admin approval (`/affiliate/apply`, `/admin/affiliate`)
- Affiliate cabinet (overview / conversions / ledger / settings pages)
- Public landing `/affiliates`
- Click tracking → cookie → conversion → ledger (атомарно)
- Daily cron pending → available после hold period
- Admin detail page `/admin/affiliate/[id]` с табами и действиями
- Admin actions: suspend / unsuspend / ban / forfeit
- Same-IP fraud detection
- Risk flags в admin detail
- Wallet setup с 7-day lock, method-specific валидацией (TRC20/ERC20/Polygon), atomic update + audit log
- Affiliate-side payout endpoints (Step 9.4): POST /api/affiliate/payouts (atomic create с TOCTOU recheck, partial unique index в БД для защиты от race), GET /api/affiliate/payouts (dashboard summary + history с masked wallets). Smoke-tested в production: GET 200, POST 409 wallet_locked корректно, 401 без auth.

Текущий test affiliate: root@alexadminer.com, refCode tesssettre, status approved, баланс \$0, 0 conversions, wallet установлен (USDT TRC20), walletLockUntil May 10 2026.

## LAST COMPLETED STEP
Step 9.4.2 + 9.4.3 (commit 6b8a661) — payout request endpoints affiliate-side. Smoke-test пройден end-to-end через curl на production.

## CURRENT ACTIVE TASK
Подготовка Step 9.5 pre-check.

## NEXT STEP
Step 9.5: Admin payout review endpoints (4 действия).

Зафиксированный scope:
- approve: requested → approved (no ledger entry)
- reject: requested → cancelled, reset conversion.payoutId=null (no ledger, requires reason)
- complete: approved → completed, payout_paid ledger entry, decrement balanceAvailable, increment lifetimePaid (transactionHash optional для MVP)
- fail: approved → failed, reset conversion.payoutId=null (no ledger, requires reason)
- freeze deferred (no enum value, no MVP use case)
- processing status не используется в MVP

Pre-check Step 9.5 проверит:
- AffiliatePayoutStatus enum (transitions)
- Affiliate balance fields (balanceAvailable, lifetimePaid)
- writeLedgerEntries сигнатура для payout_paid type
- Существующий админ auth pattern (x-admin-key)
- Audit log pattern для admin payout actions

## BACKLOG

### P0 — blockers
(пусто)

### P1 — MVP / launch critical
- Step 9.5 — Admin payout review endpoints (approve/reject/complete/fail)
- Step 9.6 — Cabinet payout UI (request form + history)
- Step 9.7 — Admin payout review UI
- Step 11 — Full E2E test (click → register → payment → conversion → cron → payout)
- Step 10B — Terms/Privacy pages
- Pre-prod security audit

### P2 — important but not blocking
- Lifetime counters не обновляются автоматически (lifetimePaid будет вручную в Step 9.5 complete action)
- AffiliateClick FK без onDelete:Cascade
- Admin approve/reject existing endpoints non-atomic
- Admin UI Approve/Reject loading state отсутствует
- LeaderboardEntry table без RLS
- Email notifications для affiliates
- Внутренний cabinet nav хардкоден без shared layout
- Freeze action для admin payout (не критично для MVP)
- Real payout provider integration (NowPayments) → processing status

### P3 — later
- KYC integration
- Sub-affiliate flow
- Multi-reason fraud flags
- RefTracker fallback
- Refactor: attribution.ts + attach-click route
- Refactor: admin auth gate в shared layout
- Refactor: cabinet nav в shared layout
- Refactor: r/[code]/route.ts inline IP hash
- Wallet review UI для admin

## KNOWN BUGS
Нет подтверждённых багов.

## RISKS
- Technical: Step 9.5 complete action — обновление balanceAvailable + lifetimePaid должно быть atomic с writeLedgerEntries в одном \$transaction. Pre-check определит точную сигнатуру.
- Technical: prisma db push hangs через DATABASE_URL. DDL — через Supabase SQL Editor.
- Technical: Free Vercel plan, 2 cron limit.
- Product: payout flow без email notifications.
- Product: KYC не реализован.
- Infra: единый Supabase для dev/preview/prod.
- Legal: Terms/Privacy pages отсутствуют.
- Security: ADMIN_API_KEY в dev-логах.

## RECENTLY CHANGED FILES
- src/lib/affiliate/payout.ts (Step 9.4.1 new)
- src/app/api/affiliate/payouts/route.ts (Step 9.4.2 + 9.4.3 new)
- src/lib/ratelimit.ts (Step 9.4.2 + payoutRequest)
- src/lib/affiliate/wallet.ts (Step 9.3.5)
- src/app/api/affiliate/wallet/route.ts (Step 9.3.5)
- src/app/affiliate/settings/page.tsx (Step 9.3.5)
- src/app/affiliate/page.tsx (Step 9.3.5 nav)
- src/app/affiliate/conversions/page.tsx (Step 9.3.5 nav)
- src/app/affiliate/ledger/page.tsx (Step 9.3.5 nav)

DB migrations applied:
- partial unique index affiliate_active_payout_idx (Step 9.4.0, applied via Supabase SQL Editor)

Last commits (chronological):
- 6b8a661 Step 9.4.2-9.4.3 (payout endpoints affiliate-side)
- 1129645 docs after 9.3.5
- 9e060a0 Step 9.3.5
- ade0306 Step 12.2.B
- f5b06f3 Step 12.2.A

## LAST CLAUDE CODE REPORT
Step 9.4.2-9.4.3 implementation complete. Build green, 3 files changed (+432), commit 6b8a661 pushed. Smoke-test in production: GET /api/affiliate/payouts returns 200 with correct dashboard summary (blockingReason wallet_locked correctly identified, masked paymentWallet, walletLockUntil May 10 2026). POST /api/affiliate/payouts returns 409 wallet_locked with minRequired=100. No-auth returns 401. Partial unique index in DB applied via Supabase SQL Editor. Wallet remains locked until May 10 2026 — full E2E payout test will require unlock or test affiliate with no wallet lock.

## OPEN QUESTIONS
Нет открытых вопросов перед Step 9.5.

## USER SHOULD PROVIDE IF AVAILABLE
- Required: ничего критичного для Step 9.5
- Optional: текст Terms/Privacy для будущего Step 10B
