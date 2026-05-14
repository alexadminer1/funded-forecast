-- ─────────────────────────────────────────────────────────────
-- P0.3.a Consistency Rule — one-shot backfill for ChallengeDailyPnL.
--
-- Aggregates existing Trade rows into per-(challenge, UTC date) buckets.
-- Idempotent: re-runs upsert via ON CONFLICT (challengeId, date) DO UPDATE,
-- so it is safe to execute multiple times.
--
-- Source filter:
--   - Trade."realizedPnl" IS NOT NULL  (excludes 'buy' events and historical
--     sells/resolves written before Session 14 — those have NULL by design,
--     per Q6.a decision; consistency history starts from new data only).
--   - Trade."challengeId" IS NOT NULL  (excludes sandbox-mode trades not tied
--     to a challenge — nothing to consistency-check).
--
-- Mirror of: src/app/api/cron/daily-pnl-aggregate/route.ts (incremental cron)
--            src/lib/consistency.ts → computeConsistencyLive() (live read)
-- Same aggregation formula in all three; keep them in sync.
--
-- Day-grouping formula: DATE("createdAt") — direct, NOT `AT TIME ZONE 'UTC'`.
-- Trade.createdAt is `timestamp without time zone`; Prisma writes UTC
-- wall-clock; DATE() extracts the UTC date with no TZ conversion. Using
-- AT TIME ZONE 'UTC' would convert via session TZ and break if session TZ
-- ≠ UTC. See ChallengeDailyPnL model comment in prisma/schema.prisma.
--
-- Scope:
--   - ALL challenges with history (active, passed, failed, expired) — no
--     status filter. The cron endpoint (Step 6) handles only active going
--     forward; this script is one-shot historical backfill.
--
-- Run manually as Alexey, on dev:
--   ssh ff-dev
--   docker exec -i $(docker ps --filter 'label=coolify.resourceName=postgres-dev' \
--     --format '{{.Names}}' | head -n1) \
--     psql -U postgres -d fundedforecast < scripts/backfill-daily-pnl.sql
--
-- Or via the dev-psql helper:
--   dev-psql -f /path/to/scripts/backfill-daily-pnl.sql
--
-- Expected output today (Session 14 commit): 0 INSERT, 0 UPDATE — all
-- existing Trade.realizedPnl values are NULL. The script becomes useful
-- once new sells/resolves accumulate, or if historical PnL is materialized
-- later by a separate one-shot migration.
-- ─────────────────────────────────────────────────────────────

BEGIN;

INSERT INTO "ChallengeDailyPnL" (
  "challengeId",
  "date",
  "dailyPnl",
  "dailyTrades",
  "isWinningDay",
  "createdAt",
  "updatedAt"
)
SELECT
  "challengeId",
  DATE("createdAt")               AS "date",
  SUM("realizedPnl")              AS "dailyPnl",
  COUNT(*)::int                   AS "dailyTrades",
  SUM("realizedPnl") > 0          AS "isWinningDay",
  NOW()                           AS "createdAt",
  NOW()                           AS "updatedAt"
FROM "Trade"
WHERE "realizedPnl" IS NOT NULL
  AND "challengeId"  IS NOT NULL
GROUP BY "challengeId", DATE("createdAt")
ON CONFLICT ("challengeId", "date") DO UPDATE
SET
  "dailyPnl"     = EXCLUDED."dailyPnl",
  "dailyTrades"  = EXCLUDED."dailyTrades",
  "isWinningDay" = EXCLUDED."isWinningDay",
  "updatedAt"    = NOW();

COMMIT;

-- Summary of resulting state — handy for verifying after the run.
SELECT
  COUNT(*)                                            AS total_rows,
  COUNT(DISTINCT "challengeId")                       AS challenges_covered,
  COALESCE(MIN("date")::text, '—')                    AS earliest_day,
  COALESCE(MAX("date")::text, '—')                    AS latest_day,
  COUNT(*) FILTER (WHERE "isWinningDay")              AS winning_days,
  COUNT(*) FILTER (WHERE NOT "isWinningDay")          AS non_winning_days
FROM "ChallengeDailyPnL";
