# FundedForecast Backlog
Last updated: 2026-05-11
Source: Бизнес-аудит TFP + 10 decisions заказчика + 22 пункта корректировок

## Status overview
- Demo blockers: ✓ закрыты (см. Archive)
- Wallet model: ✓ APPROVED (docs/WALLET_MODEL.md)
- Decisions: ✓ получены от заказчика (см. ниже)
- Open questions: 4 блокера → docs/OPEN_QUESTIONS_P0.md
- Production readiness: requires P0 work (~17 дней)
- 10 задач закрыто (P0.3.e, P0.6, P0.10 drafts, P0.1, P0.2 Wave A, P0.2.b, P0.2.c, P0.2.d, P0.2.e, P0.5)
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
- [x] CLOSED 2026-05-12 (commit 0f52644) — verified coverage 27% → 78%,
      10 iterations × 100 markets
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
- [x] CLOSED 2026-05-12 (commit ff54927) — 128 resolved, 15 positions
      processed, challenge #18 verified
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

### P0.2.f Delist persistently-stale markets (низкий приоритет)
- Зависит от: ничего
- Блокирует: ничего (косметика админ-панели и /markets UI)
- Scope:
  - 98 маркетов status='live' но lastSyncedAt > 7 дней
  - Polymarket возвращает closed=false → реально живые, но выпали из feed
  - Логика: если lastSyncedAt > 30 дней и Polymarket НЕ резолвен → status='delisted'
  - НЕ автоматически — manual review через admin panel
- Файлы:
  - src/app/api/admin/cleanup-stale-markets/route.ts: добавить delist branch
  - src/app/admin/page.tsx: вкладка "Delisted markets" (optional)
- Оценка: 2ч

### P0.3 Недостающие challenge rules

#### P0.3.a Consistency Rule ✓ CLOSED (Session 14, 2026-05-14, commit ba46520)
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

#### P0.3.b Min Resolved Positions 35 ✓ CLOSED (Session 11, 2026-05-12)
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

#### P0.3.c Unique Events 30 ✓ CLOSED (Session 12, 2026-05-12, commit ab092ac)
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

#### P0.3.d Inactivity Timer 72ч ✓ CLOSED (Session 11, 2026-05-12)
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

### P0.3.G1 Schema reconciliation + migrations baseline ⚠ PARTIALLY CLOSED (Phase 0.5, 2026-05-15)
- Parent: G1 tech debt — schema drift через `prisma db push` history
- Scope Phase 0.5: schema.prisma приведена в соответствие с dev DB, baseline migration создана, migrations tracking перестроен
- Status: develop НЕ обновлён (Phase 0.5 closed, ветка готова к merge)
- Closed работы:
  - Explicit onDelete/onUpdate на всех 30 FK
  - @db.Timestamp на PayoutRequest.lastVerifyAttemptAt
  - Partial indexes документированы (UNMANAGED_DDL.md)
  - Старые миграции архивированы (prisma/_archived_migrations/)
  - 0_baseline_reconciled создан и помечен applied
- Открытые работы (deferred):
  - Prod БД до сих пор не сверена — будет нужно при первом prod release
  - Migration freeze policy в CI (P1 задача, не блокер)
  - Periodic schema drift check (P2)
- Связь: после merge — все будущие schema changes через `prisma migrate dev`

### P0.3.A ChallengePlan business model update ✓ CLOSED (Phase 1, 2026-05-15)
- Parent: P0.3 challenge rules — фундамент бизнес-модели в БД
- Scope:
  - A1: Hybrid storage модель подтверждена — никаких новых колонок,
    tier-params в ChallengePlan, engine rules в `src/lib/engine/constants.ts`
  - A2: UPDATE 3 строк ChallengePlan (challengePeriodDays 30→10, minTradingDays 15→10;
    DLL/MLL re-asserted явно для идемпотентности — фактически без изменений)
  - A3: minTradingDays оставлен в схеме (значение = challengePeriodDays). Удаление поля → TECH-DEBT-4
- Migration: `prisma/migrations/20260515165522_phase_1_challenge_plan_values/migration.sql`
- Status: applied on dev (postgres-dev). Prod release deferred to PROD_RELEASE_CHECKLIST.
- Файлы: только migration.sql (нет изменений в schema.prisma и коде)
- Оценка: 2ч (factual: ~1.5ч)

### P0.3.B Trade volume + security guards ✓ CLOSED (Phase 2.B, 2026-05-17)
- Parent: P0.3 challenge rules — business rules #4/#5/#6 из docs/BUSINESS_RULES.md
- Phase 2.A (Session 2026-05-16) уже закрыла B1 (min position) + B2 (max aggregate position);
  Phase 2.B закрывает B3/B4/B5.
- Status: merged to develop via PR #12 (merge commit 7a7a7dc)
- Файлы: src/lib/engine/{constants,spreads}.ts + src/app/api/trade/{buy,sell}/route.ts +
  src/app/api/user/positions/route.ts + src/app/markets/[id]/page.tsx
- TECH-DEBT spawned: 6 (admin endpoint для isBlocked), 7 (dailyBuyVolume race), 8 (Trade composite index)

#### P0.3.B3 Max daily buy volume cap (rule #4) ✓ CLOSED
- 5% of Challenge.startBalance per UTC day, buy-only, challenge mode only
- Hard reject 400 DAILY_VOLUME_EXCEEDED с структурированным response (currentDailyVolume, newCost, totalAfter, maxAllowed)
- Реализация: trade/buy после Phase 2.A aggregate check, до trade.create; pre-insert tx.trade.aggregate
- Commits: 511b9c6 (helpers), 0dc5344 (guard)

#### P0.3.B4 Market endDate guard for buy (rule #5) ✓ CLOSED
- Hard reject 400 MARKET_ENDED на buy при market.endDate < NOW AND status=live (gap window)
- Sell route НЕ модифицирован — Blocker 3 resolution (legitimate position close)
- Commit: 0dc5344

#### P0.3.B5 User.isBlocked guard for trade routes (rule #6) ✓ CLOSED
- 403 USER_BLOCKED возвращается BEFORE main transaction в обоих buy и sell
- Симметричный response shape: {error, error_code, blockReason}
- Admin UI/API для записи isBlocked НЕ включены — см. TECH-DEBT-6
- Commits: 0dc5344 (buy), ec2b5c3 (sell)

### P0.3.D API extension for dashboard widgets ✓ CLOSED (Phase 3, 2026-05-17)
- Parent: P0.3 challenge rules — supplies derived metrics для UI widgets без duplication на front-end
- Status: feature/p0-3-d-api-extension готова к merge (smoke test ✅ на image 6eca53e)
- Файлы: src/lib/user/active-challenge.ts (new) + src/app/api/user/{me,mode}/route.ts + src/lib/types.ts + src/app/dashboard/page.tsx
- TECH-DEBT spawned: 9 (per-tier position limits)
- TASK spawned: TASK-DOC-1 (BR doc), TASK-CLEANUP-1 (/mode spread), TASK-CLEANUP-2 (dashboard isPassed local)

#### P0.3.D1 buildActiveChallenge helper + contract ✓ CLOSED
- Helper `src/lib/user/active-challenge.ts` (239 строк): централизует derived вычисления из Challenge columns + computeConsistencyLive aggregate
- Exported types: ActiveChallenge (21 поле — canonical), PreloadedChallenge (17 — input contract), BuildActiveChallengeOptions
- `buildActiveChallenge(userId, opts?)` — если opts.challenge передан, helper пропускает свой findFirst, делает только consistency aggregate (+1 query path)
- Commits: bec9564, c05c4c1, 4baa873

#### P0.3.D1.5 maxDailyVolumeUsd + PreloadedChallenge optimization ✓ CLOSED
- Добавлено 21-е поле в ActiveChallenge: maxDailyVolumeUsd = startBalance × MAX_DAILY_VOLUME_PCT / 100
- Optional `opts.challenge: PreloadedChallenge` параметр — endpoints передают pre-loaded row, helper не делает второй findFirst
- Net cost для endpoint refactor: +1 query (computeConsistencyLive) вместо +2 (двойной findFirst)
- Commit: 715b77b

#### P0.3.D2 /api/user/me extension ✓ CLOSED
- activeChallenge: 17 existing → 29 полей (+12 new derived dashboard metrics)
- Extended findFirst select до superset PreloadedChallenge (status, expiresAt, dayStartBalance, dayStartDate, plan.id, plan.price)
- Response через explicit cherry-pick + overlay (никаких лишних columns не утекает)
- 12 новых полей: status, isPassed, consistency, daysRemaining, daysTraded, dailyLossLimitPercent, maxLossLimitPercent, currentDrawdownPercent, dailyDrawdownPercent, minPositionPercent, maxAggregatePositionPercent, maxDailyVolumeUsd
- types.ts: User.activeChallenge inline shape расширен 11 optional + plan.id/price expansion
- Commits: cc8a698 (endpoint + types), 6eca53e (production build cast)

#### P0.3.D3 /api/user/mode extension ✓ CLOSED
- challenge: 37 existing → 49 полей (+11 overlay; status уже в raw spread; plan через include)
- findFirst → findFirst({ include: { plan: { id, name, price } } }) — сохраняет existing 35-columns leak (back-compat) + добавляет plan relation
- Response через spread + 11-field overlay (status pas duplicated, уже spread'нут)
- dashboard/page.tsx Challenge interface: +11 optional + plan relation
- Расхождение strategy с /me (cherry-pick vs spread) — намеренное (back-compat /mode). Cleanup как TASK-CLEANUP-1.
- Commits: d7d757d (endpoint + types), 6eca53e (production build cast)

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

### P0.4.bis Pre-trade challenge failure UX ✓ CLOSED (Session 17, 2026-05-14, commit a6c1789)
- Severity: HIGH (blocker запуска — юзеры запутаются)
- Parent: P0.4 (mechanics done, UX осталось)
- Effort: 4-6h
- Status: CLOSED (без Instant Reset CTA — P1.5 не реализован)

Проблема:
При попытке buy если challenge уже выполнил fail-condition (например Daily DD превышен из-за движения цен на существующих позициях), API возвращает 400 "Challenge failed: ...". Юзер видит ошибку вместо понятного сообщения "ваш challenge закончился".

Решение:

Backend:
- Сменить 400 → 409 Conflict для случая "challenge failed during pre-trade check"
- Структурированный response body: { error_code: "CHALLENGE_FAILED_PRE_TRADE", reason: "daily_drawdown_exceeded" | "mll_breach" | "inactivity" | "time_limit", details: "...", challengeStatusAfter: "failed", violationCause: "price_movement_on_existing_positions" | ... }
- Применить во всех endpoints где идёт pre-trade check: trade/buy, trade/sell

Frontend:
- Перехват 409 + error_code=CHALLENGE_FAILED_PRE_TRADE
- Модальное окно с текстом причины и тремя CTA: Buy Instant Reset (30% off) / Buy new challenge / Continue in sandbox
- После закрытия модалки — refresh dashboard
- Убрать toast "Challenge failed" возле кнопки Buy

FAQ (Wave 4):
- Описать сценарий "позиции просели до DD лимита пока готовил сделку — challenge зафейлен"

Acceptance:
- API возвращает 409 со структурированным body когда pre-trade check ловит already-failed challenge
- Frontend показывает модалку, не toast
- Smoke test: создать ситуацию когда DD достигнут на существующих позициях, попробовать buy → видим модалку

### P0.4.next Replace min position with min daily volume rule ✓ CLOSED (Session 18, 2026-05-14, commit baf7c27)
- Parent: P0.4 (mechanics revision)
- Scope: убран per-trade min position rule, добавлен daily volume requirement через `qualifyingTradingDaysCount`
- Schema: `Challenge.qualifyingTradingDaysCount Int @default(0)` (SQL применён к postgres-dev)
- Cron `daily-pnl-aggregate`: пересчёт qualifying days per active challenge
- Pass-condition: переключена с `tradingDaysCount` на `qualifyingTradingDaysCount`
- API/UI: `todayBuyVolume`, `minDailyVolumeUsd` в /api/user/me + mode; новые widgets на dashboard; FAQ entry
- Status: CLOSED on develop, ожидает prod release (ALTER TABLE на ff-sandbox-db + cron pre-run)
- Deferred: backfill для PASSED/FAILED/EXPIRED, qualifyingTradingDaysCount в /api/user/challenges history view

### P0.5 On-chain txHash verification (SEC-5) ✓ CLOSED (Session 15, 2026-05-14, commit 9ff36d8, PR #8)
- Scope: verify USDC transfer перед approving payout
- Логика (через viem + Alchemy RPC):
  - tx exists на Base
  - to address = expected (из PayoutRequest.address)
  - amount = approved amount (с tolerance ±1 cent)
  - asset = USDC contract
  - confirmations >= 5
- Retry cron:
  - Новый cron /api/cron/verify-pending-payouts каждые 10 минут
  - Max 24 попытки (4 часа), после — flag для manual review
- Файлы изменены:
  - src/lib/onchain-verify.ts (новый)
  - src/app/api/admin/payouts/[id]/route.ts (изменён — перехват paid transition)
  - src/app/api/cron/verify-pending-payouts/route.ts (новый)
  - prisma/schema.prisma (добавлены verificationAttempts, manualReview, lastVerifyAttemptAt, @unique на txHash)
  - src/app/admin/page.tsx (pending_verification tab + badges)
- Статус: CLOSED (issue #6, branch claude/issue-6-20260514-0902)
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

### P1.infra.1 Branch protection на main — ✅ DONE (Session 13)
- Source: Session 12 (2026-05-13)
- Scope: GitHub Settings → Branches → Add rule для `main`
- Rules:
  - Require pull request before merging
  - Require approvals: 1
  - Dismiss stale approvals on new commits
  - Disable direct push
- Файлы: настройки GitHub (не код)
- Тесты: попытка `git push origin main` → должна быть отвергнута
- Оценка: 0.5ч
- Результат: Ruleset `protect-main` Active. Bypass list: Repository admin. Direct push отвергается с GH013.

### P1.infra.2 Выключить auto-deploy main в Coolify — ✅ DONE (Session 13)
- Source: Session 12 (2026-05-13)
- Scope: для ff-prod-app в Coolify GUI отключить GitHub webhook (auto-deploy)
- Логика: после этого push в main НЕ деплоится автоматически; Алексей нажимает Deploy вручную
- Файлы: настройки Coolify (не код)
- Тесты: dummy commit в main → Coolify НЕ запускает deploy
- Оценка: 0.5ч
- Результат: галочка "Auto Deploy" снята у ff-sandbox-app. Webhook остаётся подключён.

### P1.infra.3 Bash helpers + sudoers для user claude — ✅ DONE (Session 13)
- Source: Session 12 (2026-05-13), Q4 решение Архитектора
- Scope: на VPS создать helpers и ограничения для пользователя `claude`
- Создать:
  - `/home/claude/.bashrc` с функциями `dev-logs`, `dev-exec`, `dev-psql`
  - `/etc/sudoers.d/claude-restrictions` — блокировка docker write на `ff-prod-*`
- Файлы: bash + sudoers (на VPS, не в репо)
- Тесты:
  - `dev-logs app-dev` → работает
  - `dev-exec ls /app` → работает
  - `docker exec ff-prod-app ls /app` от user claude → отказ (sudoers)
- Оценка: 2ч
- Результат: helpers `dev-exec`, `dev-logs`, `dev-psql` созданы в `/usr/local/bin/` (owner root, executable). Контейнеры резолвятся через label `coolify.resourceName`.
- Заметка: sudoers пропущен, см. SESSION_LOG Session 13. OS-level защита перенесена в новую задачу **P1.infra.7** (см. ниже).

### P1.infra.4 Создать docs/PROD_RELEASE_CHECKLIST.md — ✅ DONE (Session 13)
- Source: Session 12 (2026-05-13)
- Scope: чеклист перед deploy develop → main
- Включает:
  - Env vars sync проверка (есть ли новые env vars в develop которых нет на prod?)
  - DB migrations — какие ALTER нужно применить на prod БД?
  - Backup БД прод
  - Smoke test на dev.tradepredictions.online завершён?
  - Rollback план (как откатиться если deploy сломал прод)
- Файлы: `docs/PROD_RELEASE_CHECKLIST.md`
- Оценка: 1ч
- Результат: создан с 8 секциями (pre-merge verification, DB migrations, backup, merge to main, deploy, post-deploy verification, rollback plan, communication).

### P1.infra.5 Smoke test @claude GitHub App — ✅ DONE (Session 13)
- Source: Session 12 (2026-05-13)
- Scope: первая безопасная задача через @claude-mention в issue
- Идея: создать GitHub Issue с мелкой косметической задачей (typo fix, добавить console.log, etc.) и @claude mention
- Цель: убедиться что:
  - @claude видит issue
  - Создаёт PR в develop (не main)
  - PR содержит ожидаемые изменения
  - Алексей может смерджить PR
- Оценка: 1ч
- Результат: workflow `.github/workflows/claude.yml` создан через `/install-github-app`, auth через OAuth token Max-подписки. Issue #1 — @claude прочитал CLAUDE.md, добавил комментарий, запушил ветку `claude/issue-1-20260513-1111`. Косяк с PR в main, откатан через PR #5 revert.

### P1.infra.6 Разделить prod/dev secrets перед боевым запуском
- Source: Session 12 (2026-05-13), Q2 решение Архитектора
- Scope: разделить идентичные на сегодня secrets между prod и dev
- Список secrets для разделения:
  - `RESEND_API_KEY` (или ввести `DISABLE_EMAILS=true` на dev)
  - `ALCHEMY_API_KEY` (separate keys для quotas)
  - `JWT_SECRET` (разные на dev/prod чтобы токены не работали между средами)
  - `CRON_SECRET` (разные)
  - `ADMIN_API_KEY` (разные)
  - `UPSTASH_REDIS_*` (отдельная Redis instance для dev)
  - USDC payment receiver address (test wallet для dev)
- BLOCKER: эта задача обязательна перед Wave 6 (P0.9) — выход прода в боевой режим
- Файлы: Coolify env vars (на двух apps)
- Оценка: 4ч

### P1.infra.7 OS-level write protection on prod containers
- Source: Session 13 (2026-05-13) — sudoers пропущен из P1.infra.3
- Priority: P1
- Trigger: **when prod exits sandbox mode** (см. P0.9 / Wave 6)
- Scope: реальная защита user `claude` от случайных `docker exec/stop/rm` на `ff-sandbox-app` и `ff-sandbox-db`
- Варианты реализации (обсудить с Архитектором):
  - `sudoers` + ограничение docker socket access
  - docker authz plugin (более гибко, но сложнее в настройке)
  - отдельный user без доступа в группу docker для prod-операций
- Сейчас отсутствует: защита только на дисциплине (CLAUDE.md whitelist) и helper-скриптах
- BLOCKER: обязательно до выхода прода в боевой режим
- Файлы: на VPS, не в репо
- Оценка: 2-4ч (зависит от выбранного варианта)

### P1.infra.8 Remove Vercel GitHub App — ✅ DONE (Session 13)
- Source: Session 13 (2026-05-13) — наблюдение
- Priority: P2
- Scope: отключить Vercel GitHub App от репо `funded-forecast` (и от `funded-forecast-wrt4`, если применимо)
- Причина: Vercel деплоит превью на каждый PR. CLAUDE.md явно говорит "Vercel — забыли, не используем". Лишний шум в PR checks.
- Как: GitHub Settings → Integrations → Vercel → Configure → удалить доступ к репо (или Suspend)
- Файлы: настройки GitHub (не код)
- Оценка: 0.2ч
- Результат: Vercel GitHub App suspended через GitHub Settings → Applications → Vercel → Suspend. Конфигурация Vercel-аккаунта сохранена, при необходимости — Unsuspend в один клик.

### P1.infra.9 Unify dev cron tasks style + sync drift
- Source: Session 14 (2026-05-14)
- Priority: P2
- Scope:
  - 3 tasks на `app-dev` имеют cosmetic differences vs prod style (выявлено при разведке после переноса 8 prod cron'ов на dev):
    - `activate-payments`: `container=watch-payments` → нужно `app-dev` (на dev нет контейнера `watch-payments`; в БД значение осталось от копирования с prod, но execution прошла успешно — почему точно не разбирались)
    - `daily-pnl-aggregate`: `curl -sf ...` → нужно `curl -fsS ...` (флаг `S` нужен для show-errors при failures в execution logs)
    - `Expire Challenges`: `curl -H "Auth..."` (без флагов) → нужно `curl -fsS -H "Auth..."`
  - Функционально работает (подтверждено execution logs Session 14: все 3 cron'а вернули 200), но differences усложняют debug при будущих failures
- Файлы: Coolify GUI (не код)
- Оценка: 0.5ч


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

### P1.UX.1 Challenge naming & identifiers
- Severity: MEDIUM (UX clarity + support workflow)
- Status: OPEN

Проблема:
Сейчас юзер видит на dashboard "Evaluation Challenge ACTIVE" без идентификатора, в Past Challenges — только "Starter · May 14, 2026". У одного юзера может быть несколько challenges одновременно (passed + failed + active — пример: id=10, 11, 12 у alexadminer). Юзер не может различить свои challenges между собой. Support не может быстро найти конкретный challenge в БД когда юзер пишет жалобу.

Решение:

A. User-facing identifier (видит юзер на dashboard и в Past Challenges):
   - Формат: #N TierName · Date старта
   - Пример: #1 Starter · May 14, 2026
   - N — порядковый номер challenge ЭТОГО юзера (1, 2, 3...). Считается на лету через ROW_NUMBER() OVER (PARTITION BY userId ORDER BY startedAt).
   - Не хранится в БД отдельной колонкой.
   - Применяется и к Evaluation Challenge (активный), и к Past Challenges (история).

B. Internal global ID (видим только admin/support):
   - Формат: CH-NNNNNN (zero-padded до 6 знаков). Пример: CH-000042.
   - Базируется на существующем Challenge.id из БД, просто форматируется при выводе через helper. Никаких новых колонок.
   - Виден в admin panel рядом с user-facing именем.
   - Используется в логах AuditLog, email уведомлениях для support, error reports.
   - Юзер этот ID НЕ видит на dashboard. Видит только когда обращается в support — support по нему ищет.

Файлы (предположительно — Claude Code адаптирует к реальной структуре):
- src/lib/challenge-display.ts (NEW) — два helper'а: formatUserFacingName(challenge, userChallenges[]), formatGlobalId(challenge.id)
- src/app/dashboard/page.tsx (или компонент Evaluation Challenge card) — использует formatUserFacingName
- Компонент Past Challenges — использует formatUserFacingName
- src/app/admin/page.tsx — использует formatGlobalId + formatUserFacingName рядом
- src/app/api/user/challenges/route.ts — возможно нужно вернуть userIndex (порядковый номер) в API response

Acceptance:
- Юзер с 3 challenges видит на dashboard и в Past Challenges три РАЗНЫХ имени: #1 Starter · ..., #2 Starter · ..., #3 Starter · ...
- В admin panel рядом с каждым challenge виден CH-000010, CH-000011, CH-000012
- Не сломаны существующие фичи (история, фильтры по статусу, нав)

Это P1 — НЕ блокер запуска, но важно для UX и support workflow в первые недели после запуска.

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


### TECH-DEBT-1 Rotate POSTGRES_PASSWORD for postgres-dev 🔴 P0 (created Phase 0.5)
- Reason: пароль трижды попал в transcript Phase 0.5 (включая Claude Code, чат с Архитектором, отчёт в основной чат)
- Action: через Coolify UI → postgres-dev → Environment Variables → rotate POSTGRES_PASSWORD
- Update connected services: ff-sandbox-app DATABASE_URL должен подтянуться автоматически (verify)
- Verify: dev app перезапускается, login + smoke test работают
- Estimated: 15 минут
- Когда делать: ДО любого нового удалённого подключения к postgres-dev по этому паролю
- Priority raised 2026-05-15 (Phase 1): пароль повторно засветился в transcript основной сессии. Обязательная ротация ДО prod release.

### TECH-DEBT-2 Cleanup ~/prisma.config.ts ⚪ P2 (created Phase 0.5)
- Reason: устаревший файл в home directory ломает `npx prisma ...` если запускать вне `~/funded-app`
- Action: либо удалить, либо обновить под текущую версию Prisma
- Estimated: 5 минут
- Не блокер

### TECH-DEBT-3 Rename BalanceLog type 'challenge_start' → 'sandbox_welcome' ⚪ P2 (created Phase 0.9)
- Reason: src/app/api/register/route.ts:94 creates sandbox welcome balance
  with type='challenge_start' — misleading for admin/audit queries
  (no Challenge exists at that point, challengeId=NULL)
- Action: rename in register/route.ts + migration UPDATE for existing records
- Scope: one line of code + one UPDATE
- Estimated: 30 минут
- Не блокер. Делаем после Phase 1.

### TECH-DEBT-4 Remove redundant minTradingDays field from ChallengePlan ⚪ P2 (created Phase 1)
- Reason: после Phase 1 minTradingDays = challengePeriodDays всегда.
  Поле дублирует значение, является tech debt.
- Action: миграция ALTER TABLE DROP COLUMN, удаление всех references в коде
- Scope: schema.prisma + ~5-10 файлов в src/ + миграция
- Estimated: 1-2 часа
- Не блокер. Делаем после Phase 4 (когда все cron'ы по новой модели готовы).

### TECH-DEBT-5 Remove redundant maxPositionSizePct from ChallengePlan and Challenge ⚪ P2 (created Phase 2.A)
- Reason: после Phase 2.A значение 5% хранится в engine constant
  MAX_AGGREGATE_POSITION_PCT. Поля Challenge.maxPositionSizePct и
  ChallengePlan.maxPositionSizePct больше не используются в runtime
  trade-time path. Snapshot logic в payment/activation.ts и
  admin/users/[id]/action/route.ts продолжает копировать значение из
  plan в challenge, но trade/buy его не читает.
- Action: миграция ALTER TABLE DROP COLUMN на обеих таблицах, удаление
  поля из schema.prisma, удаление references в коде (snapshot logic в
  покупке challenge + admin actions + admin UI inputs)
- Scope: schema.prisma + ~5-7 файлов в src/ (admin/page.tsx,
  admin/plans/route.ts, admin/plans/[id]/route.ts,
  admin/users/[id]/action/route.ts, payment/activation.ts) + миграция
- Estimated: 1-2 часа
- Не блокер. Делаем после Phase 4 (когда все cron'ы по новой модели готовы),
  одновременно с TECH-DEBT-4 (minTradingDays).
- Created: Phase 2.A discovery (commit 223c871 ошибочно ссылается на
  TECH-DEBT-6 — anticipatory off-by-one)

### TECH-DEBT-6 Admin endpoint for User.isBlocked write ⚪ P2 (created Phase 2.B)
- Source: Phase 2.B (rule #6 implementation)
- Currently isBlocked can only be set via direct SQL UPDATE — no API surface, no admin UI.
  Smoke test для P0.3.B5 выполнялся через `dev-psql -c "UPDATE \"User\" SET \"isBlocked\"=true WHERE id=1;"`.
- Action: добавить POST /api/admin/users/[id]/block (set true/false + optional blockReason) +
  admin UI page (либо action в существующем /admin/users если он есть)
- Scope: 1 новый endpoint + 1 admin UI block + audit log entry
- Estimated: 1-2 часа
- Не блокер: trade-time guard работает, нужен только write-side surface.
- Priority: P2 (когда понадобится оперативно блокировать юзеров без SQL access).

### TECH-DEBT-7 Concurrent dailyBuyVolume race condition ⚪ P3 (created Phase 2.B)
- Source: Phase 2.B (rule #4 implementation)
- tx.trade.aggregate — это SELECT, не SELECT FOR UPDATE. Два параллельных buy
  внутри одного transaction snapshot могут оба пройти aggregate check,
  превысив cap на commit.
- Probability на single-user UI: очень низкая (нет concurrent clicks).
  API-based abuse: возможна (skript автоматизация).
- Action: одно из:
  (a) SELECT FOR UPDATE на Challenge row внутри tx
  (b) SERIALIZABLE isolation level для buy транзакций
  (c) application-level mutex (Redis advisory lock per challengeId)
- Estimated: 2-4 часа (зависит от выбранного подхода)
- Не блокер: per Architect decision приемлемо на MVP.
- Priority: P3 (revisit когда появится evidence реальных race conditions
  в production logs или при подготовке к публичному API).

### TECH-DEBT-8 Missing composite index Trade(challengeId, action, createdAt) ⚪ P3 (created Phase 2.B)
- Source: Phase 2.B (rule #4 implementation, Discovery C0.b)
- Daily-volume aggregate query: WHERE challengeId=$1 AND action='buy' AND createdAt>=$2
- No covering index exists. Closest match — Trade_challengeId_idx (только challengeId) →
  Postgres делает in-memory filter для action+createdAt после index scan.
- Та же query shape используется в /api/user/me и /api/user/mode — индекс
  улучшил бы и эти endpoints тоже.
- Action: добавить `@@index([challengeId, action, createdAt])` в schema.prisma на model Trade,
  создать миграцию через `prisma migrate dev --create-only`, ревью, `prisma migrate deploy` на dev,
  затем prod через PROD_RELEASE_CHECKLIST.
- Scope: schema.prisma (1 строка) + migration file (CREATE INDEX)
- Estimated: 30 минут
- Не блокер: linear в worst case, но per-challenge buy-counts <1k currently.
- Priority: P3 (revisit когда challenges начнут расти или появятся slow-query alerts).

### TECH-DEBT-9 Per-tier position limits (Starter/Pro/Elite differentiated) ⚪ P3 (created Phase 3)
- Source: Phase 3 (Discovery Step 1 micro-discovery — `maxPositionSizePct=5` для всех 3 plan'ов в БД)
- Currently engine constants `MIN_POSITION_PCT=2` и `MAX_AGGREGATE_POSITION_PCT=5` глобальны.
  Helper buildActiveChallenge берёт их из constants. ChallengePlan имеет только legacy
  `maxPositionSizePct` (=5 для всех, dead column — см. TECH-DEBT-5).
- BUSINESS_RULES.md предположительно специфицирует per-tier values
  (Starter min 2% / max 5%, Pro min 1.5% / max 4%, Elite min 1% / max 3% — verify against BR).
- Action plan:
  (a) Verify BUSINESS_RULES спецификацию vs engine constants — какая правда?
  (b) Добавить `minPositionPercent`, `maxAggregatePositionPercent` columns в ChallengePlan (migration)
  (c) Backfill existing rows tier-appropriate значениями
  (d) Update trade/buy/route.ts: читать из plan вместо engine constants
  (e) Update buildActiveChallenge: source `minPositionPercent` / `maxAggregatePositionPercent` из plan, не из constants
  (f) Keep engine constants как fallback для legacy challenges без plan
- Scope: schema.prisma + migration + trade/buy + helper + tests
- Estimated: 3-4 часа
- Не блокер: текущий unified-5%-rate работает для всех планов одинаково (нет per-tier разницы в DB).
- Priority: P3 (revisit когда BR разногласие решено и есть commercial reason для differentiation).
- Related: TECH-DEBT-5 (maxPositionSizePct cleanup) — лучше делать ОДНОВРЕМЕННО.

### TASK-DOC-1 Update BUSINESS_RULES.md rule #6 (MLL formula peak-based) ⚪ P3 (created Phase 3)
- Source: Phase 3 (Step 1 helper review — formula mismatch BR vs engine inline)
- Текущая запись в BR rule #6 (по памяти из chat): drawdown = `(initialBalance - currentBalance) / initialBalance × 100`
- Engine реально считает: `(peakBalance - realizedBalance) / startBalance × 100` (peak-based)
  See trade/buy/route.ts:400-402, trade/sell/route.ts:266-268, marketResolve.ts:136-138
- Helper buildActiveChallenge.ts:177-184 использует ту же peak-based formula
- Action: открыть docs/BUSINESS_RULES.md, найти rule #6, заменить формулу на peak-based,
  добавить comment "(matches engine MLL inline logic in trade/buy/route.ts:400)"
- Scope: docs/BUSINESS_RULES.md (1 параграф)
- Estimated: 15 минут
- Не блокер: docs accuracy issue, не runtime bug. Engine behaviour не меняется.
- Priority: P3.

### TASK-CLEANUP-1 Replace /api/user/mode `{...activeChallenge}` spread with explicit cherry-pick ⚪ P3 (created Phase 3)
- Source: Phase 3 (Step 3 — спред 35 columns Challenge утекает в response)
- Currently /api/user/mode response.challenge включает все 35 columns Challenge model
  (peakEquity, drawdownViolated, planId, refundableFeeCents, etc.), большинство из которых
  фронт не типизирует и не использует.
- Сравни с /api/user/me Step 2 (explicit cherry-pick — clean).
- Action:
  (a) Audit dashboard/page.tsx Challenge interface (15 documented полей) + найти untyped reads
  (b) Build explicit list полей которые фронт consumes
  (c) Replace spread в mode/route.ts:120-141 на explicit cherry-pick по образцу me/route.ts:139-163
  (d) Smoke test что фронт не упал (особенно поля типа drawdownViolated которые есть в interface но не должны быть)
- Scope: src/app/api/user/mode/route.ts (~30 строк)
- Estimated: 1 час
- Не блокер: data leak не security issue (всё это уже на response, фронт может читать; просто less clean API).
- Priority: P3.

### TASK-CLEANUP-2 Remove dashboard/page.tsx:425 local `isPassed` compute ⚪ P3 (created Phase 3)
- Source: Phase 3 (Step 2 — endpoint теперь exposes isPassed в response)
- Currently dashboard/page.tsx:425: `const isPassed = last.status === "passed";` — local compute
  для past challenges display logic
- После Phase 3 `/api/user/me.activeChallenge.isPassed` (для active) и эквивалентно для past
  challenges нужно решить — добавить isPassed в LastChallenge тип или extend /api/user/challenges
- Action:
  (a) Add `isPassed` к LastChallenge interface (dashboard/page.tsx:26-32)
  (b) /api/user/mode returns lastChallenge только с {id, status, violationReason, profitTargetMet, endedAt} —
      нужно либо добавить isPassed в select, либо вычислять на фронте из status (что уже делается).
  (c) Если предпочитаем централизованный compute — extend /api/user/mode lastChallenge select +
      add `isPassed: lastChallenge.status === "passed"` в response composition.
  (d) Remove local compute в dashboard/page.tsx:425.
- Scope: 2 файла, ~5 строк изменений
- Estimated: 30 минут
- Не блокер: cosmetic. Local compute работает корректно.
- Priority: P3.