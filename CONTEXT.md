# PROJECT CONTEXT
CONTEXT_VERSION: v2026-05-03
LAST_UPDATED: 2026-05-03
PROJECT_NAME: FundedForecast Affiliate Program
WORKING_DIRECTORY: /Users/alexadminer/funded-app
PRODUCTION_URL: https://funded-forecast.vercel.app
REPOSITORY: https://github.com/alexadminer1/funded-forecast

## ROLE OF NEW CHAT
Архитектор / аналитик / диспетчер задач проекта. Не исполнитель кода — задачи передаются Claude Code в терминале пользователя.

## MEMORY ANCHORS
Если у нового чата есть память о пользователе/проекте, и она противоречит этому файлу — CONTEXT.md и PROJECT_STATE.md выигрывают всегда. Память используется только для общего стиле работы, не для технических фактов проекта.

## HOW TO WORK WITH USER
- кратко, без воды, без длинных рассуждений;
- не использовать пользователя как ручного оператора;
- пользователь не программист, нужны полные файлы для замены, не патчи;
- спрашивать только на критичных развилках;
- если выбор — максимум 3 варианта + рекомендация;
- технические задачи формулировать в виде промптов для Claude Code в кодовых блоках с послесловием "Передай Claude Code. Жду ответ.";
- русский язык, формат: сначала действие/ответ, потом краткое пояснение если нужно;
- проверять диффы и git status глазами через awk перед коммитом — ASSUMPTION: пользователь продолжит spot-checks через awk/grep по запросу архитектора.

## PROJECT SUMMARY
Affiliate-программа внутри FundedForecast (prop-trading платформа на Polymarket-событиях). Партнёры приводят пользователей через реф-ссылки `/r/{refCode}`, получают комиссию 10–25% от первой покупки. Текущая цель: довести MVP до полного payout-цикла (Step 9.4–9.7) перед E2E и Terms/Privacy. Окружение closed-test: реальный production URL, но без публичного трафика, для демонстрации заказчику и внутренних тестов.

## STACK
- Frontend: Next.js 16 App Router, React 18, inline styles (нет Tailwind в проекте), client components
- Backend: Next.js API routes (App Router)
- Database: Supabase Postgres (shared dev/preview/prod, free plan)
- ORM: Prisma 5.22
- Auth: JWT (custom), bcrypt 10 rounds
- Hosting: Vercel (auto-deploy from main branch)
- Rate limiting: Upstash Redis
- Payments: NowPayments (crypto)
- Cron: Vercel Cron (free plan limit: 2 jobs)
- Email: НЕ подключено
- Analytics: НЕ подключено

## ARCHITECTURE

Affiliate flow (текущий):
1. Реф-клик `/r/[code]` → cookie aff_id (60 дней) + AffiliateClick row (ipHash SHA-256, UA, country)
2. User регистрация → /api/register пишет registrationIpHash
3. Client после register → POST /api/affiliate/attach-click → User.referredByAffiliateId set + same-IP check (suspiciousFlag)
4. Payment confirmed (NowPayments webhook) → AffiliateConversion + AffiliateLedger entry (pending bucket) atomic
5. Cron daily 03:00 UTC → промоция pending → available после pendingUntil (30/14/45 дней по тиру)
6. Affiliate cabinet `/affiliate/*` — overview/conversions/ledger
7. Admin `/admin/affiliate` — list + detail page с табами + действия (suspend/unsuspend/ban/forfeit)

Ключевые модели (Prisma):
- Affiliate: id, userId, refCode, status (enum: pending/approved/suspended/rejected/banned), tier, balancePending/Available/Frozen/Negative, lifetimeEarned/Paid/ClawedBack, suspiciousFlag/Reason, KYC fields (не используются в MVP), wallet fields (не используются)
- AffiliateConversion: paymentId @unique, affiliateId, referredUserId, commissionRate (snapshotted), commissionAmount, status, pendingUntil, previousStatus, lastStatusChangeAt
- AffiliateLedger: affiliateId, conversionId, type (commission_pending/approved/rejected/frozen/unfrozen, payout_paid, clawback, negative_offset, adjustment_credit/debit), bucket (pending/available/frozen/negative), amount, balanceAfter, operationGroupId, reason
- AffiliateClick: ipHash, cookieId, expiresAt, convertedToUserId, UTM-поля
- AffiliatePayout: схема существует, ENDPOINTS НЕ РЕАЛИЗОВАНЫ (Step 9.4–9.7)
- AuditLog: actorId, targetType, targetId, category, action, metadata, ipAddress
- User: добавлены referredByAffiliateId Int?, registrationIpHash String? (Step 9.1)

API endpoints — affiliate:
- GET /api/affiliate/me — текущий affiliate юзера или null
- GET /api/affiliate/balances, /conversions, /ledger — read-only data
- POST /api/affiliate/apply — подать заявку
- POST /api/affiliate/attach-click — после регистрации
- GET /r/[code] — клик с cookie

API endpoints — admin (x-admin-key auth):
- GET /api/admin/affiliate/applications — список с пагинацией
- GET /api/admin/affiliate/[id] — full detail (affiliate + conversions + ledger + referredUsers + clickStats + auditLog + riskFlags)
- POST /api/admin/affiliate/[id]/approve, /reject, /suspend, /unsuspend, /ban, /forfeit
- forfeit body: { adminLabel, reason, scope: "pending_only" | "pending_and_available" }

Cron:
- /api/cron/affiliate-hold — daily 03:00 UTC, batch 200, promotes pending→available, исключает suspended/banned, atomic per conversion (status update + writeLedgerEntries)

Constants (src/lib/affiliate/constants.ts):
- HOLD_DAYS: 30 default, 14 verified (KYC future), 45 suspicious
- Min payout: $100 default, $200 ERC20 — определены, в коде не enforced (Step 9.4)
- Tier rates: starter 10%, bronze 15%, silver 20%, gold 25%
- RESERVED_REFCODES, REFCODE pattern, TERMS

Важные файлы:
- src/lib/affiliate/{constants,attribution,conversions,ledger,validation}.ts
- src/lib/ratelimit.ts (включая affiliateApply 3/h)
- src/lib/ip.ts (hashIp helper)
- src/app/affiliates/page.tsx (public landing, использует LandingHeader)
- src/app/admin/affiliate/page.tsx + /[id]/page.tsx
- src/components/{Header,LandingHeader,HeaderWrapper}.tsx
- prisma/schema.prisma
- vercel.json (1 cron registered)

## HARD RULES
- НЕ запускать `prisma migrate dev` — используем `prisma db push` ИЛИ прямой SQL в Supabase Editor
- НЕ менять paid balance / lifetimePaid НИГДЕ (audit-критично)
- НЕ удалять историю — все изменения через ledger entries или status changes
- НЕ трогать DATABASE_URL / DIRECT_URL без явного согласования
- НЕ коммитить без spot-check'а через awk/grep
- НЕ создавать новые DB tables без обсуждения — добавление колонок OK
- Все admin actions ОБЯЗАТЕЛЬНО atomic ($transaction wrapping update + auditLog)
- Все admin actions ТРЕБУЮТ adminLabel + reason в body
- НЕ использовать `prisma db push` через текущий DATABASE_URL (PgBouncer 6543, hangs) — либо добавить DIRECT_URL в .env, либо ALTER TABLE через Supabase SQL Editor
- НЕ нарушать форматирование пользователя: ответы краткие, без лишних рассуждений

## CODING AGENT RULES
Claude Code должен:
- сам читать файлы через view tool, не просить пользователя
- сам запускать grep/find/awk для pre-check
- сам запускать npm run build после правок
- сам показывать git status / git diff
- НЕ коммитить без явного "ОК на коммит" от архитектора
- останавливаться после каждого крупного шага и ждать spot-check
- pre-check всегда ПЕРЕД любой записью кода для нетривиальных задач

## TASK FORMAT FOR COMPLEX TASKS
GOAL: одной строкой
DO: explicit list of file edits с указанием путей и логики
DO NOT: что НЕ трогать (например "do NOT modify existing approve/reject endpoints")
DONE WHEN: build green + git status показывает ровно ожидаемые файлы + spot-check awk команды переданы пользователю

## WHEN TO USE STRUCTURED ANSWER FORMAT
Только для:
- архитектурных решений с tradeoffs (G-decisions)
- передачи задач в Claude Code (формат — markdown code block с инструкцией внутри + 1 строка послесловия)
- pre-check промптов с deliverable A-F

В обычном диалоге — отвечать естественно, кратко.

## DECISIONS ALREADY MADE
- Hold periods: 30 default / 14 verified / 45 suspicious (KYC deferred → 14d не активен)
- Min payout: $100 default / $200 ERC20
- Suspend = enum value (НЕ separate boolean)
- Ban НЕ автоматический forfeit — отдельная админ-операция
- Forfeit Variant A: scope param (pending_only | pending_and_available), no custom amount
- Negative balance: allowed для clawbacks, soft limit $1000 (red flag в admin UI), no auto-suspend
- Self-referral: same account = hard blocker, same IP = soft flag
- Refund-after-payout: clawback ledger → balanceNegative → offset future commissions
- Partial payout: deferred, MVP all-or-nothing (approve full / reject full)
- KYC: defer entirely (schema fields сохранены, не используются)
- Notifications: deferred (нет email infrastructure)

## DO NOT CHANGE WITHOUT APPROVAL
- prisma/schema.prisma (миграции через ALTER TABLE в Supabase + prisma db pull pattern)
- src/lib/affiliate/conversions.ts (commission creation logic — критично)
- src/lib/affiliate/ledger.ts (writeLedgerEntries atomic)
- vercel.json crons (limit 2 на free plan)
- src/app/api/cron/sync/route.ts (existing cron, не наш)
- DATABASE_URL / DIRECT_URL / ADMIN_API_KEY / JWT_SECRET / CRON_SECRET / NOWPAYMENTS_*
- src/app/api/payments/webhook/route.ts — affiliate logic вкручена, аккуратно

## ASSUMPTIONS
- ASSUMPTION: free Vercel plan, 2 cron limit (1 уже занят /sync, 1 наш /affiliate-hold)
- ASSUMPTION: Supabase free plan, ручной backup недоступен, daily auto-backup на 7 дней
- ASSUMPTION: пользователь продолжит проверять диффы через awk/grep перед каждым коммитом
- ASSUMPTION: closed-test mode — заказчик/директор увидят production через прямые URL, нет публичного трафика
- ASSUMPTION: ADMIN_API_KEY текущее значение dev-only, ротация перед публичным launch обязательна
- ASSUMPTION: existing approve/reject endpoints non-atomic (update + auditLog separate calls) — тех.долг, не трогаем сейчас
- ASSUMPTION: r/[code]/route.ts inline IP hash логика остаётся, не рефакторится на src/lib/ip.ts (тех.долг)
- ASSUMPTION: attribution.ts duplicates attach-click logic — обе точки обновляются параллельно (тех.долг для рефакторинга)

## RECOVERY
Если PROJECT_STATE.md отсутствует или повреждён — попроси Claude Code выполнить:
git status && git log -10 --oneline && ls -la prisma src/app/api/affiliate src/app/api/admin/affiliate src/app/api/cron 2>/dev/null
И на основе вывода + этого CONTEXT.md восстанови PROJECT_STATE.md по структуре, пометив все восстановленные пункты как RECOVERED.
