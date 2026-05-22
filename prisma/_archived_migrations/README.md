# Archived migrations (pre-baseline)

These migrations were applied to the dev database before Phase 0.5
schema reconciliation (2026-05-15). They are NOT reproducible against
a fresh database (the second one references indexes that don't exist
in the first one — schema drift through manual `db push` calls).

After Phase 0.5 the canonical baseline is
`prisma/migrations/0_baseline_reconciled/migration.sql`, which represents
the full schema as a single CREATE TABLE snapshot.

These archived migrations are kept here only as historical record. They
are NOT in `prisma/migrations/` because Prisma 5.x scans that directory
exhaustively and would try to apply them.

Do not move these files back into `prisma/migrations/`.
