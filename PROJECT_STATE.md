# PROJECT STATE
STATE_VERSION: v2026-05-04
LAST_UPDATED: 2026-05-04
PROJECT_NAME: FundedForecast Affiliate Program
WORKING_DIRECTORY: /Users/alexadminer/funded-app

## CURRENT STATE
Affiliate Program MVP в production на funded-forecast.vercel.app, branch main.

Что работает end-to-end:
- Apply form + admin approval (`/affiliate/apply`, `/admin/affiliate`)
- Affiliate cabinet (overview / conversions / ledger / settings / payouts)
- Public landing `/affiliates`
- Click tracking → cookie → conversion → ledger (атомарно)
- Daily cron pending → available после hold period
- Admin sub-nav Applications | Payouts (Step 9.8.1)
- Admin detail page `/admin/affiliate/[id]` с 6 табами и actions
- Admin actions affiliate-level: suspend / unsuspend / ban / forfeit
- Wallet setup с 7-day lock, method-specific валидацией
- Affiliate-side payout endpoints + cabinet UI (Step 9.4 + 9.6)
- Admin payout review API (Step 9.5)
- Admin payout review UI (Step 9.7 + 9.8) standalone + per-affiliate tab
- Legal draft pages /terms /privacy с centralized LEGAL_CONFIG (Step 10B)

Текущий test affiliate: root@alexadminer.com, refCode tesssettre, status approved, баланс \$0, 0 conversions, wallet установлен (USDT TRC20), walletLockUntil May 10 2026.

## LAST COMPLETED STEP
Step 10B (commit fdd8891) — legal draft pages /terms /privacy + src/lib/legal/company.ts с TBD placeholders. Старые dead-code DB-driven /privacy-policy и /terms-of-use удалены. 5 ссылок (Footer/CookieBanner/account) переключены на новые маршруты. Smoke-test пройден.

## CURRENT ACTIVE TASK
Выбор следующего шага.

## NEXT STEP CANDIDATES (P1)

### Step 11 — Full E2E test (DEFERRED to dedicated session)
Решение пользователя: вынести в отдельную сессию (полдня минимум). Делать один раз перед launch когда ничего не меняется. Текущие блокеры:
- walletLockUntil на test affiliate до May 10 2026
- NowPayments в dev режиме (sandbox vs webhook simulation)
- Same-IP suspicious flag verification

### Pre-prod security audit
- Rotate ADMIN_API_KEY
- Rotate DATABASE_URL password
- Update Vercel envs

### Quick P2 fixes (быстрые улучшения)
- lifetimeEarned auto-update (отсутствует — только lifetimePaid обновляется в complete)
- Admin Approve/Reject loading state (double-click protection)
- AffiliateClick FK без onDelete:Cascade
- Cabinet nav в shared layout (хардкоден на 5 страницах)

## BACKLOG

### P0 — blockers
(пусто)

### P1 — MVP / launch critical
- Step 11 — Full E2E test (deferred to dedicated session)
- Pre-prod security audit (rotate keys)
- Финальные значения LEGAL_CONFIG когда будут юр. имя + домен (одна правка в src/lib/legal/company.ts)

### P2 — important but not blocking
- lifetimeEarned не обновляется автоматически
- Admin UI Approve/Reject loading state отсутствует
- AffiliateClick FK без onDelete:Cascade
- Admin approve/reject existing endpoints non-atomic
- LeaderboardEntry table без RLS
- Email notifications для affiliates
- Внутренний cabinet nav хардкоден без shared layout
- Freeze action для admin payout (deferred MVP)
- Real payout provider integration (NowPayments) → processing status
- Blockchain explorer links для transactionHash
- Legal review реальным юристом перед public launch
- Cookie consent infra (банер есть но не блокирует non-essential cookies)

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
- ContentBlock model в schema.prisma — оставлен как unused

## KNOWN BUGS
Нет подтверждённых багов.

## RISKS
- Step 11: NowPayments sandbox возможно недоступен → потребует webhook simulate через curl с подписью
- Step 11: walletLockUntil affiliate до May 10 2026 → patch DB или новый affiliate
- prisma db push hangs. DDL — Supabase SQL Editor.
- Free Vercel plan, 2 cron limit.
- Email notifications отсутствуют.
- KYC не реализован.
- Единый Supabase для dev/preview/prod.
- Legal страницы — DRAFT, требуют юр. ревью перед public launch
- ADMIN_API_KEY в dev-логах.

## RECENTLY CHANGED FILES
- src/lib/legal/company.ts (Step 10B new — LEGAL_CONFIG)
- src/app/terms/page.tsx (Step 10B new — 17 sections)
- src/app/privacy/page.tsx (Step 10B new — 12 sections)
- src/app/account/page.tsx (Step 10B refs update)
- src/components/CookieBanner.tsx (Step 10B refs update)
- src/components/Footer.tsx (Step 10B refs update)
- src/app/admin/affiliate/[id]/page.tsx (Step 9.8.2 + Payouts tab)
- src/app/admin/affiliate/page.tsx (Step 9.8.1 + sub-nav)
- src/app/admin/affiliate/payouts/page.tsx (Step 9.8.1 + 9.7)
- src/app/affiliate/payouts/page.tsx (Step 9.6)

DELETED:
- src/app/privacy-policy/page.tsx (dead DB-driven stub)
- src/app/terms-of-use/page.tsx (dead DB-driven stub)

DB migrations applied:
- partial unique index affiliate_active_payout_idx (Step 9.4.0)

Last commits (chronological, newest first):
- fdd8891 Step 10B (legal pages + LEGAL_CONFIG)
- 12e859c docs after 9.8
- 50d10cc Step 9.8.2 (Payouts tab in detail)
- 2661005 Step 9.8.1 (admin sub-nav)
- 802ff26 Step 9.7 (admin payout UI)
- 3a9d361 Step 9.6 (cabinet payout UI)
- e2c0509 Step 9.5 (admin payout endpoints)
- 6b8a661 Step 9.4 (payout endpoints affiliate-side)
- 9e060a0 Step 9.3.5 (wallet setup)

## LAST CLAUDE CODE REPORT
Step 10B implementation complete. 8 files changed (+814, -49), commit fdd8891 pushed. Build green: /terms and /privacy compile as static pages, /privacy-policy and /terms-of-use removed from build. Smoke-test passed: contact section shows TBD placeholders correctly.

## OPEN QUESTIONS
1. Когда будут юр. имя + финальный домен — обновить TBD значения в src/lib/legal/company.ts
2. Step 11 strategy — отдельная сессия

## USER SHOULD PROVIDE IF AVAILABLE
- Required (когда появится): юр. имя компании, финальный домен, jurisdiction, legal/support emails, registration number, registered address, effective date
- Optional: список restricted jurisdictions для Terms section 2
