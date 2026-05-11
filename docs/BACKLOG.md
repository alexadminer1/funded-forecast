# FundedForecast Backlog
Last updated: 2026-05-11
Source: Бизнес-аудит TFP + 10 decisions заказчика

## Status overview
- Demo blockers: ✓ закрыты (см. Archive)
- Wallet model: ✓ APPROVED (docs/WALLET_MODEL.md)
- Decisions: ✓ получены от заказчика (см. ниже)
- Production readiness: requires P0 work (~7-10 дней)

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
9. Гео-блок — OFAC + санкционные через MaxMind GeoLite2
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

## P0 — Production blockers (~7-10 дней)

### P0.1 Refundable Fee — УБРАТЬ полностью
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
- Scope: переключить drawdown с fixed на trailing через peakBalance
- Файлы:
  - src/app/api/trade/buy: peakBalance update logic
  - src/app/api/trade/sell: то же + drawdown check от peakBalance
  - SQL migration: UPDATE peakBalance = GREATEST(startBalance, realizedBalance) для всех active challenges
- Логика:
  - При каждом trade: peakBalance = MAX(peakBalance, newRealizedBalance)
  - Drawdown check: (peakBalance - realizedBalance) / peakBalance * 100 >= maxTotalDdPct
  - peakBalance НИКОГДА не уменьшается
- Тесты:
  - profit → peakBalance растёт, MLL "поднимается"
  - loss → peakBalance не падает, проверка от пика
  - test6/7/8: migration корректно проставила peakBalance
- Оценка: 6ч

### P0.3 Недостающие challenge rules

#### P0.3.a Consistency Rule
- Scope: запретить passing если biggest day > 25% от total profit
- БД: новая таблица ChallengeDailyPnL (id, challengeId, date, dailyPnl, dailyTrades, isWinningDay)
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
  - Update lastNewPositionAt при NEW position (не update existing)
  - Cron каждый час: status=active AND now - lastNewPositionAt > 72h → failed
  - Для funded: > 120h
- Файлы:
  - prisma/schema.prisma
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
- Файлы:
  - prisma migration: EngineSettings + seed data
  - src/app/api/trade/buy, sell
  - src/lib/engine-settings (новый, кэш на 60 сек)
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
- Файлы:
  - src/lib/onchain-verify (новый)
  - src/app/api/admin/payouts/[id]/complete: integration
- Тесты:
  - Valid USDC tx → approved
  - Wrong amount → rejected
  - Wrong recipient → rejected
  - Insufficient confirmations → pending
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
- Логика:
  - Регистрация: захватить deviceFingerprint + IP hash
  - При оплате: query active challenges с тем же fingerprint OR ipHash → если есть → soft block
  - Cron detect-multi-accounts: hourly группировка → MultiAccountFlag
- Файлы:
  - frontend: интеграция FingerprintJS на /register
  - src/app/api/register
  - src/app/api/payments/create: check before payment
  - src/app/api/cron/detect-multi-accounts (новый)
  - admin UI для review flags
- Flow при detection:
  - Soft block: показать "We need to verify your account. Contact support."
  - Email админу
  - Manual review через admin panel
- Тесты:
  - Регистрация с тем же fingerprint → flag
  - Покупка challenge другого user на том же IP → soft block
- Оценка: 16ч

### P0.8 Юридические дисклеймеры + гео-блок
- Scope: обновить тексты + добавить гео-блок
- Тексты (footer, Risk Disclosure):
  - "100% simulated trading. You are NOT trading with real money."
  - "Payouts are made from company revenue, not actual trading profits."
  - "We are NOT a broker. NOT registered with SEC, FINRA, or CFTC."
- Terms: явный non-refundable subscription пункт
- Гео-блок:
  - MaxMind GeoLite2 (бесплатная база)
  - Список запрещённых: US, North Korea, Iran, Syria, Cuba, Russia, Belarus, Crimea, LNR/DNR
  - Блок на /register + при /payments/create
- Файлы:
  - src/components/Footer
  - src/app/risk-disclosure, terms, register
  - src/lib/geo-block (новый, MaxMind интеграция)
  - download MaxMind DB в Docker build
- Тесты:
  - IP из RU → reject on register
  - IP из UA → allow
- Оценка: 10ч

### P0.9 UPDATE цены — ОТЛОЖЕНО
- Тестовые цены остаются для closed-test phase
- При финальном launch: UPDATE через админку

### Summary P0
**Общая оценка P0: ~86 часов = ~11 рабочих дней при 1 разработчике**

---

## P1 — Первая неделя после launch

### P1.0 [A1] Wallet isolation
- Из WALLET_MODEL.md (APPROVED)
- БАЗА для P1.1 Funded phase
- Зависимости: нет
- Оценка: L (40ч)

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
- Оценка: 20ч

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

### Summary P1
**Общая оценка P1: ~136ч = ~17 рабочих дней**

---

## P2 — Первый месяц

- P2.1 Bot/VPN detection (IPQualityScore + behavior analysis) — 16ч
- P2.2 In-app notifications (MLL/DLL/inactivity warnings) — 12ч
- P2.3 Account states UI (LOCKED, FUNDED states) — 10ч
- P2.4 AuditLog для всех trades — 6ч
- P2.5 Risk Disclosure статистика (после accumulating data) — 4ч

---

## P3 — По запросу заказчика

- P3.1 Stripe subscription интеграция (параллельно crypto) — 30ч

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
