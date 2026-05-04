# PROJECT STATE
STATE_VERSION: v2026-05-04
LAST_UPDATED: 2026-05-04
PROJECT_NAME: FundedForecast Affiliate Program
WORKING_DIRECTORY: /Users/alexadminer/funded-app

## CURRENT STATE
Affiliate Program MVP в production на funded-forecast.vercel.app, branch main.

Что работает end-to-end:
- Apply form + admin approval (`/affiliate/apply`, `/admin/affiliate`)
- Affiliate cabinet (overview / conversions / ledger / settings / payouts pages)
- Public landing `/affiliates`
- Click tracking → cookie → conversion → ledger (атомарно)
- Daily cron pending → available после hold period
- Admin sub-nav Applications | Payouts на admin/affiliate и admin/affiliate/payouts (Step 9.8.1)
- Admin detail page `/admin/affiliate/[id]` с 6 табами (Overview / Conversions / Ledger / Referred Users / Audit Log / Payouts) и actions
- Admin actions affiliate-level: suspend / unsuspend / ban / forfeit
- Wallet setup с 7-day lock, method-specific валидацией
- Affiliate-side payout endpoints + cabinet UI (Step 9.4 + 9.6)
- Admin payout review API (Step 9.5): GET list, GET detail, POST approve/reject/complete/fail
- Admin payout review UI (Step 9.7 + 9.8): standalone /admin/affiliate/payouts с filter + table + action modal, плюс Payouts tab в карточке партнёра с lazy load и теми же действиями

Текущий test affiliate: root@alexadminer.com, refCode tesssettre, status approved, баланс \$0, 0 conversions, wallet установлен (USDT TRC20), walletLockUntil May 10 2026.

## LAST COMPLETED STEP
Step 9.8.2 (commit 50d10cc) — Payouts tab в admin/affiliate/[id]. Smoke-test пройден: 6 табов, Payouts таб показывает per-affiliate список ("No payouts for this affiliate." при пустых данных).

## CURRENT ACTIVE TASK
Подготовка Step 11 (Full E2E test) или решение по следующему шагу.

## NEXT STEP CANDIDATES

### Step 11 — Full E2E test
End-to-end проверка всего цикла на production:
1. Реф-клик /r/{tesssettre} → cookie aff_id
2. Регистрация нового тестового юзера → registrationIpHash
3. /api/affiliate/attach-click → User.referredByAffiliateId
4. NowPayments тестовая покупка (если есть sandbox/тест-режим)
5. Webhook → AffiliateConversion (status=pending)
6. Cron promote → status=approved + balanceAvailable
7. Cabinet payout request → AffiliatePayout (status=requested)
8. Admin approve → approved
9. Admin complete → completed + payout_paid ledger + lifetimePaid increment
10. Verification: balance correct, conversion paid, audit log полный

Pre-check Step 11:
- Проверить как сейчас работает NowPayments в dev/test (есть ли sandbox)
- Может ли реально пройти платёж в closed-test или нужен manual webhook trigger
- IP-overlap между тестовым юзером и affiliate (одна машина) → suspiciousFlag

### Step 10B — Terms/Privacy
Юр. контент от пользователя.

### Pre-prod security audit
- Rotate ADMIN_API_KEY
- Rotate DATABASE_URL password
- Update Vercel envs

## BACKLOG

### P0 — blockers
(пусто)

### P1 — MVP / launch critical
- Step 11 — Full E2E test
- Step 10B — Terms/Privacy pages
- Pre-prod security audit

### P2 — important but not blocking
- Lifetime counters: lifetimeEarned не обновляется автоматически
- AffiliateClick FK без onDelete:Cascade
- Admin approve/reject existing endpoints non-atomic
- Admin UI Approve/Reject loading state отсутствует
- LeaderboardEntry table без RLS
- Email notifications для affiliates
- Внутренний cabinet nav хардкоден без shared layout
- Freeze action для admin payout (deferred MVP)
- Real payout provider integration (NowPayments) → processing status
- Blockchain explorer links для transactionHash

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
- Step 11: NowPayments sandbox возможно недоступен → потребует manual webhook simulate через curl с подписью
- Step 11: walletLockUntil affiliate'а до May 10 2026 — payout request не пройдёт сейчас (blockingReason wallet_locked). Либо ждать, либо сменить wallet (что снова даёт 7 дней lock), либо patch DB вручную, либо использовать другого test affiliate
- prisma db push hangs. DDL — Supabase SQL Editor.
- Free Vercel plan, 2 cron limit.
- Email notifications отсутствуют.
- KYC не реализован.
- Единый Supabase для dev/preview/prod.
- Terms/Privacy отсутствуют.
- ADMIN_API_KEY в dev-логах.

## RECENTLY CHANGED FILES
- src/app/admin/affiliate/[id]/page.tsx (Step 9.8.2 + Payouts tab + handlers + modal)
- src/app/admin/affiliate/page.tsx (Step 9.8.1 + sub-nav)
- src/app/admin/affiliate/payouts/page.tsx (Step 9.8.1 + header bar + sub-nav, Step 9.7 + admin UI)
- src/app/affiliate/payouts/page.tsx (Step 9.6 cabinet UI)
- src/app/affiliate/page.tsx (Step 9.6 + Payouts nav)
- src/app/affiliate/conversions/page.tsx (Step 9.6 + Payouts nav)
- src/app/affiliate/ledger/page.tsx (Step 9.6 + Payouts nav)
- src/app/affiliate/settings/page.tsx (Step 9.6 + Payouts nav)
- src/app/api/admin/affiliate/payouts/* (Step 9.5)
- src/app/api/affiliate/payouts/route.ts (Step 9.4)
- src/lib/affiliate/payout.ts (Step 9.4.1)
- src/lib/ratelimit.ts (Step 9.4.2 + payoutRequest)

DB migrations applied:
- partial unique index affiliate_active_payout_idx (Step 9.4.0, applied via Supabase SQL Editor)

Last commits (chronological, newest first):
- 50d10cc Step 9.8.2 (Payouts tab in detail page)
- 2661005 Step 9.8.1 (admin sub-nav)
- 802ff26 Step 9.7 (admin payout UI)
- 3a9d361 Step 9.6 (cabinet payout UI)
- e2c0509 Step 9.5 (admin payout endpoints)
- 6b8a661 Step 9.4 (payout endpoints affiliate-side)
- 9e060a0 Step 9.3.5 (wallet setup)

## LAST CLAUDE CODE REPORT
Step 9.8.2 implementation complete. Build green, file size 751 lines (no gaps), commit 50d10cc pushed. Smoke-test passed: 6 tabs visible in /admin/affiliate/[id], Payouts tab shows per-affiliate list with lazy load, empty state shows "No payouts for this affiliate." correctly.

## OPEN QUESTIONS
1. Step 11 strategy — реально пройти платёж в NowPayments sandbox или симулировать webhook вручную?
2. Wallet lock на test affiliate (до May 10 2026) — ждать или patch DB?

## USER SHOULD PROVIDE IF AVAILABLE
- Required: ничего критичного
- Useful: подтверждение что NowPayments в dev режиме доступен для теста
- Optional: текст Terms/Privacy для Step 10B
