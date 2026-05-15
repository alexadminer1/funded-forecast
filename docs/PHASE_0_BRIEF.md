```markdown
# PHASE_0_BRIEF.md — Подготовка к внедрению P0.3.X

## Status
READY TO START — 2026-05-15
Parent: PHASE_KIT.md (общие правила)
Source of truth: BUSINESS_RULES.md

## STATUS UPDATE — 2026-05-15
Phase 0 PAUSED after discovery of schema drift. Phase 0.5 (Schema Reconciliation)
inserted as prerequisite. Phase 0 will resume with reduced scope (Coolify docs only)
after Phase 0.5 completes. Wipe (P0.3.A4) moved to new Phase 0.9.

## Goal фазы
Подготовить dev-окружение к внедрению новой бизнес-модели:
- Чистая БД без legacy test data
- Документированные cron расписания
- Backup перед началом изменений
- Feature-ветка готова

**После Фазы 0 не должно меняться поведение системы.** Только инфраструктурная подготовка.

---

## Scope фазы (P0.3.X задачи)

### P0.3.A4 — Wipe dev test data
- Удалить все challenges (active/failed/passed/expired) из postgres-dev
- Удалить связанные positions, trades, balanceLogs, payments, payoutRequests, ChallengeDailyPnL
- Сбросить sandbox-балансы тестовых юзеров до $10
- НЕ удалять самих юзеров (alexadminer, test1-test8 остаются)
- НЕ удалять markets (они синкаются с Polymarket)
- НЕ удалять ChallengePlan (это конфиг тарифов)

### P0.3.G2 — Документация cron расписаний
- Создать `docs/CRON_SCHEDULE.md`
- В нём — таблица: endpoint, файл, текущее расписание в Coolify, описание
- Источник: что Coolify показывает в Scheduled Tasks UI (Алексей предоставит скриншот или текст)
- Зафиксировать в git, чтобы не потерять при пересоздании сервиса

### P0.3.G3 — Прояснить sirota cron
- `cleanup-stale-markets` упомянут в SESSION_LOG, endpoint в репо НЕТ
- Проверить в Coolify Scheduled Tasks — есть ли такой task
- Если есть — удалить из Coolify (нерабочий endpoint)
- Если нет — пометить в docs как resolved

### Backup
- Перед wipe — `pg_dump` postgres-dev → файл с timestamp
- Сохранить локально на VPS в `/root/backups/` или аналогичной папке
- Зафиксировать путь в SESSION_LOG

---

## Что НЕ входит в Фазу 0

- Никаких изменений в коде
- Никаких изменений схемы
- Никаких новых правил
- Никаких миграций
- Не трогаем prod БД

---

## Последовательность шагов

```
1. Создать feature-ветку: feature/p0-3-phase-0
2. Backup dev БД через pg_dump
3. P0.3.A4 — wipe test data (один SQL скрипт)
4. Smoke test: login alexadminer → /dashboard грузится, balance $10, no active challenge
5. P0.3.G2 — создать docs/CRON_SCHEDULE.md
6. P0.3.G3 — проверить cleanup-stale-markets в Coolify, обновить doc
7. Коммит изменений docs/
8. Обновить SESSION_LOG.md, BACKLOG.md
9. Push ветки → PR → merge в develop
```

---

## Контрольные точки

### После wipe (шаг 3)
Smoke test через UI:
- [ ] Login alexadminer → OK
- [ ] /dashboard грузится без ошибок
- [ ] Balance = $10 (sandbox)
- [ ] Open positions = 0
- [ ] Past challenges = пусто
- [ ] /account/plans грузится, 3 тарифа видны
- [ ] /markets грузится, markets отображаются

### После всей фазы
- [ ] Все шаги выполнены
- [ ] Backup БД лежит и доступен
- [ ] docs/CRON_SCHEDULE.md создан и закоммичен
- [ ] develop merge выполнен
- [ ] Smoke test финальный пройден

---

## SQL для wipe (Архитектор пусть проверит и адаптирует)

```sql
-- Backup сначала! pg_dump перед запуском.

BEGIN;

-- Удаляем зависимые записи в правильном порядке (FK constraints)
DELETE FROM "ChallengeDailyPnL";
DELETE FROM "BalanceLog";
DELETE FROM "Trade";
DELETE FROM "Position";
DELETE FROM "PayoutRequest";
DELETE FROM "PaymentTransaction";
DELETE FROM "Payment";
DELETE FROM "Challenge";

-- Сбросить sandbox-балансы (если они хранятся отдельно — TBD)
-- Если баланс computed из BalanceLog — после удаления BalanceLog баланс = 0
-- Нужно создать initial BalanceLog $10 для тестовых юзеров

-- Архитектор пусть уточнит схему юзеров и как создаётся initial balance
-- (через User.balance поле или через BalanceLog запись)

COMMIT;
```

⚠️ **Архитектор должен проверить:**
- Полный список таблиц с FK на User / Challenge
- Как создаётся initial sandbox balance при регистрации (look up signup flow)
- Нужно ли восстанавливать $10 для existing тестовых юзеров или regenerate через resignup

---

## Файлы, которые нужно создать / изменить

### Создаются
- `docs/CRON_SCHEDULE.md` — новый файл
- `scripts/wipe-dev-data.sql` (опционально) — SQL для повторного wipe в будущем

### Изменяются
- `docs/SESSION_LOG.md` — добавить запись о Phase 0
- `docs/BACKLOG.md` — пометить P0.3.A4, G2, G3 как CLOSED

### НЕ изменяются
- Любой код (src/)
- prisma/schema.prisma
- prisma/migrations/

---

## Что Алексей делает сам (не через Claude Code)

1. **Backup БД:**
```bash
ssh ff-dev
docker exec ff-postgres-dev pg_dump -U postgres fundedforecast > /root/backups/ff-sandbox-db-pre-p0-3-$(date +%Y%m%d-%H%M).sql
ls -lh /root/backups/
```

2. **Применение SQL wipe:**
```bash
ssh ff-dev
cat wipe-dev-data.sql | docker exec -i ff-postgres-dev psql -U postgres -d fundedforecast
```
(или через `dev-psql -f`)

3. **Проверка Coolify Scheduled Tasks:**
- Зайти в Coolify UI
- ff-sandbox-app → Scheduled Tasks
- Сделать скриншот или скопировать список тасков с расписаниями
- Передать Архитектору для документирования в CRON_SCHEDULE.md

4. **Smoke test после wipe:**
- dev.tradepredictions.online
- Login + проверка чеклиста выше

5. **Push + PR + merge в develop**

---

## Формат CRON_SCHEDULE.md (Архитектор разработает)

Шаблон:

```markdown
# CRON_SCHEDULE.md

## Status
Mirrors Coolify Scheduled Tasks на ff-sandbox-app.
Source of truth: Coolify UI.
Этот файл — документация для git, не автоматическая синхронизация.

## Текущие задачи

| Endpoint | Файл | Расписание (cron) | Контейнер | Описание |
|----------|------|-------------------|-----------|----------|
| /api/cron/activate-payments | src/app/api/cron/activate-payments/route.ts | * * * * * | app-dev | Активация confirmed payments |
| /api/cron/watch-payments | src/app/api/cron/watch-payments/route.ts | * * * * * | app-dev | Сканирование USDC переводов |
| /api/cron/expire-payments | src/app/api/cron/expire-payments/route.ts | * * * * * | app-dev | Истечение неоплаченных payment'ов |
| /api/cron/sync | src/app/api/cron/sync/route.ts | */15 * * * * | app-dev | Синк markets с Polymarket |
| /api/cron/verify-pending-payouts | src/app/api/cron/verify-pending-payouts/route.ts | */10 * * * * | app-dev | On-chain verification payouts |
| /api/cron/expire-challenges | src/app/api/cron/expire-challenges/route.ts | TBD | app-dev | Истечение challenge при expiresAt |
| /api/cron/inactivity-check | src/app/api/cron/inactivity-check/route.ts | 0 * * * * | app-dev | 72h/120h без новой позиции — fail |
| /api/cron/daily-pnl-aggregate | src/app/api/cron/daily-pnl-aggregate/route.ts | 0 1 * * * | app-dev | Daily PnL aggregation + qualifying days |
| /api/cron/affiliate-hold | src/app/api/cron/affiliate-hold/route.ts | TBD | app-dev | Approve affiliate commissions |

## Известные проблемы
- cleanup-stale-markets: упомянут в SESSION_LOG, endpoint отсутствует в src/. Проверить и удалить из Coolify.
- affiliate-hold: расписание не задокументировано в коде.
- expire-challenges: расписание не задокументировано.

## Будущие изменения (Фаза 4)
После внедрения P0.3.C1 / C2 / C3:
- Добавить: end-of-day-check (55 23 * * *), end-of-challenge-finalize
- Удалить: inactivity-check
```

(Архитектор уточнит расписания с Алексеем по факту Coolify.)

---

## Closing checklist для Архитектора

Перед закрытием фазы:

- [ ] Все P0.3.A4, G2, G3 выполнены
- [ ] Backup БД создан и доступен
- [ ] Smoke test пройден (Алексей)
- [ ] docs/CRON_SCHEDULE.md создан и закоммичен
- [ ] docs/SESSION_LOG.md обновлён
- [ ] docs/BACKLOG.md обновлён (3 задачи помечены CLOSED)
- [ ] feature-ветка замержена в develop
- [ ] Алексей вернулся в основной чат (Session 19) с отчётом "Фаза 0 закрыта, commit X"

---

## Следующая фаза
Фаза 1 — фундамент схемы (P0.3.A1, A2, A3).
Требует ответы Алексея на:
- Какие колонки добавить в ChallengePlan (см. BUSINESS_RULES.md — гибридная модель)
- Какие SQL UPDATE применить к существующим 3 строкам ChallengePlan

PHASE_1_BRIEF.md будет выдан из основного чата после закрытия Фазы 0.
```

---

Сохрани в `docs/PHASE_0_BRIEF.md`.

Когда положишь — открывай новый чат с Архитектором. Стартовый pack для него:
1. `CLAUDE.md`
2. `BUSINESS_RULES.md`
3. `BACKLOG.md`
4. `PHASE_KIT.md`
5. `PHASE_0_BRIEF.md`

Первое сообщение ему — просто: "Прочитай файлы молча. После — предложи план Фазы 0. Не начинай работу."
