# PHASE_KIT.md

## Назначение
Инструкция для Архитектора-исполнителя в новом чате.
Каждая фаза реализации (P0.3.X задачи) — отдельный чат.
Этот документ описывает общие правила работы для всех фаз.

## Status
APPROVED — 2026-05-15 (Алексей + Архитектор-аудитор Session 19)
SOURCE: процесс из Session 19, после полного аудита бизнес-модели.

---

## Роли

### Алексей (Product Owner)
- Принимает решения по бизнес-логике
- Запускает Claude Code в терминале
- Делает smoke test
- Решает когда merge / когда release
- Хранит мастер-контекст в основном чате (Session 19 chat)

### Архитектор-исполнитель (новый чат на каждую фазу)
- Получает на старте 4 файла: CLAUDE.md, BUSINESS_RULES.md, BACKLOG.md, PHASE_N_BRIEF.md
- Запрашивает дополнительные файлы по необходимости
- Составляет план фазы
- Выдаёт задания Claude Code (одним сплошным блоком в конце сообщения)
- Ревьюит отчёты Claude Code
- В конце фазы — обновляет SESSION_LOG, BACKLOG; готовит pre-release SQL

### Claude Code (исполнитель в терминале)
- Bypass permissions ON
- Работает на ветке feature/p0-3-X-name
- НЕ пушит в develop без явной команды
- НЕ запускает prisma db push / migrate без явного указания
- НЕ применяет SQL к dev БД без явного указания

---

## Правила безопасности для Claude Code

### Что Claude Code МОЖЕТ делать без подтверждения
- Читать файлы (cat, grep, rg, view, ls)
- Изменять файлы кода (TypeScript, TSX, prisma/schema.prisma)
- Запускать `npm run build`, `npx tsc --noEmit`, `npx prisma generate`
- Создавать миграции через `npx prisma migrate dev --create-only` (БЕЗ применения)
- Делать локальные коммиты в feature-ветке
- Запускать read-only SQL через dev-psql (SELECT)

### Что Claude Code НЕ МОЖЕТ делать
- `prisma db push` — никогда
- `prisma migrate dev` без флага `--create-only` — никогда
- Применять SQL к БД (INSERT/UPDATE/DELETE/ALTER/CREATE/DROP) — никогда
- `git push` — только по явной команде Алексея
- Мержить в develop / main — никогда
- Менять файлы вне явно указанного скопа фазы — никогда

### Что делает Алексей сам
- Применяет SQL к dev (через dev-psql вручную)
- Применяет миграции к dev (`npx prisma migrate deploy` локально)
- Запускает cron'ы через curl для теста
- Решает когда push, когда PR, когда merge
- Делает smoke test на dev.tradepredictions.online
- Для prod release — следует PROD_RELEASE_CHECKLIST.md

---

## Структура каждой фазы

### Старт фазы
1. Алексей создаёт новый чат с Архитектором
2. Прикладывает: CLAUDE.md, BUSINESS_RULES.md, BACKLOG.md, PHASE_N_BRIEF.md
3. Архитектор молча читает (без "я готов"), запрашивает доп. файлы если нужно
4. Алексей даёт команду "начинаем"

### Workflow внутри фазы
1. Архитектор предлагает план фазы (какие задачи, в каком порядке, чем заканчивается)
2. Алексей даёт ACK или коррекции
3. Архитектор выдаёт первое задание Claude Code одним сплошным блоком
4. Алексей копирует в Claude Code, ждёт выполнения
5. Claude Code сохраняет отчёт в /tmp/phase-N-task-M.md и выводит команду pbcopy
6. Алексей пересылает отчёт Архитектору
7. Архитектор ревьюит, выдаёт следующее задание ИЛИ корректировку
8. Цикл повторяется до завершения всех задач фазы

### Закрытие фазы
1. Архитектор готовит:
   - Список изменённых файлов
   - Список созданных миграций (не применённых)
   - SQL для prod (если требуется ALTER TABLE)
   - Smoke test чеклист для Алексея
2. Алексей выполняет smoke test на dev
3. Если OK → Алексей пушит ветку, создаёт PR develop, мержит
4. Архитектор обновляет SESSION_LOG.md и BACKLOG.md одним коммитом
5. Алексей возвращается в основной чат (Session 19) с одной строкой: "Фаза N закрыта, последний коммит X"

---

## Ветки и коммиты

### Naming
- Ветка фазы: `feature/p0-3-foundation`, `feature/p0-3-guards`, `feature/p0-3-cron`, и т.д.
- Каждая P0.3.X задача — отдельный коммит внутри ветки фазы
- Сообщение коммита: `[P0.3.X] краткое описание`

### Process
1. От develop → создать feature/p0-3-<phase>
2. Все задачи фазы — коммиты в эту ветку
3. После smoke test — PR develop → develop (squash merge ИЛИ merge commit, решает Алексей)
4. После merge — ветка удаляется

### Prod release
- НЕ делаем prod release после каждой фазы
- Накапливаем логические пакеты (пример: Фазы 0-2 = "ядро правил готово")
- Release следует PROD_RELEASE_CHECKLIST.md строго

---

## Миграции

### Принцип
Все schema changes начиная с Фазы 1 идут через Prisma migrations.
Никаких `prisma db push` или ручного ALTER TABLE.

### Текущий долг (G1 в gap-list)
В prisma/migrations/ только 2 файла:
- 20260426111052_init
- 20260506000000_onchain_payment_subsystem

Все позднейшие изменения схемы (qualifyingTradingDaysCount, ChallengeDailyPnL,
peakEquity, resolvedPositionsCount, uniqueEventsCount, polymarketEventId,
Trade.realizedPnl, affiliate subsystem и др.) применялись через db push + SQL.

### План
- Фаза 0 — НЕ делать миграции (только wipe + docs)
- Фаза 1 — создать ОДНУ миграцию "p0_3_phase_1_business_rules" которая:
  - Добавляет колонки в ChallengePlan (если решено добавлять)
  - Делает baseline всех пропущенных изменений
- Все последующие фазы — отдельные миграции на каждое schema change

### Создание миграции
```bash
npx prisma migrate dev --create-only --name p0_3_phase_N_<description>
```
Это создаёт файл, НЕ применяет. Алексей ревьюит SQL → применяет через
`npx prisma migrate deploy` локально → коммитит миграцию.

---

## Формат заданий для Claude Code

Архитектор выдаёт задания **одним сплошным code-блоком** в конце сообщения,
без markdown-форматирования внутри. Текст для Алексея — ОТДЕЛЬНО, до блока.

### Обязательный header задания
TASK NAME — Phase N, Task M
MODE: <READ-ONLY | CODE-ONLY | SCHEMA>
BRANCH: feature/p0-3-<phase>
SCOPE: <конкретные файлы>
NO PUSH, NO DB PUSH, NO MIGRATE APPLY

### Обязательный footer
В конце сохрани отчёт в /tmp/phase-N-task-M.md
В конце выведи команду: cat /tmp/phase-N-task-M.md | pbcopy

### Запрещено в заданиях
- Просьбы запушить
- Просьбы применить миграцию
- Просьбы делать prod release
- "Заодно почини X" — только явный scope

---

## Файлы для нового чата Архитектора (стартовый pack)

| Файл | Назначение |
|------|------------|
| CLAUDE.md | Общая инструкция проекта, известные тонкости |
| BUSINESS_RULES.md | Источник истины по бизнес-модели (12 правил, параметры тиров) |
| BACKLOG.md | Список задач P0.3.X с приоритетами |
| PHASE_N_BRIEF.md | Конкретное ТЗ для этой фазы |
| PHASE_KIT.md | Этот файл — общие правила работы |

При необходимости Архитектор запрашивает дополнительно:
- SESSION_LOG.md — если нужна история предыдущих фаз
- WALLET_MODEL.md — если фаза касается wallet
- PROD_RELEASE_CHECKLIST.md — на финальной фазе перед release
- OPEN_QUESTIONS_P0.md — если фаза блокирована вопросами заказчику

---

## Контрольные точки между фазами

После закрытия фазы Алексей возвращается в основной чат (Session 19) с отчётом.
Основной чат проверяет:

1. Все ли P0.3.X задачи фазы закрыты?
2. Smoke test пройден?
3. Что отложено / deferred?
4. Готовы ли к следующей фазе?

Только после "ок" из основного чата — старт следующей фазы.

---

## Что делать если что-то пошло не так

### Claude Code сломал dev
1. Откат: `git reset --hard origin/develop` в feature-ветке
2. Если БД испорчена → restore из backup (Фаза 0 делает backup перед началом)
3. Откатить задачу в Архитекторе, переформулировать

### Архитектор предлагает решение вне модели
1. Алексей останавливает: "это не из BUSINESS_RULES.md"
2. Если решение нужно — возврат в основной чат для обсуждения и фиксации
3. Обновление BUSINESS_RULES.md перед продолжением

### Расхождение между BUSINESS_RULES.md и кодом
BUSINESS_RULES.md — источник истины.
Код приводится к нему, не наоборот.

---

## Изменения этого файла
- 2026-05-15: Initial version. Approved Алексей.

## Schema reconciliation note
Schema drift существует в dev-БД из-за истории применения изменений через
`prisma db push` + ручной SQL вместо миграций. Фаза 0.5 (вставлена 2026-05-15)
исправляет это до начала любых schema-меняющих фаз. См. SESSION_LOG записи
Phase 0.5 для деталей.

- 2026-05-15: Added schema reconciliation note (Phase 0.5 inserted).