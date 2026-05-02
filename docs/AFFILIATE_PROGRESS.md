# Affiliate Program MVP — Progress

Project: FundedForecast prop-firm platform
Branch: feature/affiliate-program
Started: 2026-04-30
Last commit: a460ea3 (Step 5B-2)

---

## Stack
Next.js 16 + Prisma + Supabase Postgres 17 + Vercel Hobby + NOWPayments
Custom JWT auth (src/lib/auth dot ts — sync verifyToken)
Admin auth: x-admin-key header against ADMIN_API_KEY env

## Database
- Session pooler port 5432 for pg_dump
- Transaction pooler port 6543 for app
- DATABASE_URL in dot env
- Never use prisma migrate dev, only npm run db:push

---

## Completed Steps

| Step | Description | Commit |
|---|---|---|
| 1 | Prisma schema: 8 enums + 5 models, RLS enabled | cbe5a80 |
| 2 | constants and ledger helpers | 842c59f |
| 3 | /r/[code] route + cookie tracking | 18962f8 |
| 4 | POST /api/affiliate/attach-click | b2a4463 |
| 5A | attribution + payment/create attach hook + test script | 2274690 |
| 5B-1 | conversions helper + isolated test (10 PASS) | a1f4978 |
| 5B-2 | Webhook integration (1 try/catch) | a460ea3 |

Money flow wired end-to-end: click then cookie then attach then webhook then conversion + ledger + balance.

---

## Remaining Steps

- Step 6: /api/affiliate/apply + /me + admin approve/reject + applications list
- Step 7: Affiliate cabinet UI
- Step 8: Admin affiliate UI
- Step 9: 5 cron jobs + GitHub Actions
- Step 10: /affiliates landing + Terms/Privacy
- Step 11: E2E full-flow test

---

## Architecture Decisions (FINAL)

### Tiers and Commission
- Starter 10% / Bronze 15% / Silver 20% / Gold 25%
- Hard cap: 30% of net revenue
- MVP: netAmount equals payment amount (no fees subtracted yet)

### Hold Periods
- Default: 30 days
- Verified affiliate: 14 days (90d + 10 sales + 0 fraud + max 2 percent fraud rate)
- Suspicious: 45 days

### Attribution
- Last-click wins
- 60-day cookie
- 10-min grace period
- Only first successful purchase commissionable
- Sub-affiliate 5 percent / 12mo RESERVED in schema, no logic in MVP

### Payouts (NOT YET IMPLEMENTED)
- Manual trigger
- 1st and 15th of month
- Min 100 USD TRC-20 / 200 USD ERC-20
- KYC manual via email at 500 USD first / 1000 USD lifetime
- Wallet change: 7-day lock + manual review

### Conversion State Machine
pending then approved (after hold + activity check)
        then pending_review (60d stale)
        then rejected (refund/fraud)
pending/pending_review/approved then frozen then previousStatus or rejected
approved then paid (only after AffiliatePayout status equals completed)
paid then clawback (refund/fraud post-payout, goes to negative bucket)

### Payout State Machine
requested then approved then processing then completed (ledger movement only here)
requested/approved then cancelled
processing then failed (returns conversions, clears payoutId)

### Cron Jobs (Phase 1, 5 total)
- C1 process-pending: 03:00 UTC daily
- C2 check-stale: 06:00 UTC daily
- C3 reconcile-balances: 04:00 UTC daily
- C4 recalculate-tiers: 1st of month
- C5 cleanup-clicks: Sunday weekly

GitHub Actions, CRON_SECRET Bearer auth.

### Allowed Integration Points (only 3, already used)
1. prisma/schema dot prisma — new models at end (DONE)
2. webhook route — one try/catch hook (DONE)
3. payment/create route — one try/catch attach call (DONE)

---

## Existing Project Context (Important Quirks)

- verifyToken returns userId or null, sync, no exception
- Auth pattern in routes: req headers get authorization slice 7 then verifyToken
- Admin auth: x-admin-key header, NO User role field
- NOWPayments webhook idempotency via ProcessedStripeEvent table
- Successful payment statuses (verbatim from webhook line 63): "confirmed" and "finished"
- Existing cron pattern: Authorization Bearer CRON_SECRET, maxDuration 30s
- Upstash Redis ratelimit: limiters by pathname only, no custom-key
- CookieBanner uses localStorage only — affiliate aff_id is functional cookie
- Next dot js 16: cookies from next/headers is async, request cookies get is sync
- Register requires: email, password (min 10 chars + upper/lower/digit), username (a-zA-Z0-9_, no hyphens), firstName, lastName, acceptedPayoutRules, acceptedPrivacy
- ChallengePlan id=1 ("Starter", 39.99 USD) exists for tests
- Visual style: inline styles only, palette bg #060a10, accent #22C55E

---

## Affiliate Schema Field Lists

### Affiliate (28 fields)
Confirmed at Step 1. Key fields:
- id, userId @unique, refCode @unique
- status: AffiliateStatus (pending/approved/rejected/banned)
- tier: String (starter/bronze/silver/gold)
- customCommissionRate: Float optional
- suspiciousFlag: Boolean, isVerified: Boolean
- acceptedTermsAt: DateTime
- applicationData: Json
- balancePending, balanceAvailable, balanceFrozen, balanceNegative (Float, cached)
- createdAt, updatedAt

NOT in schema: approvedBy, approvedAt, rejectedAt, reviewNote, acceptedTermsVersion. If needed for Step 6, must be added.

### AffiliateConversion (paymentId @unique — idempotent)
### AffiliateLedger (append-only, 4 buckets, 10 types)
### AffiliateClick (16 fields, indexes on expiresAt/cookieId)
### AffiliatePayout (21 fields, NOT YET TOUCHED)

Full schema: see prisma/schema dot prisma

---

## Test Scripts

### scripts/test-affiliate-flow dot ts
- Tests /r/[code] then click then attach then payment/create chain
- 7 PASS
- Run: TEST_USER_EMAIL=... TEST_USER_PASSWORD='...' npx tsx scripts/test-affiliate-flow dot ts

### scripts/test-affiliate-conversion dot ts
- Tests recordAffiliateConversionFromPayment isolated
- 10 PASS (happy path, idempotency, not-first-purchase, self-referral, no-attribution)
- Run: npx tsx scripts/test-affiliate-conversion dot ts

All test data prefix: TEST_AFF_ or test-aff-*. Tests clean up after themselves.

---

## Known Quirks and Workarounds

### Markdown auto-link bug in user's chat client
User's terminal/chat client auto-converts dotted patterns to markdown links during copy:
- payment dot id becomes a markdown link
- f dot read becomes a markdown link

Workarounds:
- Use chr(46) instead of literal dot in Python heredocs
- Use hex 2e in perl regex
- Heredoc with quoted EOF prevents shell substitution
- File on disk usually correct; markdown only in display

### Backup/Restore
- Git tag pre-affiliate-v1 (rollback point)
- Backups in ~/funded-backups/

---

## Process Rules (How We Work)

### Roles
- This chat (Claude): architecture, business logic, code review, prompts
- Claude Code in terminal: actual coding, migrations, deploy
- User (Alexey, not a programmer): runs commands, verifies, brings outputs between chats

### Communication
- Russian language
- One step at a time, wait for confirmation
- Mark documents: arrow-out (for Claude Code, copy verbatim) or list (for user)
- Each terminal command starts with cd ~/funded-app and-and

### Discovery / Implementation Pattern
1. Plan step in this chat (architecture + risks)
2. Write strict prompt for Claude Code with pre-check
3. Pre-check from Claude Code with concrete data (not "all good")
4. Code review before save
5. Save then build then test then commit then push
6. Verify with reproducible test script
