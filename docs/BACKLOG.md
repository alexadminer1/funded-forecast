# FundedForecast — Backlog

Точка правды по статусу проекта. Обновляется после каждой завершённой задачи.

Последнее обновление: 2026-05-04 (после Step 11 E2E + visual fix + webhook fix).

---

## ✅ Закрыто (production)

### Affiliate program — full MVP

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
- /api/register пишет registrationIpHash
- attach-click пишет referredByAffiliateId + same-IP fraud check → suspiciousFlag

**Conversion creation**
- src/lib/affiliate/conversions.ts — recordAffiliateConversionFromPayment — `a1f4978`
- Webhook integration — `a460ea3`
- First-purchase only, idempotent (paymentId @unique + ProcessedStripeEvent)

**Cron pending → available**
- /api/cron/affiliate-hold daily 03:00 UTC (Step 9.3)
- Batch 200, исключает suspended/banned, atomic per conversion

**Apply / approval**
- POST /api/affiliate/apply + GET /api/affiliate/me (Step 6)
- Admin approve/reject endpoints
- Apply form /affiliate/apply + status page /affiliate
- Validation, rate limiting 3/hour, AuditLog

**Affiliate cabinet UI** — Overview / Conversions / Ledger / Settings / Payouts

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
- Удалены DRAFT баннеры с privacy/terms
- Удалена дублирующая "Back to home" с risk-disclosure
- /contact превращён в форму (name/email/subject/message)
- /api/contact endpoint (валидация + AuditLog)
- Padding fix: 32px → 80px top на /privacy и /terms

**Auth / Security базовая**
- JWT + bcrypt, IP hashing SHA-256
- Rate limiting Upstash (login 5/15m, apply 3/h, wallet 5/h, payout 1/day)
- x-admin-key для admin endpoints

**Тесты**
- Step 5A — scripts/test-affiliate-flow.ts (T1–T7 PASS)
- Step 5B — scripts/test-affiliate-conversion.ts (10/10 PASS)
- **Step 11 — scripts/e2e-step11.ts (T0–T26 ALL PASS на production)** — `b8c840f`
  - Полный flow: click → attach → payment → webhook (HMAC SHA-512) → cron → payout → admin approve → admin complete
  - Verify: suspiciousFlag=true → 45d hold, ledger entries, balance transitions, lifetimePaid increment
  - Atomic cleanup в finally

**Webhook fix (найден через E2E, 2026-05-04)** — `e592782` + `ab283d8`
- Number(actually_paid) каст + guards против NaN / null / undefined
- payAmount и payCurrency пишутся только если значение валидное, иначе null
- Re-tested E2E ALL 27 PASS после фикса

---

## 🔴 P1 — блокирующее launch

| # | Задача | Детали |
|---|---|---|
| 1 | Сменить пароль root@alexadminer.com | Засветился в чате при Step 11 |
| 2 | Email delivery /api/contact | Resend / SES / Postmark → support@fundedforecast.com |
| 3 | Pre-prod security audit | Rotate ADMIN_API_KEY + DATABASE_URL password + sync Vercel envs + git history scan + Vercel logs не должны содержать ADMIN_API_KEY |
| 4 | LEGAL_CONFIG fill-in | src/lib/legal/company.ts — после получения домена и юрлица. **Закроется автоматически когда сделаем P2 #5 Admin Site Settings.** |
| 5 | Restricted jurisdictions list | Section 2 Terms — список стран где prediction markets запрещены |
| 6 | Lawyer review | Внешний юрист по Terms / Privacy / Risk Disclosure до public launch |

---

## 🟡 P2 — важно, не блокирует

| # | Задача | Описание |
|---|---|---|
| 1 | NowPayments polling fallback | Webhook — единственный путь финализации Payment. Если потерян — Payment навсегда `pending`. Cron polling pending старше N минут через NowPayments API |
| 2 | AffiliateLedger reconciliation cron | reconcileAffiliate() есть в коде, нигде регулярно не вызывается. Cron + alert при mismatch |
| 3 | Verified threshold automation | Проверить реализована ли автоматика перехода в isVerified=true (90d + 10 sales + 0 fraud + ≤2% rate). Если нет — cron |
| 4 | lifetimeEarned auto-update | Сейчас обновляется только lifetimePaid (в admin complete) |
| 5 | **Admin Site Settings / Content CMS** | Объединённая задача после выбора финального бренда. Включает: (1) Brand identity — productName, companyName, domain, emails, address, jurisdiction, registrationNumber, effectiveDate; (2) Homepage SEO — title, description, ogImage, canonicalUrl; (3) Footer / social links; (4) Legal CMS — Privacy/Terms/Risk markdown editor рядом с Plans/FAQ/Reviews в /admin/content; (5) Cached server-side reads (Next.js unstable_cache + revalidate on PATCH); (6) Admin edit UI с валидацией. Требует БД модель SiteSettings (singleton) + LegalPage. Блокеры: финальный домен, юрлицо, ogImage. Связана с P1 #4 LEGAL_CONFIG fill-in — после реализации #4 закрывается автоматически |
| 6 | AffiliateClick FK без onDelete: Cascade | Удаление user оставит orphan clicks |
| 7 | Existing approve/reject non-atomic | Affiliate-level update + auditLog как 2 операции — риск потери audit при крэше |
| 8 | Admin Approve/Reject loading state | Double-click risk без disable во время запроса |
| 9 | LeaderboardEntry без RLS | Supabase Security Advisor warning |
| 10 | Email notifications | suspend / ban / payout / wallet_change — нет |
| 11 | Freeze action для admin payout | Deferred MVP, нет enum value |
| 12 | NowPayments processing status | Сейчас сразу complete, нет промежуточного |
| 13 | Blockchain explorer links | transactionHash plaintext, нет ссылок на explorer |
| 14 | Cookie consent infra | Banner есть, non-essential cookies не блокируются |
| 15 | Wallet review UI | walletRequiresReview=true flag есть, UI для админа нет |

---

## 🟢 P3 — потом / refactor

| # | Задача |
|---|---|
| 1 | KYC integration (Persona / Veriff / Sumsub) |
| 2 | Sub-affiliate flow (5% / 12 mo) — parentAffiliateId готов, RESERVED |
| 3 | Multi-reason fraud flags — сейчас single string |
| 4 | Frozen status между active и suspended |
| 5 | Negative balance auto-suspend $1000 |
| 6 | RefTracker fallback — auto-attach после login |
| 7 | Refactor: attribution.ts + attach-click — единый путь |
| 8 | Refactor: admin auth gate в shared layout |
| 9 | Refactor: cabinet nav в shared layout (5 pages) |
| 10 | Refactor: r/[code] inline IP hash → src/lib/ip.ts |
| 11 | Удалить ContentBlock model — unused dead code |
| 12 | Cleanup test user afftest1@test.local (id=6) |

---

## 📋 Архитектурные константы (immutable)

Не задачи, а зафиксированные решения. Не пересматривать без явного запроса.

**Commission tiers**
- Starter: 10% / Bronze: 15% / Silver: 20% / Gold: 25%
- Hard cap: 30%

**Hold periods**
- Default: 30 days / Verified: 14 days / Suspicious: 45 days

**Verified threshold (auto-promote)**
- 90+ days as affiliate
- 10+ successful sales
- 0 fraud incidents
- ≤2% fraud rate

**Attribution**
- Last-click wins
- 60-day cookie lifetime
- 10-min grace period
- First successful purchase only is commissionable

**Successful payment statuses (verbatim из webhook)**
- confirmed
- finished

**Payouts**
- Manual, 1st & 15th
- Min: $100 TRC-20 / $200 ERC-20
- Wallet change: 7-day lock + manual review

**KYC thresholds**
- $500 first sale / $1000 lifetime
- Manual via email

**Webhook idempotency**
- Outer: ProcessedStripeEvent (eventId = `nowpayments:{payment_id}:{status}`)
- Inner: AffiliateConversion.paymentId @unique

**Sub-affiliate (RESERVED, не реализовано в MVP)**
- 5% от sub-affiliate sales / 12 месяцев
- parentAffiliateId в schema

---

## ⚠️ Риски и quirks

**Инфраструктурные риски**
- prisma db push зависает → DDL только через Supabase SQL Editor вручную
- Free Vercel plan: limit 2 cron jobs одновременно
- Единый Supabase для dev / preview / prod (нет изоляции)
- Email infrastructure отсутствует совсем
- ADMIN_API_KEY риск попадания в Vercel logs при ошибках (закрывается P1 #3)

**Quirks разработки**
- Markdown auto-link в чат-клиенте: payment.id → markdown-ссылка при копировании. Workarounds: chr(46) в Python heredoc, \x2e в perl regex, heredoc с 'EOF'. Учитывать при написании промптов.
- Claude Code сворачивает большие output'ы (+N lines (ctrl+o to expand)). Для pre-check больших файлов писать через > /tmp/file.txt и читать cat в обычном Terminal.app.
- Write tool теряет строки в больших файлах. Для файлов >100 строк использовать cat > file << 'EOF' или python3 string replace.
- Upstash @upstash/ratelimit v2: ключи формата {prefix}:{identifier}:{windowIndex}. Для сброса лимита нужен SCAN+DEL по конкретному префиксу. После DEL не вызывать limit() для проверки — он съест окно.

**Тестовые остатки в БД**
- User id=6 afftest1@test.local — UserConsent + BalanceLog dependencies, не удаляется простым DELETE (P3 #12)

---

## 📊 Прогресс

```
Affiliate MVP:        ████████████████████  100%  (Step 11 E2E PASS)
Public pages UI:      ████████████████████  100%  (visual fix done)
Webhook robustness:   ████████████████████  100%  (guards added, re-tested)
Legal content:        ████████░░░░░░░░░░░░   40%  (drafts, TBD pending)
Email infra:          ░░░░░░░░░░░░░░░░░░░░    0%
Security audit:       ░░░░░░░░░░░░░░░░░░░░    0%
Admin Site Settings:  ░░░░░░░░░░░░░░░░░░░░    0%  (отложено до ребренда)
P2 cleanup:           ░░░░░░░░░░░░░░░░░░░░    0%  (15 задач)
P3 refactors:         ░░░░░░░░░░░░░░░░░░░░    0%  (12 задач)
```

**Public launch ready чек-лист:** P1 #1–6 закрыто.

**Estimated до launch:** 2–4 рабочих сессии. P1 #1–3 быстрые. #4–6 — внешние блокеры (домен, юрист).

---

## История сессий

- **2026-05-04** — Step 11 E2E (T0-T26 ALL PASS), visual fix legal/contact, contact form, padding fix, webhook fix (Number coercion + guards), backlog consolidated from 4 chat sessions

