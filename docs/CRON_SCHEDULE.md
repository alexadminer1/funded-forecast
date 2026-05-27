# CRON_SCHEDULE.md

## Status
Last verified against Coolify UI: 2026-05-17 (Phase 4.A).
Mirrors Coolify Scheduled Tasks on `ff-sandbox-app`.
Source of truth: Coolify UI.

This file is git-tracked documentation, not an auto-sync source.
When schedule changes in Coolify — update this file manually in the same PR.

## Current scheduled tasks

| # | Coolify task name      | Endpoint (in app)                                    | Schedule (UTC) | Purpose                                                              |
|---|------------------------|------------------------------------------------------|----------------|----------------------------------------------------------------------|
| 1 | watch-payments         | GET /api/cron/watch-payments                         | `* * * * *`     | Scan on-chain USDC transfers, match to pending Payments              |
| 2 | activate-payments      | GET /api/cron/activate-payments                      | `* * * * *`     | Convert CONFIRMED Payment -> Challenge (creates BalanceLog seed)     |
| 3 | expire-payments        | GET /api/cron/expire-payments                        | `* * * * *`     | Expire Payments past `expiresAt` if still AWAITING_PAYMENT           |
| 4 | sync-prices            | GET /api/cron/sync                                   | `*/15 * * * *`  | Pull Polymarket prices into Market table                             |
| 5 | expire-challenges      | POST /api/admin/expire-challenges                    | `0 * * * *`     | Mark active Challenges as failed past `expiresAt`                    |
| 6 | cleanup-stale-markets  | POST /api/admin/cleanup-stale-markets                | `0 * * * *`     | Auto-resolve markets closed on Polymarket (P0.2.e, commit ff54927)   |
| 7 | end-of-day-check       | GET /api/cron/end-of-day-check                       | `55 23 * * *`   | Daily activity check — fail challenges per rules #7, #8 (Phase 4.A)  |
| 8 | affiliate-hold         | POST /api/admin/affiliate-hold (verify path)         | `0 3 * * *`     | Daily affiliate ledger hold/release transitions                       |
| 9 | live-price-sync        | GET /api/cron/live-price-sync                        | `* * * * *`     | Background sync of Polymarket prices for markets with open positions (6 internal ticks/min ≈ 10s freshness) |

Notes:
- `cleanup-stale-markets` schedule confirmed working (Session 10, 128 markets resolved).
- `end-of-day-check` MUST run BEFORE UTC midnight. Grace day logic compares
  `challenge.startedAt` against today's UTC midnight; if cron runs at or
  after 00:00 UTC, grace boundary breaks. Recommended schedule: `55 23 * * *`.
- `inactivity-check` was removed in Phase 4.A (2026-05-17). The 72h/120h
  hour-based fail was replaced by daily `end-of-day-check`. Coolify task
  for `inactivity-check` must be removed manually.

## Known issues / verifications pending

### Header comments in code
Several cron endpoints lack a header comment with their schedule:
`expire-challenges`, `affiliate-hold`, `cleanup-stale-markets`. Worth
adding for self-documentation. Tracked as post-Phase-0.9 housekeeping
(not P0 blocker).

### Curl invocation flags in Coolify GUI
SESSION_LOG (Session 14) noted inconsistent curl flags between scheduled
commands (`-sf` vs `-fsS`). Functional, but `-fsS` is preferred for error
visibility in execution logs. Aligning is a Coolify GUI edit, not code.

## Future additions

Per BUSINESS_RULES.md (12 rules):
- `end-of-challenge-finalize` schedule TBD — rules #9-12 finalization on Day 10 23:59 UTC

Per Wallet model (post P1.0):
- No new crons expected from wallet isolation work itself.

## Maintenance protocol

When adding a new cron endpoint:
1. Add a header comment in `src/app/api/cron/<name>/route.ts` (or
   `src/app/api/admin/<name>/route.ts`) stating the schedule and purpose.
2. Create Coolify Scheduled Task with the same schedule.
3. Add a row to the table above in the same PR.

When changing schedule of an existing one:
1. Update the header comment in the route file.
2. Update Coolify.
3. Update this file.

## Changelog
- 2026-05-17: Phase 4.A — replaced `inactivity-check` (row 7) with
  `end-of-day-check` (`55 23 * * *`). Removed inactivity-related "Known
  issues" subsection. Moved `end-of-day-check` out of "Future additions"
  (now active).
- 2026-05-15: Initial version (Phase 0.9). Compiled from SESSION_LOG entries
  dated 2026-05-12 (Session 9-10) and BUSINESS_RULES.md.
