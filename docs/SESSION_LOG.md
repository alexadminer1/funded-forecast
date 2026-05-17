# FundedForecast — Session Log

Точка входа для любого нового контекста. Читается за 5 минут.

**Как использовать:**
- Новый чат с Claude → прочти этот файл + `docs/BACKLOG.md`
- Детали архитектуры → `docs/BACKLOG.md` раздел "Архитектурные константы"
- Детали задачи → ищи по commit hash в `git show <hash>`

---

## Session 2026-05-17 — Phase 2.B — Trade volume + security guards CLOSED

### Закрыто
- P0.3.B3 Max daily buy volume = 5% of startBalance — hard reject 400 (challenge mode only, buy only)
- P0.3.B4 Market endDate guard for buy — hard reject 400; sell intentionally NOT blocked (legitimate position close)
- P0.3.B5 User.isBlocked guard for buy AND sell — hard reject 403 (BEFORE main transaction, no state mutations on reject)

### Контекст
Закрытие core trade-flow guards. После Phase 2.A (rules #2, #3 — min/max position) добавлены rules #4, #5, #6. Pure logic + helpers + 3 file-local error classes per route + minimal /api/user/positions extension + 1 UI info-row. No schema changes.

### Реализация
- Branch: feature/p0-3-b-trade-volume-security-guards (4 commits + merge)
- engine/constants.ts: добавлена MAX_DAILY_VOLUME_PCT = 5
- engine/spreads.ts: добавлены getMaxDailyVolumeUsd + checkMaxDailyVolume (паттерн Phase 2.A)
- trade/buy/route.ts: 3 новых error class (UserBlockedError, MarketEndedError, DailyVolumeExceededError); isBlocked guard OUTSIDE main transaction в dedicated try/catch (main try wraps only $transaction); endDate guard inside tx, immediately after market.status; dailyVolume guard inside tx, inside if(activeChallenge), after aggregate position check
- trade/sell/route.ts: UserBlockedError class (file-local duplicate, by design); isBlocked guard same pattern as buy; sell does NOT receive endDate or dailyVolume guards (Blocker 3 resolution — legitimate position close)
- /api/user/positions: extended response — activeChallenge now includes todayBuyVolume, minDailyVolumeUsd, maxDailyVolumeUsd (mirrors /api/user/me raw SQL pattern)
- markets/[id]/page.tsx: новый info-row "Daily volume $X / $Y" в TradeModal preview (action=buy + activeChallenge, паттерн Phase 2.A row)

### Commits в develop
- 511b9c6 [P0.3.B] add MAX_DAILY_VOLUME_PCT constant + helpers in spreads.ts
- 0dc5344 [P0.3.B] trade/buy: add user-blocked, market-ended, daily-volume guards + extend /api/user/positions
- ec2b5c3 [P0.3.B] trade/sell: add user-blocked guard
- 830a88d [P0.3.B] TradeModal: daily volume preview row in challenge mode
- 7a7a7dc merge PR #12 feature/p0-3-b-trade-volume-security-guards → develop

### Smoke test (alexadminer на https://dev.tradepredictions.online, Coolify temp-switched to feature branch; Challenge #23 reactivated via SQL UPDATE + BalanceLog manual_reset $1000)

| # | Сценарий | Результат |
|---|----------|-----------|
| A | Buy on blocked user → 403 USER_BLOCKED | ✅ {error:"Account is blocked", blockReason:null} |
| B | Sell on blocked user → 403 USER_BLOCKED (symmetric shape) | ✅ identical to A |
| C | Buy on expired market (endDate<NOW, status=live) → 400 MARKET_ENDED | ✅ {endDate:"2026-05-17T00:00:00.000Z"} |
| D | Sell on expired market with open position → 200 success | ✅ Blocker 3 validated; tradeId 82, realizedPnl -0.82 |
| E | Single buy exceeding daily cap → 400 DAILY_VOLUME_EXCEEDED | ✅ currentDailyVolume:20.6, totalAfter:56.27, maxAllowed:50 |
| F | Split daily volume (3 cumulative buys past cap) → 400 with correct aggregate | ✅ currentDailyVolume:40.91 matched SQL SUM exactly |
| G | Regression — MIN_POSITION still works (Phase 2.A) | ✅ cost:9.99, minRequired:20 |
| H | Regression — AGGREGATE_POSITION fires before DAILY_VOLUME | ✅ existingCost:20.31, totalAfter:56.94, maxAllowed:50 |
| I | Sandbox mode without active challenge — new rules NOT applied | ✅ buy cost $0.17 succeeded (MIN_POSITION challenge-only) |

### Process notes
- Discovery phase (Task A) uncovered three blocking questions for Architect, all resolved before Step B: (1) Trade.cost = Float not Decimal → no Prisma.Decimal handling; (2) timezone for daily-volume aggregate aligned with /api/user/me UTC-day bucket; (3) UserPositionsResp inline type extended (Option 1 — extend /api/user/positions response). Architect approved Variant A for /api/user/me + /api/user/mode (NOT extended in Phase 2.B — deferred to Phase 3 along with 8 other dashboard fields).
- Architectural decision (Blocker 3): sell route does NOT receive endDate guard. Rationale: legitimate position close on a market where endDate passed but cron has not yet flipped status to resolved. POSITION_NOT_FOUND fallback handles the "no position to sell" case downstream. See PR #12 description for decision-log anchor.
- isBlocked guard sits OUTSIDE main transaction in a dedicated try/catch wrapper, because main try in both buy and sell only wraps prisma.$transaction (not the entire handler). Refactoring to single top-level try/catch — TECH-DEBT, not in scope.
- Note: maxDailyVolumeUsd намеренно НЕ добавлен в /api/user/me и /api/user/mode в Phase 2.B. Это будет сделано в Phase 3 (API extension) вместе с другими 8 полями для dashboard widgets — единым согласованным пакетом. Решение зафиксировано как deferred.
- Process note: GitHub auto-linked `#4`/`#5`/`#6` в PR description body to unrelated issue numbers in the repo. In future PR bodies, escape with `\#N` when referencing BUSINESS_RULES.md rule numbers. Cosmetic — does not affect repository state.
- Test setup: Challenge #23 reactivated via SQL UPDATE (status='active' + nullify endedAt/violationReason/lastTradingDay/dayStartBalance) + manual_reset BalanceLog row ($990.06 amount, runningBalance 1000) because runningBalance was at $9.94 from Phase 2.A market_resolve. Without the manual_reset row, buy guard would have rejected with INSUFFICIENT_BALANCE.
- Coolify source branch temporarily switched to feature/p0-3-b-trade-volume-security-guards for smoke test, restored to develop after merge (image tag 7a7a7dc → e9a8428 → 7a7a7dc auto after merge). Verified deployments via Coolify UI.
- API tested via direct curl (not UI), because /api/user/me 403 cascade with isBlocked=true breaks dashboard rendering. Pre-existing legacy behavior, not Phase 2.B regression.

---

## Session 2026-05-16 — Phase 2.A — Trade position guards CLOSED

### Закрыто
- P0.3.B1 Max aggregate position 5% per (marketId, side) — hard reject 400
- P0.3.B2 Min position 2% — hard reject 400 (re-introduced after P0.4.next removal)
- UI info-row in TradeModal preview (Min/Max position display, challenge mode only)

### Контекст
Первая фаза с реальными изменениями в коде приложения после Phase 0.5
reconciliation + Phase 1 data update. Pure logic + helpers + UI display.
No schema changes.

### Реализация
- Branch: feature/p0-3-b-trade-position-guards (3 commits + merge)
- engine/constants.ts: добавлена MAX_AGGREGATE_POSITION_PCT = 5;
  MIN_POSITION_PCT docstring обновлён (no longer "legacy", active rule)
- engine/spreads.ts: добавлены getMaxAggregatePositionUsd + checkAggregatePosition
  helpers по паттерну существующих getMinPositionUsd/checkMinPosition
- trade/buy/route.ts: 2 новых error class (MinPositionError, AggregatePositionExceededError);
  existingPosition findFirst перемещён вверх (single fetch для aggregate check + upsert);
  старый per-trade `maxPositionSizePct` check заменён на pair (MIN → AGGREGATE);
  sandbox branch не изменён (legacy per-trade vs currentBalance);
  catch блок: 2 новых handler (400 status, no Challenge state changes)
- markets/[id]/page.tsx: TradeModal preview — info-row "Min position: $X /
  Max aggregate: $Y" (только action=buy + activeChallenge)

### Commits в develop
- a0d7a01 [P0.3.B] add MAX_AGGREGATE_POSITION_PCT constant + helpers in spreads.ts
- 223c871 [P0.3.B] trade/buy: add min position 2% + aggregate position 5% rejects (rules #2, #3)
- a79542c [P0.3.B] TradeModal: preview info-row for min/max position in challenge mode
- 8faf040 merge PR #11 feature/p0-3-b-trade-position-guards → develop

### Smoke test (alexadminer на https://dev.tradepredictions.online, Coolify temp-switched to feature branch)
Setup: SQL hack — INSERT Challenge #23 (Starter $1000, status=active) +
BalanceLog `challenge_start` $1000 (alexadminer не имеет реального
payment-activated challenge на dev). После тестов Challenge #23 переведён
в status=failed для проверки sandbox mode.

| # | Сценарий | Результат |
|---|----------|-----------|
| 1 | Min position reject (10 shares × $0.275 = $2.75 < $20) | ✅ 400 "Minimum position is $20.00" |
| 2 | Legitimate buy (28 NO × $0.7540 = $21.11) | ✅ Position created, balance $978.89 |
| 3 | Aggregate cap single trade (74 NO × $0.7540 = $55.80 > $50) | ✅ 400 "Position cap exceeded" |
| 4 | Aggregate pass at boundary | ⏭️ Skipped (покрыт логикой #5) |
| 5 | Aggregate cap split ($21.11 existing + $29.41 new = $50.52 > $50) | ✅ 400, existing учтён правильно |
| 6 | Sandbox без active challenge (1 YES × $0.0550 = $0.06) | ✅ Прошло, Min/Max info-row не отображается, правила #2/#3 не применены |
| Reg | Buy cap $0.85 (NO @ $0.90) | ✅ 400 BuyCapExceeded (incidentally tested) |

### Side effect / implicit bugfix
До Phase 2.A admin-созданные challenges имели maxPositionSizePct=2,
plan-созданные = 5. Phase 2.A унифицирует это через engine constant
MAX_AGGREGATE_POSITION_PCT=5 для всех Challenges независимо от пути
создания. Поле Challenge.maxPositionSizePct (snapshot) и
ChallengePlan.maxPositionSizePct остаются в schema как dead columns —
runtime их больше не читает в trade-time path. Удаление — TECH-DEBT-5
(после Phase 4).

### Process notes
- Phase 1 (feature/p0-3-a-challenge-plan-update) не была смерджена в develop
  до старта Phase 2.A — обнаружено в Task A discovery. Phase 1 смерджена
  непосредственно перед началом Task B (rebase Phase 2.A onto fresh develop).
  Memory для основного чата: после "Phase N closed" подтверждать merge done
  перед выдачей следующего brief.
- Test setup через SQL hack (INSERT Challenge напрямую), не через payment
  activation flow. Это может потребовать отдельной валидации payment flow в
  Phase 2.B или позже.
- Coolify source branch временно переключался на feature-ветку для smoke
  test, после merge возвращён на develop. Передеплой подтверждён
  (image tag 8faf040, container 060107228046).
- Commit 223c871 message упоминает "TECH-DEBT-6" — anticipatory off-by-one;
  фактический номер TECH-DEBT-5 (см. ниже).

### Production release (отложено для develop→main)
- Никаких schema changes — миграций не требуется
- Изменения чисто логические + UI display
- Smoke test на prod после deploy: повторить сценарии #1, #3 (или их аналоги)

### Что НЕ сделано (вне scope Phase 2.A)
- TECH-DEBT-5 (maxPositionSizePct removal) — отложено в BACKLOG
- Phase 2.B (max daily volume + User.isBlocked + Market.endDate checks) — следующая фаза
- Client-side submitDisabled для MIN/AGGREGATE (preview info-only сейчас) — Phase 5

### Следующая фаза
Phase 2.B — trade guards: volume + security
- B3: Max daily volume 5% — block trade
- B4: User.isBlocked check
- B5: Market.endDate check
PHASE_2_B_BRIEF.md будет выдан после ACK закрытия Phase 2.A.

---

## Session 2026-05-15 — Phase 1 — ChallengePlan business model update CLOSED

### Закрыто
- P0.3.A1 Hybrid storage model подтверждена (никаких новых колонок в ChallengePlan)
- P0.3.A2 UPDATE значений ChallengePlan через Prisma migration
- P0.3.A3 minTradingDays оставлен в схеме, значение = challengePeriodDays = 10

### Контекст
Первая фаза с реальным изменением данных через `prisma migrate deploy`
после Phase 0.5 schema reconciliation. Миграция создана вручную
(mkdir + migration.sql), т.к. это pure DML — не schema diff.

### Реализация
- Создана миграция `20260515165522_phase_1_challenge_plan_values`
- Pure DML в транзакции BEGIN/COMMIT, 3 UPDATE по accountSize
- Идемпотентна: DLL/MLL re-asserted явно, фактически совпадают со старыми значениями
- Реальные изменения: только `challengePeriodDays` 30→10 и `minTradingDays` 15→10

### Snapshot ChallengePlan

До (из Task A):
```
 id |  name   | accountSize | priceCents | profitTargetPct | dailyLossPct | maxLossPct | challengePeriodDays | minTradingDays
----+---------+-------------+------------+-----------------+--------------+------------+---------------------+----------------
  1 | Starter |        1000 |        100 |              15 |            5 |         10 |                  30 |             15
  2 | Pro     |        5000 |        195 |              15 |            4 |          8 |                  30 |             15
  3 | Elite   |       15000 |        300 |              15 |            3 |          6 |                  30 |             15
```

После (из Task C4):
```
 id |  name   | accountSize | priceCents | profitTargetPct | dailyLossPct | maxLossPct | challengePeriodDays | minTradingDays
----+---------+-------------+------------+-----------------+--------------+------------+---------------------+----------------
  1 | Starter |        1000 |        100 |              15 |            5 |         10 |                  10 |             10
  2 | Pro     |        5000 |        195 |              15 |            4 |          8 |                  10 |             10
  3 | Elite   |       15000 |        300 |              15 |            3 |          6 |                  10 |             10
```

### Backup pre-migration
`/tmp/dev-db-pre-phase-1-20260515-1959.sql` (3 MB, на Mac)

### Smoke test (alexadminer на https://dev.tradepredictions.online)
✅ login, ✅ /account/plans (3 тарифа, цены $1/$1.95/$3), ✅ карточки планов,
✅ /dashboard, ✅ "Get Plan" → checkout

### Discovered (added to BACKLOG)
- TECH-DEBT-4: remove redundant minTradingDays field (deferred to after Phase 4)
- TECH-DEBT-1 priority RAISED: POSTGRES_PASSWORD засветился в чате основной сессии повторно, ротация до prod release обязательна

### Production release (отложено для develop→main)
- Та же миграция применится на ff-sandbox-db через `prisma migrate deploy`
  во время prod release (через PROD_RELEASE_CHECKLIST)
- ChallengePlan на prod сейчас содержит старые значения 30/15

### Что НЕ сделано (вне scope)
- Никаких изменений в schema.prisma
- Никаких изменений в коде приложения
- Никаких изменений в engine constants (Phase 2)
- Никаких изменений UI/FAQ (Phase 6 / E2)
- Цены priceCents не меняли (по решению — через админку)

### Следующая фаза
Phase 2 — Trade endpoint guards.
Phase 2.A: B1 (max aggregate position 5%) + B2 (min position 2% hard reject)
Phase 2.B: B3 (max daily volume 5%) + B4 (User.isBlocked check) + B5 (Market.endDate check)
PHASE_2_A_BRIEF.md будет выдан после merge Phase 1 в develop.

---

## Session 2026-05-14 — Session 18 — P0.4.next CLOSED

### Закрыто
- P0.4.next Refactor min position → daily volume rule (commit baf7c27)

### Реализация
- Убран per-trade min position rule
- Добавлено новое поле Challenge.qualifyingTradingDaysCount (SQL applied to postgres-dev)
- Cron daily-pnl-aggregate пересчитывает qualifyingTradingDaysCount per active challenge
- Pass condition (auto-pass) теперь использует qualifyingTradingDaysCount вместо tradingDaysCount
- Dashboard: 2 новых widgets "Qualifying Days" и "Daily Volume"
- API /api/user/me, /api/user/mode возвращают todayBuyVolume + minDailyVolumeUsd
- FAQ: добавлен item "How does a trading day count?"

### SQL применён к postgres-dev
```sql
ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "qualifyingTradingDaysCount" INTEGER NOT NULL DEFAULT 0;
```

### Cron pre-run
`curl /api/cron/daily-pnl-aggregate` → processed=0, skipped=5, qualifyingUpdated=[5 challenges count=0]

### Production release (отложено для develop→main)
- ALTER TABLE на ff-sandbox-db (через PROD_RELEASE_CHECKLIST)
- Cron pre-run на prod после деплоя

### Что НЕ сделано (отложено)
- Backfill для PASSED/FAILED/EXPIRED challenges (cron обрабатывает только active)
- /api/user/challenges и Past Challenge cards не получили qualifyingTradingDaysCount
- Sub-day pass-condition: сегодняшний день не зачитывается до cron-тика 01:00 UTC (by design)

### Следующая сессия
- Полный аудит бизнес-модели P0.3 — будет проводиться в отдельном чате
- Список задач P0.3.X будет сформирован после аудита

---

## Session 2026-05-15 — Phase 0.9 — Wipe dev data + Cron docs CLOSED

### Закрыто
- P0.3.A4 Wipe dev test data
  - 269 rows deleted across 12 tables (Challenge=13, Trade=55,
    Position=34, BalanceLog=99, Payment=31, PaymentTransaction=12,
    Affiliate{Ledger,Conversion,Click}=4/4/16, ChallengeDailyPnL=1)
  - 5 sandbox welcome BalanceLog created
    (alexadminer, test1, test6, test7, test8)
  - type='challenge_start', amount=$10 — exact mirror of
    src/app/api/register/route.ts:94-105
  - test2-5 not found in dev DB at wipe time (legacy ghosts from old
    brief) — acknowledged, not blocker
- P0.3.G2 docs/CRON_SCHEDULE.md created — 8 Coolify Scheduled Tasks
  documented, source SESSION_LOG 2026-05-12
- P0.3.G3 cleanup-stale-markets — reclassified as working cron
  (P0.2.e commit ff54927), NOT sirota

### Файлы
- scripts/wipe-dev-data.sql (NEW) — 14-step DELETE/INSERT
- scripts/backup-dev-db.sh (NEW) — primary (ssh+docker) + fallback (tunnel)
- docs/CRON_SCHEDULE.md (NEW)

### Коммиты в develop
- 111b827 [P0.9] add wipe-dev-data.sql + backup-dev-db.sh
- c9037ed [P0.9] add CRON_SCHEDULE.md
- d1c5300 merge PR feature/p0-9-wipe-and-cron-docs
- 2d4d13f [P0.9] fix backup-dev-db.sh path /root → /home/claude

### Backup pre-wipe
/home/claude/backups/dev-db-pre-wipe-20260515-1908.sql (3.1 MB on ff-dev)

### Smoke test (alexadminer)
✅ login, ✅ dashboard $10 balance, ✅ /account/plans (3 tiers visible),
✅ /markets loaded, ✅ /account history empty

### Discovered (added to BACKLOG)
- TECH-DEBT-3: rename BalanceLog type 'challenge_start' → 'sandbox_welcome'
  for sandbox welcome credits (register/route.ts misleading naming)

### Carry-forward to Phase 1
Clean dev DB ready for ChallengePlan UPDATE work (P0.3.A1-A3).
No code/schema changes in this phase.

## Session 2026-05-15 — Phase 0.9 — Wipe dev data + Cron docs CLOSED

### Контекст
Phase 0.9 запущена после закрытия Phase 0.5 (schema reconciliation).
Цель: очистить dev-БД от legacy test data, восстановить sandbox welcome
balance $10 для тестовых юзеров, задокументировать Coolify Scheduled Tasks.

### Закрыто
- P0.3.A4 Wipe dev test data
  - 269 rows deleted across 12 tables (Challenge=13, Trade=55, Position=34,
    BalanceLog=99, Payment=31, PaymentTransaction=12, Affiliate{Ledger,
    Conversion,Click}=4/4/16, ChallengeDailyPnL=1)
  - 5 sandbox welcome BalanceLog created (alexadminer, test1, test6, test7, test8)
  - type='challenge_start', amount=$10 — exact mirror of
    src/app/api/register/route.ts:94-105
  - test2-5 not found in dev DB at wipe time (legacy ghosts from old brief) —
    acknowledged, not blocker
- P0.3.G2 docs/CRON_SCHEDULE.md создан — 8 Coolify Scheduled Tasks
  документированы, источник SESSION_LOG 2026-05-12
- P0.3.G3 cleanup-stale-markets — переклассифицирован как working cron
  (P0.2.e commit ff54927), НЕ sirota. Шаг E1-E3 оригинального брифа отменён.

### Файлы
- scripts/wipe-dev-data.sql (NEW) — 14-step DELETE/INSERT order respecting
  Restrict/SetNull FKs
- scripts/backup-dev-db.sh (NEW) — primary (ssh ff-dev + docker exec) +
  fallback (local pg_dump via SSH tunnel)
- docs/CRON_SCHEDULE.md (NEW)

### Коммиты в develop
- 111b827 [P0.9] add wipe-dev-data.sql + backup-dev-db.sh
- c9037ed [P0.9] add CRON_SCHEDULE.md
- d1c5300 merge PR feature/p0-9-wipe-and-cron-docs
- 2d4d13f [P0.9] fix backup-dev-db.sh path /root → /home/claude (hotfix)

### Backup pre-wipe
/home/claude/backups/dev-db-pre-wipe-20260515-1908.sql (3.1 MB, на ff-dev)

### Smoke test (alexadminer)
✅ login, ✅ dashboard $10 balance, ✅ /account/plans (3 tiers visible),
✅ /markets loaded, ✅ /account history empty

### Discovered (added to BACKLOG)
- TECH-DEBT-3: rename BalanceLog type 'challenge_start' → 'sandbox_welcome'
  для sandbox welcome credits (register/route.ts misleading naming)

### Что НЕ сделано (вынесено в отдельные задачи / следующие фазы)
- inactivity-check cron остаётся в Coolify (LEGACY) — отключение в Phase 4
  одновременно с rollout end-of-day-check
- end-of-day-check и end-of-challenge-finalize cron'ы — Phase 4
- Pre-flight TECH-DEBT-1 (POSTGRES_PASSWORD rotation) — не сделан, решение
  Алексея: ротация перед prod, не сейчас

### Следующая фаза
Phase 1 — фундамент schema под бизнес-правила.
Scope: P0.3.A1 (колонки в ChallengePlan), P0.3.A2 (UPDATE 3 строк ChallengePlan
новыми значениями DLL/MLL/duration), P0.3.A3 (судьба minTradingDays).
Первая фаза с реальными изменениями схемы через `prisma migrate dev`.

## Session 2026-05-15 — Phase 0.5 — Schema reconciliation CLOSED

### Контекст
Phase 0 был запущен (wipe + docs + backup), но остановлен после обнаружения
schema drift между `prisma/schema.prisma` и реальной dev-БД (G1 долг из
PHASE_KIT.md). Введена новая Phase 0.5 для reconciliation перед любыми
schema-меняющими работами.

### Закрыто
- Phase 0.5 Schema reconciliation (branch `feature/p0-5-schema-reconciliation`)

### Реализация

**Schema diff scope:**
- 24 таблицы — совпадают
- 24 primary keys — совпадают (включая User.id integer)
- 10 enums — совпадают
- 330 колонок — 1 type-precision diff (PayoutRequest.lastVerifyAttemptAt)
- 30 FK — 0 missing/extra, но 21 onDelete-policy mismatches
- 2 partial unique indexes в БД отсутствуют в schema.prisma (Prisma DSL не
  поддерживает partial indexes)

**Изменения в `prisma/schema.prisma`:**
- Добавлены explicit `onDelete` + `onUpdate` к 21 relation
- Добавлен `@db.Timestamp` к `PayoutRequest.lastVerifyAttemptAt`
- Triple-slash комментарии над Payment, AffiliatePayout, PayoutRequest
  про partial indexes

**Migration tracking перестроен (Strategy 3):**
- Старые миграции (20260426111052_init, 20260506000000_onchain_payment_subsystem)
  перемещены в `prisma/_archived_migrations/` (вне prisma/migrations/ —
  Prisma 5.x сканирует всю папку, не игнорирует `_`-prefix)
- Создан `0_baseline_reconciled` (890 строк: 24 CREATE TABLE, 10 CREATE TYPE,
  74 indexes, 30 ALTER TABLE constraints)
- `_prisma_migrations` в БД очищена от старых записей и помечена baseline
  applied через `prisma migrate resolve --applied`

**Новые документы:**
- `docs/UNMANAGED_DDL.md` — реестр того, что Prisma не контролирует
  (3 partial indexes + 4 soft FKs)
- `docs/BUSINESS_RULES.md` — финальная бизнес-модель (12 правил, параметры тиров)
- `docs/PHASE_KIT.md` — общие правила работы Архитектора-исполнителя
- `docs/PHASE_0_BRIEF.md`, `docs/PHASE_0_5_BRIEF.md` — фазовые ТЗ

**Обновлены:**
- `CLAUDE.md` §10 — переход на Prisma migrations after Phase 0.5
- `BUSINESS_RULES.md` — Q3 resolved (hybrid storage)

### Verification
`npx prisma migrate status` → "Database schema is up to date!"
`npx prisma migrate diff` → 1 расхождение (DROP INDEX PayoutRequest_txHash_key —
known partial-index drift, задокументировано в UNMANAGED_DDL.md)

### Что НЕ сделано (вынесено в отдельные задачи)
- POSTGRES_PASSWORD ротация — пароль трижды попал в transcript Phase 0.5,
  требует ротации через Coolify UI (новая задача TECH-DEBT-1)
- Локальный `~/prisma.config.ts` устаревший, мешает работе `npx prisma`
  из home directory (новая задача TECH-DEBT-2, не блокер)
- Wipe dev test data — перенесено в Phase 0.9 (адаптировано под SET NULL
  семантику, обнаруженную в Phase 0.5)
- Coolify cron расписания → `docs/CRON_SCHEDULE.md` — перенесено в Phase 0.9

### Backups
- Full dev-DB pre-Phase-0: `/root/backups/postgres-dev-pre-p0-3-20260515-0610.sql` (2.9 MB)
- `_prisma_migrations` pre-cleanup: `/root/backups/prisma_migrations_backup_20260515-1252.sql` (1.2 KB)

### Commits (10 в feature-ветке)
a6c5ba1, b44688c, abddd05, f76e809, 65a1464, 31bc537, 9ba5197, 1e035fa, 6e5976e, 8186dde

### Следующая фаза
Phase 0.9 — wipe dev test data + Coolify cron documentation.
PHASE_0_9_BRIEF.md будет выдан после merge Phase 0.5 в develop.

---

## Session 2026-05-14 — Session 18 — P0.4.next min-position → daily-volume rule

### Реализовано (код в develop, commit baf7c27)
- **Backend per-trade rule убран**: `buy/route` больше не бросает `MinPositionError`. Остался только defensive `cost > 0` guard.
- **Schema**: добавлена колонка `Challenge.qualifyingTradingDaysCount Int @default(0)`. SQL миграция НЕ применена автоматически — Architect применяет вручную.
- **Cron `daily-pnl-aggregate`**: после обычного агрегата дневной P&L пересчитывает `qualifyingTradingDaysCount` каждого active challenge как `COUNT(d)` по дням `DATE(Trade.createdAt) < today` где `SUM(Trade.cost WHERE action='buy') >= 2% * startBalance`. Полный пересчёт = идемпотентно, без отдельной таблицы дней.
- **Pass-condition**: переключена с `tradingDaysCount` на `qualifyingTradingDaysCount` в трёх местах: `lib/challengeStatus.ts::checkAndMarkPassed`, `api/trade/sell/route.ts::otherConditionsMet`, `api/admin/expire-challenges/route.ts::tradingDaysOk`. Legacy `tradingDaysCount` инкрементируется по-прежнему на каждый новый UTC день — для UI.
- **API**: `/api/user/me` и `/api/user/mode` теперь возвращают `activeChallenge.todayBuyVolume` (live `SUM(Trade.cost where action='buy' and DATE=today)`) и `activeChallenge.minDailyVolumeUsd` (= `startBalance * 2%`).
- **Dashboard widget**: новые ячейки "Qualifying Days" и "Daily Volume" рядом с легаси "Trading Days" в active-challenge card.
- **FAQ**: добавлен пункт "How does a trading day count?" в `Challenge Rules`.
- **Constants**: добавлен `MIN_DAILY_VOLUME_PCT = 2`; `MIN_POSITION_PCT` оставлен как legacy alias.

### SQL для Architect (применить вручную на dev → потом на prod)
```sql
ALTER TABLE "Challenge"
  ADD COLUMN IF NOT EXISTS "qualifyingTradingDaysCount"
  INTEGER NOT NULL DEFAULT 0;
```
После применения — однократно дёрнуть `/api/cron/daily-pnl-aggregate` (с `Authorization: Bearer $CRON_SECRET`) чтобы пересчитать счётчик для уже-активных challenge'ей.

### Что НЕ сделано / open вопросы
- Per-challenge `qualifyingTradingDaysCount` для PASSED/FAILED/EXPIRED challenges остаётся 0 после миграции — cron обрабатывает только `status='active'`. Если для отчётности нужно back-fill историю, сделать отдельной мини-задачей (одноразовый SQL: `UPDATE Challenge SET qualifyingTradingDaysCount = (SELECT COUNT(*) FROM (SELECT DATE("createdAt") d FROM Trade WHERE "challengeId" = "Challenge".id AND action='buy' GROUP BY DATE("createdAt") HAVING SUM("cost") >= "startBalance" * 0.02) q)`).
- В `/api/user/challenges` (history view) пока не добавлен `qualifyingTradingDaysCount` — past challenge cards показывают только legacy `tradingDaysCount`. Можно добавить позже, без срочности.
- Сегодняшний день в pass-condition не учитывается до следующего тика cron (01:00 UTC) — это ожидаемо по спецификации, но проявляется как до-суточная задержка auto-pass для активно торгующих пользователей.

### Smoke (manual после применения SQL)
1. test8: `dev-psql -c "UPDATE \"Challenge\" SET status='active', startBalance=1000, realizedBalance=1000, qualifyingTradingDaysCount=0 WHERE id=17;"`.
2. Поставить 3-4 буя на сегодня суммарно $25+. Открыть `dashboard` → "Daily Volume: $25.xx / $20.00", "Qualifying Days: 0 / X" (cron ещё не запускался).
3. Дёрнуть cron: `curl -H "Authorization: Bearer $CRON_SECRET" https://dev.tradepredictions.online/api/cron/daily-pnl-aggregate` (но ожидать что сегодняшний день не зачтётся — cron смотрит только на дни строго до today).
4. Имитировать «вчерашний день»: вставить Trade с `createdAt` за вчера; дёрнуть cron → `qualifyingTradingDaysCount` должен стать 1.
5. Per-trade check: попробовать buy 1 share @ $0.10 (cost $0.10). Ожидаем 200 OK (раньше было 400 Min position).

---

## Session 2026-05-14 — Session 17 — P0.4.bis Pre-trade failure UX CLOSED

### Закрыто
- **P0.4.bis** Pre-trade challenge failure UX (commit a6c1789)

### Реализация
- **Backend (trade/buy + trade/sell)**:
  - `DrawdownViolatedError` carries `category: "mll_breach" | "daily_drawdown_exceeded"`.
  - New `ChallengeExpiredError` (replaces generic `throw new Error("CHALLENGE_EXPIRED")`).
  - Pre-trade fail paths now return **HTTP 409** with structured body:
    ```
    {
      error_code: "CHALLENGE_FAILED_PRE_TRADE",
      reason: "daily_drawdown_exceeded" | "mll_breach" | "time_limit",
      details: "<human readable>",
      challengeStatusAfter: "failed",
      violationCause: "price_movement_on_existing_positions" | "challenge_period_ended"
    }
    ```
  - Expired challenge is now persisted as `status=failed, violationReason="Challenge period expired"`
    in the trade route (mirrors expire-challenges cron behaviour).
  - Trade-caused rejections (BuyCap, MinPosition, PartialSell, position size, slippage,
    insufficient balance) stay on **HTTP 400** with their original payloads.
- **Frontend**:
  - New `src/components/ChallengeFailedModal.tsx` with two CTAs:
    “Buy new challenge” → `/account/plans`, “Continue in sandbox” → `/dashboard`.
    Closes on X / Esc / click-outside. `router.refresh()` on close.
  - `TradeModal` in `src/app/markets/[id]/page.tsx` switched to raw `fetch` so `res.status`
    is observable. On 409 + `CHALLENGE_FAILED_PRE_TRADE` the inline banner is suppressed
    and the modal opens via `onChallengeFailed`.

### Smoke tests (dev.tradepredictions.online, commit a6c1789)
| # | Scenario | Setup | Expected | Result |
|---|----------|-------|----------|--------|
| 1 | Daily DD pre-trade fail | test8 ch#17: dayStart=1000, realized=950, buy 50@0.525 → newRealized 923.75 → DD 7.63% | 409 + `daily_drawdown_exceeded` | ✅ 409 returned, challenge persisted as failed |
| 2 | Trade-caused MinPosition | test8 ch#17 clean, buy 1@0.525 → $0.53 < $20 min | 400, no modal | ✅ 400 with original payload |

curl evidence:
```
HTTP/2 409
{"error_code":"CHALLENGE_FAILED_PRE_TRADE","reason":"daily_drawdown_exceeded",
 "details":"Daily drawdown 7.63% exceeded limit 5%","challengeStatusAfter":"failed",
 "violationCause":"price_movement_on_existing_positions"}
```

### Архитектурное (для Архитектора, требует ревью)
- **Inactivity reason** не триггерится из buy/sell (только cron). Если cron уже сделал
  `status=failed`, следующий buy/sell не находит активного challenge и тихо уходит в
  sandbox mode — модалка не показывается. Возможно стоит добавить отдельный pre-trade
  lookup "recently failed challenge без active replacement" → 409 inactivity/time_limit.
  Сейчас вне scope P0.4.bis.
- **Sell DD smoke** не выполнен (sell увеличивает realizedBalance → daily DD после sell
  обычно лучше; equity-aware MLL требует одновременно открытых позиций с большим MTM
  loss). Catch handler идентичен buy — confidence high, но manual sell smoke на UI
  желателен от QA.
- **Frontend модалка**: smoke выполнен только на API. UI behavior (modal open/close,
  router.push, refresh) проверяется вручную в браузере.

### БД cleanup
- test8 (Challenge#17) после smoke возвращён в clean state: `status=active, balance=1000`.

---

## Session 2026-05-14 — P0.4 Position mechanics CLOSED + P0.4.bis OPENED

### Закрыто
- P0.4 Position mechanics: buy/sell spreads, cap, min position, full sell only (commit 22bd917)

### Реализация (Variant A)
- effective price хранится в Position.avgPrice
- raw price хранится в Trade.raw_yes (snapshot для аудита)
- spread tiers: 0% / 2% / 7% на buy в зависимости от rawPrice
- sell spread 4% единый
- buy cap: rawPrice >= 0.85 → 400 BuyCapExceededError
- min position: cost < 2% startBalance в challenge mode → 400 MinPositionError
- partial sell: amount != position.shares → 400 PartialSellError

### Smoke tests (7/7 PASS)
1. Buy rawPrice 0.55, 50 shares → spread 0%, effective=0.55, cost=$27.50 ✓
2. Buy rawPrice 0.65, 50 shares → spread 2%, effective=0.663, cost=$33.15 ✓
3. Buy rawPrice 0.835, 50 shares → spread 7%, effective=0.89345, cost=$44.67 ✓
4. Buy rawPrice 0.9995 → 400 BuyCapExceeded ✓
5. Buy 1 share × 0.83 (cost $0.89) → 400 MinPosition ✓
6. Sell partial 30 of 50 → 400 PartialSell ✓
7. Sell full 50 @ 0.65 → spread 4%, proceeds=$31.20, realizedPnl=-$1.95 (точный комбинированный spread overhead) ✓

### Архитектурное решение
- Pre-trade challenge status check: если challenge fail-condition выполнено к моменту buy (например DD превышен из-за движения цен на существующих позициях), API возвращает ошибку и сделка не исполняется. Это правильное поведение (kill switch). НО UX требует доработки → создана P0.4.bis.

### БД cleanup
- Reset test8 (Challenge#17): status=active, balance=1000
- Force-closed orphan positions: #44 (test8, market 2080209), #47 (test1, market 2245165)

### Открыто (новое)
- P0.4.bis Pre-trade challenge failure UX — структурированный 409 response + frontend модалка

---

## Session 2026-05-14 — Session 15 — P0.5 On-chain txHash Verification

### Закрыто
- **P0.5** On-chain txHash verification for admin payouts (SEC-5) ✅ (PR #8 merged, commit 9ff36d8)

### Архитектурные решения
- Verification синхронно при admin вводе txHash через PUT /api/admin/payouts/[id] (transition в `paid`)
- Status `pending_verification` для ситуации `confirmations < 5` — cron retry каждые 10 минут, max 24 попытки (~4 часа)
- После 24 fails → `manualReview = true` + AuditLog `payout_verification_failed`
- 6 проверок: tx_already_used (DB), tx_not_found, wrong_token (USDC Transfer event), wrong_recipient, wrong_amount (±0.01 USDC), insufficient_confirmations
- Tolerance ±0.01 USDC (10000 в 6-decimal units)
- Только USDC, USDT не поддерживается
- Chain и USDC contract address резолвятся через `getPaymentConfig()` — никакого hardcode

### Реализация
- `src/lib/onchain-verify.ts` (NEW, +169) — verification helper на viem
- `src/app/api/cron/verify-pending-payouts/route.ts` (NEW, +196) — retry cron с Bearer CRON_SECRET auth
- `src/app/api/admin/payouts/[id]/route.ts` (+164/-34) — paid transition теперь вызывает verify
- `prisma/schema.prisma` (+4/-1) — txHash @unique, verificationAttempts, manualReview, lastVerifyAttemptAt
- `src/app/admin/page.tsx` (+33/-11) — `pending_verification` tab + badges "Verifying N/24" + "Needs manual review"

### Инфра
- SQL migration применена на postgres-dev через Coolify DB Terminal:
  ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "verificationAttempts" INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "manualReview" BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "lastVerifyAttemptAt" TIMESTAMP;
  CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "PayoutRequest_txHash_key" ON "PayoutRequest" ("txHash") WHERE "txHash" IS NOT NULL;
- Coolify Scheduled Task `verify-pending-payouts` создан на app-dev (frequency `*/10 * * * *`, container `app-dev`)
- Manual trigger вернул `{"success":true,"processed":0,...}` — endpoint работает

### Косяки сессии (для понимания контекста)
1. Coolify build падал на `exporting layers` с ошибкой DeploymentException — ушло 1+ час разбирательств. Причина: VPS Hetzner CX23 имеет 3.7GB RAM без swap, OOM kill во время Docker image export. Решение: создан /swapfile 4GB, добавлен в /etc/fstab. После этого билд проходит за ~3 минуты.
2. Claude Code запушил код в `claude/issue-6-20260514-0902`, но PR не открыл сам — Архитектор открыл вручную (PR #8). Сначала пришлось синхронизировать main → develop (PR #7) потому что Claude Code создал ветку от main, develop отставала.
3. Конфликт merge в `docs/SESSION_LOG.md` — резолвлен через GitHub web editor (обе записи Session 14 + Session 15 оставлены).

### Открытые задачи (новые)
- Нет новых

### Production release (отложено)
- SQL migration на ff-sandbox-db (применяется при develop → main релизе по PROD_RELEASE_CHECKLIST)
- Coolify cron task `verify-pending-payouts` на ff-sandbox-app (создаётся после релиза в main)

---

## Session 2026-05-14 — Session 14 — P0.3.a Consistency Rule

### Закрыто
- **P0.3.a** Consistency Rule ✅ (commit ba46520, 11 файлов, ~+517/-54)

### Архитектурные решения
- Источник `dailyPnl`: новая колонка `Trade.realizedPnl` (`Decimal? @db.Decimal(20,8)`)
- Новый `action='resolve'` для `Trade` — `marketResolve.ts` создаёт Trade row при резолве маркета
- `ChallengeDailyPnL` — pre-aggregated table для payout checks; auto-pass читает live из Trade (без зависимости от cron)
- Day-grouping: `DATE("createdAt")` без `AT TIME ZONE 'UTC'` (Postgres колонка `timestamp without time zone`, серверный TZ=UTC)
- Backfill для исторических данных НЕ делается (Q6.a) — grace period для существующих challenges
- Cron `0 1 * * *` UTC агрегирует вчерашний день за активные challenges, идемпотентен через `ON CONFLICT DO UPDATE`

### Инфра
- Coolify scheduled task `daily-pnl-aggregate` создан на `app-dev` (frequency `0 1 * * *`, container `app-dev`)
- 8 prod cron tasks перенесены с `ff-sandbox-app` на `app-dev` (был dev/prod drift — на dev был только новый daily-pnl-aggregate)
- Backup `/home/claude/ff-sandbox-db-pre-p03a-backfill-20260514-0729.sql` (2.3MB) перед backfill
- Backfill no-op подтверждён: все исторические `Trade.realizedPnl=NULL` → SQL вставил 0 строк
- Health check после деплоя: Next.js Ready ✓, `/api/health` → 200, `/api/cron/daily-pnl-aggregate` без auth → 401 ✓

### Smoke test
- `alexadminer` (challenge 10) через UI: buy 10 @ 0.0715 + sell 10 @ 0.0715 на marketId 2155000
- Trade row #63 (action='sell') — `realizedPnl=0.00000000` записан корректно (Шаг 7 интеграция + Шаг 10 post-fix работают)
- BalanceLog связан через `tradeId`: rows 126 (`trade_open`, -0.71) и 127 (`trade_close`, +0.71)
- Manual trigger `/api/cron/daily-pnl-aggregate` (от лица CRON_SECRET, внутри app-dev): `processed=0, skipped=6` (нет sell за yesterday) — endpoint работает идемпотентно
- Live-агрегация формулой даёт 1 row для challenge 10 today (dailyPnl=0, dailyTrades=1) — корректно

### Открытые задачи (новая в BACKLOG)
- **P1.infra.9** — унифицировать flag style (`-fsS`) и `container` field в 3 scheduled tasks на app-dev. Функциональность подтверждена execution logs, но в БД остались cosmetic differences: `activate-payments` container=watch-payments, `daily-pnl-aggregate` использует `-sf`, `Expire Challenges` без `-fsS`

---

## Session 2026-05-13 — Session 13 — Branch protection, bash helpers, @claude smoke test

### Закрыто
- **P1.infra.1** Branch protection main ✅
- **P1.infra.2** Auto-deploy main off ✅
- **P1.infra.3** Bash helpers ✅ (sudoers пропущен — см. ниже)
- **P1.infra.4** PROD_RELEASE_CHECKLIST.md ✅
- **P1.infra.5** Smoke test @claude ✅
- **P1.infra.8** Remove Vercel GitHub App ✅

### Что сделано

#### P1.infra.1 Branch protection main
- GitHub Ruleset `protect-main` создан, статус Active
- Target: `main`
- Bypass list: Repository admin (Always allow) — добавлен чтобы single-developer мог обходить required reviews
- Включено: Require PR before merging (1 approval, dismiss stale), Restrict deletions, Block force pushes
- Проверено: прямой push в main отвергается с `GH013`

#### P1.infra.2 Auto-deploy main off
- В Coolify для приложения `ff-sandbox-app` снята галочка "Auto Deploy"
- Webhook остаётся подключён, но автодеплой не срабатывает
- Прод теперь деплоится только вручную через Coolify Deploy button

#### P1.infra.3 Bash helpers (sudoers пропущен)
- На VPS созданы три helper-скрипта в `/usr/local/bin/` (owner root, executable):
  - `dev-exec <cmd>` — `docker exec` в `app-dev` (resolve через label `coolify.resourceName=app-dev`)
  - `dev-logs [app-dev|postgres-dev] [args]` — `docker logs`, по умолчанию `--tail 200` без `-f`
  - `dev-psql [args]` — `psql` на `postgres-dev`, БД `fundedforecast`, user `postgres`
- Решено **НЕ** создавать `/etc/sudoers.d/claude-restrictions`: user `claude` не имеет sudo вообще, защита от ошибочных write-операций на prod-контейнеры — на дисциплине (CLAUDE.md) и helper-скриптах
- При выходе production в боевой режим — задача OS-level защиты вернётся как P1 блокер (см. новая задача **P1.infra.7** в BACKLOG)
- Контейнеры идентифицируются через Coolify label `coolify.resourceName` (хешевые имена меняются при передеплое)

#### P1.infra.4 PROD_RELEASE_CHECKLIST
- Создан `docs/PROD_RELEASE_CHECKLIST.md`
- 8 секций: pre-merge verification, DB migrations, backup, merge to main, deploy, post-deploy verification, rollback plan, communication

#### P1.infra.5 Smoke test @claude
- GitHub App Claude подтверждён установленным на репо (Repository access: funded-forecast)
- Создан workflow `.github/workflows/claude.yml` через `/install-github-app` в Claude Code
- Auth: OAuth token от Max-подписки (secret `CLAUDE_CODE_OAUTH_TOKEN`)
- Включены Workflow permissions: Read and write + Allow GitHub Actions to create and approve pull requests
- **Важно:** workflow видны GitHub Actions только если они на default branch — поэтому потребовался первый prod-релиз `develop → main` (PR #3) с одним yaml-файлом и docs-каталогом
- Smoke test issue #1: @claude прочитал `CLAUDE.md`, прочитал `src/lib/engine/constants.ts`, добавил комментарий, запушил ветку `claude/issue-1-20260513-1111`
- Косяк: тестовый PR #4 был смерджен в `main` вместо `develop` (неточная инструкция в чате) — откатан через PR #5 revert на main

#### P1.infra.8 Vercel GitHub App suspended
- GitHub App Vercel suspended через GitHub Settings → Applications → Vercel → Danger zone → Suspend
- Vercel больше не деплоит превью на PR в funded-forecast
- Конфигурация в Vercel-аккаунте сохранена; при необходимости — один клик Unsuspend

### Бонусом
- Первый реальный prod-релиз через `develop → main`: PR #3 (5 commits, 503 additions, 147 deletions; только docs + workflow, без кода/БД)
- Подтверждено: branch protection реально блокирует прямой push в main (`GH013`)
- Подтверждено: bypass для Repository admin работает (merge без review через диалог "Bypass rules and merge")

### Открытые наблюдения (не блокеры Session 13)
- Default branch остаётся `main`, не меняли
- Workflow `pull_request_review` в `claude.yml` триггерится на @claude в `review.body` — для текущей one-developer репы не критично, но при будущих collaborators проверить

### Что НЕ сделано (отложено)
- Sudoers / OS-level write protection на prod-контейнеры — вынесено в новую задачу **P1.infra.7** (вернётся когда prod выйдет из sandbox)
develop

---

## Session 2026-05-13 — Session 12 — Dev Environment Setup

### Закрыто
- **Setup dev environment** — полноценное изолированное окружение для безопасной автономной работы Claude Code

### Что сделано (Алексеем + DevOps-чатом)

#### GitHub branching
- Создана ветка `develop` (синхронна с main на момент создания)
- Прод-релизы теперь идут через PR `develop → main` (ручная сверка, ручной merge)
- Все feature-ветки и Claude Code commits идут в `develop`

#### Coolify infrastructure
- Новое приложение `app-dev` (ветка develop, auto-deploy включён)
- Новая БД `postgres-dev` (PostgreSQL 17-alpine, отдельный контейнер)
- Hostname контейнеров:
  - app-dev: `wlugzzo3b2482ji68l6r3zcv-045726055218`
  - postgres-dev: `ku2yqi907qdi78bk3xb5zy3p`
- Прод-БД переименована: `nameless` → `ff-sandbox-db` (hostname без изменений: `n6a214z1jmhhlogwdf4pllxj`)
- Прод-app: `ff-prod-app` (без изменений)

#### Domains
- Production: `tradepredictions.online` (без изменений)
- Development: `dev.tradepredictions.online` (новый, HTTPS via Let's Encrypt)

#### Data
- БД `postgres-dev` содержит копию прод-данных (dump через pg_dump 2026-05-13)
- Имя БД внутри Postgres: `fundedforecast` (как на проде)
- DATABASE_URL в app-dev указывает на postgres-dev (не на ff-sandbox-db) — подтверждено логом `prisma db push`

#### SSH access
- Создан пользователь `claude` (UID 1000, группа docker)
- На ноутбуке Алексея настроен alias `ssh ff-dev`
- Auth: ed25519 key-based only
- Claude Code может: читать логи, exec в контейнеры, запускать docker команды

#### GitHub App @claude
- Установлен на репо funded-forecast
- Permissions: read+write для issues, PRs, code, workflows
- Работает по @claude-mentions в issues и PRs

### Решения Архитектора (по 6 вопросам Q1-Q6)

- **Q1 DATABASE_URL:** разделены (dev → postgres-dev, prod → ff-sandbox-db) ✓ подтверждено
- **Q2 RESEND_API_KEY:** оставить идентично проду на время sandbox-стадии; разделить перед боевым запуском (новая задача P1 в BACKLOG)
- **Q3 Auto-deploy main:** ВЫКЛЮЧИТЬ webhook для prod-app, deploy только manual через Coolify GUI
- **Q4 Защита от ошибок Claude Code:** bash-функции (`dev-logs`, `dev-exec`, `dev-psql`) + sudoers restrictions для блокировки docker write-операций на `ff-prod-*`
- **Q5 Прод-релиз процесс:** PR develop → main с branch protection в GitHub, ручной merge + ручной Deploy в Coolify
- **Q6 (от Алексея) Container access policy:** READ-ONLY операции (logs, ps, inspect) разрешены на всех контейнерах включая prod; WRITE — только dev

### Обновления документации
- CLAUDE.md — полностью переписан (новые разделы Environments, SSH access, GitHub App, container whitelist, prod-release workflow)
- SESSION_LOG.md — эта запись
- BACKLOG.md — добавлены задачи: branch protection на main, выключить auto-deploy main, bash helpers + sudoers, разделение secrets перед боевым запуском (P1)

### Технический долг к следующей сессии
1. **Branch protection** на main в GitHub (Settings → Branches → Add rule)
2. **Выключить webhook auto-deploy** для ff-prod-app в Coolify
3. **Создать bash helpers и sudoers** для пользователя claude на VPS
4. **Создать PROD_RELEASE_CHECKLIST.md**
5. **Тест @claude** на безопасной мелкой задаче в dev
6. Только после этого — продолжить P0.3.c Unique Events 30

### Важно
P0.3.c НЕ начинаем пока не закрыты пункты 1-5 техдолга — иначе теряется смысл нового dev-окружения.

---

## Session 2026-05-12 (continued) — Session 12 — P0.3.c CLOSED

### Закрыто
- **P0.3.c Unique Events 30** (commit ab092ac)
  - Schema: `Market.polymarketEventId String?` + `@@index([polymarketEventId])`; `Challenge.uniqueEventsCount Int @default(0)`
  - SQL миграция (выполнена Алексеем в Coolify DB Terminal):
    ```sql
    ALTER TABLE "Market" ADD COLUMN IF NOT EXISTS "polymarketEventId" TEXT;
    CREATE INDEX CONCURRENTLY IF NOT EXISTS "Market_polymarketEventId_idx" ON "Market" ("polymarketEventId");
    ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "uniqueEventsCount" INTEGER NOT NULL DEFAULT 0;
    ```
  - Constants: `src/lib/engine/constants.ts` — добавлен `MIN_UNIQUE_EVENTS = 30` рядом с `MIN_RESOLVED_POSITIONS = 35`
  - Helper `checkAndMarkPassed` расширен: 4-е условие `c.uniqueEventsCount < MIN_UNIQUE_EVENTS → return false`; поле добавлено в `select`
  - `sell/route.ts` inline auto-pass расширен: 4-е условие `&& activeChallenge.uniqueEventsCount >= MIN_UNIQUE_EVENTS`
  - `sync-markets/route.ts`: парсит `m.events[0]?.id ?? null` → `polymarketEventId`; `console.warn` при `events.length >= 2` с форматом `[sync-markets] market {id} has {N} events: [{ids}] — using first`
  - `trade/buy/route.ts`: внутри `if (activeChallenge && challengeId)` после trading days counter — `findMany` всех positions, `Set` с fallback `market:${id}`, `challenge.update({ uniqueEventsCount })`
  - Разведка (подшаги 2a/2a.5): топ-50 markets по volume24hr — 100% имеют ровно 1 event; поле `events[0].id` — строка типа `"435920"`

### Verify результаты
- 869/1098 live markets с `polymarketEventId IS NOT NULL` после первого sync cycle (79%)
- Пример группировки: Brazil election markets `601819` + `601824` → один `polymarketEventId = 45915` (два market contract-а → один event)
- 5 active challenges все с `uniqueEventsCount = 0` — никто не торговал после деплоя (ожидаемо)

### Замечания
- Backfill не делался — legacy positions (test6/7/8) без eventId; все три далеки от passing → не критично
- `market:${id}` префикс в fallback защищает от коллизий если числовой `eventId` совпадёт с `market.id`
- Multi-event `console.warn` начнут появляться в логах Coolify когда/если Polymarket будет возвращать рынки с `events.length >= 2`
- 21% markets без `polymarketEventId` (229 markets) — выпавшие из top-1000 по volume24hr; заполнятся со временем при следующих sync-циклах

---

## Session 2026-05-12 (continued) — Session 11 — P0.3.b CLOSED

### Закрыто
- **P0.3.b Min Resolved Positions 35** (commits c29d578, 8363624, eb3842b, 9feda94, f6e0566)
  - Schema: добавлено поле `Challenge.resolvedPositionsCount Int @default(0)`
  - SQL миграция: `ALTER TABLE "Challenge" ADD COLUMN "resolvedPositionsCount" INTEGER NOT NULL DEFAULT 0` (без backfill — тестовые данные)
  - Constants: новый файл `src/lib/engine/constants.ts` экспортирует `MIN_RESOLVED_POSITIONS = 35` (в P0.4 переедет в EngineSettings)
  - Helper: новый файл `src/lib/challengeStatus.ts` — функция `checkAndMarkPassed(tx, challengeId)` для атомарной проверки passing-условий
  - marketResolve.ts: инкремент `resolvedPositionsCount: { increment: 1 }` в challenge.update + вызов helper при `!drawdownViolated`
  - sell/route.ts: третье условие в auto-pass — `&& activeChallenge.resolvedPositionsCount >= MIN_RESOLVED_POSITIONS` (помимо profitTargetMet + minTradingDays)
  - Verify smoke: SELECT по Challenge возвращает новое поле, 5 active далеки от passing, prod стабилен

### Замечания
- Helper НЕ используется в sell-route — там сохранены побочные эффекты (autoPass flag, passMeta, auditLog `challenge_auto_passed`), которые helper не покрывает
- Helper используется ТОЛЬКО в marketResolve — там passing может произойти без вызова sell endpoint (юзер ничего не продавал, market сам резолвится)
- Race condition защита: `{ increment: 1 }` атомарный Prisma operator
- Backfill отложен — все 10 challenges с `resolvedPositionsCount=0`, реальные данные будут с момента следующего market resolve

### Инфраструктура disk cleanup (важно)
- В процессе сессии VPS забился до 100% (Docker images накопились после 4 деплоев)
- Удалено вручную 19 старых images + build cache → освобождено ~28 GB
- Активный image на момент чистки: `s141eg1kymnmhed70b9jwu7a:3725eb8d`
- TODO (отложено): автоматический cron для очистки images старше 7 дней

---

## Session 2026-05-12 — Session 11 — P0.3.d CLOSED

### Закрыто
- **P0.3.d Inactivity Timer 72ч** (commits e21ec56, a418c47, 15de268, f0c436a)
  - Schema: добавлено поле `Challenge.lastNewPositionAt DateTime?`
  - SQL миграция: `ALTER TABLE "Challenge" ADD COLUMN "lastNewPositionAt"` + bootstrap для 5 active challenges (через NOW(), мягкий рестарт таймера чтобы не сжечь существующие)
  - Activation hook: `src/lib/payment/activation.ts` — при создании Challenge устанавливает `lastNewPositionAt = now`
  - Trade hook: `src/app/api/trade/buy/route.ts` — UPDATE Challenge.lastNewPositionAt только в else-ветке (INSERT новой Position), не при увеличении shares существующей
  - Cron endpoint: `src/app/api/cron/inactivity-check/route.ts` — evaluation 72h / funded 120h, violationReason `inactivity_72h` / `inactivity_120h`
  - Coolify Scheduled Task: `inactivity-check` * `0 * * * *`
  - Verify: cron вернул `{"failedCount":0,"updatedChallengeIds":[],"errors":[]}` — корректно (все active с свежим таймером)

### Замечания
- Использован `Challenge.startedAt` как точка отсчёта (поле `activatedAt` решено не добавлять — startedAt совпадает с моментом активации payment)
- Position уже имеет `challengeId` — отдельной миграции связи не потребовалось
- Реальный тест inactivity → failed произойдёт естественно: первый юзер который не торгует 72ч после деплоя

### Инфраструктура (актуальные кроны)
- watch-payments         * * * * *
- activate-payments      * * * * *
- expire-payments        * * * * *
- expire-challenges      0 * * * *
- affiliate-hold         0 3 * * *
- sync-prices            */15 * * * *
- cleanup-stale-markets  0 * * * *
- inactivity-check       0 * * * *  ← новое (P0.3.d)

---

## Session 2026-05-12 (continued) — Session 10 — P0.2.e CLOSED

### Закрыто
- P0.2.e Stale market cleanup (auto-resolve)
  - Новый файл: src/app/api/admin/cleanup-stale-markets/route.ts
    - POST endpoint с x-admin-key auth
    - Берёт markets со status='live' и lastSyncedAt < NOW() - 24h
    - Батчинг по 10 параллельных fetch к Polymarket /markets/{id}, 200ms между батчами
    - Для closed && umaResolutionStatus="resolved" с converged prices:
      → update Market.status='resolved', winningOutcome
      → вызов resolveMarketPositions (переиспользует Wave A+C логику)
    - Tolerance 0.01 для определения winner (prices ≈ [1,0] или [0,1])
    - Disputed markets (prices не converged) → skip + лог
  - Helpers в src/lib/polymarket.ts:
    - PolymarketResolvedMarket interface
    - fetchMarketById(id) — single market lookup
    - getWinningOutcome(market) — парсинг outcomePrices JSON-string,
      возвращает "yes" | "no" | null
  - Commit: ff54927
  - Coolify deploy: ✅ Success (webhook auto-deploy сработал этот раз)

  - Manual run результат (228 stale markets):
    - resolved: 128 (на Polymarket закрыты, prices converged)
    - stillActive: 100 (Polymarket вернул closed=false — реально живые)
    - disputed: 0
    - errors: 0
    - totalPositionsProcessed: 15 user positions

  - Challenge #18 (test1, active) verify после cleanup:
    - 2 open positions резолвлены:
      - Position #27 (2133404 "Iran airspace", side=yes, winner=no): -$0.33
      - Position #28 (2037907 "Clavicular pregnancy", side=yes, winner=yes): +$0.40
    - Net change: realizedBalance 1000 → 1000.07
    - peakEquity: 1000 → 1000.40 (Wave C peak фиксировался выше cash peak)
    - drawdownViolated: false, challenge остался active ✓

  - Coolify Scheduled Task создан:
    - Name: cleanup-stale-markets
    - Frequency: 0 * * * * (каждый час)
    - Verify Execute Now: 100 checked, 0 resolved, 0 errors

### Critical findings (для будущих задач)
- Polymarket поле umaResolutionStatus (SINGULAR) — авторитативный сигнал
- Polymarket поле umaResolutionStatuses (PLURAL, массив) — НЕ использовать,
  у всех проверенных resolved маркетов = ["proposed"] (врёт)
- outcomes и outcomePrices в API — JSON-encoded STRINGS, не нативные массивы
  (нужен JSON.parse())

### Wave C дополнительная проверка (bonus)
- Challenge #18: peakEquity > peakBalance после резолва ($1000.40 vs $1000.07)
- Это подтверждает что Wave C peak трекинг работает независимо от cash peak —
  equity на момент когда обе позиции были open и market.yesPrice был favourable

### Что осталось (НЕ блокер, новая мелкая задача)
- 98 markets status='live' но lastSyncedAt > 7 дней
- Polymarket возвращает closed=false для них — реально активные, выпали из
  top-1000 по volume24hr
- Когда они закроются на Polymarket — следующий cron auto-resolve их подхватит
- Можно добавить policy "delist after 30 days stale" в будущем (P0.2.f)

### Lessons learned
- Backup через CSV \copy работает когда pg_dump недоступен
  (app-контейнер vs database-контейнер)
- TypeScript stale state в Coolify build: первая попытка показала 0 ошибок
  но в Write был артефакт display (склейка строк), реальный файл был чистый
- Polymarket API: closed=true может быть proposed (не финально resolved),
  поэтому umaResolutionStatus === "resolved" обязательная проверка

---

## Session 2026-05-12 (continued) — Session 10 — P0.2.d CLOSED

### Закрыто
- P0.2.d Sync coverage fix
  - src/app/api/admin/sync-markets/route.ts:
    - limit: 30 → 100 (совпадает с cron шагом)
    - response: added hasMore flag (markets.length === limit)
  - src/app/api/cron/sync/route.ts:
    - maxDuration: 30 → 60s
    - paginate offset < MAX_OFFSET (1000) с early break по hasMore===false
    - summary counters: iterations, totalCreated, totalUpdated, totalSkipped
  - Commit: 0f52644
  - Coolify deploy: ✅ Success (Manual redeploy — webhook упал второй раз
    подряд за день, обе разово, без pattern в коде)
  - Execute Now verify:
    - iterations: 10, totalCreated: 522, totalUpdated: 322, totalSkipped: 156
    - hasMore: true на всех 10 → Polymarket feed > 1000 active markets
  - БД coverage verify:
    - До: 145 fresh_1h из 541 total live (27%)
    - После: 840 fresh_1h из 1072 total live (78%)
    - just_synced (за 5 мин): 0 → 837

### Что осталось stale (НЕ блокер P0.2.d)
- 201 markets в БД с status='live' но lastSyncedAt > 7 дней
- Причина: эти маркеты выпали из top-1000 по volume24hr на Polymarket
- Решение: P0.2.e Stale market cleanup (уже в backlog)

### Lessons learned
- Coolify webhook auto-deploy — упал 2 раза подряд за день (07:31 и 07:35),
  manual redeploy всегда чистый. Не блокер, но trend для monitoring
- maxDuration на Next.js cron endpoint: дефолт 30s, увеличили до 60s;
  фактическое время выполнения ~30 секунд (10 fetch к Polymarket + DB upserts)
- hasMore flag в API response — простой и надёжный stop condition
  когда API не имеет has_more/total_count

---

## Session 2026-05-12 (continued) — Session 10 — P0.2.c CLOSED + new findings

### Закрыто
- P0.2.c Equity-aware MLL upgrade (Wave C)
  - Новый файл: src/lib/equity.ts (computeOpenPositionsValue + computeEquity)
  - Schema: добавлено Challenge.peakEquity Float?
  - SQL migration: ALTER TABLE + UPDATE backfill 5 active challenges
  - 3 правки: src/app/api/trade/buy/route.ts, sell/route.ts, marketResolve.ts
    - В каждом: isFailedByCash || isFailedByEquity
    - violationReason: разный формат для cash-fail vs equity-fail
    - peakEquity: MAX(peakEquity ?? peakBalance, equity)
  - Commit: 4b2b487
  - Coolify deploy: ✅ Success (после одного разового retry)
  - БД миграция: ALTER + UPDATE выполнен Алексеем 12 мая
  - Sanity test (test8 Starter, challenge id=17):
    - Before buy: realizedBalance=1000, peakBalance=1000, peakEquity=1000
    - After buy 75 sh @ 0.0652 (cost $4.89):
      realizedBalance=995.11, peakBalance=1000, peakEquity=1000
    - Formula verified: equity = 995.11 + 75×0.065 = 999.99 < 1000
    - peakEquity stayed at 1000 (MAX(1000, 999.99))

### Discovery findings (НЕ блокеры, новые задачи)
- Coverage gap в sync-markets: limit=30, но cron шлёт offset += 100
  → пропускаются индексы 30-100, 130-200, 230+
  → 298/541 (55%) live маркетов stale > 7 дней
- Stale market accumulation: 70 маркетов с endDate < NOW status='live'
  → Polymarket их не возвращает в active feed, никогда не cleanup
- Эти проблемы влияют на equity accuracy (Wave C считает на старых ценах
  для маркетов, которые не sync'аются)

### Создано в BACKLOG
- P0.2.d Sync coverage fix
- P0.2.e Stale market cleanup

### Lessons learned
- Wave A (cash-based MLL) — backstop check, остался работать после Wave C
- На buy equity почти не меняется (cash↓ балансирует position value↑),
  Wave C полезен в первую очередь в sell/marketResolve
- Округление: cost $4.89 vs avgPrice 0.0652 × 75 = $4.89 (нет drift)

---

## Session 2026-05-12 (continued) — Session 10 — P0.2.b CLOSED

### Закрыто
- P0.2.b Sync-prices cron infrastructure
  - Bug fix: убран хардкод "https://funded-forecast.vercel.app"
    в src/app/api/cron/sync/route.ts (2 места)
  - Заменено на getBaseUrl() helper с throw if NEXT_PUBLIC_APP_URL missing
  - Добавлена проверка ADMIN_API_KEY с throw (было ! non-null assertion)
  - sync-prices fetch теперь захватывает response (раньше терялся)
  - console.error при failure (раньше silent)
  - Commit: 0f2ce7d
  - Coolify deploy: ✅ Success
  - Coolify Scheduled Task создан:
    - Name: sync-prices
    - Command: curl -fsS -H "Authorization: Bearer $CRON_SECRET"
               https://tradepredictions.online/api/cron/sync
    - Frequency: */15 * * * *
    - Timeout: 300s
  - Verify (Coolify Recent executions): 2 Success runs
  - Verify (DB): MAX("lastSyncedAt")=2026-05-12 05:54:12,
    128 markets synced last 5 minutes, 537 total live markets

### Lessons learned
- NEXT_PUBLIC_APP_URL был выставлен правильно в Coolify,
  настоящая проблема была в отсутствии cron task (никто не вызывал endpoint)
- Хардкод Vercel fallback — бомба замедленного действия (silent fail
  если кто-то удалит env), убран ради diagnostics

### Unblocked
- P0.2.c Equity-aware MLL upgrade (требовал свежих цен)

---

## Session 2026-05-12 (continued) — Session 10 — P0.2 Wave A CLOSED

### Закрыто
- P0.2 Wave A — MLL Trailing (TFP-style fixed drawdown, realized-based)
  - Формула: maxLossAmount = startBalance × maxLossPct/100 (FIXED)
  - MLL = peakBalance − maxLossAmount (trailing вверх)
  - isFailed = realizedBalance < MLL
  - Файлы (3):
    - src/app/api/trade/buy/route.ts (~204 строка)
    - src/app/api/trade/sell/route.ts (~191 строка)
    - src/lib/marketResolve.ts (~108 строка)
  - violationReason единый формат:
    "Max Loss hit: balance $XXX below limit $YYY (peak $ZZZ)"
  - Commit: f2f46bb
  - Coolify deploy: ✅ Success
  - БД миграция (Алексей вручную в Coolify Terminal):
    UPDATE "Challenge" SET "peakBalance" = GREATEST("startBalance", "realizedBalance")
    WHERE status = 'active';
  - 5 active challenges мигрированы

### Discovery findings
- peakBalance уже было в schema (из подготовки)
- newPeakBalance уже обновлялся в buy/sell/resolve (правильно)
- Был сломан только MLL check — считал от startBalance вместо peakBalance
- violationReason нигде не парсится — можно менять формат свободно

### НЕ ДЕЛАЛИ (отложено)
- P0.2.b Sync-prices cron infrastructure (новая задача в BACKLOG)
- P0.2.c Equity-aware MLL upgrade (новая задача в BACKLOG)
  - Цены в БД stale: 0 маркетов обновлены за 24ч, 313/501 > 7 дней
  - Wave C невозможен пока цены не свежие
  - Текущий Wave A безопасен на realizedBalance

### Critical findings (для P0.2.b)
- BUG: src/app/api/cron/sync/route.ts хардкодит fallback URL
  "https://funded-forecast.vercel.app" — Vercel мёртв, sync падает
- Нет sync-prices cron в Coolify Scheduled Tasks
- Все 501 live маркетов имеют stale цены

### Lessons learned
- Claude Code предлагал неправильную формулу: drawdown = (peak-realized)/peak × 100
  Это НЕ TFP-style. Правильно: maxLossAmount FIXED от startBalance
- Architecture decision требует проверки данных до выбора (вариант B vs C решён
  по результатам discovery)

---

## Session 2026-05-12 — Session 10 — P0.1 Refundable Fee CLOSED

### Закрыто
- P0.1 Refundable Fee removal (backend + БД + Admin, без текстов)
  - БД: UPDATE "ChallengePlan" SET "refundableFeeCents" = 0 (3 plans)
  - Backend: src/app/api/user/payout/route.ts — убран bonus calculation
    (priorPaid query + refundableFeeCents → finalAmount = amount)
  - Backend: src/app/api/admin/payouts/[id]/route.ts — убрана установка
    refundableFeePaidAt при approve payout
  - Frontend: src/app/admin/page.tsx — 7 точечных правок
    (поле из emptyNew, startEdit, saveEdit, addPlan + 2 input-поля
     из Edit/Add forms + Fee bonus из payouts list + grid 3→2 и 4→3)
  - Commit: 841a536
  - Coolify deploy: ✅ Success (5m 41s)
  - Production test: Edit Plan ✓, New Plan ✓, Payouts list ✓

### НЕ ТРОНУТО (deferred)
- prisma/schema.prisma — поле refundableFeeCents остаётся
- src/lib/payment/activation.ts — копирование оставлено (default 0 из БД)
- src/app/api/admin/plans/route.ts + [id]/route.ts — API backward compatible
- src/app/page.tsx — тексты "Refundable Fee" на лендинге (отложено)
- DROP COLUMN миграция — через 7 дней после стабильной работы P0

### Lessons learned
- Claude Code изначально хотел делать больше (Prisma schema, activation.ts,
  admin/plans API) — Архитектор скорректировал scope
- В git add попали лишние файлы (.gitignore от прошлого коммита) —
  Claude Code сделал git restore --staged, всё прошло чисто
- БД UPDATE выполнен Алексеем вручную в Coolify DB Terminal (по правилу
  CLAUDE.md — не через Claude Code)

---

## Session 2026-05-11 (continuation 4) — P0.3.e Trading Days default 10→15

### Done
- ChallengePlan.minTradingDays UPDATED 10 → 15 для всех 3 планов (Starter/Pro/Elite)
- Применено напрямую через Coolify DB Terminal (sandbox БД)
- Existing active challenges не затронуты (minTradingDays — snapshot в Challenge таблице, NOT NULL без default)
- SQL: BEGIN; UPDATE "ChallengePlan" SET "minTradingDays" = 15; COMMIT;
- UI Admin Plans editor проверен — MIN TRADING DAYS=15 отображается корректно для всех планов

### Not done yet
- Production БД (когда переключимся с sandbox на mainnet) — повторить SQL

---

## Session 2026-05-11 (continuation 5) — P0.6 USDC unification

### Done
- prisma/schema.prisma: PayoutRequest.currency default "USDT" → "USDC"
- БД (sandbox): ALTER TABLE PayoutRequest ALTER COLUMN currency SET DEFAULT 'USDC'
- БД (sandbox): UPDATE existing USDT → USDC (0 rows — sandbox чистый)
- src/app/api/user/payout/route.ts: hardcoded "USDT" → "USDC" (line 191, hotfix после первого P0.6 коммита)
- src/app/account/page.tsx: 4 дефолта walletNetwork → "USDC ERC20", оба select-а (profile + payout) → только USDC ERC20 + USDC Polygon
- src/app/faq/data.ts:56: текст обновлён на "USDC on ERC20 and Polygon networks"
- src/app/how-it-works/page.tsx:40: "USDT is sent" → "USDC is sent"

### Scope NOT touched
- src/app/terms/page.tsx раздел 8.3 — это affiliate payout (отдельный flow с AffiliatePaymentMethod enum, оставляем оба варианта)
- src/app/api/admin/payouts/* — currency валидация уже корректна
- src/lib/payment/* — incoming USDC payments, не трогаем

### Not done yet
- Production БД (когда переключимся с sandbox на mainnet) — повторить ALTER + UPDATE

---

## Session 2026-05-11 (continuation 6) — P0.10 email templates DRAFTS

### Done
- Создана директория src/lib/email-templates/ с 7 файлами:
  - verification.ts — Email verification (registration)
  - payment-confirmed.ts — Challenge активирован после payment
  - challenge-passed.ts — Challenge passed
  - challenge-failed.ts — Challenge failed (drawdown/expired) + Instant Reset CTA
  - payout-approved.ts — Payout одобрен админом
  - payout-completed.ts — Payout отправлен on-chain (BaseScan/PolygonScan link)
  - index.ts — barrel export
- Все шаблоны используют buildBrandTemplate + buildKeyValueTable + escapeHtml из src/lib/email.ts
- Типизированные параметры (export interface XxxEmailData)
- TFP-style DRAFTS — финальный copywriting от заказчика (OPEN_QUESTIONS_P0.md #2)
- TypeScript check: clean

### Scope NOT covered (отложено в Wave 2/3)
- Inactivity warning email — P1 (не P0)
- MLL warning email — P1
- Интеграция в endpoints (вызовы sendEmail) — Wave 3
- Существующий auto-pass email в trade/sell/route.ts:323 — будет переподключён в Wave 3

### Hotfix приложен к коммиту
- src/app/api/user/payout/route.ts:191 — currency hardcode "USDT" → "USDC" (часть P0.6, пропущенная в коммите 41bb411)

---

## Session 2026-05-11 (continuation 3) — Backlog audit + corrections

### Получено
- Аудит backlog от заказчика (19 пунктов замечаний + 3 корректировки структуры)

### Принято в backlog
- 18/22 пунктов аудита приняты с моими решениями
- 4 пункта вынесены в OPEN_QUESTIONS_P0.md (требуют ответа заказчика)
- Скорректирована оценка P0 с buffer 30% (132ч)
- Добавлены P0.10 Email templates + P0.11 Backup & DR
- P1 разделён на P1.early (critical, 117ч) + P1.late (48ч)
- Добавлены P1.7 Analytics + P1.8 Support
- Создан MIGRATION_PLAN с rollback strategy

### Total estimate to production
- 44 working days ≈ 9 weeks

### Blocked on
- 4 open questions: KYC rejection policy, email copywriting, MaxMind verification, backup storage

---

## Session 2026-05-11 (continuation 2) — TFP audit + decisions

### Получено от заказчика
- 10 decisions по бизнес-модели (см. BACKLOG)
- 4 предупреждения решены (migration, partial sell, trading days, порядок P0)

### Зафиксировано
- BACKLOG реструктурирован: P0/P1/P2/P3
- Старые блокеры → Archive section
- Оценка P0: ~86ч (~11 дней)
- Оценка P1: ~136ч (~17 дней)

### Pre-prod plan
- Перед катом P0 в prod: synthetic users simulation (10-20 ботов)
- Existing test data (test6/7/8) маркированы как legacy

### Следующий шаг
- Создать MIGRATION_PLAN_P0.md с детальным порядком работы
- НЕ начинать implementation до подтверждения backlog

---

## 2026-05-11 (продолжение) — D26 + ghost balance discovery

### Контекст сессии

Продолжение той же демо-сессии. Закрыты D27/D28 (изоляция позиций), D26 (история challenges + secondary sandbox card), обнаружен D29 (ghost balance). Создан docs/WALLET_MODEL.md — архитектурное решение [A1] подтверждено.

---

### [D27/D28] Full-reload после покупки + изоляция позиций по challengeId `6773a37`

**Проблема D27:** `router.push("/dashboard")` в checkout — SPA-навигация, не вызывает повторных fetch. После успешной покупки дашборд оставался с данными предыдущей сессии.

**Проблема D28:** После провала challenge позиции того challenge всё ещё показывались в дашборде. Старый фильтр `NOT: { challenge: { status: "failed" } }` (D20) не разделял sandbox и challenge wallets — позиции от разных контекстов перемешивались.

**Решение D27:** `src/app/checkout/page.tsx` — `router.push("/dashboard")` → `window.location.href = "/dashboard"`. Full page reload форсирует все fetch заново.

**Решение D28:** Явная фильтрация по `challengeId`:
- Active challenge → `challengeId: activeChallenge.id`
- Нет active challenge → `challengeId: null` (sandbox)

Применено в двух местах:
- `GET /api/user/positions/route.ts` — список позиций
- `GET /api/user/me/route.ts` — счётчик `openPositionsCount` (запрос `activeChallenge` перемещён выше счётчика — reuse без extra query)

**TODO [A1]** в обоих файлах — заменить на нативную walletId фильтрацию после реализации wallet model. Детали: `docs/WALLET_MODEL.md`.

---

### [D26] История challenges + sandbox secondary card `00370d0`, `6dbfbc3`

**Проблема:** После провала/прохождения challenge пользователь не видел историю. Sandbox режим при активном challenge не отображался в UI.

**Бэкенд** (`00370d0`):
- Новый `GET /api/user/challenges` — terminal challenges (passed/failed/expired) с вычисленными полями: `pnl`, `profitTargetProgress` (0–100%), `drawdownUsed` (0–100%), `positionsCount` через Prisma `_count`
- `GET /api/user/mode` расширен: если active challenge — добавляет `sandboxBalance` + `sandboxPositionsCount` для вторичной карточки

**Фронтенд** (`6dbfbc3`):
- `PastChallengesSection` — таблица с badge (passed=green, failed=red, expired=gray), hover border transition, caret. Клик → `ChallengeDetailModal`
- `SandboxSecondaryCard` — мутный фон, PAUSED badge, balance + кол-во позиций, helper text. Видна только при active challenge
- `ChallengeDetailModal` — закрытие через ESC + ✕ + клик по backdrop. Stats как `{label: string; value: string; color?: string}[]` — не `React.ReactNode` (React не импортирован в файл, только хуки). Violation reason block если заполнен
- Layout порядок: ChallengeCard → PastChallengesSection → SandboxSecondaryCard → Open Positions
- 4-й fetch в `Promise.all` с failsafe: `.catch(() => null)` — дашборд не ломается если endpoint недоступен

---

### [D29] Обнаружен: Ghost balance в sandbox режиме (не закрыт, P2 #18)

**Проблема:** После завершения challenge (passed/failed) дашборд в sandbox режиме показывает `currentBalance` из последнего challenge вместо реального sandbox BalanceLog.

**Корень:** `GET /api/user/mode/route.ts` — запрос `lastLog` не имеет фильтра `challengeId`. `findFirst` с `orderBy: createdAt desc` возвращает лог от завершённого challenge (более свежий), а не sandbox.

**Простой fix (не реализован):**
```typescript
// mode/route.ts — добавить challengeId фильтр к lastLog
const lastLog = await prisma.balanceLog.findFirst({
  where: activeChallenge
    ? { userId, challengeId: activeChallenge.id }
    : { userId, challengeId: null },
  orderBy: { createdAt: "desc" },
});
```

**Статус:** Баг обнаружен, задокументирован как D29. Не блокирует демо (проявляется только после завершения challenge, а не во время активного). Закроется автоматически при внедрении [A1] wallet model.

---

## 2026-05-11

### Контекст сессии

Демо-готовность. Четыре задачи по блокерам перед показом инвестору / первым реальным платежом.

---

### [HEADER] Рефакторинг шапки — гостевой хедер на авторизованных страницах `584f0f4`

**Проблема:** Залогиненный пользователь на `/affiliates`, `/faq`, `/leaderboard` видел гостевую шапку (LandingHeader) вместо своей. Три отдельных бага с одним корнем.

**Корень:** `HeaderWrapper.tsx` монтировался на сервере (SSR) без доступа к localStorage — `getToken()` всегда возвращал `null`. `isActive("/affiliates")` не срабатывал, поэтому гостевая шапка просачивалась на аутентифицированные страницы.

**Решение:** mounted-паттерн в `HeaderWrapper` — рендер только после гидратации клиента:
```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);
if (!mounted) return null;
return getToken() ? <Header /> : <LandingHeader />;
```
`Header.tsx` упрощён: убраны все гостевые ветки — он теперь рендерится только для залогиненных.

---

### [SEC-1] Rate limiting через proxy.ts `31349d3`

**Проблема:** Архитектор обнаружил 3 дыры в `src/proxy.ts` (Next.js 16 middleware):

1. `getLimiter()` не знал о 3 affiliate endpoints → они падали в `default` лимитер (60/мин вместо 5/ч)
2. `/api/cron/*` роуты не имели bypass → планировщик мог получить 429 и упасть
3. Нет `try/catch` → если Redis/Upstash недоступен, весь API возвращает 500

**Решение (вариант B — дополнить, не переписывать):**
- `getLimiter()`: добавлены 3 строки для affiliate endpoints
- `proxy.ts`: добавлен bypass для cron + webhook, весь блок обёрнут в `try/catch { return NextResponse.next() }`

**Принцип:** rate limiting — это защита, не блокировка легитимного трафика. Failsafe обязателен.

---

### [D20] Скрыть позиции в failed challenges `274eeab`

**Проблема:** После провала challenge открытые позиции оставались видны в `/dashboard` и `/user/positions`. Пользователь видел "активные" позиции в мёртвом challenge — вводило в заблуждение.

**Решение:** Prisma фильтр `NOT: { challenge: { status: "failed" } }` в двух endpoints:
- `GET /api/user/positions` — список позиций
- `GET /api/user/me` — счётчик `openPositionsCount`

**Важно:** Это workaround, не архитектурный fix. Правильное решение (TODO A2) — автоматически закрывать позиции при провале challenge. Фильтр помечен комментарием `// TODO [A2]`.

**Prisma семантика:** `NOT: { challenge: { status: "failed" } }` включает строки где `challengeId IS NULL` ИЛИ `challenge.status != 'failed'` — именно то, что нужно.

---

### [D15] Popup "Payment confirmed" + fallback polling `47f4ebd`

**Проблема:** После CONFIRMED payment страница `/checkout` не показывала никакого подтверждения. `router.push("/dashboard")` вызывался тихо, без визуального feedback. Если cron активации запаздывал (challengeId ещё null), редирект не происходил вообще. Silent `catch {}` блоки глотали ошибки и прятали реальные проблемы.

**Три правки в `src/app/checkout/page.tsx`:**

1. **Logging:** `catch {}` → `catch (err) { console.error("[checkout] polling error:", err) }`

2. **Popup вместо тихого редиректа:** `router.push("/dashboard")` → `setShowSuccessPopup(true)`. Компонент `SuccessPopup` показывает: план, размер аккаунта, profit target, ссылку на tx в BaseScan. Кнопка "Go to Dashboard →" — единственный выход (нет ×, нет клика по backdrop).

3. **Fallback polling:** 4-й `useEffect` — каждые 10 сек опрашивает `/api/payments/me/active`. Если `recentConfirmed.challengeId` появился — показывает popup. Защита от случая когда основной polling (по `/payments/[id]/status`) не сработал.

**BaseScan links:**
- chainId 8453 → `https://basescan.org/tx/{hash}`
- chainId 84532 → `https://sepolia.basescan.org/tx/{hash}`

---

## 2026-05-08

**Auto-pass logic + email helper refactor.** P0 закрыт.

При закрытии сделки через sell — challenge автоматически переходит в `passed` если выполнены условия (profitTargetMet + tradingDaysCount >= minTradingDays + !drawdownViolated). Раньше требовал ручного действия админа.

Email refactor: создан `src/lib/email.ts` — shared `sendEmail()` helper (никогда не бросает), `buildBrandTemplate()`, `buildKeyValueTable()`. Все email-маршруты переключены на него.

Коммиты: `6303c22` (auto-pass), `e9fd5fc` (email refactor)

---

## 2026-05-07

**On-chain payment loop замкнут.** Три больших блока:

**Step 4 — Watcher service** (`5bf63d5` + fixes): viem + Alchemy, batch 9 блоков/запрос (Alchemy free tier inclusive limit = 10, т.е. toBlock-fromBlock ≤ 9). Детектирует USDC Transfer events, матчит с Payment по сумме, advances confirmations. E2E: 2 транзакции из MetaMask → CONFIRMED за 2-22 минуты.

**P0 #1 — Checkout UX + zombie cleanup** (`f3886e2` + 4 коммита): Postgres partial unique index не может содержать `now()` в predicate → zombie AWAITING_PAYMENT блокировали новые invoice. Layered defense: inline cleanup при create + cron expire-payments каждую минуту. Cancel button на /checkout, banner на /account/plans.

**Step 5 — Activation flow** (`c85811f`, `86d85cd`): `activatePayment()` с pg_advisory_xact_lock, создаёт Challenge из Payment, idempotent. Cron `/api/cron/activate-payments` каждую минуту. F5 fix: `/api/payments/me/active` возвращает recentConfirmed → checkout восстанавливает состояние после перезагрузки.

---

## 2026-05-06

**On-chain payment subsystem.** NowPayments полностью удалён.

Step 1 schema (`b0eba69`): новые модели Payment/PaymentTransaction/PaymentWatcherState, BigInt для amount, cuid id. Миграция вручную через Coolify Database Terminal.

Step 2 invoice API (`5514c82`): POST /api/payments/create (advisory lock, amount uniqueness ±50 cents, idempotent), GET /api/payments/[id]/status. tsconfig ES2017 → ES2020 (BigInt literals).

Step 3 checkout UI (`4e577fd` + `c6d21dc` + `22b3c10`): QR код, countdown, polling, 7 UI states. Critical fix: `useRef` flag вместо `useState` в useEffect (предотвращает infinite loop при 429).

---

## 2026-05-05

**Security revamp + UX.** 7 коммитов.

Закрыт бесплатный challenge flow (`a40e135`), STARTING_BALANCE $10 для новых юзеров (`343e66b`), `/account/plans` plan selection UI (`20210df`). Mobile responsive headers. Cron auto-fail expired challenges hourly. Post-challenge dashboard banner (passed/expired/failed).

---

## 2026-05-04

**Affiliate MVP 100% + Sandbox VPS.**

Полный affiliate program: schema, click tracking, conversions, cron, apply/approval, cabinet UI, admin UI, payout flow, public landing page. 

Sandbox: Hetzner CX23, Coolify GUI, tradepredictions.online, PostgreSQL 17, auto-deploy из main. E2E tests T0-T26 ALL PASS на production.

---

## Текущее состояние (2026-05-11)

### Что работает end-to-end
- Регистрация → выбор плана → on-chain оплата USDC (Base Sepolia testnet) → popup подтверждения → активация challenge → торговля → auto-pass при достижении цели → email уведомление
- Affiliate program: клик → attribution → конверсия → холд → payout
- Admin панель: пользователи, affiliate, платежи, планы

### Активные cron задачи на Coolify
| Cron | Расписание | Что делает |
|------|-----------|------------|
| `watch-payments` | `* * * * *` | Alchemy watcher — детектирует USDC transfers |
| `activate-payments` | `* * * * *` | CONFIRMED → Challenge создание |
| `expire-payments` | `* * * * *` | AWAITING → EXPIRED cleanup |
| `expire-challenges` | `0 * * * *` | Active → Failed по дедлайну |
| `affiliate-hold` | `0 3 * * *` | Pending → Available conversions |

### Ключевые env vars (в Coolify)
`DATABASE_URL` (sandbox Postgres), `JWT_SECRET`, `CRON_SECRET`, `ALCHEMY_API_KEY`, `USDC_CONTRACT_ADDRESS`, `RECEIVER_ADDRESS`, `CHAIN_ID=84532` (testnet), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`

### Что НЕ сделано из важного (P1)
- `prisma migrate deploy` в Coolify start command — миграции пока вручную
- Pre-prod security audit (ротировать секреты)
- Coolify → Base Mainnet switch (сейчас testnet)
- Admin dashboard 403 bug (frontend не handle'ит 4xx)

---

## Инфраструктура

| | URL | Назначение |
|--|-----|-----------|
| Production | https://tradepredictions.online | Coolify VPS, Hetzner Helsinki |
| Fallback | https://funded-forecast.vercel.app | Vercel Hobby (not primary) |
| Coolify GUI | https://coolify.tradepredictions.online | Deploys, cron, DB terminal |
| DB terminal | Coolify → Database → Terminal | `psql -U postgres -d fundedforecast` |

**Важно:** sandbox БД резолвится только внутри Coolify контейнеров. Локальный `.env` → production Supabase (другой инстанс).
