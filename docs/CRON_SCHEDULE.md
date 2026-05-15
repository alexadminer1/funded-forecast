# CRON_SCHEDULE.md

## Status
Last verified against Coolify UI: 2026-05-12 (per SESSION_LOG Session 9-10).
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
| 7 | inactivity-check       | POST /api/admin/inactivity-check (verify path)       | `0 * * * *`     | LEGACY (72h/120h inactivity). Replaced by end-of-day cron in new model. |
| 8 | affiliate-hold         | POST /api/admin/affiliate-hold (verify path)         | `0 3 * * *`     | Daily affiliate ledger hold/release transitions                       |

Notes:
- `cleanup-stale-markets` schedule confirmed working (Session 10, 128 markets resolved).
- `inactivity-check` is legacy — BUSINESS_RULES.md replaces 72h/120h with daily
  cron (`end-of-day-check`, schedule `55 23 * * *`, to be added in Phase 4).
  Decision on disabling `inactivity-check` deferred to Phase 4.

## Known issues / verifications pending

### `inactivity-check`
- Status: LEGACY rule. Per BUSINESS_RULES.md (2026-05-15) the 72h/120h timer
  is replaced by per-day cron checks. Task remains scheduled in Coolify.
- Action: disable / remove in Phase 4 alongside `end-of-day-check` rollout.

### Header comments in code
Several cron endpoints lack a header comment with their schedule:
`expire-challenges`, `affiliate-hold`, `cleanup-stale-markets`,
`inactivity-check`. Worth adding for self-documentation. Tracked as
post-Phase-0.9 housekeeping (not P0 blocker).

### Curl invocation flags in Coolify GUI
SESSION_LOG (Session 14) noted inconsistent curl flags between scheduled
commands (`-sf` vs `-fsS`). Functional, but `-fsS` is preferred for error
visibility in execution logs. Aligning is a Coolify GUI edit, not code.

## Future additions (post-Phase-1)

Per BUSINESS_RULES.md (12 rules, end-of-day & end-of-challenge cron):
- `end-of-day-check`         schedule `55 23 * * *` UTC — rule 7-8 (no activity / volume < min)
- `end-of-challenge-finalize` schedule TBD            — rules 9-12 on Day 10 23:59 UTC

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
- 2026-05-15: Initial version (Phase 0.9). Compiled from SESSION_LOG entries
  dated 2026-05-12 (Session 9-10) and BUSINESS_RULES.md.
