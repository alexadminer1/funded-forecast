# P0 Migration Plan
Last updated: 2026-05-11

## Принцип: 4 фазы для каждой задачи P0

1. **БД миграция** — добавить поля/таблицы/seed data
2. **Логика** — обновить evaluation engine, API endpoints, cron
3. **UI** — обновить дашборд, формы, дисклеймеры
4. **Тесты** — на test6/7/8 + synthetic users

---

## Порядок выполнения P0

### Wave 1 — Database foundation (Day 1)
- P0.1 Migration: refundableFeeCents = 0
- P0.2 Migration: peakBalance = GREATEST(startBalance, realizedBalance)
- P0.3.a Migration: новая таблица ChallengeDailyPnL
- P0.3.b Migration: Challenge.resolvedPositionsCount + 0 default
- P0.3.c Migration: Market.polymarketEventId, Challenge.uniqueEventsCount
- P0.3.d Migration: Challenge.lastNewPositionAt
- P0.4 Migration: EngineSettings таблица + seed defaults
- P0.6 Migration: PayoutRequest.currency default 'USDC'
- P0.7 Migration: User.deviceFingerprint + MultiAccountFlag таблица
- Verify: prisma db push, schema in sync

### Wave 2 — Evaluation engine (Day 2-3)
- P0.2 trade/buy + sell: peakBalance trailing logic
- P0.3.a cron daily-pnl-aggregate + auto-pass check
- P0.3.b resolve-markets cron: counter increment
- P0.3.c sync-markets: eventId парсинг + auto-pass check
- P0.3.d trade/buy: lastNewPositionAt update + cron inactivity-check
- P0.4 trade/buy + sell: spreads + caps + min position + full sell only

### Wave 3 — Payment system (Day 4-5)
- P0.5 on-chain verify lib
- P0.5 admin/payouts/[id]/complete: integration
- P0.6 payout endpoint: USDC unification
- P0.7 register + payments/create: fingerprint check
- P0.7 cron detect-multi-accounts

### Wave 4 — Frontend + Legal (Day 6-7)
- P0.1 убрать Refundable Fee тексты (footer, лендинг, Risk, Terms)
- P0.8 обновить дисклеймеры
- P0.8 гео-блок интеграция (MaxMind)
- P0.7 FingerprintJS на /register

### Wave 5 — Testing (Day 8-9)
- Тестирование на test6/7/8
- Synthetic users script: 10-20 ботов проходят разные сценарии
- Edge cases:
  - Inactivity boundary (71ч vs 73ч)
  - Consistency 24% vs 26%
  - Buy cap 0.84 vs 0.86
  - Drawdown trailing после profit growth
  - Multi-account same fingerprint

### Wave 6 — Acceptance (Day 10-11)
- Все pre-prod тесты pass
- Юридический review текстов
- Финальный аудит безопасности
- Decision на launch с тестовыми ценами OR upgrade на боевые

---

## Legacy данные (НЕ ломаем)

- test6/7/8 existing active challenges: peakBalance migration применяется
- existing partial sells в истории: остаются как есть
- existing minTradingDays=10 challenges: доигрывают по старым правилам
- existing refundableFeeCents значения: обнуляются, но история не меняется

---

## Schema changes summary (все в Wave 1)

### New tables
| Таблица | Поля | Назначение |
|---|---|---|
| ChallengeDailyPnL | id, challengeId, date, dailyPnl, dailyTrades, isWinningDay | Consistency rule |
| EngineSettings | key, value, updatedAt | Spread/cap конфиг |
| MultiAccountFlag | id, userIds[], reason, status, createdAt | Multi-account detection |

### Modified models
| Модель | Поле | Изменение |
|---|---|---|
| Challenge | resolvedPositionsCount Int @default(0) | P0.3.b |
| Challenge | uniqueEventsCount Int @default(0) | P0.3.c |
| Challenge | lastNewPositionAt DateTime? | P0.3.d |
| Market | polymarketEventId String? | P0.3.c |
| User | deviceFingerprint String? | P0.7 |
| AuditLog | deviceFingerprint String? | P0.7 |
| PayoutRequest | currency default 'USDC' | P0.6 |

### Data migrations
| SQL | Когда |
|---|---|
| UPDATE "ChallengePlan" SET "refundableFeeCents"=0 | Wave 1 |
| UPDATE "Challenge" SET "peakBalance"=GREATEST("startBalance","realizedBalance") WHERE status='active' | Wave 1 |
| UPDATE "PayoutRequest" SET currency='USDC' WHERE currency='USDT' | Wave 1 |

### Deferred schema changes (after P0 stable)
- DROP COLUMN "refundableFeeCents" FROM "Challenge" and "ChallengePlan"

---

## New cron jobs (Wave 2-3)

| Cron | Расписание | Что делает |
|---|---|---|
| /api/cron/daily-pnl-aggregate | 0 1 * * * (01:00 UTC) | Агрегация PnL по дням |
| /api/cron/inactivity-check | 0 * * * * (hourly) | 72ч/120ч без new position → fail |
| /api/cron/detect-multi-accounts | 0 * * * * (hourly) | Группировка fingerprint/IP → flag |

---

## EngineSettings seed values

| key | value | описание |
|---|---|---|
| buyspread_below_60 | 0 | spread % для price < 0.60 |
| buyspread_60_70 | 2 | spread % для price 0.60–0.70 |
| buyspread_70_80 | 4 | spread % для price 0.70–0.80 |
| buyspread_80_85 | 7 | spread % для price 0.80–0.85 |
| buy_cap | 0.85 | максимальная цена покупки |
| sell_spread | 4 | spread % при продаже |
| min_position_pct | 2 | минимальный размер позиции (% от баланса) |

---

## Geo-block list (P0.8)

Запрещённые юрисдикции: US, North Korea, Iran, Syria, Cuba, Russia, Belarus, Crimea, LNR/DNR

Источник: MaxMind GeoLite2 (бесплатная база, скачивается в Docker build).
Блок применяется на: /register, /api/payments/create
