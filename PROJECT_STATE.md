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
- Admin detail page `/admin/affiliate/[id]` с табами и действиями
- Admin actions affiliate-level: suspend / unsuspend / ban / forfeit
- Same-IP fraud detection
- Risk flags
- Wallet setup с 7-day lock, method-specific валидацией
- Affiliate-side payout endpoints + cabinet UI (Step 9.4 + 9.6): создание payout request с TOCTOU recheck, dashboard summary, history с masked wallets, blocking reason mapping в UI, window.confirm перед submit
- Admin payout review API (Step 9.5): GET list, GET detail, POST approve/reject/complete/fail. Все atomic, с audit log. complete делает payout_paid ledger entry, increment lifetimePaid, переводит conversions в paid

Текущий test affiliate: root@alexadminer.com, refCode tesssettre, status approved, баланс \$0, 0 conversions, wallet установлен (USDT TRC20), walletLockUntil May 10 2026.

## LAST COMPLETED STEP
Step 9.6 (commit 3a9d361) — affiliate cabinet payout UI. Smoke-test пройден визуально: dashboard, action block с lock-сообщением, история (пустая), nav с пятью ссылками, Payouts активная.

## CURRENT ACTIVE TASK
Подготовка Step 9.7 pre-check.

## NEXT STEP
Step 9.7: Admin payout review UI.

Зафиксированный scope:
- Расширить /admin/affiliate секцию payouts (или создать отдельную /admin/payouts)
- List view: фильтр по статусу, пагинация
- Detail view: показывает payout + affiliate + conversions
- 4 actions: approve / reject / complete / fail
- Modal с adminLabel + reason (для reject/fail/complete - reason; approve - reason optional)
- complete modal: дополнительно transactionHash + adminNote (optional)

Pre-check Step 9.7 проверит:
- Структуру существующего /admin/affiliate UI (паттерны list/detail, modal, action handler)
- Где разместить payouts admin UI (вкладка в admin/affiliate или отдельная страница)
- Существующий ADMIN_API_KEY flow в admin pages

## BACKLOG

### P0 — blockers
(пусто)

### P1 — MVP / launch critical
- Step 9.7 — Admin payout review UI
- Step 11 — Full E2E test (click → register → payment → conversion → cron → payout cycle с реальным affiliate balance)
- Step 10B — Terms/Privacy pages
- Pre-prod security audit (rotate ADMIN_API_KEY, DATABASE_URL password)

### P2 — important but not blocking
- Lifetime counters lifetimeEarned не обновляется автоматически (lifetimePaid обновляется в complete)
- AffiliateClick FK без onDelete:Cascade
- Admin approve/reject existing endpoints non-atomic (тех.долг)
- Admin UI Approve/Reject loading state отсутствует
- LeaderboardEntry table без RLS
- Email notifications для affiliates (suspend/ban/payout/wallet_change)
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
- Technical: Step 9.7 — большой UI. Возможно потребуется новая admin страница или вкладка в существующей. Pre-check определит.
- Technical: prisma db push hangs. DDL — Supabase SQL Editor.
- Technical: Free Vercel plan, 2 cron limit.
- Product: payout flow без email notifications.
- Product: KYC не реализован.
- Infra: единый Supabase для dev/preview/prod.
- Legal: Terms/Privacy отсутствуют.
- Security: ADMIN_API_KEY в dev-логах.

## RECENTLY CHANGED FILES
- src/app/affiliate/payouts/page.tsx (Step 9.6 new)
- src/app/affiliate/page.tsx (Step 9.6 + Payouts nav)
- src/app/affiliate/conversions/page.tsx (Step 9.6 + Payouts nav)
- src/app/affiliate/ledger/page.tsx (Step 9.6 + Payouts nav)
- src/app/affiliate/settings/page.tsx (Step 9.6 + Payouts nav)
- src/app/api/admin/affiliate/payouts/route.ts (Step 9.5.1 new — list)
- src/app/api/admin/affiliate/payouts/[id]/route.ts (Step 9.5.1 new — detail)
- src/app/api/admin/affiliate/payouts/[id]/approve/route.ts (Step 9.5.2 new)
- src/app/api/admin/affiliate/payouts/[id]/reject/route.ts (Step 9.5.3 new)
- src/app/api/admin/affiliate/payouts/[id]/fail/route.ts (Step 9.5.3 new)
- src/app/api/admin/affiliate/payouts/[id]/complete/route.ts (Step 9.5.4 new)
- src/lib/affiliate/payout.ts (Step 9.4.1 new)
- src/app/api/affiliate/payouts/route.ts (Step 9.4.2 + 9.4.3 new)
- src/lib/ratelimit.ts (Step 9.4.2 + payoutRequest)

DB migrations applied:
- partial unique index affiliate_active_payout_idx (Step 9.4.0, applied via Supabase SQL Editor)

Last commits (chronological):
- 3a9d361 Step 9.6 (cabinet payout UI)
- e2c0509 Step 9.5 (admin payout review endpoints)
- b5646cd docs after 9.4
- 6b8a661 Step 9.4.2-9.4.3 (payout endpoints affiliate-side)
- 1129645 docs after 9.3.5
- 9e060a0 Step 9.3.5

## LAST CLAUDE CODE REPORT
Step 9.6 implementation complete. Build green, 5 files changed (+340 insertions), commit 3a9d361 pushed. Smoke-test in production: /affiliate/payouts page renders correctly with all 3 sections (dashboard with 4 stat cards, action block with wallet_locked message and disabled button, empty history). All 5 nav links present including active Payouts.

## OPEN QUESTIONS
1. Admin payout review UI — где разместить: новая вкладка в /admin/affiliate detail page (по affiliate'у) или отдельная страница /admin/payouts (cross-affiliate list)?
   - Pre-check Step 9.7 покажет структуру admin UI и подскажет.

## USER SHOULD PROVIDE IF AVAILABLE
- Required: ничего критичного для Step 9.7
- Optional: текст Terms/Privacy для Step 10B
