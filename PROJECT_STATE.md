# PROJECT STATE
STATE_VERSION: v2026-05-03
LAST_UPDATED: 2026-05-03
PROJECT_NAME: FundedForecast Affiliate Program
WORKING_DIRECTORY: /Users/alexadminer/funded-app

## CURRENT STATE
Affiliate Program MVP в production на funded-forecast.vercel.app, branch main.

Что работает end-to-end:
- Apply form + admin approval (`/affiliate/apply`, `/admin/affiliate`)
- Affiliate cabinet (overview / conversions / ledger pages)
- Public landing `/affiliates` с финальным контентом
- Click tracking → cookie → conversion → ledger (атомарно)
- Daily cron pending → available после hold period
- Admin detail page `/admin/affiliate/[id]` с табами (Overview / Conversions / Ledger / Referred Users / Audit Log)
- Admin actions: suspend / unsuspend / ban / forfeit (pending_only | pending_and_available) с modal + reason
- Same-IP fraud detection (registrationIpHash vs AffiliateClick.ipHash)
- Risk flags computed в admin detail (sameIp, negative balance >$1000, many clicks zero conversions, recent velocity)
- View → link в admin list для approved/suspended/banned/rejected
- Smart Affiliate header link (logged-in с affiliate → cabinet, иначе → landing)

Текущий test affiliate: `root@alexadminer.com`, refCode `tesssettre`, status approved, баланс $0, 0 conversions.

## LAST COMPLETED STEP
Step 12.2.B (commit ade0306) — admin action UI на detail page + View link в list. Vercel deployed, smoke-test "визуально работает" — подтверждено пользователем.

## CURRENT ACTIVE TASK
Пауза перед Step 9.4. Готовится перенос контекста в новый чат через CONTEXT.md + PROJECT_STATE.md.

## NEXT STEP
Step 9.4: Payout request endpoints (affiliate-side).

Pre-check questions перед началом:
1. Wallet validation — есть ли UI для set'а paymentWallet у affiliate? Если нет — расширить scope или добавить отдельный шаг.
2. Min payout method-specific ($100 / $200 ERC20) — реализовать сразу или $100 hard-floor для MVP?

Промпт Step 9.4 Pre-check ещё не написан, начинать с него.

## BACKLOG

### P0 — blockers
(пусто — все блокеры закрыты до Step 9.4)

### P1 — MVP / launch critical
- Step 9.4 — Payout request endpoint (affiliate POST /payout/request, GET /payouts) с idempotency и min-payout check
- Step 9.5 — Admin payout review endpoints (list + approve/reject/freeze)
- Step 9.6 — Cabinet payout UI (request form + history)
- Step 9.7 — Admin payout review UI
- Step 11 — Full E2E test (click → register → payment → conversion → cron → payout)
- Step 10B — Terms/Privacy pages (требуется юр. текст от пользователя)
- Pre-prod security audit (rotate ADMIN_API_KEY, DATABASE_URL password, обновить Vercel envs)

### P2 — important but not blocking
- Lifetime counters (lifetimeEarned/Paid/ClawedBack/salesCount30d) НЕ обновляются в коде, в API не выводятся
- AffiliateClick FK to Affiliate без onDelete:Cascade — cleanup требует ручного deleteMany на AffiliateClick
- Admin approve/reject existing endpoints non-atomic (update + auditLog separate) — тех.долг
- Admin UI Approve/Reject loading state отсутствует → double-click риск
- LeaderboardEntry table без RLS (Supabase Security Advisor warning) — не критично пока используем Prisma напрямую
- Email notifications для affiliates при suspend/ban/payout (deferred per G7)

### P3 — later
- KYC integration (Persona / Veriff / Sumsub)
- Sub-affiliate flow (parentAffiliateId уже в schema)
- Multi-reason fraud flags (сейчас single suspiciousReason string)
- RefTracker fallback (auto-attach клика после login если client не вызвал attach-click)
- Refactor: объединить attribution.ts lib и attach-click route в один путь
- Refactor: вынести admin auth gate в shared layout (сейчас copy-paste в каждой admin page)
- Refactor: r/[code]/route.ts inline IP hash → использовать src/lib/ip.ts

## KNOWN BUGS
Нет подтверждённых багов. Smoke-test Step 12.2 пройден визуально. Реальное поведение action endpoints в production не проверено end-to-end (нет тестового conversion с balance > 0).

## RISKS
- Technical: Step 9.4 может потребовать миграцию схемы AffiliatePayout (если в текущей схеме нет polled-status / idempotency-key fields). Pre-check определит.
- Technical: prisma db push hangs через DATABASE_URL (PgBouncer). Все DDL миграции делать через Supabase SQL Editor.
- Technical: Free Vercel plan, 2 cron limit. Если понадобится 3-й cron — нужен upgrade или объединение.
- Product: payout flow без email notifications — affiliates не узнают о статусе выплаты иначе как через cabinet refresh.
- Product: KYC не реализован — выплаты больших сумм юридически уязвимы. Acceptable для closed-test.
- Infra: единый Supabase для dev/preview/prod. Любая ошибка в миграции = production. Backup на free plan только daily auto.
- Legal: Terms/Privacy pages отсутствуют. Acceptable для closed-test, blocker для public launch.
- Security: ADMIN_API_KEY в dev-логах. Ротация перед public launch обязательна.

## RECENTLY CHANGED FILES
- src/app/admin/affiliate/page.tsx (Step 12.2.A list updates + 12.2.B View link)
- src/app/admin/affiliate/[id]/page.tsx (Step 12.2.A detail page + 12.2.B action buttons + modal)
- src/app/api/admin/affiliate/[id]/route.ts (Step 12.2.A new GET endpoint)
- src/app/api/admin/affiliate/[id]/{suspend,unsuspend,ban,forfeit}/route.ts (Step 12.1)
- src/app/api/cron/affiliate-hold/route.ts (Step 9.3)
- vercel.json (Step 9.3 cron registration)
- src/app/api/register/route.ts (Step 9.2)
- src/app/api/affiliate/attach-click/route.ts (Step 9.2)
- src/lib/affiliate/attribution.ts (Step 9.2)
- src/lib/ip.ts (Step 9.2 new file)
- prisma/schema.prisma (Step 9.1)

Last commits (chronological):
- ade0306 Step 12.2.B
- f5b06f3 Step 12.2.A
- a83e2b9 Step 12.1
- 37432a8 Step 9.3
- 8ecaf55 Step 9.2
- 9d724e2 Step 9.1

## LAST CLAUDE CODE REPORT
Step 12.2.B implementation complete. Build green, 2 files modified, commit ade0306 pushed to main, Vercel deployed. Spot-check через grep подтвердил: 5 visibility flags корректны, modal state init корректный, fmtUsd available в file scope.

## OPEN QUESTIONS
1. Wallet validation в Step 9.4 — есть ли существующий UI для set'а paymentWallet или расширяем scope шага?
2. Min payout method-specific в MVP — $100 hard-floor или сразу различение $100/$200 ERC20?

## USER SHOULD PROVIDE IF AVAILABLE
- Required: ничего критичного для Step 9.4 на старте
- Useful: подтверждение текущего test affiliate данных (refCode tesssettre, balance $0)
- Optional: текст Terms/Privacy для будущего Step 10B
