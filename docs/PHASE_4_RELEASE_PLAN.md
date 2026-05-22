# PHASE_4_RELEASE_PLAN.md — Phased prod release

## Status
READY TO EXECUTE — 2026-05-22
Parent: docs/PROD_RELEASE_CHECKLIST.md (generic)
This document: release-specific addendum для PR #17 (develop → main, 75 commits, 15 phases)

## Цель
Задеплоить накопившиеся 15 фаз с develop на prod (ff-sandbox-app) без даунтайма и без data loss. Phase 4.A.2 содержит CRITICAL hot-fix который нужен на prod срочно — но мерджить кнопкой все 75 коммитов нельзя, нужен phased порядок.

## Главное правило
**Каждый шаг — gate.** Если шаг не PASS — стоп, не продолжать. Recovery через rollback (раздел 11).

---

## Содержание

1. Pre-flight check
2. Backup prod БД
3. Capture corruption baseline
4. Apply prisma migrations
5. Verify ChallengePlan UPDATE
6. Merge PR #17 на GitHub
7. Coolify auto-deploy ff-sandbox-app
8. Coolify Scheduled Tasks reconciliation
9. Post-deploy smoke test
10. 24h observation
11. Rollback procedures

---

## 1. Pre-flight check

**Выполняет:** Алексей.

### 1.1 Verify ENV vars на ff-sandbox-app

Per release-prep.md analysis — **новых ENV vars НЕТ.** Все Alchemy/Payment vars уже на проде (используются payment watcher).

- [ ] Coolify GUI → ff-sandbox-app → Environment Variables — sanity check что `ALCHEMY_API_URL_BASE_SEPOLIA`, `PAYMENT_RECEIVER_ADDRESS`, `CRON_SECRET`, `ADMIN_API_KEY` присутствуют. Если что-то отсутствует — стоп.

### 1.2 Verify develop состояние

- [ ] PR #17 на GitHub: `Able to merge` ✅ (уже проверено)
- [ ] develop HEAD = `3a1e90f`
- [ ] app-dev container запущен на `3a1e90f` (Up 3 days, healthy)

### 1.3 Verify dev observation period

Если 23:55 и 23:59 UTC crons на app-dev не отработали 3 цикла без ошибок — стоп. Проверить логи Coolify Scheduled Tasks для tasks `end-of-day-check` и `expire-challenges` за последние 72 часа.

- [ ] end-of-day-check — 3 запуска, без 5xx ошибок
- [ ] expire-challenges — 3 запуска, без 5xx ошибок

**Gate 1:** все три чек-листа этого раздела ✅ → переходим к 2. Любой ❌ → стоп.

---

## 2. Backup prod БД

**Выполняет:** Алексей через Coolify DB Terminal.

### 2.1 Backup

Per PROD_RELEASE_CHECKLIST раздел 3.

В Coolify → ff-sandbox-db → ищи кнопку **Backups** или используй pg_dump через SSH:

```bash
ssh <prod-vps>
docker exec ff-sandbox-db pg_dump -U postgres -d fundedforecast -F c -f /tmp/ff-sandbox-db-pre-phase-4-release.dump
docker cp ff-sandbox-db:/tmp/ff-sandbox-db-pre-phase-4-release.dump ~/backups/
ls -lh ~/backups/ff-sandbox-db-pre-phase-4-release.dump
```

**Альтернатива (если Coolify имеет Backup UI):** один клик на ручной backup в ff-sandbox-db.

- [ ] Backup file создан
- [ ] Размер не нулевой, plausible vs предыдущих backups
- [ ] Path сохранён: `_______________________`
- [ ] Timestamp UTC: `_______________________`

**Gate 2:** backup готов → 3. Без backup нельзя продолжать.

---

## 3. Capture corruption baseline

**Зачем:** Phase 4.A.2 / Phase 4.B меняют поведение `marketResolve.ts`. Перед deploy нужен snapshot текущего состояния corruption на prod — чтобы потом можно было сравнить и убедиться что новые фиксы не сломали что-то ещё.

**Выполняет:** Алексей через Coolify DB Terminal (ff-sandbox-db).

```sql
-- Подключиться: psql -U postgres -d fundedforecast

-- 1. Chain leak count (Phase 4.A.2 finding #2)
SELECT COUNT(*) AS chain_leak_count
FROM "BalanceLog" bl
LEFT JOIN LATERAL (
  SELECT "challengeId" FROM "BalanceLog"
  WHERE "userId" = bl."userId" AND "createdAt" < bl."createdAt"
  ORDER BY "createdAt" DESC LIMIT 1
) prev ON true
WHERE bl."type" = 'market_resolve'
  AND prev."challengeId" IS DISTINCT FROM bl."challengeId";

-- 2. Audit corruption count (Phase 4.A.2 finding #1)
SELECT COUNT(*) AS audit_corruption_count
FROM "Trade" t
JOIN "Challenge" c ON c.id = t."challengeId"
WHERE t."action" = 'resolve'
  AND c."status" != 'active';

-- 3. Ghost positions count (Phase 4.B finding #5)
SELECT
  c.status AS challenge_status,
  COUNT(*) AS orphan_count
FROM "Position" p
JOIN "Challenge" c ON c.id = p."challengeId"
WHERE p.status = 'open' AND c.status != 'active'
GROUP BY c.status;
```

- [ ] Записать 3 числа в SESSION_LOG entry release-дня:
  - chain_leak_count: `_____`
  - audit_corruption_count: `_____`
  - ghost_positions_count: `_____`

**Gate 3:** числа зафиксированы → 4.

---

## 4. Apply prisma migrations

**Выполняет:** Алексей.

Эта секция — самая рискованная. Per release-prep.md, нужно:
1. Mark baseline applied (no DDL)
2. Run migrate deploy для Phase 1 ChallengePlan UPDATE (43 lines)

### 4.1 Mark baseline applied

Per Phase 0.5 design — `0_baseline_reconciled` migration отражает текущую prod schema. Запустить её на prod = error (tables уже существуют). Нужно зарегистрировать как applied **без DDL**.

**Способ через docker exec ff-sandbox-app:**

```bash
ssh <prod-vps>
docker exec -it $(docker ps --filter name=ff-sandbox-app --format '{{.Names}}') npx prisma migrate resolve --applied 0_baseline_reconciled
```

Ожидаемый вывод:
```
Migration 0_baseline_reconciled marked as applied.
```

- [ ] Команда выполнена без ошибок
- [ ] Verify в БД через Coolify DB Terminal:
  ```sql
  SELECT migration_name, applied_steps_count, started_at, finished_at FROM _prisma_migrations;
  ```
  Должна быть одна строка с `migration_name = '0_baseline_reconciled'`, `finished_at IS NOT NULL`.

**Стоп если:** ошибка `Migration ... not found` или `_prisma_migrations` table не существует → не продолжать, escalate.

### 4.2 Phase 1 ChallengePlan UPDATE

**ВАЖНО:** этот шаг выполняется ПОСЛЕ merge кода (не сейчас), потому что Phase 1 migration файл попадёт в prod только после code deploy. Текущая prod БД ещё не видит этот файл.

**Запланировано:** выполнить **между шагом 7 (deploy завершён) и шагом 8 (cron reconciliation)**.

Пока — только зафиксировать что эта migration существует и проверена на dev.

- [ ] Verify в app-dev что migration уже применена (через те же `_prisma_migrations`):
  ```bash
  ssh ff-dev
  dev-exec npx prisma migrate status
  ```
  Должно показать `Database schema is up to date!`.

**Gate 4:** baseline marked applied на prod, Phase 1 migration verified на dev → 5.

---

## 5. Verify ChallengePlan UPDATE на dev

**Выполняет:** Алексей через Coolify DB Terminal на postgres-dev (не prod!).

Перед применением Phase 1 миграции на prod — убедиться что на dev она применилась корректно и значения соответствуют ожиданиям.

```sql
SELECT "accountSize", "challengePeriodDays", "minTradingDays", "dailyLossPct", "maxLossPct"
FROM "ChallengePlan"
ORDER BY "accountSize";
```

Ожидаемый результат на dev (3 строки):
- accountSize=1000  | challengePeriodDays=10 | minTradingDays=10 | dailyLossPct=5 | maxLossPct=10
- accountSize=5000  | challengePeriodDays=10 | minTradingDays=10 | dailyLossPct=4 | maxLossPct=8
- accountSize=15000 | challengePeriodDays=10 | minTradingDays=10 | dailyLossPct=3 | maxLossPct=6

- [ ] Все 3 строки соответствуют ожидаемым значениям

**Gate 5:** значения на dev корректны → 6. Если нет — стоп, проблема в самой миграции, не релизим.

---

## 6. Merge PR #17 на GitHub

**Выполняет:** Алексей.

Сейчас выполнить:

- [ ] GitHub → PR #17 → нажать checkbox **"Merge without waiting for requirements to be met (bypass rules)"**
- [ ] Нажать **Merge pull request**
- [ ] Confirm merge
- [ ] Записать merge commit hash: `_______________________`
- [ ] Удалить branch develop? **НЕТ** — develop остаётся, не удалять
- [ ] (Опционально) Удалить старые feature branches которые уже merged: feature/p0-3-c-position-audit, feature/p0-3-d-resolve-hotfix, feature/p0-3-e-finalize

**Gate 6:** PR #17 merged, merge commit hash зафиксирован → 7.

---

## 7. Coolify auto-deploy ff-sandbox-app

**Выполняет:** Coolify webhook автоматически. Алексей мониторит.

Coolify ff-sandbox-app настроен на auto-deploy main branch (per CLAUDE.md). После merge — webhook должен сработать в течение секунд.

### 7.1 Дождаться deploy

- [ ] Открыть Coolify → ff-sandbox-app → Deployments
- [ ] Появилась новая запись `In Progress` для merge commit из шага 6
- [ ] Дождаться `Success` (build обычно 3-5 минут)
- [ ] Если `Failed` — стоп, переход к 11.1 (Code-only rollback)

### 7.2 Apply Phase 1 migration

После того как Coolify deploy завершился, в новом контейнере есть файл `prisma/migrations/20260515165522_phase_1_challenge_plan_values/migration.sql`. Применить:

```bash
ssh <prod-vps>
docker exec -it $(docker ps --filter name=ff-sandbox-app --format '{{.Names}}') npx prisma migrate deploy
```

Ожидаемый вывод:
```
1 migration found in prisma/migrations
Applying migration `20260515165522_phase_1_challenge_plan_values`
Migration applied successfully.
```

- [ ] Migrate deploy успешно завершился
- [ ] Verify в prod БД:
  ```sql
  SELECT "accountSize", "challengePeriodDays", "minTradingDays" FROM "ChallengePlan" ORDER BY "accountSize";
  ```
  Должно быть 3 строки с `challengePeriodDays=10, minTradingDays=10`.
- [ ] Verify в `_prisma_migrations` — добавилась вторая запись для `20260515165522_phase_1_challenge_plan_values`.

**Gate 7:** code deployed на prod, Phase 1 migration applied → 8.

**Стоп если** migration упал: применить SQL вручную через Coolify DB Terminal (текст в release-prep.md раздел 2), потом `prisma migrate resolve --applied 20260515165522_phase_1_challenge_plan_values`.

---

## 8. Coolify Scheduled Tasks reconciliation

**Выполняет:** Алексей через Coolify GUI.

Phase 4.A полностью переделал cron schedule. Нужно вручную обновить Coolify Scheduled Tasks для ff-sandbox-app согласно `docs/CRON_SCHEDULE.md`.

### 8.1 Remove legacy `inactivity-check` task

Endpoint удалён в Phase 4.A. Если task существует — каждый запуск возвращает 404.

- [ ] Coolify → ff-sandbox-app → Scheduled Tasks
- [ ] Найти task с endpoint `/api/cron/inactivity-check`
- [ ] **Delete** task
- [ ] Если task не существует — пропустить

### 8.2 Add `end-of-day-check`

- [ ] Создать новый Scheduled Task:
  - Name: `end-of-day-check`
  - Container: ff-sandbox-app
  - Schedule: `55 23 * * *`
  - Command: `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://tradepredictions.online/api/cron/end-of-day-check`

### 8.3 Add `verify-pending-payouts` (was missing from CRON_SCHEDULE.md)

Per твоё подтверждение — endpoint существует на develop, task на app-dev есть и работает. На ff-sandbox-app task не создан намеренно (был ждать deploy).

- [ ] Создать новый Scheduled Task:
  - Name: `verify-pending-payouts`
  - Container: ff-sandbox-app
  - Schedule: `*/10 * * * *`
  - Command: `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://tradepredictions.online/api/cron/verify-pending-payouts`

### 8.4 Verify остальные tasks на месте

Per `docs/CRON_SCHEDULE.md`, должны быть 8 (+2 новые = 10 total) tasks:
1. watch-payments — `* * * * *`
2. activate-payments — `* * * * *`
3. expire-payments — `* * * * *`
4. sync-prices — `*/15 * * * *`
5. expire-challenges — `0 * * * *`
6. cleanup-stale-markets — `0 * * * *`
7. end-of-day-check — `55 23 * * *` (новый, 8.2)
8. affiliate-hold — `0 3 * * *`
9. verify-pending-payouts — `*/10 * * * *` (новый, 8.3)
10. ~~inactivity-check~~ (удалён, 8.1)

- [ ] Все 9 tasks существуют и активны (Enabled: yes)

**Gate 8:** cron schedule приведён к каноническому состоянию → 9.

---

## 9. Post-deploy smoke test на prod

**Выполняет:** Алексей вручную через браузер + curl.

### 9.1 Сайт работает

- [ ] `https://tradepredictions.online` загружается (HTTP 200)
- [ ] Логин работает (логин под test юзером, не adminer — adminer уже passed challenge)
- [ ] Dashboard рендерится без 500 errors в browser console

### 9.2 Critical endpoints

```bash
# Без auth, должны вернуть JSON
curl -i https://tradepredictions.online/api/markets | head -20

# С auth (Bearer token из browser DevTools после логина)
curl -i -H "Authorization: Bearer <token>" https://tradepredictions.online/api/user/me | head -20
curl -i -H "Authorization: Bearer <token>" https://tradepredictions.online/api/user/mode | head -20
```

- [ ] `/api/markets` → 200, не пустой
- [ ] `/api/user/me` → 200
- [ ] `/api/user/mode` → 200

### 9.3 Critical trade flow (на test юзере с активным challenge)

Найти test юзера на prod БД (НЕ adminer, у него уже passed challenge):
```sql
SELECT u.id, u.username, c.id AS challenge_id, c.status FROM "User" u JOIN "Challenge" c ON c."userId" = u.id WHERE c.status = 'active' LIMIT 5;
```

- [ ] Логин как test юзер с активным challenge
- [ ] Открыть `/markets` — markets рендерятся
- [ ] Открыть конкретный market, кликнуть Trade → preview показывает корректную цену + spread
- [ ] Сделать buy на минимальную сумму ($1-2) → success, position появляется в Dashboard
- [ ] Сделать sell на эту же position (или скип если рискованно)

### 9.4 Sell guard verification (Phase 4.B Task 3)

Если на prod есть юзер с **failed challenge + open position** (orphan position):
```sql
SELECT p.id, p."userId", p."challengeId", p."marketId" FROM "Position" p JOIN "Challenge" c ON c.id = p."challengeId" WHERE p.status = 'open' AND c.status != 'active' LIMIT 5;
```

- [ ] Если есть orphan position — попробовать sell через curl:
  ```bash
  curl -i -X POST https://tradepredictions.online/api/trade/sell \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"marketId": <orphan>, "side": "yes", "shares": <amount>}'
  ```
  Ожидаем HTTP 403 + `{"error_code": "challenge_isolation"}`
- [ ] Если orphan positions нет — пропустить, проверим в 24h observation

### 9.5 Post-deploy corruption check

Запустить новый endpoint Phase 4.A.2:
```bash
curl -X POST https://tradepredictions.online/api/admin/audit/resolve-corruption \
  -H "x-admin-key: <ADMIN_API_KEY_PROD>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Это должен быть **тот же snapshot** что в шаге 3 (никаких новых corruption rows за время deploy).

- [ ] Сохранить JSON в `~/release-2026-05-22-corruption-post.json`
- [ ] Сравнить с шагом 3: chain_leak_count и audit_corruption_count не выросли

**Gate 9:** все smoke tests PASS → 10. Любой FAIL → решение Алексея: continue with monitoring, или rollback (раздел 11).

---

## 10. 24h observation

**Выполняет:** Алексей пассивно.

В течение 24 часов после release:

- [ ] Tomorrow morning: проверить Coolify Scheduled Tasks tab. `end-of-day-check` отработал в 23:55 UTC, `expire-challenges` отработал в 00:00 UTC. Логи без ошибок.
- [ ] Проверить prod corruption endpoint ещё раз — числа стабильны:
  ```bash
  curl -X POST https://tradepredictions.online/api/admin/audit/resolve-corruption \
    -H "x-admin-key: <key>" -d '{}'
  ```
- [ ] Проверить через Coolify Logs ff-sandbox-app — нет 500 errors flood'а

### Update SESSION_LOG

Per PROD_RELEASE_CHECKLIST раздел 8:

- [ ] Добавить entry в `docs/SESSION_LOG.md`:
  - Timestamp UTC
  - Merge commit range: `de6bf39..<new-main-sha>`
  - Migrations applied: `0_baseline_reconciled` (baseline only), `20260515165522_phase_1_challenge_plan_values`
  - Coolify cron changes: removed `inactivity-check`, added `end-of-day-check`, added `verify-pending-payouts`
  - Corruption baseline (шаг 3) и post (шаг 9.5) — оба числа
  - Issues, если были

**Gate 10:** observation 24h без incidents → release COMPLETE.

---

## 11. Rollback procedures

### 11.1 Code-only rollback (если build failed в шаге 7)

Build не прошёл — ничего на prod не задеплоено. Просто:
- Coolify → ff-sandbox-app → Deployments → найти последний Success deploy (`de6bf39`)
- Redeploy
- Расследовать build failure отдельно, потом retry release

### 11.2 Code rollback после успешного deploy (если smoke test FAIL в шаге 9, БЕЗ data corruption)

Шаги:
1. GitHub: `git revert -m 1 <merge-sha>` на main, push
2. Coolify auto-deploy откатит код
3. **Schema rollback НЕ нужен** — Phase 1 UPDATE на ChallengePlan не разрушительный (старые значения восстановить вручную через UPDATE, если нужно):
   ```sql
   UPDATE "ChallengePlan" SET "challengePeriodDays" = 30, "minTradingDays" = 15;
   ```
4. Coolify Scheduled Tasks вернуть в pre-release state (восстановить inactivity-check, удалить end-of-day-check и verify-pending-payouts).

### 11.3 Full rollback с restore из backup (если data corruption detected)

1. Stop ff-sandbox-app в Coolify
2. Restore prod БД из backup шага 2:
   ```bash
   ssh <prod-vps>
   docker cp ~/backups/ff-sandbox-db-pre-phase-4-release.dump ff-sandbox-db:/tmp/
   docker exec -it ff-sandbox-db pg_restore -U postgres -d fundedforecast --clean /tmp/ff-sandbox-db-pre-phase-4-release.dump
   ```
3. Git revert merge commit на main
4. Coolify Scheduled Tasks вернуть в pre-release state
5. Coolify redeploy ff-sandbox-app
6. Verify сайт работает

**Note:** `pg_restore --clean` уничтожит все данные созданные ПОСЛЕ backup'а. Любые трейды/регистрации сделанные между шагом 2 и моментом rollback'а будут потеряны.

---

## Краткий чеклист (для копирования в SESSION_LOG)

```
Phase 4 release — develop → main

[ ] Gate 1: pre-flight (ENV, develop state, observation crons)
[ ] Gate 2: prod backup taken, path stored
[ ] Gate 3: corruption baseline captured
[ ] Gate 4: prisma migrate resolve --applied 0_baseline_reconciled
[ ] Gate 5: Phase 1 ChallengePlan verified on dev
[ ] Gate 6: PR #17 merged, merge commit hash recorded
[ ] Gate 7: Coolify deploy green, prisma migrate deploy applied
[ ] Gate 8: Coolify Scheduled Tasks reconciled (10 tasks total)
[ ] Gate 9: post-deploy smoke test PASS
[ ] Gate 10: 24h observation clean, SESSION_LOG updated

Release COMPLETE — timestamp UTC: _____
Merge commit: _____
Corruption baseline / post: _____ / _____
```
