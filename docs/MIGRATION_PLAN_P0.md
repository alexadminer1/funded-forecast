# P0 Migration Plan
Last updated: 2026-05-11

## Принцип: 4 фазы для каждой задачи P0

1. **БД миграция** — добавить поля/таблицы/seed data
2. **Логика** — обновить evaluation engine, API endpoints, cron
3. **UI** — обновить дашборд, формы, дисклеймеры
4. **Тесты** — на test6/7/8 + synthetic users

---

## Порядок выполнения P0

### Wave 1 — Database foundation (Day 1-2)
- Pre-Wave: pg_dump baseline → Backblaze B2 + git tag wave-1-start
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

### Wave 2 — Evaluation engine (Day 3-5)
- P0.2 trade/buy + sell: peakBalance trailing logic
- P0.3.a cron daily-pnl-aggregate + auto-pass check
- P0.3.b resolve-markets cron: counter increment
- P0.3.c sync-markets: eventId парсинг + auto-pass check
- P0.3.d trade/buy: lastNewPositionAt update + cron inactivity-check
- P0.4 trade/buy + sell: spreads + caps + min position + full sell only

### Wave 3 — Payment system + Email + Backup (Day 6-9)
- P0.5 on-chain verify lib
- P0.5 admin/payouts/[id]/complete: integration
- P0.5 cron verify-pending-payouts setup (retry каждые 10 мин, max 24 попытки)
- P0.6 payout endpoint: USDC unification
- P0.7 register + payments/create: fingerprint check
- P0.7 cron detect-multi-accounts
- P0.10 Email templates: ИНТЕГРАЦИЯ в Resend
  (drafts готовим в TFP-style в Wave 1-2 параллельно,
   финальные тексты от заказчика приходят к Wave 4,
   placeholder-ы катим если нет финальных)
- P0.11 Backup verification: restore test на pre-prod

### Wave 4 — Frontend + Legal (Day 10-12)
- P0.1 убрать Refundable Fee тексты (footer, лендинг, Risk, Terms)
- P0.4 frontend: trade modal net cost preview со spread
  (показывать "Buy 100 @ $0.65 + 2% spread = $66.30 total" до confirm)
- P0.8 обновить дисклеймеры
- P0.8 гео-блок интеграция (MaxMind)
- P0.7 FingerprintJS на /register
- P0.10 Email templates: финальные тексты от заказчика → заменить placeholders

### Wave 5 — Testing (Day 13-15)
- Тестирование на test6/7/8
- Synthetic users script: 10-20 ботов проходят разные сценарии
- Edge cases:
  - Inactivity boundary (71ч vs 73ч)
  - Consistency 24% vs 26%
  - Buy cap 0.84 vs 0.86
  - Drawdown trailing после profit growth
  - Multi-account same fingerprint
- Email delivery testing: каждый из 6 шаблонов триггерится на pre-prod,
  проверка inbox-доставки + spam-score через mail-tester.com

### Wave 6 — Acceptance (Day 16-17)
- Все pre-prod тесты pass
- Юридический review текстов
- Финальный аудит безопасности
- **P0.9 decision**: заказчик принимает решение — оставить тестовые цены / UPDATE на боевые
- P0.11 acceptance: full restore drill — взять snapshot, restore на отдельную БД,
  проверить целостность данных. Документировать в SESSION_LOG.
- Sign-off от заказчика перед production deploy

---

## Rollback Strategy

Перед каждым Wave:
- pg_dump полный snapshot БД → Backblaze B2
- Git tag на текущем commit: `git tag wave-N-start`

**RTO:** 30 минут на rollback
**RPO:** 0 (snapshot перед каждым Wave)

### Rollback procedure
1. `prisma migrate resolve --rolled-back <migration>`
2. `pg_restore` из snapshot Backblaze B2
3. `git revert` последнего merge
4. Coolify redeploy предыдущего тега

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
| MultiAccountFlag | id, userIds[], reason, status (pending\|confirmed\|whitelisted\|reviewed_legitimate), createdAt | Multi-account detection |

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

**Note:** existing users с deviceFingerprint=NULL — legacy, исключаются из multi-account detection до момента следующей авторизации (тогда фингерпринт собирается).

### Deferred schema changes (after P0 stable)
- DROP COLUMN "refundableFeeCents" FROM "Challenge" and "ChallengePlan" —
  в первом релизе после 7 дней стабильной работы P0 в проде
  (даёт время на rollback если найдётся баг)

---

## New cron jobs

| Cron | Wave | Расписание | Что делает |
|---|---|---|---|
| /api/cron/daily-pnl-aggregate | Wave 2 | 0 1 * * * | Агрегация PnL по дням |
| /api/cron/inactivity-check | Wave 2 | 0 * * * * | 72ч/120ч без new position → fail |
| /api/cron/detect-multi-accounts | Wave 3 | 0 * * * * | Группировка fingerprint/IP → flag |
| /api/cron/verify-pending-payouts | Wave 3 | */10 * * * * | Retry on-chain verification (max 24 attempts = 4ч) |

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

### EngineSettings validation rules
- buyspread_*: 0 ≤ value ≤ 20
- buy_cap: 0.5 ≤ value ≤ 0.99
- sell_spread: 0 ≤ value ≤ 20
- min_position_pct: 0 ≤ value ≤ 50

Валидация в admin/engine-settings API endpoint + on read с fallback на defaults.

---

## Geo-block list (P0.8)

Источник: MaxMind GeoLite2-City (бесплатная база, не Country — нужна для subdivision detection).
Блок применяется на: /register, /api/payments/create

### Blocked by country_code
US, KP (North Korea), IR (Iran), SY (Syria), CU (Cuba), RU (Russia), BY (Belarus)

### Blocked by subdivision (country=UA)
- UA-43: Crimea (Автономна Республіка Крим)
- UA-14: Donetsk (Донецька область)
- UA-09: Luhansk (Луганська область)

**Note:** MaxMind GeoLite2-City subdivision support requires verification before Wave 1 — см. OPEN_QUESTIONS_P0.md #3.
