# PHASE_0_5_BRIEF.md — Schema Reconciliation

## Status
READY TO START — 2026-05-15
Parent: PHASE_KIT.md
Predecessor: Phase 0 paused after schema drift discovery

## Goal
Привести prisma/schema.prisma в соответствие с реальным состоянием dev-БД.
Зафиксировать unmanaged DDL (partial indexes, soft FKs) в документации.
Создать baseline migration для последующего перехода на Prisma migrations.

После Phase 0.5 НЕ меняется поведение приложения и БД.

## Scope

### prisma/schema.prisma
1. Добавить onDelete + onUpdate к 20 @relation (см. таблицу A1)
2. Добавить @db.Timestamp к PayoutRequest.lastVerifyAttemptAt
3. Triple-slash комментарии над Payment, AffiliatePayout, PayoutRequest

### Documentation
4. docs/UNMANAGED_DDL.md — реестр unmanaged DDL
5. CLAUDE.md — обновить раздел про prisma db push

### Baseline migration (Алексей)
6. prisma migrate dev --create-only
7. prisma migrate resolve --applied

## Что НЕ входит
- Никакого DDL на БД
- Никакого prisma db push
- Никаких изменений кода вне schema.prisma / docs/ / CLAUDE.md
- Wipe данных (это Phase 0.9)
- Soft FK formalization (deferred)

## Разделение работ

Claude Code: A1-A4, B1-B2, коммиты в feature-ветку.
Алексей: prisma migrate diff / migrate dev --create-only / migrate resolve / migrate status / push.

## Шаг A — schema.prisma

### A1. Маппинг 20 relations (onDelete / onUpdate)

| Relation                          | onDelete | onUpdate |
|-----------------------------------|----------|----------|
| AuditLog.actor (actorId)          | SetNull  | Cascade  |
| BalanceLog.challenge              | SetNull  | Cascade  |
| BalanceLog.trade                  | SetNull  | Cascade  |
| BalanceLog.user                   | Restrict | Cascade  |
| Challenge.plan                    | SetNull  | Cascade  |
| Challenge.user                    | Restrict | Cascade  |
| PaymentTransaction.payment        | SetNull  | Cascade  |
| Payment.challenge                 | SetNull  | Cascade  |
| Payment.plan                      | SetNull  | Cascade  |
| Payment.user                      | Restrict | Cascade  |
| PayoutRequest.challenge           | Restrict | Cascade  |
| PayoutRequest.user                | Restrict | Cascade  |
| Position.challenge                | SetNull  | Cascade  |
| Position.market                   | Restrict | Cascade  |
| Position.user                     | Restrict | Cascade  |
| Subscription.user                 | Restrict | Cascade  |
| Trade.challenge                   | SetNull  | Cascade  |
| Trade.market                      | Restrict | Cascade  |
| Trade.user                        | Restrict | Cascade  |
| UserConsent.user                  | Restrict | Cascade  |

Если в diff-отчёте есть 21-я relation не из таблицы (например ChallengeDailyPnL.challenge) — применить значения СОГЛАСНО реальному состоянию БД из diff §D.1, отметить в Open questions.

### A2. PayoutRequest.lastVerifyAttemptAt
Добавить @db.Timestamp (без аргумента).

### A3. Triple-slash комментарии
Точные тексты — см. ниже в задании в heredoc'ах.

### A4. Validate
npx prisma format / validate / generate — все три без ошибок.

## Шаг B — Documentation

### B1. Создать docs/UNMANAGED_DDL.md
Точное содержимое — см. ниже в задании.

### B2. Обновить CLAUDE.md
Найти раздел про prisma db push, добавить блок в конец. Если раздела нет — создать новый §N в конец файла.

## Шаг C — Verification (Алексей)
export DATABASE_URL="postgresql://..."
npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource "$DATABASE_URL" --script
Ожидаемо: empty или только partial indexes.

## Шаг D — Baseline (Алексей)
DATABASE_URL=... npx prisma migrate dev --create-only --name 0_baseline_reconciled
Ревью migration.sql. При необходимости — очистка до SELECT 1;
DATABASE_URL=... npx prisma migrate resolve --applied 0_baseline_reconciled
DATABASE_URL=... npx prisma migrate status

## Шаг E — Wrap-up
Коммиты — Claude Code. Push — Алексей. PR не создаётся.

## Следующая фаза
Phase 0.9 — wipe dev test data с учётом SET NULL семантики.
