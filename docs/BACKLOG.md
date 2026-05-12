# FundedForecast Backlog
Last updated: 2026-05-11
Source: Бизнес-аудит TFP + 10 decisions заказчика + 22 пункта корректировок

## Status overview
- Demo blockers: ✓ закрыты (см. Archive)
- Wallet model: ✓ APPROVED (docs/WALLET_MODEL.md)
- Decisions: ✓ получены от заказчика (см. ниже)
- Open questions: 4 блокера → docs/OPEN_QUESTIONS_P0.md
- Production readiness: requires P0 work (~17 дней)
- 7 задач закрыто (P0.3.e, P0.6, P0.10 drafts, P0.1, P0.2 Wave A, P0.2.b, P0.2.c)
- P0 production blockers: +2 новых (P0.2.d, P0.2.e)

---

## Подтверждённые decisions

1. MLL Trailing — использовать существующий peakBalance
2. Consistency Rule — 25% в challenge / 35% в payout
3. Min Resolved Positions — 35 (только market-resolved, БЕЗ sold)
4. Inactivity Timer — 72ч challenge / 120ч funded
5. Funded phase — Deduction model (TFP-style)
6. KYC — Sumsub (Web SDK, crypto-friendly)
7. Refundable Fee — УБРАТЬ полностью (не переименовывать)
8. Instant Reset — да, 30% off от боевых ($27.99/$69.99/$139.99)
9. Гео-блок — OFAC + санкционные через MaxMind GeoLite2-City
10. Multi-account — 1 device fingerprint + 1 IP hash (FingerprintJS open-source)

---

## Migration approach

### Existing test данные (test6/7/8) — legacy, не ломаем
- Existing active challenges: UPDATE peakBalance = GREATEST(startBalance, realizedBalance)
- Existing positions с partial sell в истории: остаются как есть
- minTradingDays=10 у старых challenges доигрываются, новые покупки = 15
- Refundable fee: значения в БД обнуляются, поле удаляется в migration после P0

### Pre-prod testing
Перед катом P0 в prod — pre-prod environment + симуляция на 10-20 синтетических юзеров.

---

## P0 — Production blockers

### P0.1 Refundable Fee — УБРАТЬ полностью
- [x] CLOSED 2026-05-12 (commit 841a536) — backend + БД + Admin (без текстов)
- [ ] Wave 4: тексты "Refundable Fee" на лендинге, FAQ, Risk, Terms
- [ ] Deferred (after 7 days stable): DROP COLUMN refundableFeeCents
- Scope: убрать поле + текст + логику bonus в payout
- Файлы:
  - prisma migration: UPDATE refundableFeeCents=0 для всех Plans
  - src/app/api/user/payout: убрать bonus calculation
  - Лендинг + Risk Disclosure + Terms: убрать упоминания
  - Админка Plans editor: удалить поле из формы
- Миграция БД: следующим релизом DROP COLUMN refundableFeeCents
- Тесты: payout считается без bonus
- Оценка: 4ч

### P0.2 MLL Trailing
- [x] Wave A CLOSED 2026-05-12 (commit f2f46bb) — TFP-style fixed drawdown
      realized-based, БД миграция выполнена (5 active challenges)
- [ ] Wave C: equity-aware upgrade (отдельная задача P0.2.c, требует свежих цен)
- Формула финал: maxLossAmount = startBalance × maxLossPct / 100 (FIXED)
- MLL = peakBalance − maxLossAmount (trailing вверх)
- Применено: trade/buy, trade/sell, marketResolve
- Funded phase carry-forward:
  - При passing: peakBalance переносится 1:1 в funded
  - В funded: peakBalance растёт при profit, никогда не падает
  - После withdrawal: balance -= amount, peakBalance НЕ меняется
  - Safe Balance = peakBalance × (1 - maxLossPct/100) → стабильный
- Оценка: 6ч (выполнено)

### P0.2.b Sync-prices cron infrastructure
- [x] CLOSED 2026-05-12 (commit 0f2ce7d) — cron */15, verified DB
- Зависит от: ничего (изолированная задача)
- Блокирует: P0.2.c
- Scope:
  - Фикс fallback URL bug в src/app/api/cron/sync/route.ts
    (хардкод "https://funded-forecast.vercel.app" — Vercel мёртв)
  - Verify NEXT_PUBLIC_APP_URL в Coolify env = https://tradepredictions.online
  - Настроить Coolify Scheduled Task для GET /api/cron/sync
  - Расписание: */15 * * * * (каждые 15 минут)
  - Verify после запуска: SELECT MAX("lastSyncedAt") FROM "Market"
- Файлы:
  - src/app/api/cron/sync/route.ts (фикс URL)
  - Coolify GUI (новый scheduled task)
- Оценка: 2ч

### P0.2.c Equity-aware MLL upgrade (Wave C)
- [x] CLOSED 2026-05-12 (commit 4b2b487) — equity check + peakEquity,
      verified на test8 challenge id=17
- Зависит от: P0.2.b (sync-prices работает стабильно)
- Scope:
  - Заменить MLL check на equity-based
  - equity = realizedBalance + Σ(position.shares × market.currentPrice)
  - peakBalance = MAX(peakBalance, equity) — peak от EQUITY
  - MLL = peakBalance − maxLossAmount (FIXED, как сейчас)
  - failed if currentEquity < MLL
- Файлы:
  - src/lib/equity.ts (новый helper computeEquity)
  - src/app/api/trade/buy/route.ts
  - src/app/api/trade/sell/route.ts
  - src/lib/marketResolve.ts
- Оценка: 4-6ч

### P0.2.d Sync coverage fix
- Зависит от: ничего
- Блокирует: production readiness (stale prices в БД)
- Scope:
  - В src/app/api/admin/sync-markets/route.ts: const limit = 30 → 100
  - Альтернатива: в src/app/api/cron/sync/route.ts использовать nextOffset
    из response для proper pagination до конца Polymarket feed
  - Verify: после одного cron запуска SELECT COUNT(*) FROM "Market"
    WHERE "lastSyncedAt" > NOW() - INTERVAL '20 minutes' AND status = 'live'
    Должно быть > 50% от total live
- Файлы:
  - src/app/api/admin/sync-markets/route.ts (только limit)
  - ИЛИ src/app/api/cron/sync/route.ts (pagination loop)
- Оценка: 2ч

### P0.2.e Stale market cleanup
- Зависит от: ничего
- Блокирует: production readiness (overdue маркеты остаются live)
- Scope:
  - Новый cron /api/cron/cleanup-stale-markets (или встроить в /api/cron/sync)
  - Расписание: 0 * * * * (каждый час)
  - Логика:
    1. SELECT * FROM "Market" WHERE "endDate" < NOW() AND status = 'live'
    2. Для каждого: попытаться get winningOutcome через Polymarket API
       (separate endpoint /events/{id} или markets resolved feed)
    3. Если есть outcome → status='resolved' + resolveMarketPositions(id, outcome)
    4. Если нет outcome спустя 7 дней после endDate → status='expired',
       все open positions → refund по avgPrice или forfeit (TBD)
  - Edge case: positions на expired markets — что с ними?
    → решение Архитектора при реализации
- Файлы:
  - src/app/api/cron/cleanup-stale-markets/route.ts (новый)
  - src/lib/polymarket.ts (новый helper fetchResolvedMarket?)
  - Coolify Scheduled Task (новый)
- Оценка: 8ч

### P0.3 Недостающие challenge rules

#### P0.3.a Consistency Rule
- Scope: запретить passing если biggest day > 25% от total profit
- БД: новая таблица ChallengeDailyPnL (id, challengeId, date, dailyPnl, dailyTrades, isWinningDay)
- Формула:
  - dailyPnl = SUM(realizedPnl) за UTC день
  - Включает: market-resolved + sold positions (всё закрытое)
  - isWinningDay = (dailyPnl > 0)
  - Consistency: max(dailyPnl WHERE >0) / total_realized_profit ≤ 0.25
- Логика:
  - Cron daily: агрегация из Trade за прошлый день
  - При попытке passing: max(dailyPnl WHERE >0) / totalProfit <= 0.25
  - Для payout: <= 0.35 (мягче)
- Файлы:
  - prisma/schema.prisma: новая модель
  - src/app/api/cron/daily-pnl-aggregate (новый)
  - src/app/api/trade/sell: учёт consistency перед auto-pass
  - src/app/api/user/payout: учёт consistency перед approval
- Тесты:
  - День с большим profit + остальные малые → fail consistency
  - Равномерные дни → pass consistency
- Оценка: 12ч

#### P0.3.b Min Resolved Positions 35
- Scope: для passing требуется ≥35 market-resolved positions (НЕ sold)
- БД: Challenge.resolvedPositionsCount Int @default(0)
- Логика:
  - Инкремент ТОЛЬКО при market.status → resolved (cron resolve-markets)
  - sold positions НЕ считаются
  - Проверка при auto-pass: resolvedPositionsCount >= 35
- Файлы:
  - prisma/schema.prisma: новое поле
  - src/app/api/admin/resolve-markets: инкремент counter
  - src/app/api/trade/sell: учёт в auto-pass
- Тесты:
  - 34 resolved → не passing
  - 35 resolved + target met → passing
  - 100 sold + 30 resolved → не passing
- Оценка: 8ч

#### P0.3.c Unique Events 30
- Scope: для passing требуется trade на ≥30 уникальных Polymarket events
- БД:
  - Market: добавить polymarketEventId String?
  - Challenge: добавить uniqueEventsCount Int @default(0)
- Логика:
  - Polymarket sync: тянуть event_id из Polymarket API
  - При новом trade: пересчитать uniqueEventsCount = COUNT(DISTINCT market.eventId WHERE position.challengeId=X)
  - Проверка при auto-pass: uniqueEventsCount >= 30
- Fallback:
  - Если Market.polymarketEventId IS NULL → market.id считается уникальным event
  - Документировать в коде + FAQ
- Файлы:
  - prisma/schema.prisma
  - src/lib/polymarket.ts: парсинг event_id
  - src/app/api/admin/sync-markets: сохранение eventId
  - src/app/api/trade/buy: пересчёт counter
- Тесты:
  - 50 trades на 25 событий → не passing
  - 30 trades на 30 событий → passing
- Оценка: 10ч

#### P0.3.d Inactivity Timer 72ч
- Scope: failed если нет new position >72ч (challenge) / 120ч (funded)
- БД: Challenge.lastNewPositionAt DateTime?
- Логика:
  - При создании Challenge: lastNewPositionAt = activatedAt (даёт 72ч с момента активации)
  - Update lastNewPositionAt при NEW position (не update existing)
  - Cron каждый час: status=active AND now - lastNewPositionAt > 72h → failed
  - Для funded: > 120h
- Файлы:
  - prisma/schema.prisma
  - src/lib/payment/activation.ts: set lastNewPositionAt = activatedAt
  - src/app/api/trade/buy: update timer при NEW position
  - src/app/api/cron/inactivity-check (новый)
- Тесты:
  - 73ч без new position → failed
  - 71ч без new position → active
  - Update existing position НЕ resetит таймер
- Оценка: 6ч

#### P0.3.e Trading Days дефолт 10 → 15
- Scope: обновить дефолт через админку
- Existing challenges с minTradingDays=10 НЕ трогать
- Файлы: только UPDATE через Plans editor
- Status: ✓ DONE 2026-05-11 (SQL UPDATE через Coolify DB Terminal, sandbox)
- Оценка: 0.5ч

### P0.4 Position mechanics
- Scope: progressive buy spread, buy cap $0.85, sell spread 4%, min position 2%, full sell only
- БД: новая таблица EngineSettings (key, value, updatedAt) для spread конфига
- Конфиг (значения по умолчанию):
  - buyspread_below_60: 0
  - buyspread_60_70: 2
  - buyspread_70_80: 4
  - buyspread_80_85: 7
  - buy_cap: 0.85
  - sell_spread: 4
  - min_position_pct: 2
- Логика:
  - src/app/api/trade/buy: применить spread + reject если price > 0.85
  - src/app/api/trade/sell: применить spread + reject partial sell
  - Min position check: cost >= realizedBalance * 0.02
- Frontend (trade modal):
  - Показывать "Buy 100 @ $0.65 + 2% spread = $66.30 total" ДО подтверждения
  - Юзер видит net cost с учётом spread
- Файлы:
  - prisma migration: EngineSettings + seed data
  - src/app/api/trade/buy, sell
  - src/lib/engine-settings (новый, кэш на 60 сек)
  - src/app/markets/[id]: обновить trade modal UI
- Тесты:
  - buy на price 0.65 → spread 2% применился
  - buy на price 0.86 → reject
  - sell 50% shares → reject (only full)
  - position cost < 2% balance → reject
- Оценка: 14ч

### P0.5 On-chain txHash verification (SEC-5)
- Scope: verify USDC transfer перед approving payout
- Логика (через Alchemy):
  - tx exists на Base
  - to address = expected (из PayoutRequest.address)
  - amount = approved amount (с tolerance ±1 cent)
  - asset = USDC contract
  - confirmations >= 5
- Retry cron:
  - Новый cron /api/cron/verify-pending-payouts каждые 10 минут
  - Max 24 попытки (4 часа), после — flag для manual review
  - Включён в Wave 3
- Файлы:
  - src/lib/onchain-verify (новый)
  - src/app/api/admin/payouts/[id]/complete: integration
  - src/app/api/cron/verify-pending-payouts (новый)
- Тесты:
  - Valid USDC tx → approved
  - Wrong amount → rejected
  - Wrong recipient → rejected
  - Insufficient confirmations → pending, retry cron picks up
- Оценка: 8ч

### P0.6 Валютная унификация USDC (SEC-4)
- Scope: убрать hardcoded "USDT" в PayoutRequest
- Файлы:
  - prisma migration: PayoutRequest.currency default 'USDC'
  - src/app/api/user/payout: явный USDC
  - src/app/api/admin/payouts: validation
- Оценка: 2ч

### P0.7 Multi-account защита (минимум)
- Scope: detection + soft block при purchase + retroactive cron
- Технологии: FingerprintJS open-source (CDN или npm)
- БД:
  - User.deviceFingerprint String?
  - AuditLog.deviceFingerprint String?
  - Новая таблица MultiAccountFlag (id, userIds[], reason, status, createdAt)
  - MultiAccountFlag.status enum: pending | confirmed | whitelisted | reviewed_legitimate
- Логика:
  - Регистрация: захватить deviceFingerprint + IP hash
  - Cookie/JS-disabled: блокировать регистрацию без JS, показывать <noscript> message
  - При оплате: query active challenges с тем же fingerprint OR ipHash → если есть → soft block
  - Cron detect-multi-accounts: hourly группировка → MultiAccountFlag
- Файлы:
  - frontend: интеграция FingerprintJS на /register + <noscript> block
  - src/app/api/register
  - src/app/api/payments/create: check before payment
  - src/app/api/cron/detect-multi-accounts (новый)
  - admin UI для review flags + whitelist action
- Flow при detection:
  - Soft block: показать "We need to verify your account. Contact support."
  - Email админу
  - Manual review через admin panel (approve/whitelist/confirm)
- Тесты:
  - Регистрация с тем же fingerprint → flag
  - Покупка challenge другого user на том же IP → soft block
  - JS disabled → registration blocked
- Оценка: 16ч

### P0.8 Юридические дисклеймеры + гео-блок
- Scope: обновить тексты + добавить гео-блок
- Тексты (footer, Risk Disclosure):
  - "100% simulated trading. You are NOT trading with real money."
  - "Payouts are made from company revenue, not actual trading profits."
  - "We are NOT a broker. NOT registered with SEC, FINRA, or CFTC."
- Terms: явный non-refundable subscription пункт
- Гео-блок:
  - MaxMind GeoLite2-City (бесплатная база, для subdivision detection)
  - Логика: country_code IN (US, KP, IR, SY, CU, RU, BY) → block
  - + country=UA AND subdivision_code IN (UA-43, UA-14, UA-09) → block
  - Блок на /register + при /payments/create
- Файлы:
  - src/components/Footer
  - src/app/risk-disclosure, terms, register
  - src/lib/geo-block (новый, MaxMind интеграция)
  - download MaxMind GeoLite2-City DB в Docker build
- Тесты:
  - IP из RU → reject on register
  - IP из UA (Kyiv) → allow
  - IP из UA-43 (Crimea) → reject
- Оценка: 10ч

### P0.9 UPDATE цены
- Тестовые цены остаются для closed-test phase
- EXPLICIT step в Wave 6 acceptance: заказчик принимает решение — оставить тестовые / UPDATE на боевые
- Это часть acceptance criteria Wave 6

### P0.10 Email templates (critical for launch)
- Минимум 6 шаблонов через Resend:
  1. Email verification (registration)
  2. Payment confirmed → challenge active
  3. Challenge passed
  4. Challenge failed + Instant Reset CTA
  5. Payout approved
  6. Payout completed (с txHash + BaseScan link)
- Inactivity/MLL warnings → отложены в P1 (после launch)
- Файлы: src/lib/email-templates/ (новая директория)
- Зависит от: финальный copywriting от заказчика (см. OPEN_QUESTIONS_P0.md)
- Оценка: 10ч

### P0.11 Backup & DR (production launch blocker)
- Daily PostgreSQL snapshot → Backblaze B2 (уже частично настроено)
- 7-day retention minimum
- Point-in-time recovery setup
- Тест восстановления на pre-prod (запуск restore + verify)
- RTO: 30 минут, RPO: 24ч (daily snapshot)
- Файлы: scripts/backup.sh, .github/workflows (если автоматизируем)
- Оценка: 6ч

### P0.12 FAQ full rewrite (TFP-style structure)
- Scope: переписать FAQ под полноценную структуру по референсу TFP
- Текущий формат src/app/faq/data.ts (плоский {q,a}) → новая структура:
  - 5 категорий: Getting Started, Challenge Rules, Position Mechanics, Funded Phase, Account & Compliance
  - Каждая статья: title + длинный body (примеры, формулы, таблицы, списки)
- Контент адаптировать под FF реалии (НЕ копировать TFP дословно):
  - Платежи: on-chain USDC (Base), НЕ Stripe subscription
  - Цены: текущие тестовые → актуальные mainnet после P0.9
  - MLL/DLL значения: из БД ChallengePlan (Starter 10%/5%, Pro 8%/4%, Elite 6%/3%)
  - Instant Reset цены: $27.99/$69.99/$139.99 (по 8 decision)
  - НЕ копировать статистику ("97% fail", "average $0") — нет наших данных
- Юридические дисклеймеры: согласовать с P0.8 (Risk Disclosure + Terms)
- Файлы:
  - src/app/faq/data.ts: новый schema (Article[] вместо плоских q/a)
  - src/app/faq/page.tsx: новый компонент рендера (категории + accordion статей)
- Источник референса: TFP FAQ, 5 категорий ~30 статей
- Зависит от: P0.1 (Refundable Fee убран), P0.8 (юр.дисклеймеры финализированы)
- Оценка: 6ч

### Summary P0
**Общая оценка P0: 102ч × 1.3 buffer = ~132ч ≈ 17 рабочих дней**

---

## P1.early — Critical post-launch

### P1.0 [A1] Wallet isolation
- Из WALLET_MODEL.md (APPROVED)
- БАЗА для P1.1 Funded phase
- Зависимости: нет
- Оценка: 55ч

### P1.1 Funded phase (Deduction model)
- Зависит от: P1.0 (A1 wallet isolation)
- Scope: active → passed → funded → cycles → closed
- БД:
  - Challenge.status: enum +funded
  - Новая таблица PayoutCycle (challengeId, cycleNumber, startBalance, endBalance, profitInCycle, payoutAmount, paidAt)
  - Challenge.completedPayoutsCount Int
- Логика:
  - При passing → challenge.status = 'funded' (НЕ closed)
  - В funded: trailing MLL + Inactivity 120ч + Prohibited (DLL OFF)
  - После payout: balance -= payoutAmount, peakBalance НЕ трогать, Safe Balance НЕ падает
- Оценка: 30ч

### P1.2 6 Payout requirements
- Зависит от: P1.1
- Проверки:
  1. profit_since_last_payout >= $200
  2. consistency in cycle <= 35%
  3. resolved_positions_in_cycle >= 15
  4. winning_days_in_cycle >= 5
  5. days_since_last_payout >= 14
  6. balance_after_withdraw >= Safe Balance
- Оценка: 12ч

### P1.3 KYC интеграция (Sumsub)
- Зависит от: нет
- Scope: блокировка первого payout до KYC verified
- БД: User.kycStatus (pending|verified|rejected), User.kycVerifiedAt
- Технологии: Sumsub Web SDK
- Файлы:
  - frontend: KYC flow перед payout request
  - src/app/api/user/payout: блок если !kycVerified
  - src/app/api/webhooks/sumsub (новый)
- KYC Rejected Policy: → см. OPEN_QUESTIONS_P0.md
- Оценка: 20ч

**Subtotal P1.early: 117ч ≈ 15 дней**

---

## P1.late — Important post-launch

### P1.4 Прогрессивный profit split
- Зависит от: P1.1
- Логика: Challenge.completedPayoutsCount → split:
  - 1-2: 70%
  - 3-4: 80%
  - 5+: 90%
- Plan.profitSharePct → override (если задан) или прогрессив (если null)
- Оценка: 4ч

### P1.5 Instant Reset продукт
- Scope: новый продукт для failed challenges
- Цены: 30% off от боевых ($27.99/$69.99/$139.99)
- Логика:
  - Endpoint /api/user/instant-reset
  - Только при Challenge.status=failed
  - Crypto-only оплата
  - При CONFIRMED: новый Challenge с тем же планом, balance reset
- Примечание: auto-rebill → P3
- Оценка: 16ч

### P1.6 Dashboard widgets
- Зависит от: P0.3 (правила реализованы)
- Виджеты:
  - Per-rule progress: Positions X/35, Events X/30, Days X/15
  - Safe Balance + buffer
  - Daily P&L vs DLL gauge
  - Inactivity countdown
  - Consistency: biggest day %
- Оценка: 14ч

### P1.7 Analytics & Metrics dashboard
- Метрики: registrations, purchases, fail rate per rule, payout rate, KYC pass rate
- Файлы: src/app/admin/analytics (новая страница)
- Оценка: 10ч

### P1.8 Support system setup
- Email support@, шаблоны на типовые вопросы, SLA definition
- Оценка: 4ч

**Subtotal P1.late: 48ч ≈ 6 дней**

---

## P2 — Первый месяц

- P2.1 Bot/VPN detection (IPQualityScore + behavior analysis) — 16ч
- P2.2 In-app notifications (MLL/DLL/inactivity warnings) — 12ч
- P2.3 Account states UI (LOCKED, FUNDED states) — 10ч
- P2.4 AuditLog для всех trades — 6ч
- P2.5 Risk Disclosure статистика (после accumulating data) — 4ч

**Subtotal P2: 48ч ≈ 6 дней**

---

## P3 — По запросу заказчика

- P3.1 Stripe subscription интеграция (параллельно crypto) — 30ч
- P3.2 Instant Reset auto-rebill — TBD

---

## Total estimate to production-ready

| Фаза | Оценка | Дней |
|---|---|---|
| P0 | 132ч | ~17 дней |
| P1.early | 117ч | ~15 дней |
| P1.late | 48ч | ~6 дней |
| P2 | 48ч | ~6 дней |
| **Grand total** | **~345ч** | **~44 рабочих дня ≈ 9 недель** |

---

## Archive — Closed in demo prep (2026-05-01..05-11)

- [D14] Цены /plans vs /checkout (commit 0f09b70)
- [D6+D25] Auth-aware шапка
- [D15] Checkout popup (commit 47f4ebd)
- [D20] Hide failed positions (commit 274eeab)
- [D26] Past Challenges + Sandbox secondary UX (commits 00370d0, 6dbfbc3)
- [D27][D28] Full reload + active challenge filter
- [D29] Ghost balance fix (commit ad3e283)
- [SEC-1] Rate limits via proxy (commit 31349d3)
- Docker cleanup retention=3
