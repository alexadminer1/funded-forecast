# UNMANAGED_DDL.md

## Status
APPROVED — 2026-05-15 (Phase 0.5 schema reconciliation)

## Назначение
Реестр DDL объектов в dev/prod БД, которые НЕ управляются через
prisma/schema.prisma. Эти объекты должны переноситься между средами
вручную через SQL-скрипты или сохраняться при миграциях.

Перед любой schema-меняющей задачей — прочитать этот файл и убедиться,
что задействованные таблицы не содержат unmanaged DDL.

---

## Partial unique indexes

Prisma DSL не поддерживает partial indexes (`WHERE ... clause`).
Эти индексы создавались manually через SQL.

### 1. Payment_active_amount_unique

```sql
CREATE UNIQUE INDEX "Payment_active_amount_unique"
ON "Payment" ("chainId", "tokenAddress", "receiverAddress", "expectedAmountUnits")
WHERE "status" IN ('AWAITING_PAYMENT','SEEN_ON_CHAIN','CONFIRMING','UNDERPAID');
```

Назначение: предотвращает создание двух активных Payment с одинаковой
expectedAmountUnits на одного receiver — нужно для безопасной on-chain
матчинг через watcher.

Используется в: `src/app/api/cron/expire-payments/route.ts` (header
комментарий ссылается на этот индекс как load-bearing).

### 2. affiliate_active_payout_idx

```sql
CREATE UNIQUE INDEX "affiliate_active_payout_idx"
ON "AffiliatePayout" ("affiliateId")
WHERE "status" IN ('requested','approved','processing');
```

Назначение: предотвращает создание двух одновременно in-flight payouts
для одного affiliate.

Используется в: запросы affiliate payout creation (см. affiliate API).

### 3. PayoutRequest_txHash (partial form)

```sql
CREATE UNIQUE INDEX "PayoutRequest_txHash_key"
ON "PayoutRequest" ("txHash")
WHERE "txHash" IS NOT NULL;
```

Behaviorally equivalent to standard `@unique` в PostgreSQL (NULL values
do not collide), но DDL отличается от того, что генерит Prisma.
Не критично, но не дать `prisma db push` дропнуть.

---

## Soft FKs (application-enforced relations)

Эти колонки ссылаются на другие таблицы logically, но не имеют FK constraint
ни в prisma/schema.prisma, ни в БД. Целостность поддерживается application
кодом.

| Source                                | Target           | Notes |
|---------------------------------------|------------------|-------|
| `Affiliate.userId`                    | `User.id`        | One-to-one. `@unique` есть, FK нет. |
| `User.referredByAffiliateId`          | `Affiliate.id`   | Optional. FK нет. |
| `AffiliateClick.convertedToUserId`    | `User.id`        | Optional. FK нет. |
| `AffiliateConversion.referredUserId`  | `User.id`        | Required (`Int`). FK нет. |

Решение оставить как soft FK принято в Phase 0.5 — формализация через
`@relation` потребовала бы data cleanup при наличии dangling references.
Эта задача deferred.

---

## Sequences

24 sequences `public.*_id_seq` — управляются автоматически через
`@default(autoincrement())` в Prisma. Не требуют документирования.

---

## _prisma_migrations table

Существует в БД, пустая. После Phase 0.5 + baseline migration начнёт
использоваться для отслеживания всех будущих миграций.

---

## Maintenance protocol

При создании новых partial indexes / soft FK / unmanaged objects:

1. Добавить в этот файл с DDL и обоснованием
2. Создать SQL-скрипт в `scripts/ddl/` для применения
3. Применить в dev → задокументировать в SESSION_LOG
4. Перед prod release — добавить SQL в PROD_RELEASE_CHECKLIST раздел "Database migrations"

При schema changes через `prisma migrate`:

1. Проверить этот файл — затрагивает ли изменение unmanaged DDL
2. Если да — указать в migration файле какие partial indexes нужно
   восстановить после ALTER TABLE
3. Verify post-migration через `pg_dump --schema-only`

---

## Изменения этого файла
- 2026-05-15: Initial version, Phase 0.5 reconciliation.
