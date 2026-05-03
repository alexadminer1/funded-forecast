# PROJECT STATE
STATE_VERSION: v2026-05-03
LAST_UPDATED: 2026-05-03
PROJECT_NAME: FundedForecast Affiliate Program
WORKING_DIRECTORY: /Users/alexadminer/funded-app

## CURRENT STATE
Affiliate Program MVP в production на funded-forecast.vercel.app, branch main.

Что работает end-to-end:
- Apply form + admin approval (`/affiliate/apply`, `/admin/affiliate`)
- Affiliate cabinet (overview / conversions / ledger / settings pages)
- Public landing `/affiliates` с финальным контентом
- Click tracking → cookie → conversion → ledger (атомарно)
- Daily cron pending → available после hold period
- Admin detail page `/admin/affiliate/[id]` с табами
- Admin actions: suspend / unsuspend / ban / forfeit с modal + reason
- Same-IP fraud detection
- Risk flags в admin detail
- Smart Affiliate header link
- Wallet setup (set/change) с 7-дневным lock, method-specific валидацией адресов (TRC20/ERC20/Polygon), atomic update + audit log, masked addresses в audit metadata, noop check на идентичный сейв (Step 9.3.5)

Текущий test affiliate: `root@alexadminer.com`, refCode `tesssettre`, status approved, баланс $0, 0 conversions, wallet установлен (USDT TRC20, locked до May 10 2026).

## LAST COMPLETED STEP
Step 9.3.5 (commit 9e060a0) — affiliate wallet setup endpoint + cabinet UI. Vercel deployed, smoke-test пройден end-to-end (set wallet, lock на 7 дней корректен, current wallet отображается, success message сбрасывается после reload).

## CURRENT ACTIVE TASK
Подготовка Step 9.4 pre-check.

## NEXT STEP
Step 9.4: Payout request endpoints (affiliate-side).

Решения уже зафиксированы:
- Wallet setup отдельным шагом — закрыт в 9.3.5
- Min payout — method-specific сразу ($100 default / $200 ERC20)

Pre-check Step 9.4 проверит:
- Полную схему AffiliatePayout (status enum значения, includedConversionIds, idempotency-related поля)
- Существующий RATE_LIMIT.payoutRequestPerDay — где определён
- Логику balanceAvailable/balancePending — где обновляется при создании payout
- Какие conversion'ы попадают в payout (status === 'available' && не в pending payout)
- Существующий active-payout duplicate check pattern

## BACKLOG

### P0 — blockers
(пусто)

### P1 — MVP / launch critical
- Step 9.4 — Payout request endpoint (affiliate POST /payout/request, GET /payouts) с idempotency, min-payout method-specific check, wallet exists check, walletLockUntil enforcement, duplicate active payout prevention
- Step 9.5 — Admin payout review endpoints (list + approve/reject/freeze)
- Step 9.6 — Cabinet payout UI (request form + history)
- Step 9.7 — Admin payout review UI
- Step 11 — Full E2E test (click → register → payment → conversion → cron → payout)
- Step 10B — Terms/Privacy pages
- Pre-prod security audit (rotate ADMIN_API_KEY, DATABASE_URL password)

### P2 — important but not blocking
- Lifetime counters не обновляются в коде
- AffiliateClick FK без onDelete:Cascade
- Admin approve/reject existing endpoints non-atomic
- Admin UI Approve/Reject loading state отсутствует
- LeaderboardEntry table без RLS
- Email notifications для affiliates при suspend/ban/payout/wallet_change
- При login через глобальный header в /affiliate/settings внутренний кабинетный nav не виден (только external Affiliates link). Внутренний nav хардкоден в /affiliate/page.tsx и не имеет shared layout. Не критично — отдельный shared layout в P3 refactors.

### P3 — later
- KYC integration
- Sub-affiliate flow
- Multi-reason fraud flags
- RefTracker fallback
- Refactor: объединить attribution.ts lib и attach-click route
- Refactor: вынести admin auth gate в shared layout
- Refactor: вынести affiliate cabinet nav в shared layout (см. P2)
- Refactor: r/[code]/route.ts inline IP hash → src/lib/ip.ts
- Wallet review UI для admin (walletRequiresReview флаг готов в DB, action нет)

## KNOWN BUGS
Нет подтверждённых багов.

## RISKS
- Technical: Step 9.4 может потребовать миграцию AffiliatePayout (idempotency-key поле). Pre-check определит.
- Technical: prisma db push hangs через DATABASE_URL. DDL — через Supabase SQL Editor.
- Technical: Free Vercel plan, 2 cron limit.
- Product: payout flow без email notifications.
- Product: KYC не реализован.
- Infra: единый Supabase для dev/preview/prod.
- Legal: Terms/Privacy pages отсутствуют.
- Security: ADMIN_API_KEY в dev-логах.

## RECENTLY CHANGED FILES
- src/lib/affiliate/wallet.ts (Step 9.3.5 new)
- src/app/api/affiliate/wallet/route.ts (Step 9.3.5 new)
- src/app/affiliate/settings/page.tsx (Step 9.3.5 new)
- src/lib/ratelimit.ts (Step 9.3.5 + walletUpdate)
- src/app/affiliate/page.tsx (Step 9.3.5 + Settings nav link)
- src/app/affiliate/conversions/page.tsx (Step 9.3.5 + Settings nav link)
- src/app/affiliate/ledger/page.tsx (Step 9.3.5 + Settings nav link)
- src/app/admin/affiliate/page.tsx (Step 12.2)
- src/app/admin/affiliate/[id]/page.tsx (Step 12.2)
- src/app/api/admin/affiliate/[id]/route.ts (Step 12.2.A)
- src/app/api/admin/affiliate/[id]/{suspend,unsuspend,ban,forfeit}/route.ts (Step 12.1)
- src/app/api/cron/affiliate-hold/route.ts (Step 9.3)
- vercel.json (Step 9.3)
- src/app/api/register/route.ts (Step 9.2)
- src/app/api/affiliate/attach-click/route.ts (Step 9.2)
- src/lib/affiliate/attribution.ts (Step 9.2)
- src/lib/ip.ts (Step 9.2)
- prisma/schema.prisma (Step 9.1)

Last commits (chronological):
- 9e060a0 Step 9.3.5
- ade0306 Step 12.2.B
- f5b06f3 Step 12.2.A
- a83e2b9 Step 12.1
- 37432a8 Step 9.3
- 8ecaf55 Step 9.2
- 9d724e2 Step 9.1

## LAST CLAUDE CODE REPORT
Step 9.3.5 implementation complete. Build green, 7 files changed (+490), commit 9e060a0 pushed. Smoke-test пройден: wallet установлен с правильным форматом отображения, lock 7 дней enforced, success state сбрасывается после reload, current wallet отображается с человекочитаемым лейблом метода.

## OPEN QUESTIONS
Нет открытых вопросов перед Step 9.4.

## USER SHOULD PROVIDE IF AVAILABLE
- Required: ничего критичного для Step 9.4 на старте
- Optional: текст Terms/Privacy для будущего Step 10B
