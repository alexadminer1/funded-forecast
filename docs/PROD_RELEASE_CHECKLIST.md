# Production Release Checklist

Checklist Alexey works through before every `develop → main` production release.
Used as the single source of truth for the release procedure: skipping items is
not allowed. Claude Code does NOT execute this checklist — only Alexey does.

---

## 1. Pre-merge verification (on develop)

- [ ] Smoke test passed on https://dev.tradepredictions.online
- [ ] `npm run build` succeeds in `app-dev`
- [ ] `npx tsc --noEmit` clean (no type errors)
- [ ] All new env vars introduced on `develop` are added to `ff-sandbox-app` in Coolify
- [ ] All required DB migrations (ALTER TABLE statements) are documented and ready to apply

---

## 2. Database migrations

- [ ] List of SQL statements to run on `ff-sandbox-db` collected from latest commits
- [ ] Each statement reviewed for idempotency (`IF NOT EXISTS`, `IF EXISTS`)
- [ ] Destructive operations (`DROP COLUMN`, `DROP TABLE`, `TRUNCATE`) flagged separately
- [ ] Migration plan defined: which statements run BEFORE deploy, which AFTER

---

## 3. Backup

- [ ] Manual `pg_dump` of `ff-sandbox-db` saved with timestamp (e.g. `ff-sandbox-db-YYYYMMDD-HHMM.sql`)
- [ ] Backup file location documented (path on VPS or external storage)
- [ ] Backup size verified — not zero bytes, plausible compared to previous backups

---

## 4. Merge to main

- [ ] PR `develop → main` created on GitHub
- [ ] Self-approve (Alexey)
- [ ] Merge strategy: **Merge commit** (NOT squash — preserves history)
- [ ] Wait for merge confirmation on GitHub

---

## 5. Deploy

- [ ] Pre-deploy DB migrations applied via Coolify DB Terminal (if any are marked pre-deploy)
- [ ] Manual **Deploy** button clicked in Coolify for `ff-sandbox-app`
- [ ] Build logs monitored — no errors
- [ ] Container restarted successfully (verified via `docker ps` showing the new image / fresh `Up` time)

---

## 6. Post-deploy verification

- [ ] https://tradepredictions.online loads (HTTP 200, no 5xx)
- [ ] Auth flow works (login as `testuser2026`)
- [ ] Critical endpoints respond 200:
  - [ ] `/api/user/me`
  - [ ] `/api/markets`
  - [ ] `/api/cron/sync` (manual GET with cron secret)
- [ ] Cron jobs visible in Coolify scheduled tasks tab — no failures in the last hour
- [ ] Post-deploy DB migrations applied (if any)

---

## 7. Rollback plan

### Scenario A — Code-only rollback (no schema changes)

1. On `main`, revert the merge commit: `git revert -m 1 <merge-sha>` and push
2. Click **Deploy** manually in Coolify for `ff-sandbox-app`
3. Verify https://tradepredictions.online is back on the previous version

### Scenario B — Schema rollback (migrations were applied)

1. Restore `ff-sandbox-db` from the `pg_dump` backup taken in section 3, e.g.:
   ```
   psql -h <host> -U <user> -d fundedforecast < ff-sandbox-db-YYYYMMDD-HHMM.sql
   ```
2. Revert the merge commit on `main` (as in Scenario A)
3. Redeploy `ff-sandbox-app` via Coolify

**Note:** if a migration was destructive (`DROP COLUMN`, `DROP TABLE`), rollback
is possible **only** through restore from the backup — there is no in-place
recovery path.

---

## 8. Communication

- [ ] Notify Architect (Claude in separate chat) about the release
- [ ] Update `docs/SESSION_LOG.md` with a release entry containing:
  - Timestamp (UTC)
  - List of merged commits (range `prev-main..new-main`)
  - Migrations applied (SQL statements)
  - Observed issues, if any
