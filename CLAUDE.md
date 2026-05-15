# CLAUDE.md — FundedForecast project rules

Этот файл читается автоматически в начале каждой сессии Claude Code в директории
`~/funded-app`. Содержит правила работы, контекст проекта и границы автономности.

---

## 1. Работа с пользователем

- **Алексей** (alexadminer) — владелец процесса, не программист.
- Общение с Алексеем: **русский язык**.
- Весь код, коммиты, тексты сайта, документация в `docs/` (кроме SESSION_LOG.md
  где разрешён русский) — **английский**.
- **Если Claude Code в чём-то не уверен** — спрашивает **Архитектора** (Claude в
  отдельном чате), НЕ Алексея. Алексей и Архитектор всё решают вместе перед
  тем как задача попадает в Claude Code.

---

## 2. Project overview

- **Repo:** `github.com/alexadminer1/funded-forecast`
- **Stack:** Next.js 16 + Prisma 5.22 + PostgreSQL 17 + TypeScript
- **Working directory:** `~/funded-app`
- **Payments:** on-chain USDC, Base Sepolia (sandbox) -> Base Mainnet (planned)

### Что за проект

FundedForecast — prop-firm платформа на основе Polymarket prediction markets.
Юзер покупает challenge → торгует симуляцией → проходит правила → получает
funded status → request payouts через on-chain USDC transfer.

### Tested users (legacy, НЕ ломаем при миграциях)

- `testuser2026` (ID#25, APPROVED affiliate)
- `test6` (failed Starter)
- `test7` (active Starter после failed)
- `test8` (active Starter, чистая история)

---

## 3. Environments — Production vs Development

**Critical: два полностью изолированных окружения. НЕ путать.**

### Production (НЕ ТРОГАТЬ без явного approval)

- App container: `ff-sandbox-app`
- Postgres container: `ff-sandbox-db` (hostname: `n6a214z1jmhhlogwdf4pllxj`)
- Domain: https://tradepredictions.online
- Branch: `main`
- Chain: Base Sepolia (sandbox stage), CHAIN_ID=84532

### Development (рабочее окружение для Claude Code)

- App container: `app-dev` (hostname: `wlugzzo3b2482ji68l6r3zcv-045726055218`)
- Postgres container: `postgres-dev` (hostname: `ku2yqi907qdi78bk3xb5zy3p`)
- Domain: https://dev.tradepredictions.online
- Branch: `develop`
- Database name: `fundedforecast` (внутри postgres-dev)

### Важно про данные

- БД `postgres-dev` содержит копию прод-данных (dump 2026-05-13)
- Env-переменные в `app-dev` сейчас идентичны проду (Resend, Alchemy, JWT_SECRET и т.д.)
- Это временное решение пока прод в sandbox-режиме
- Перед выходом в боевой режим — разделить secrets (см. P1 task в BACKLOG)

---

## 4. Git workflow

### Branches

- `main` — production. Защищён branch protection rules. Прямой push ЗАПРЕЩЁН.
- `develop` — рабочая ветка для активной разработки. Все изменения идут сюда.
- `feature/*` — опционально для длинных задач (>1 день), мерджатся в `develop`.

### Стандартный цикл задачи

1. Убедиться что находимся в develop: `git checkout develop && git pull`
2. Внести изменения
3. `git diff` (показать Алексею перед коммитом)
4. Дождаться подтверждения
5. `git add . && git commit -m "..." && git push origin develop`
6. Coolify подхватывает push в develop → auto-deploy в app-dev
7. Тест на https://dev.tradepredictions.online

### Production release: develop → main

Только Алексей выполняет этот процесс. Claude Code НЕ создаёт PR в main самостоятельно.

1. Develop стабилен и протестирован на dev.tradepredictions.online
2. Алексей создаёт PR develop → main на GitHub
3. PR review (Алексей approve себя)
4. Merge (strategy: Merge commit, не squash — сохраняем историю)
5. Push в main НЕ триггерит auto-deploy (webhook выключен)
6. Алексей вручную нажимает Deploy в Coolify для ff-sandbox-app
7. Перед deploy — пройти PROD_RELEASE_CHECKLIST.md

### Стиль коммитов

- `feat [P0.X] short description`
- `fix [DXX] description`
- `docs short description`
- `refactor [area] description`
- `chore [scope] description`

Тело commit message — английский, можно многострочное.

---

## 5. SSH access и работа на VPS

### Подключение

- User: `claude`
- Auth: ed25519 key-based only (passwordless disabled)
- Alias на ноутбуке Алексея: `ssh ff-dev`
- Group: `docker` (доступ к docker daemon)

### Container access policy

**READ-ONLY operations — разрешены на ВСЕХ контейнерах (включая prod):**
- `docker logs <container>` — диагностика, сравнение dev vs prod
- `docker ps`, `docker inspect`, `docker stats`
- `docker exec ... cat /path/file` (без write)

**WRITE operations — ТОЛЬКО на dev-контейнерах:**
- `docker exec` с modification (npm install, edit file, run script)
- `docker restart`, `docker stop`, `docker rm`
- `psql` с DML/DDL операциями

### Whitelist для WRITE

Контейнеры идентифицируются через Coolify label `coolify.resourceName`
(имена с хешами меняются при каждом передеплое, поэтому ориентация на label).

Разрешены ТОЛЬКО dev-контейнеры:
- `coolify.resourceName=app-dev`
- `coolify.resourceName=postgres-dev`

ЗАПРЕЩЕНО WRITE — prod-контейнеры:
- `coolify.resourceName=ff-sandbox-app` (production app)
- `coolify.resourceName=ff-sandbox-db` (production database)
- Любые системные контейнеры Coolify

### Bash helpers (установлены в `/usr/local/bin/` на VPS для пользователя claude)

- `dev-exec <cmd>` — `docker exec` в контейнер `app-dev`, под root внутри
  контейнера. Используется для `npm`, `npx prisma`, edit файлов и т.п.
- `dev-logs [app-dev|postgres-dev] [args]` — логи dev-контейнера.
  По умолчанию `--tail 200` без follow. Флаг `-f` включает follow.
  Без аргумента — логи app-dev.
- `dev-psql [args]` — psql на `postgres-dev`, база `fundedforecast`,
  пользователь `postgres`. Доп. аргументы пробрасываются в psql.
- `prod-*` — намеренно отсутствуют. Read-only операции на prod выполняются
  прямыми `docker logs / ps / inspect` по имени контейнера или label.

### Sudo / OS-level restrictions

User `claude` не имеет sudo-прав. Защита от ошибочных write-операций на
prod-контейнерах — на дисциплине Claude Code (см. whitelist выше) и в этом
файле, не на уровне ОС. При выходе production в боевой режим — задача
защиты на уровне ОС вернётся (см. P1 в BACKLOG).

---

## 6. GitHub App @claude workflow

GitHub App `@claude` установлен на репо `funded-forecast`. Permissions:
read+write для issues, PRs, code, workflows.

### Как использовать

- Алексей или Архитектор создают issue с описанием задачи
- В комментарии issue или PR упомянуть `@claude` с инструкцией
- Claude Code работает по @claude-mentions автономно
- Все изменения идут в `develop` (НЕ в main)

### Что НЕ может делать @claude автономно

- Создавать PR в `main` (только Алексей вручную)
- Деплоить в production (Coolify Deploy кнопка — только Алексей)
- Изменять `.env` или Coolify env vars (всегда обсуждается с Архитектором)
- Удалять данные в production БД (даже через миграции)

---

## 7. Сервисы — что используем

- Hetzner CX23 — VPS (Helsinki) — единственный production-сервер
- Coolify — Deploys, cron jobs, DB Terminal, GUI на coolify.tradepredictions.online
- GitHub — Repo + source of truth
- PostgreSQL 17 — БД (отдельный контейнер на dev и prod)
- Resend — Транзакционная почта
- Alchemy — Base RPC + USDC watcher
- Upstash Redis — Rate limiting через proxy.ts
- Backblaze B2 — Backups (статус: финальный выбор отложен)
- Sumsub — KYC, Web SDK (планируется в P1)
- MaxMind GeoLite2-City — Geo-block (статус отложен)

### Сервисы которые НЕ используем

- Supabase — старый `.env` может смотреть на Supabase, игнорируем
- Vercel — забыли, не используем
- Stripe — нет, только on-chain USDC
- NowPayments — удалён 2026-05-06

### Запрещённые сервисы

Российские товары, услуги, компании — никогда (хостинг, CDN, библиотеки, шрифты, аналитика).

---

## 8. Что Claude Code может делать сам (auto-actions OK)

- Читать любой файл в `~/funded-app/`
- Создавать, редактировать, удалять файлы в `src/`, `prisma/`, `scripts/`, `docs/`
- `git add` + `git commit` + `git push origin develop` после завершения задачи
- `npm install` новых пакетов (если задача требует)
- Запускать `npm run build`, `npm run lint`, `npx tsc --noEmit` для проверки
- Запускать `npx prisma generate` (только client, не schema!)
- SSH в `ff-dev`, работа в dev-контейнерах
- Чтение логов prod-контейнеров (диагностика)

---

## 9. Что Claude Code НЕ делает без явного OK

### Database changes

- ALTER TABLE / UPDATE через psql на ПРОДЕ — только Алексей вручную в Coolify DB Terminal
- ALTER TABLE / UPDATE на DEV — Claude Code может выполнять напрямую через `dev-psql`, но сначала показывает SQL Алексею
- `npx prisma migrate dev` — НИКОГДА. Жёсткий запрет. Только `db push` на dev, и ручной SQL на prod.

### Infrastructure / deploys

- Изменения в `.env` или Coolify env vars — только Алексей через Coolify GUI
- Touch к cron расписаниям — обсуждать
- Изменения в `Dockerfile`, `package.json` engines/scripts — обсуждать
- Создание PR в `main` — только Алексей
- Deploy кнопка в Coolify для prod — только Алексей

### File system

- Не удалять файлы в `src/generated/` (Prisma client, regenerates само)
- Не трогать `node_modules/`
- Не коммитить `.env`, `.env.local`, `.bak` файлы

### Code

- Не переименовывать публичные API без явной задачи
- Если задача меняет backend API endpoint — проверить кто его вызывает на фронте

---

## 10. Prisma rules

### Команды

Можно:
- `npx prisma generate` (client)
- Редактировать `prisma/schema.prisma`
- `npx prisma db push` на dev (через dev-exec)
- Ручной SQL через `dev-psql` на dev

Нельзя:
- `npx prisma migrate dev` (ломает sync)
- `npx prisma migrate deploy` без явной задачи
- `db push` напрямую на prod — только через Алексея
- Ручной SQL на prod — только Алексей

### Schema sync workflow

После изменения `schema.prisma`:
1. Коммит в `develop`
2. Push → Coolify передеплоит `app-dev` (build генерирует client)
3. Если нужны изменения в dev БД — выполнить ALTER через `dev-psql`
4. Тест на dev.tradepredictions.online
5. Когда стабильно → PR develop → main → merge → Алексей вручную выполняет ALTER на prod БД → Алексей вручную нажимает Deploy

### 2026-05-15 update — переход на Prisma migrations

После Phase 0.5 (schema reconciliation, baseline migration `0_baseline_reconciled`)
все будущие schema changes идут через `prisma migrate dev --create-only`,
ревью миграции, и `prisma migrate deploy` (применение).

`prisma db push` БОЛЬШЕ НЕ ИСПОЛЬЗУЕТСЯ для изменений схемы. Может использоваться
только для experimental prototyping в isolated branch, но финальные изменения
требуют migration file.

Unmanaged DDL (partial indexes, soft FKs) задокументирован в `docs/UNMANAGED_DDL.md`.
Перед любой schema-меняющей задачей — прочитать этот файл.

---

## 11. Документация (`docs/` в проекте)

Файлы — источник правды. Читать в начале каждой сессии:

- `docs/BACKLOG.md` — Все задачи P0/P1/P2/P3 со статусом, оценками, файлами
- `docs/MIGRATION_PLAN_P0.md` — 6 Wave порядка работ + rollback strategy
- `docs/WALLET_MODEL.md` — APPROVED архитектура wallet isolation (P1.0)
- `docs/SESSION_LOG.md` — Журнал предыдущих сессий, что и когда сделано
- `docs/OPEN_QUESTIONS_P0.md` — Вопросы заказчику (текущий статус — DEFERRED)
- `docs/PROD_RELEASE_CHECKLIST.md` — Чеклист перед деплоем develop → main
- `CLAUDE.md` — (этот файл) — правила работы

### При завершении задачи

- Обновить `docs/SESSION_LOG.md` записью о сделанном
- Если задача из BACKLOG — пометить статус (✓ DONE / partial)
- Если найдена новая задача — НЕ добавлять в BACKLOG самостоятельно, предложить Архитектору сначала

---

## 12. Когда не уверен — последовательность действий

1. Прочитать релевантный файл в `docs/`
2. Прочитать SESSION_LOG — возможно эта задача уже решалась раньше
3. Если ответа нет — спросить Архитектора (через Алексея)
4. НЕ делать догадок в логике / архитектуре / БД схеме
5. НЕ переписывать чужой код "красивее" если задача этого не требует

---

## 13. Session continuity

- Claude Code иногда делает compact (сжатие истории). После compact теряется контекст BACKLOG и текущей задачи.
- После compact: заново прочесть `CLAUDE.md` + `docs/SESSION_LOG.md` (последние 3-5 записей).
- Не импровизировать списки задач, имена полей, типы, тексты.

---

Last updated: 2026-05-13 (Session 13 — bash helpers + branch protection + auto-deploy off)
