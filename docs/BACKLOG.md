# FundedForecast — Backlog

Точка правды по статусу проекта. Обновляется после каждой завершённой задачи.

Последнее обновление: 2026-05-06 (после security revamp + on-chain Payment schema migration).

---

## ✅ Закрыто (production)

### Security revamp (2026-05-05)

**Закрытие бесплатного challenge flow** — `a40e135`
- Удалён `/api/user/start-challenge/route.ts` (создавал challenge без оплаты)
- В `/login/page.tsx` убран `startChallengeIfNeeded` (легаси из NowPayments era)
- В `/dashboard/page.tsx` кнопка "Start Challenge" → ссылка "Get Funded →" на `/account/plans`
- В `/api/user/payout/route.ts` добавлены guards: `planId IS NULL → 400`, `no verified Payment → 400`

**STARTING_BALANCE = $10** — `343e66b`
- В `/api/register/route.ts` константа 10000 → 10 для новых юзеров
- Существующие юзеры остаются с $10000 в BalanceLog (cleanup при следующем reset)

**Plan selection UI** — `20210df`
- `/account/plans` — authenticated страница с 3 карточками (Starter / Pro / Elite)
- Pro помечен "BEST VALUE" badge через `isPopular`
- Клик → `/checkout?planId=X` (старый checkout flow остался)

**Конфигурация планов** — SQL update
- Starter: maxLossPct 6→10, dailyLossPct 4→5
- Pro: maxLossPct 10→8, dailyLossPct 5→4
- Elite: maxLossPct 8→6, dailyLossPct 4→3
- Логика выправлена: дороже план — строже правила

**Mobile responsive** — `718e513`, `912bef2`
- `LandingHeader` hamburger menu ≤768px
- `Header` (authenticated) hamburger menu + balance compact ≤480px
- `/affiliate` tabs whiteSpace nowrap + overflow-x scroll

**Cron auto-fail expired challenges** — `fcef76f`
- Новый `/api/cron/expire-challenges` (GET, Bearer CRON_SECRET)
- Coolify Scheduled Task hourly `0 * * * *`
- Logic: `WHERE status='active' AND expiresAt < now() AND profitTargetMet=false`
- Не failит юзеров с достигнутым profit target (ждут админ pass)

**Post-challenge dashboard banner** — `e1b1ca8`
- `/api/user/mode` возвращает `lastChallenge` если нет active
- `/dashboard/page.tsx` `PostChallengeBanner` 3 состояния:
  - Passed: green, CTA "Request payout" → `/account`
  - Expired (failed + violationReason="Challenge period expired"): amber, CTA "Buy new challenge" → `/account/plans`
  - Failed (other): red, body=violationReason, CTA "Buy new challenge" → `/account/plans`

### On-chain Payment subsystem schema (2026-05-06) — `b0eba69`

**Полная замена NowPayments на on-chain.**

Schema changes:
- DROP: старая `Payment` (Int id, orderId, nowPaymentId, amount, currency, status string)
- DROP: `ProcessedStripeEvent` (NowPayments idempotency table)
- ADD: новая `Payment` с on-chain полями (cuid id, chainId, tokenAddress, expectedAmountUnits BigInt, planAmountUsd Decimal)
- ADD: `PaymentTransaction` (source of truth для on-chain transfers, idempotent на chainId+txHash+logIndex)
- ADD: `PaymentWatcherState` (per-receiver lastProcessedBlock tracking)
- ADD: enums `PaymentStatus` (10 значений), `PaymentTransactionStatus` (5 значений)
- CHANGE: `AffiliateConversion.paymentId` Int → String (cuid)
- ADD: partial unique index `Payment_active_amount_unique` на active payments

Code changes:
- `/api/payments/create/route.ts` → 410 Gone (заглушка до Step 2)
- `/api/payments/webhook/route.ts` → 410 Gone
- `/api/payments/status/route.ts` → 410 Gone
- `src/lib/affiliate/conversions.ts`: `paymentId` number → string, `PaymentStatus.CONFIRMED` enum, `Number(payment.planAmountUsd)` для netAmount
- `/api/user/payout/route.ts`: payment status check через `PaymentStatus.CONFIRMED`
- `scripts/e2e-step11.ts` — DELETED (NowPayments E2E test, устарел)
- `scripts/test-affiliate-conversion.ts` — DELETED (использовал старые типы)

Migration applied: вручную через Coolify Database Terminal (Coolify не запускает `prisma migrate deploy` автоматически — это P1 #6). Записи в `_prisma_migrations` сделаны.

**Network architecture (settled, не реализовано):**
- DEV: Base Sepolia (chainId 84532) + USDC testnet
- PROD: Base Mainnet (chainId 8453) + USDC native (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- USDC decimals: 6
- Confirmations: 6 blocks (~12-15 sec)
- Address model: один receiver address + уникальная сумма платежа (±50 cents, шаг 1 cent, окно 30 мин)
- Watcher: отдельный Node.js worker, batch poll каждые 5 sec
- Server stores: только public receiver address. NO private key on server.
- RPC: Alchemy primary, public Base RPC fallback only

### Affiliate program — full MVP (2026-05-04)

**Schema & infrastructure**
- Prisma schema: 8 enums + 5 моделей (Affiliate, AffiliateClick, AffiliateConversion, AffiliateLedger, AffiliatePayout) + RLS — `cbe5a80`
- `src/lib/affiliate/constants.ts` — TIER_CONFIG, HOLD_DAYS, COMMISSION, ATTRIBUTION + helpers — `842c59f`
- `src/lib/affiliate/ledger.ts` — атомарная writeLedgerEntries + reconcileAffiliate — `842c59f`
- Schema migration: enum suspended, поля rejectedAt/suspendedAt/bannedAt, User.referredByAffiliateId, User.registrationIpHash (Step 9.1)

**Click tracking & attribution**
- GET /r/[code] — редирект + AffiliateClick row + cookie aff_id 60d — `18962f8`
- POST /api/affiliate/attach-click — JWT auth — `b2a4463`
- src/lib/affiliate/attribution.ts — attachAffiliateClickIfNeeded — `2274690`
- src/lib/ip.ts — SHA-256 IP hash helper
- /api/register пишет registrationIpHash + вызывает attachAffiliateClickIfNeeded
- attach-click пишет referredByAffiliateId + same-IP fraud check → suspiciousFlag

**Conversion creation**
- src/lib/affiliate/conversions.ts — recordAffiliateConversionFromPayment — `a1f4978`
- First-purchase only, idempotent (paymentId @unique)
- ВАЖНО: после миграции 2026-05-06 paymentId — string, status check через PaymentStatus.CONFIRMED enum

**Cron pending → available**
- /api/cron/affiliate-hold daily 03:00 UTC (на Coolify Scheduled Tasks)
- Batch 200, исключает suspended/banned, atomic per conversion

**Apply / approval**
- POST /api/affiliate/apply + GET /api/affiliate/me (Step 6)
- Admin approve/reject endpoints
- Apply form /affiliate/apply + status page /affiliate
- Validation, rate limiting 3/hour, AuditLog

**Affiliate cabinet UI** — Overview / Referrals / Conversions / Ledger / Settings / Payouts

**Admin UI**
- /admin/affiliate — список с фильтрами и пагинацией
- /admin/affiliate/[id] — 6 табов
- Admin actions: suspend / unsuspend / ban / forfeit (atomic)
- /admin/affiliate/payouts — cross-affiliate список

**Payout flow (Step 9.4–9.7)**
- POST /api/affiliate/payouts — request (1/day rate limit)
- Admin: approve / complete с adminLabel + reason + transactionHash
- Atomic transitions, min payout check, wallet validation

**Public pages**
- /affiliates лендинг (Step 10A)
- /privacy, /terms, /risk-disclosure — drafts (Step 10B)
- LandingHeader / Footer / CookieBanner

**Visual fix legal/contact (2026-05-04)** — `3b73350` + `e715691`
- HeaderWrapper показывает LandingHeader на /privacy /terms /risk-disclosure /contact
- /contact превращён в форму (name/email/subject/message)
- /api/contact endpoint (валидация + AuditLog)
- Padding fix: 32px → 80px top на /privacy и /terms

**Auth / Security базовая**
- JWT + bcrypt, IP hashing SHA-256
- Rate limiting Upstash (login 5/15m, apply 3/h, wallet 5/h, payout 1/day)
- x-admin-key для admin endpoints

**Тесты (legacy, частично устарели)**
- Step 5A — scripts/test-affiliate-flow.ts (T1–T7 PASS)
- ~~Step 5B — scripts/test-affiliate-conversion.ts~~ — DELETED 2026-05-06 (старые типы)
- ~~Step 11 — scripts/e2e-step11.ts~~ — DELETED 2026-05-06 (NowPayments flow)
- Новые E2E тесты пишутся под on-chain после Step 4 watcher

**Sandbox VPS infrastructure (2026-05-04)**
- Hetzner CX23 Helsinki, IP 204.168.178.81, Ubuntu 24.04
- Coolify GUI: https://coolify.tradepredictions.online
- Application: https://tradepredictions.online (SSL Let's Encrypt, auto-deploy из main)
- PostgreSQL 17-alpine в Coolify
- Cron affiliate-hold ежедневно 03:00 UTC
- Cron expire-challenges ежечасно (2026-05-05)
- Бэкапы PostgreSQL ежедневно 04:00 UTC в Backblaze B2 (retention 30 дней)
- Vercel остался как fallback на funded-forecast.vercel.app

**Email delivery (2026-05-04)**
- Resend integration в /api/contact — commit cc0805e
- Custom domain tradepredictions.online verified в Resend (eu-west-1)
- Sender: noreply@tradepredictions.online
- Recipient: alexadmiener@gmail.com (через CONTACT_RECIPIENT_EMAIL env var)

**Referral redirect fixes (2026-05-04)**
- /r/[code]/route.ts использует x-forwarded-host вместо request.url — `cdf8a5c`
- Редирект /r/[code] → /login?mode=register — `721d845`

**Referrals tab в /affiliate (2026-05-04)**
- /api/affiliate/referrals — GET с pagination, summary aggregations
- /affiliate/referrals — UI с masked usernames, status badges
- Privacy: маска username (первые 3 символа + ***)

---

## 🔴 P0 — критичные (блокирующие функционал)

| # | Задача | Детали |
|---|---|---|
| 1 | **On-chain Step 2** — реальный invoice API | Заменить 410 Gone в `/api/payments/create/route.ts` на логику создания Payment row с advisory lock + проверкой уникальности суммы (±50 cents, шаг 1 cent, активные не-expired в окне). Returns `{paymentId, address, amount, expiresAt}` |
| 2 | **On-chain Step 3** — `/checkout` UI | QR код адреса + сумма + memo. Polling `/api/payments/{id}/status` каждые 5 sec. Прогресс confirmations (`waiting → seen → confirming N/6 → confirmed → activating`). Replace редирект на NowPayments |
| 3 | **On-chain Step 4** — Watcher service | Отдельный Node.js worker (Coolify Background Service). Batch poll Alchemy каждые 5 sec. Reads ERC-20 Transfer logs для USDC. Обновляет `lastProcessedBlock`. Idempotent через `(chainId, txHash, logIndex) @unique`. Status flow: DETECTED → MATCHED → CONFIRMED |
| 4 | **On-chain Step 5** — Activation flow | Когда PaymentTransaction.status=CONFIRMED + Payment.confirmationsSeen ≥ 6 + sum(amountUnits) ≥ expectedAmountUnits → Payment.status=CONFIRMED → создание Challenge + recordAffiliateConversionFromPayment |
| 5 | Auto-pass logic | При profit target + tradingDaysCount ≥ minTradingDays + !drawdownViolated → status=passed автоматически (вместо ручного админа). Трогает горячий trade flow в `sell/route.ts` |

---

## 🟡 P1 — важно, не блокирует

| # | Задача | Описание |
|---|---|---|
| 1 | Сменить пароль root@alexadminer.com | Засветился в чате при Step 11. Откладывается до pre-launch |
| 2 | Pre-prod security audit | Rotate ADMIN_API_KEY + DATABASE_URL password + sync Vercel envs + git history scan |
| 3 | LEGAL_CONFIG fill-in | src/lib/legal/company.ts — после получения домена и юрлица. Закроется автоматически при P2 #5 Admin Site Settings |
| 4 | Restricted jurisdictions list | Section 2 Terms — список стран где prediction markets запрещены |
| 5 | Lawyer review | Внешний юрист по Terms / Privacy / Risk Disclosure до public launch |
| 6 | **Coolify start command — `prisma migrate deploy`** | Сейчас миграции применяются ВРУЧНУЮ через Database Terminal. Добавить `npx prisma migrate deploy && npm start` в Custom Start Command в Coolify. Без этого следующая миграция тоже потребует ручного применения |
| 7 | Admin dashboard 403 bug | `GET /api/admin/stats 403` → `Uncaught (in promise) Error: Forbidden`. Frontend не handle'ит 4xx. Страница "висит". Воспроизведение есть в console |
| 8 | JWT session expiry / "сайт висит" | После долгой сессии (12-24 часа с двумя ролями admin+user) сайт не загружается до Sign out + Sign in. Возможно связано с #7 |
| 9 | Affiliate commission revert при refund | В webhook на статусах refunded/cancelled ничего не делается. После реальных платежей — добавить revert AffiliateConversion + AffiliateLedger |
| 10 | Update legal pages — убрать NowPayments | privacy/terms/how-it-works/checkout — текстовые упоминания NowPayments. После Step 2-5 заменить на on-chain payment text |

---

## 🟢 P2 — улучшения

| # | Задача | Описание |
|---|---|---|
| 1 | UI Failed Challenge — что с open positions | После failed challenge у юзера остались open positions от закрытого challengeId. Решить: автозакрывать при fail или оставлять как историю |
| 2 | Review challenge difficulty | После реальных платежей анализировать pass rate. Может потребовать пересмотра max loss / profit target. Цель: 2-3% pass rate Elite, 5-7% Starter |
| 3 | AffiliateLedger reconciliation cron | reconcileAffiliate() есть в коде, нигде регулярно не вызывается. Cron + alert при mismatch |
| 4 | Verified threshold automation | Проверить реализована ли автоматика перехода в isVerified=true (90d + 10 sales + 0 fraud + ≤2% rate) |
| 5 | lifetimeEarned auto-update | Сейчас обновляется только lifetimePaid (в admin complete) |
| 6 | **Admin Site Settings / Content CMS** | Объединённая задача после выбора финального бренда. Brand identity + Homepage SEO + Footer + Legal CMS + Cached server-side reads. Требует БД модель SiteSettings + LegalPage. Связана с P1 #3 |
| 7 | AffiliateClick FK без onDelete: Cascade | Удаление user оставит orphan clicks |
| 8 | Existing approve/reject non-atomic | Affiliate update + auditLog как 2 операции — риск потери audit при крэше |
| 9 | Admin Approve/Reject loading state | Double-click risk без disable во время запроса |
| 10 | LeaderboardEntry без RLS | Supabase Security Advisor warning |
| 11 | Email notifications | suspend / ban / payout / wallet_change — нет |
| 12 | Freeze action для admin payout | Deferred MVP, нет enum value |
| 13 | Blockchain explorer links | transactionHash plaintext в admin UI, нет ссылок на BaseScan/Etherscan |
| 14 | Cookie consent infra | Banner есть, non-essential cookies не блокируются |
| 15 | Wallet review UI | walletRequiresReview=true flag есть, UI для админа нет |
| 16 | Bug fix admin/expire-challenges balanceLog query | Запрос без `challengeId` фильтра — может подхватить sandbox-лог. Используется только админом вручную, не критично |
| 17 | Mock webhook E2E test | Альтернатива sandbox NowPayments (sandbox недоступен). Genenerate HMAC + curl на наш webhook. После Step 4 watcher — обновить под on-chain |

---

## 🔵 P3 — потом / refactor / cleanup

| # | Задача |
|---|---|
| 1 | Cleanup legacy challenges с `planId=NULL` или `expiresAt=NULL` (зомби от старого free flow) |
| 2 | Cleanup всех тестовых юзеров перед prod (DELETE FROM User CASCADE) |
| 3 | KYC integration (Persona / Veriff / Sumsub) |
| 4 | Sub-affiliate flow (5% / 12 mo) — parentAffiliateId в schema, RESERVED |
| 5 | Multi-reason fraud flags — сейчас single string |
| 6 | Frozen status между active и suspended |
| 7 | Negative balance auto-suspend $1000 |
| 8 | RefTracker fallback — auto-attach после login |
| 9 | Refactor: attribution.ts + attach-click — единый путь |
| 10 | Refactor: admin auth gate в shared layout |
| 11 | Refactor: cabinet nav в shared layout (6 pages) |
| 12 | Refactor: r/[code] inline IP hash → src/lib/ip.ts |
| 13 | Удалить ContentBlock model — unused dead code |
| 14 | TRC20/USDT поддержка (после Base USDC заработает) |
| 15 | Credit/Debit Card payments (placeholder "Coming soon" на /checkout) |
| 16 | Hardware wallet / multisig для receiver address (auto-transfer hot → cold > $500) |

---

## 📋 Архитектурные константы (immutable)

Не задачи, а зафиксированные решения. Не пересматривать без явного запроса.

**Commission tiers**
- Starter: 10% / Bronze: 15% / Silver: 20% / Gold: 25%
- Hard cap: 30%

**Hold periods**
- Default: 30 days / Verified: 14 days / Suspicious: 45 days

**Verified threshold (auto-promote)**
- 90+ days as affiliate / 10+ successful sales / 0 fraud incidents / ≤2% fraud rate

**Attribution**
- Last-click wins, 60-day cookie lifetime, 10-min grace period
- First successful purchase only is commissionable
- referredByAffiliateId на регистрации (через aff_id cookie) или payment (fallback)

**Successful payment status (on-chain era, после 2026-05-06)**
- Single source of truth: `Payment.status === PaymentStatus.CONFIRMED`
- Payment activates Challenge только когда:
  - `confirmationsSeen >= 6`
  - `actualAmountUnits >= expectedAmountUnits`
  - `actualAmountUnits <= expectedAmountUnits * 1.01` (overpayment ≤1% accepted)
  - tx within `expiresAt + 5min buffer`
- Overpayment >1% → `MANUAL_REVIEW`
- Underpayment → `UNDERPAID`, может быть topped up до `expiresAt`

**Plan rules (после 2026-05-05)**
| Plan | Account | Fee | Profit Target | Max Loss | Daily Loss | Min Days | Profit Share |
|------|---------|-----|---------------|----------|------------|----------|--------------|
| Starter | $1,000 | $39.99 | 15% | 10% | 5% | 10 | 70% |
| Pro | $5,000 | $99.99 | 15% | 8% | 4% | 10 | 80% |
| Elite | $15,000 | $199.99 | 15% | 6% | 3% | 10 | 90% |

Активные challenges не меняются при апдейте плана — параметры копируются в Challenge при создании.

**Sandbox starter balance**
- Новые юзеры: $10 (для UX-знакомства)
- Не для серьёзной торговли — `SANDBOX_MAX_POSITION_PCT = 2` (~$0.20 max позиция)

**On-chain payment architecture**
- Network DEV: Base Sepolia (chainId 84532) + USDC testnet
- Network PROD: Base Mainnet (chainId 8453) + native USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- USDC decimals: 6 (1 USDC = 1,000,000 units)
- Money math: BigInt only для amounts. Decimal для UI/USD display.
- Confirmations: 6 blocks (~12-15 sec on Base)
- Address model: один receiver + unique amount (±50 cents range, 1 cent step)
- Invoice window: 30 min from `createdAt`
- Watcher: batch poll каждые 5 sec (Alchemy primary)
- Server: NO private key. Receiver address public-only. Manual withdrawal to cold wallet.
- Idempotency on transactions: `(chainId, txHash, logIndex) @unique`

**Payouts**
- Manual, 1st & 15th of month
- Min: $100 TRC-20 / $200 ERC-20
- Wallet change: 7-day lock + manual review

**KYC thresholds**
- $500 first sale / $1000 lifetime
- Manual via email

**Sub-affiliate (RESERVED, не реализовано в MVP)**
- 5% от sub-affiliate sales / 12 месяцев
- parentAffiliateId в schema

**Privacy Referrals UI**
- Username mask: первые 3 символа + ***, либо первый символ + *** если username < 3
- Не показываем: email, IP, wallet, full username, internal user ID

---

## ⚠️ Риски и quirks

**Инфраструктурные риски**
- Coolify не запускает `prisma migrate deploy` автоматически — миграции вручную через Database Terminal (закрывается P1 #6)
- prisma db push зависает → DDL только через Supabase SQL Editor вручную (production)
- Sandbox БД через Coolify Database Terminal (psql -U postgres -d fundedforecast)
- Локальный .env смотрит в production Supabase — НЕ путать с sandbox
- Sandbox БД хост резолвится только внутри Coolify контейнеров
- ADMIN_API_KEY риск попадания в Vercel logs при ошибках (закрывается P1 #2)

**psql quirks (важно при ручных миграциях)**
- `q` в pager (например `\d "Payment"`) **не закрывает psql сессию**, только pager. Но при отсутствии pager выходит из psql целиком — будь осторожен
- DDL в открытой транзакции (BEGIN; ... ;) могут оставить часть catalog updates даже после ROLLBACK. CREATE TYPE может "залипнуть" если транзакция не закоммитилась чисто
- Зависшая `idle in transaction` сессия блокирует DDL других сессий. Лечится `SELECT pg_terminate_backend(pid)`
- Перед DDL миграцией — проверить `SELECT pid, state FROM pg_stat_activity WHERE state = 'idle in transaction'` и убить зависшие

**Coolify quirks**
- При изменении env vars нужен полный rebuild, не Restart (особенно NEXT_PUBLIC_*)
- Если Coolify видит тот же commit SHA — пропускает build. Лечится empty commit + push
- Coolify reverse proxy ломал request.url до localhost:3000 — фикс через x-forwarded-host (commit cdf8a5c)
- Coolify Background Services / Scheduled Tasks: Container name можно оставить пустым если один контейнер на сервис

**Quirks разработки**
- Markdown auto-link в чат-клиенте: точка в `payment.id` создаёт markdown-ссылку. После 2026-05-06 `payment.id` — cuid string, не Int — это всё ещё проблема для логов и URL.
- Claude Code сворачивает большие output'ы (`+N lines (ctrl+o to expand)`). Для pre-check больших файлов писать через `> /tmp/file.txt` и читать `cat` в обычном Terminal.app.
- Write tool теряет строки в больших файлах. Для файлов >100 строк использовать `cat > file << 'EOF'` или python3 string replace.
- Upstash @upstash/ratelimit v2: ключи формата `{prefix}:{identifier}:{windowIndex}`. Для сброса лимита нужен SCAN+DEL по конкретному префиксу. После DEL не вызывать `limit()` для проверки — он съест окно.

**Resend quirks**
- Тестовый домен onboarding@resend.dev пускает письма только на email с которым регистрировался Resend account
- Suppression list — невалидные email auto-block. Удаляются вручную через UI
- Новый домен warm-up: первые письма доставляются ~10 минут

**NowPayments status (2026-05-06)**
- Полностью удалён из кода
- Sandbox среда NowPayments в maintenance mode — не блокер, мы перешли на on-chain
- Production keys в Coolify env остались (будут удалены после Step 4)

**Тестовые остатки**
- User id=51 vapinkov (va.pinkov@gmail.com) — Challenge id=9 status=failed (legacy free), violationReason="Legacy free challenge closed during security fix". Сносится при cleanup всех тестовых юзеров (P3 #2)
- Все тестовые юзеры будут удалены перед prod launch — P3 #2

---

## 📊 Прогресс

```
Affiliate MVP:        ████████████████████  100%
Public pages UI:      ████████████████████  100%
Email infra:          ████████████████████  100%
Sandbox VPS:          ████████████████████  100%
Mobile responsive:    ████████████████████  100%
Security revamp:      ████████████████████  100%  (free flow closed, $10 starter)
Plan selection UI:    ████████████████████  100%  (/account/plans)
Cron auto-fail:       ████████████████████  100%  (expired challenges)
Post-challenge UI:    ████████████████████  100%  (passed/failed/expired banner)
On-chain schema:      ████████████████████  100%  (Step 1 done, b0eba69)
On-chain invoice API: ░░░░░░░░░░░░░░░░░░░░    0%  (Step 2)
On-chain checkout UI: ░░░░░░░░░░░░░░░░░░░░    0%  (Step 3)
On-chain watcher:     ░░░░░░░░░░░░░░░░░░░░    0%  (Step 4 — biggest piece)
On-chain activation:  ░░░░░░░░░░░░░░░░░░░░    0%  (Step 5)
Auto-pass logic:      ░░░░░░░░░░░░░░░░░░░░    0%
Legal content:        ████████░░░░░░░░░░░░   40%  (drafts, lawyer pending)
Security audit:       ░░░░░░░░░░░░░░░░░░░░    0%
Admin Site Settings:  ░░░░░░░░░░░░░░░░░░░░    0%
P1 cleanup:           ██░░░░░░░░░░░░░░░░░░   10%  (10 задач)
P2 cleanup:           ░░░░░░░░░░░░░░░░░░░░    0%  (17 задач)
P3 refactors:         ░░░░░░░░░░░░░░░░░░░░    0%  (16 задач)
```

**Public launch ready чек-лист:** все P0 + P1 закрыто, mock-payment E2E прошёл.

**Estimated до launch:** 3-5 рабочих сессий. P0 #1-4 (on-chain) — это основной remaining work, ~2-3 сессии. P0 #5 auto-pass + P1 #6-10 — 1 сессия. Внешние блокеры: домен, юрист.

---

## История сессий

- **2026-05-06** — On-chain Payment subsystem schema (Step 1 / 5 этапов) — `b0eba69`. NowPayments полностью удалён из кода. Новые модели Payment/PaymentTransaction/PaymentWatcherState с BigInt + cuid. AffiliateConversion.paymentId Int → String. Партиал unique index на active payments. Старые API routes → 410 Gone. conversions.ts + payout/route.ts адаптированы под PaymentStatus enum. Миграция применена вручную через Coolify DB Terminal (Coolify не запускает migrate deploy автоматически — добавлено в P1 #6). Backlog обновлён.

- **2026-05-05** — Security revamp: 7 коммитов. Закрыт бесплатный challenge flow (`a40e135`), STARTING_BALANCE = $10 (`343e66b`), `/account/plans` plan selection UI (`20210df`), конфигурация планов выправлена через SQL (Starter 10/5, Pro 8/4, Elite 6/3), mobile responsive headers (`718e513`, `912bef2`), cron auto-fail expired challenges hourly (`fcef76f`), post-challenge dashboard banner с CTA (`e1b1ca8`).

- **2026-05-04** — Step 11 E2E (T0-T26 ALL PASS) на production, visual fix legal/contact + контактная форма + Resend интеграция, sandbox VPS migration на Coolify (tradepredictions.online + auto-deploy), redirect fixes на /r/[code] (x-forwarded-host + /login?mode=register), Referred Users tab в /affiliate (privacy-aware с masked usernames), webhook fix (Number coercion + guards), backlog consolidated в repo
