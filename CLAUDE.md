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
  тем как задача попадает в Claude Code. Алексею задавать только вопросы вида
  "запустить эту команду?" / "применить этот diff?", не вопросы по логике.

---

## 2. Project overview

- **Repo:** `github.com/alexadminer1/funded-forecast`
- **Stack:** Next.js 16 + Prisma 5.22 + PostgreSQL 17 + TypeScript
- **Production:** `tradepredictions.online` (Hetzner CX23, Helsinki)
- **Sandbox БД:** PostgreSQL 17 внутри Coolify-контейнера
- **Working directory:** `~/funded-app`
- **Payments:** on-chain USDC, Base Sepolia (sandbox) → Base Mainnet (planned)

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

## 3. Сервисы — что используем

| Сервис | Назначение |
|---|---|
| Hetzner CX23 | VPS (Helsinki) — единственный production-сервер |
| Coolify | Deploys, cron jobs, DB Terminal, GUI на coolify.tradepredictions.online |
| GitHub | Repo + source of truth |
| PostgreSQL 17 | БД, живёт внутри Coolify-контейнера |
| Resend | Транзакционная почта (`RESEND_API_KEY` в Coolify env) |
| Alchemy | Base RPC + USDC watcher (`ALCHEMY_API_KEY`) |
| Upstash Redis | Rate limiting через proxy.ts |
| Backblaze B2 | Backups (статус: финальный выбор отложен — OPEN_QUESTIONS_P0.md #4) |
| Sumsub | KYC, Web SDK (планируется в P1) |
| MaxMind GeoLite2-City | Geo-block (статус отложен) |

### Сервисы которые НЕ используем

- **Supabase** — локальный `.env` исторически смотрит на Supabase, но это НЕ
  sandbox-БД. Не пушить туда схему, не считать живой.
- **Vercel** — забыли, не используем.
- **Stripe** — нет, только on-chain USDC.
- **NowPayments** — удалён 2026-05-06.

### Главное правило по инфраструктуре

**Только наш собственный сервер.** Все данные, БД, бэкапы, cron, deploys —
на Hetzner через Coolify. Никаких managed-БД, никаких external hosted services
для основной логики.

### Запрещённые сервисы

**Российские товары, услуги, компании — никогда** (хостинг, CDN, библиотеки,
шрифты, аналитика). Если возникает вопрос "взять Yandex/VK/Mail.ru что-то" —
ответ нет, искать альтернативу.

---

## 4. Что Claude Code может делать сам (auto-actions OK)

- Читать любой файл в `~/funded-app/`
- Создавать, редактировать, удалять файлы в `src/`, `prisma/`, `scripts/`, `docs/`
- `git add` + `git commit` + `git push` после завершения задачи
- `npm install` новых пакетов (если задача требует)
- Запускать `npm run build`, `npm run lint`, `npx tsc --noEmit` для проверки
- Запускать `npx prisma generate` (только client, не schema!)

### Стиль коммитов

```
feat [P0.X] short description
fix [DXX] description
docs short description
refactor [area] description
```

Тело commit message — английский, можно многострочное. Использовать heredoc через
`git commit -m "..." -m "..."` или `-F` файл.

---

## 5. Что Claude Code НЕ делает без явного ОК (Архитектор → Алексей)

### Database changes

- **ALTER TABLE / UPDATE через psql** — только Алексей сам в Coolify DB Terminal.
  Claude Code может **готовить SQL** и показывать его, но не выполнять.
- **`npx prisma db push`** локально — БЕСПОЛЕЗНО (`.env` смотрит на Supabase,
  не на sandbox). Schema sync с sandbox БД происходит при deploy на Coolify.
- **`npx prisma migrate dev`** — НИКОГДА. Жёсткий запрет. Только `db push`,
  и только через Coolify-контейнер при необходимости.

### Infrastructure / deploys

- Изменения в `.env` или Coolify env vars — только Алексей через Coolify GUI
- Touch к cron расписаниям — обсуждать
- Изменения в `Dockerfile`, `package.json` engines/scripts — обсуждать

### File system

- Не удалять файлы в `src/generated/` (Prisma client, regenerates само)
- Не трогать `node_modules/`
- Не коммитить `.env`, `.env.local`, `.bak` файлы

### Code

- **Не менять названия шорткодов** при обновлении кода (legacy WordPress habit
  у Алексея, но правило универсальное — не переименовывать публичные API без
  явной задачи на это).
- Если задача предполагает менять backend API endpoint — проверить кто его
  вызывает на фронте, обсудить миграцию.

---

## 6. Git workflow

### Стандартный цикл задачи

```
1. Внести изменения
2. git diff (показать Алексею перед коммитом)
3. Дождаться подтверждения
4. git add . && git commit -m "..." && git push
5. Coolify подхватывает push в main → auto-deploy
```

### Правила

- Один логический change = один коммит (не накапливать)
- Перед коммитом ВСЕГДА `git diff` или `git diff --cached` показать Алексею
- `.env` никогда не коммитить — проверять перед `git add .` (gitignore это
  уже покрывает, но контролировать)
- При failed build на Coolify — показать ошибку, исправить до следующего шага

### Branches

- Работа в `main`. Feature branches — только если задача длинная (>1 день) и
  Архитектор явно их запросил.

---

## 7. Prisma rules

### Команды

| Можно | Нельзя |
|---|---|
| `npx prisma generate` (client) | `npx prisma migrate dev` (ломает sync) |
| Редактировать `prisma/schema.prisma` | `npx prisma db push` локально (не та БД) |
| Запускать SQL через Coolify DB Terminal (Алексей) | `npx prisma migrate deploy` без явной задачи |

### Schema sync

После изменения `schema.prisma`:
1. Закоммитить + запушить
2. Coolify передеплоит (build генерирует client)
3. Если изменения в БД нужны (ALTER) — Алексей выполняет SQL вручную в
   Coolify DB Terminal (Архитектор готовит SQL)

---

## 8. Документация (`docs/` в проекте)

Файлы — источник правды. Читать в начале каждой сессии:

| Файл | Содержание |
|---|---|
| `docs/BACKLOG.md` | Все задачи P0/P1/P2/P3 со статусом, оценками, файлами |
| `docs/MIGRATION_PLAN_P0.md` | 6 Wave порядка работ + rollback strategy |
| `docs/WALLET_MODEL.md` | APPROVED архитектура wallet isolation (P1.0) |
| `docs/SESSION_LOG.md` | Журнал предыдущих сессий, что и когда сделано |
| `docs/OPEN_QUESTIONS_P0.md` | Вопросы заказчику (текущий статус — DEFERRED) |
| `CLAUDE.md` | (этот файл) — правила работы |

### При завершении задачи

- Обновить `docs/SESSION_LOG.md` записью о сделанном
- Если задача из BACKLOG — пометить статус (✓ DONE / partial)
- Если найдена новая задача — НЕ добавлять в BACKLOG самостоятельно,
  предложить Архитектору сначала

---

## 9. Среды и окружения

### Sandbox (текущая)

- URL: `https://tradepredictions.online`
- Chain: Base Sepolia (`CHAIN_ID=84532`)
- БД: PostgreSQL 17 в Coolify
- Тестовые цены планов: $1.00 / $1.95 / $3.00

### Production (планируется)

- Тот же URL
- Chain: Base Mainnet (`CHAIN_ID=8453`)
- Боевые цены: $39.99 / $99.99 / $199.99 (решение в Wave 6, P0.9)
- Переключение — отдельная sign-off задача

---

## 10. Когда не уверен — последовательность действий

1. **Прочитать релевантный файл в `docs/`** (BACKLOG, MIGRATION_PLAN, WALLET_MODEL)
2. **Прочитать SESSION_LOG** — возможно эта задача уже решалась раньше
3. **Если ответа нет — спросить Архитектора** (через Алексея, который перенесёт
   вопрос в свой чат с Архитектором)
4. **НЕ делать догадок** в логике / архитектуре / БД схеме
5. **НЕ переписывать чужой код "красивее"** если задача этого не требует

### Что разрешено делать самостоятельно при неполной задаче

- Уточняющие вопросы по форматированию вывода
- Уточнения по именам файлов / директорий
- Выбор между двумя equivalent способами реализации (например, `sed` vs python
  heredoc для текстовой замены) — выбрать тот что надёжнее

---

## 11. Important: Session continuity

- Claude Code иногда делает **compact** (сжатие истории). После compact теряется
  контекст BACKLOG и текущей задачи.
- **После compact:** заново прочесть `CLAUDE.md` + `docs/SESSION_LOG.md` (последние
  3-5 записей) + текущий контекст от Архитектора через Алексея.
- **Не импровизировать** списки задач, имена полей, типы, тексты. Если что-то
  выглядит знакомо — проверить в `docs/`, не доверять памяти.

---

Last updated: 2026-05-11 (Session 9, после P0.6 / P0.10 DRAFTS / P0.12 в backlog)
