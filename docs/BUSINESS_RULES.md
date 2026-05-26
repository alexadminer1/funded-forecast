# BUSINESS_RULES.md

## Status
APPROVED — 2026-05-15 (Алексей + Архитектор-аудитор)
SOURCE OF TRUTH — все задачи P0.3.X ссылаются на этот файл.
Конфликты с другими docs (CLAUDE.md, BACKLOG.md, старыми SESSION_LOG записями)
разрешаются в пользу этого файла.

## Goal
Финальная бизнес-модель challenge'а после аудита 2026-05-15.
Целевой pass rate: 2-3%. Длительность challenge: 10 дней (UTC).

---

## Product philosophy

Бизнес-модель FundedForecast основана на том, что подавляющее большинство пользователей проигрывает challenge (target pass rate 2-3%). Это структура revenue, не баг.

### Принцип: UI показывает данные, не управляет поведением

Сервер enforce'ит **только технические инварианты**:
- Buy cap $0.85 (защита от вырожденных payouts)
- Market endDate (нельзя торговать на закрытом рынке)
- User isBlocked (security)
- Insufficient balance (infrastructure)
- Position isolation (audit trail integrity)

Все остальные ограничения (min position size, max aggregate position, max daily volume, DLL/MLL drawdown, profit target, consistency, resolved positions count, unique events count) — это **правила challenge**, не блокировки решений. Они применяются **по итогу действий**: через DLL/MLL post-trade или через end-of-day / end-of-challenge crons.

### Что показывается в UI

- Текущие значения метрик (balance, profit, days remaining, positions)
- Условия challenge в pricing/FAQ (один раз при покупке)
- Причина fail когда он случился
- Цветовые индикаторы лимитов на gauges — допустимы (это данные)
- Email confirmations (passed, failed, payout) — transactional only

### Что НЕ делается

- **Submit buttons НЕ disabled** на "approaching limit" — юзер сам решает
- **Pre-trade rejects** только на технических инвариантах, не на размере trade или частоте
- **Активирующие emails** ("trade today or fail") — нет
- **Coaching / strategy hints** — нет
- **Predictive warnings** ("if you continue you'll fail in N days") — нет
- **"Resume failed challenge" CTAs** — нет (только Buy new)
- **"Are you sure?" confirmations** — нет

### Граница

Server enforce'ит технические инварианты hard reject'ом. Client показывает данные. Юзер сам решает жать ли Buy.

Цветовые индикаторы, recommendations и tooltips в UI — это часть данных, не активная защита от ошибок.

### Источник истины

Это не философия в вакууме — это бизнес-модель. Любая попытка "защитить" юзера от классических fail patterns (small bets, all-in concentration, overtrading) снижает revenue. Pass rate — управляемая метрика; искусственно снижать её через guardrails — это потеря выручки.

Pre-trade rejects на основе размера/частоты trade'ов — антипаттерн в этой бизнес-модели. Юзер должен иметь свободу торговать плохо. Challenge завершается по итогу его решений, не по предсказанию что решение "плохое".

---

## Параметры тиров

| Параметр                    | Starter $1k | Pro $5k  | Elite $15k |
|-----------------------------|-------------|----------|------------|
| Account size                | $1,000      | $5,000   | $15,000    |
| Test price (sandbox launch) | $1.00       | $1.95    | $3.00      |
| Production price            | $39.99      | $99.99   | $199.99    |
| Profit target               | 15% ($150)  | 15% ($750) | 15% ($2,250) |
| Min position size           | 2% ($20)    | 2% ($100) | 2% ($300) |
| Max aggregate position      | 5% ($50)    | 5% ($250) | 5% ($750) |
| Min daily volume            | 2% ($20)    | 2% ($100) | 2% ($300) |
| Max daily volume            | 5% ($50)    | 5% ($250) | 5% ($750) |
| DLL (daily loss limit)      | 5% ($50)    | 4% ($200) | 3% ($450)  |
| MLL (trailing max loss)     | 10% ($100)  | 8% ($400) | 6% ($900)  |
| Buy cap (raw price)         | $0.85       | $0.85    | $0.85      |
| Challenge duration          | 10 days     | 10 days  | 10 days    |
| Trading days required       | каждый день (10/10) | каждый день | каждый день |
| Min resolved positions      | 35          | 35       | 35         |
| Min unique events           | 30          | 30       | 30         |
| Consistency threshold       | 25%         | 25%      | 25%        |
| Profit share (after pass)   | 70%         | 80%      | 90%        |

**Принцип DLL/MLL:** дороже тир — строже правила. Меньше "воздуха" на $15k, чем на $1k.

**Tradeoff на pass rate:** Min resolved 35 и Unique events 30 — НЕ снижаем под 10 дней.
Цель — отсев слабых трейдеров. Pass rate ~2-3%.

---

## 12 Правил (ловушек)

### Single-trade превентивные (block before trade executes)

#### 1. Buy cap
- Правило: `rawPrice >= $0.85` → trade rejected
- Применяется: на raw price (до spread)
- Sell: cap НЕ применяется
- Реакция: HTTP 400 + UI banner "Buy cap: price $X is at or above $0.85"

Note: cap применяется к raw Polymarket price (до platform spread). Spread (0/2/4/7% по tier'у) добавляется поверх и НЕ участвует в cap check. Effective price (raw + spread) может технически превышать $0.85 для Pro/Elite tier'ов — это intentional design, spread = revenue платформы, не нарушение invariant'а.

#### 2. Min position size (DEPRECATED — recommendation only)

Recommended minimum trade size: 2% of startBalance ($20 for $1000 Starter, $100 for $5000 Pro, $300 for $15000 Elite).

Status: NOT enforced server-side as of TASK-PHILO-1 (Session 21, 2026-05-24). Users may execute trades below this threshold; small trades accumulate toward daily volume goal (Rule #8).

Rationale: pre-trade size rejects contradict Product philosophy (see top section) — user must be able to fail freely. End-of-day Rule #8 catches insufficient daily volume.

History: enforcement existed in Phase 2.A (Session 16, commits a0d7a01..a79542c, merged in 8faf040) and was removed in TASK-PHILO-1. Git history preserves implementation if needed for reference.

#### 3. Max aggregate position (DEPRECATED — recommendation only)

Recommended maximum aggregate position per market: 5% of startBalance ($50 for Starter, $250 for Pro, $750 for Elite).

Status: NOT enforced server-side as of TASK-PHILO-1 (Session 21, 2026-05-24). Users may concentrate any amount in a single market outcome.

Rationale: pre-trade concentration rejects contradict Product philosophy (see top section). Concentration is a valid user strategy and naturally self-limited by DLL/MLL drawdown rules (#5, #6) — large losing positions trigger drawdown fail.

History: enforcement existed in Phase 2.A (Session 16, commits a0d7a01..a79542c, merged in 8faf040) and was removed in TASK-PHILO-1. Git history preserves implementation if needed for reference.

#### 4. Max daily volume (DEPRECATED — recommendation only)

Recommended maximum daily buy volume: 5% of startBalance per UTC day.

Status: NOT enforced server-side as of TASK-PHILO-1 (Session 21, 2026-05-24). Users may trade any volume per day.

Rationale: pre-trade frequency/volume rejects contradict Product philosophy (see top section). High-frequency trading is a valid user strategy and naturally self-limited by drawdown rules. End-of-day Rule #8 still catches insufficient daily volume (lower bound).

History: enforcement existed in Phase 2.B (Session 17, commits 511b9c6..830a88d, merged in 7a7a7dc) and was removed in TASK-PHILO-1. Git history preserves implementation if needed for reference.

### Single-trade реактивные (fail challenge on breach)

#### 5. DLL breach (daily, cash-only)

- **Rule:** `(dayStartBalance − newRealizedBalance) / dayStartBalance × 100 >= dailyLossPct` → instant fail
- Evaluated post-trade inside the trade transaction. `newRealizedBalance = realizedBalance − cost` (buy) or `+ proceeds` (sell). If the check breaches, the transaction rolls back; the failure is then committed in a separate transaction along with auto-close of any open positions.
- `dayStartBalance` is a snapshot of `realizedBalance` taken at the first trade attempt of each UTC day (lazy reset). It does not move during the day.
- Active only in challenge phase (not in sandbox).
- **Cash-only by design.** `realizedBalance` tracks cash only — it does **not** include the market value of open positions. A buy of $X drops `realizedBalance` by $X immediately, contributing $X of drawdown for the day, even if the inventory is currently worth $X. Selling raises `realizedBalance` by the sale proceeds and pulls drawdown back down.
- **Contrast with MLL (rule #6):** MLL uses equity (`realizedBalance + open-positions value`); DLL uses `realizedBalance` only.
- **Why this asymmetry:** DLL is an intraday brake on fresh cash deployment, not a measure of equity loss. MLL covers equity loss across the lifetime of the challenge.
- **Worked example:** Starter $1000, DLL 5%. Trader buys $50 worth of YES shares at the start of day 1. `realizedBalance` drops from $1000 to $950 → daily drawdown 5.0% → DLL trips. Even if the YES position is still worth approximately $50, the rule has fired. To deploy more capital today the trader must first sell.
- **DLL evaluated on trade events only.** Buy and sell trigger DLL re-evaluation. Market resolve events (passive, user-not-initiated) do not trigger DLL check — they affect realizedBalance but not the daily drawdown ratio for fail purposes. MLL (rule #6) still covers cumulative losses including those triggered by resolves.
- **Reaction:** `Challenge.status='failed'`, `drawdownViolated=true`, `violationReason="Daily drawdown X% exceeded limit Y%"`. Open positions are auto-closed at current market prices in the same failure event; the proceeds raise `realizedBalance` post-failure but do not affect the fail decision.

#### 6. MLL breach (trailing)
- Правило: `realizedBalance < peakBalance - MLL$` → instant fail
- peakBalance обновляется на каждый увеличивающий баланс trade
- Trailing: peakBalance никогда не уменьшается
- Equity-aware версия: дополнительно проверяется по equity (включая open positions)
- Реакция: Challenge.status='failed', violationReason="Max Loss hit: balance $X below limit $Y"

### End-of-day cron (23:59 UTC)

#### 7. No trading activity
- Правило: `dailyBuyVolume == 0 AND challenge.status='active'` → instant fail
- Cron: `/api/cron/end-of-day-check`, schedule `55 23 * * *` UTC
- Реакция: Challenge.status='failed', violationReason="No trading activity"

#### 8. Min daily volume not reached
- Правило: `0 < dailyBuyVolume < 2% × startBalance` на конец дня → instant fail
- НЕ "день не засчитывается". Это FAIL.
- Реакция: Challenge.status='failed', violationReason="Daily volume below minimum"

### End-of-challenge cron (Day 10, 23:59 UTC)

#### 9. Profit target
- Правило: `realizedProfit < 15% × startBalance` на Day 10 23:59 UTC → fail
- Считается: realized only (open positions не учитываются на момент финализации)
- Решение по open positions: закрыть по последнему marketPrice или ждать market resolve — TBD до Фазы 4
- Реакция: Challenge.status='failed', violationReason="Profit target not reached"

#### 10. Consistency 25%
- Правило: `max(daily_pnl WHERE > 0) / total_realized_profit > 0.25` → fail
- Учитываются только winning days (positive daily_pnl)
- Edge cases:
  - No winning days → totalProfit=0, isPass=true (другие правила всё равно зафейлят)
  - Single winning day → biggestDayPct=1.0, fail
- Реакция: violationReason="Consistency rule violated (X% of total profit on biggest day)"

#### 11. Min resolved positions
- Правило: `resolvedPositionsCount < 35` на Day 10 → fail
- Считаются: positions, которые market сам resolved (НЕ sold юзером)
- Реакция: violationReason="Min resolved positions not met (X / 35)"

#### 12. Min unique events
- Правило: `uniqueEventsCount < 30` на Day 10 → fail
- Считается: distinct Market.polymarketEventId по positions challenge
- Fallback для markets без polymarketEventId: `market:${marketId}` префикс
- Реакция: violationReason="Min unique events not met (X / 30)"

### Continuous (anti-cheat — отложено)

- VPN detection (MaxMind GeoLite2) — заблокировано OPEN_QUESTIONS_P0 #3
- Multi-account detection (FingerprintJS) — отдельная задача P0.7
- Bot detection (rate limits) — отдельная задача
- На permanent ban → Challenge.status='failed', User.isBlocked=true

---

## Spreads

### Buy spread (tier-based)
Применяется AGAINST юзера. Effective price = `rawPrice × (1 + spreadPct/100)`.

| Raw price range            | Spread % |
|----------------------------|----------|
| 0.00 ≤ price < 0.60        | 0%       |
| 0.60 ≤ price < 0.70        | 2%       |
| 0.70 ≤ price < 0.80        | 4%       |
| 0.80 ≤ price < 0.85        | 7%       |
| price ≥ 0.85               | rejected (buy cap) |

### Sell spread (flat)
- 4% flat: effectiveSellPrice = `rawPrice × (1 - 0.04)`
- Применяется на любую цену
- Cap не применяется на sell

### Position avg/cost basis
- Position.avgPrice = effective price (после spread)
- Position.costBasis = sum of (amount × effectivePrice)
- Trade.price = effective price
- Trade.marketYesPriceAtExecution / marketNoPriceAtExecution = raw prices (для аудита)

---

## Wallet model

**Полностью описан в WALLET_MODEL.md (APPROVED 2026-05-11).**
Краткое:
- Sandbox wallet (создаётся при регистрации, balance=$10, существует навсегда)
- Challenge wallet (создаётся при confirmed payment, balance=startBalance, terminal на passed/failed/expired)
- Active wallet = challenge wallet если есть active challenge, иначе sandbox
- N=1 active challenge per user (MVP constraint)
- Реализация — после демо начальству, [A1] production-blocker

---

## Где живут параметры (хранилище)

***APPROVED 2026-05-15. Гибридная модель.**

### В БД (`ChallengePlan` таблица) — tier-specific параметры
Меняются продуктово, без деплоя. Snapshot'ятся в `Challenge` при покупке.

| Поле                  | Текущее    | После Фазы 1 |
|-----------------------|------------|--------------|
| `accountSize`         | ✅ есть    | без изменений |
| `priceCents`          | ✅ есть    | без изменений |
| `challengePeriodDays` | ✅ есть (30) | UPDATE → 10  |
| `profitTargetPct`     | ✅ есть    | без изменений |
| `dailyLossPct` (DLL)  | ✅ есть    | UPDATE на новые значения |
| `maxLossPct` (MLL)    | ✅ есть    | UPDATE на новые значения |
| `minTradingDays`      | ✅ есть    | UPDATE = challengePeriodDays (10) |
| `profitSharePct`      | ✅ есть    | без изменений |
| `payoutCooldownDays`  | ✅ есть    | без изменений |
| `refundableFeeCents`  | ✅ есть    | без изменений |
| `maxPayoutCapCents`   | ✅ есть    | без изменений |
| `minPayoutCents`      | ✅ есть    | без изменений |

Snapshot в Challenge при покупке: текущие поля Challenge уже хранят snapshot (`profitTargetPct`, `maxDailyDdPct`, `maxTotalDdPct`, `maxPositionSizePct`, `minTradingDays`, `startBalance`). Этот механизм сохраняется.

### В коде (`src/lib/engine/constants.ts`) — глобальные engine rules
Одинаковые для всех тиров. Меняются с деплоем, под git review.

| Константа                  | Значение     | Назначение |
|----------------------------|--------------|------------|
| `BUY_SPREAD_TIERS`         | 0/2/4/7%     | Прогрессивный спред на buy по диапазонам цены |
| `SELL_SPREAD_PCT`          | 4            | Flat спред на sell |
| `BUY_PRICE_CAP`            | 0.85         | Max raw price для buy |
| `MIN_POSITION_PCT`         | 2            | Минимальный per-trade cost (% от startBalance) |
| `MAX_AGGREGATE_POSITION_PCT` | 5          | Максимальная aggregate position на market/outcome (новая константа) |
| `MIN_DAILY_VOLUME_PCT`     | 2            | Минимальный daily buy volume (% от startBalance) |
| `MAX_DAILY_VOLUME_PCT`     | 5            | Максимальный daily buy volume (% от startBalance) (новая константа) |
| `MIN_RESOLVED_POSITIONS`   | 35           | Минимум resolved positions на Day 10 |
| `MIN_UNIQUE_EVENTS`        | 30           | Минимум distinct events на Day 10 |
| `CONSISTENCY_THRESHOLD_CHALLENGE` | 0.25  | Max share одного дня в total profit (в `consistency.ts`) |

### Принцип разделения
- **Тариф изменился** (новая цена, новая длительность, новый DLL) → UPDATE в `ChallengePlan` через dev-psql / admin UI
- **Правило игры изменилось** (новый buy cap, изменился спред, изменилась формула consistency) → код, PR, деплой

### Что НЕ переносим в БД
Все engine-rule параметры (min/max position, min/max daily volume, buy cap, min resolved/unique events, consistency) остаются в коде. Все 3 тира используют одинаковые значения этих правил, разница только в `startBalance`-множителе.

---

## Дельта от старой модели (что изменилось 2026-05-15)

### Убрано
- Inactivity timer 72h/120h — заменено правилами 7-8 (каждый день обязателен)
- "Min trading days = 15 из 30" — заменено на "10 дней / каждый день обязателен"
- Per-trade min position (P0.4.next в Session 18) — возвращено как hard reject (правило 2)

### Изменено
- Challenge duration: 30 → **10 days**
- DLL значения: Starter был 5%, Pro был 4%, Elite был 3% → **Starter 5%, Pro 4%, Elite 3%** (без изменений по факту, но в задании было предложено иначе — отвергнуто)
- MLL значения: Starter был 10%, Pro был 8%, Elite был 6% → **те же** (без изменений по факту)

### Добавлено
- Min daily volume 2% — fail при недоборе
- Max daily volume 5% — block trade
- Max aggregate position 5% per market/outcome — вместо per-trade
- End-of-day cron — fail при no activity или volume < min
- End-of-challenge cron — финальная проверка правил 9-12 на Day 10

### Без изменений
- Min resolved positions = 35
- Min unique events = 30
- Consistency = 25%
- Buy cap = $0.85
- Spreads (buy tier + sell flat 4%)
- Profit share по тирам (70/80/90)

---

## Auto-pass / Auto-fail flow

### Auto-pass
Срабатывает в `/api/trade/sell/route.ts` после успешного sell ИЛИ в cron `end-of-challenge-finalize` на Day 10 23:59 UTC.

Условия (все должны быть met):
1. `profitTargetMet == true`
2. `tradingDaysCount == challengePeriodDays` (каждый день покрыт qualifying volume)
3. `resolvedPositionsCount >= 35`
4. `uniqueEventsCount >= 30`
5. `consistency.isPassChallenge == true` (biggestDayPct <= 0.25)

Все met → `Challenge.status='passed'`, `endedAt=now()`, отправляется email "Challenge passed".

### Auto-fail triggers
- Правила 5-6 (DLL/MLL): fail в catch trade/buy или trade/sell после rollback transaction
- Правила 7-8: fail в end-of-day cron
- Правила 9-12: fail в end-of-challenge cron на Day 10 23:59
- Правило 12 (anti-cheat): fail manually или через admin action

Challenge.status='expired' — НЕ используется в коде. Все таймауты идут через 'failed' + violationReason="Challenge period expired" (legacy).

---

## Pass rate estimation (для unit-экономики)

Целевой: 2-3%.

Probability of fail per rule (independent assumption):
- Не торгует все 10 дней (правило 7-8): ~30-40%
- MLL breach: ~25-35% (Pro), ~30-40% (Elite)
- DLL breach: ~15-25%
- Не набирает 35 resolved: ~40-50% (зависит от market availability)
- Не набирает 30 unique events: ~30-45%
- Consistency >25%: ~30-40%
- Не достигает profit target 15%: ~50-65%

P(pass) ≈ 2-3% (с учётом корреляции событий).

**Главный риск:** 35 resolved за 10 дней может быть структурно недостижимо. Требуется отдельный market availability audit (задача P0.3.H) до launch.

---

## Связанные документы

- `WALLET_MODEL.md` — wallet модель
- `BACKLOG.md` — список задач P0.3.X (gap-list)
- `PROD_RELEASE_CHECKLIST.md` — процедура prod release
- `OPEN_QUESTIONS_P0.md` — незакрытые вопросы заказчику

## Изменения этого файла
- 2026-05-15: Initial version после аудита Session 19. Approved Алексей.
- 2026-05-15: Q3 resolved — hybrid storage (tier params in DB, engine rules in code).