# Phase 4.0 Audit — Position isolation

## Date
2026-05-18

## Phase
Phase 4.0 — Position isolation audit (READ-ONLY)
Branch: `feature/p0-3-c-position-audit`
Parent: PHASE_KIT.md v2
Source of truth: BUSINESS_RULES.md + PHASE_4_0_BRIEF.md
Predecessor: Phase 4.A merged (develop @ 4b472cb)

## Methodology
Two-stage process:
1. Claude Code collected raw findings from codebase (`/tmp/phase-4-0-raw-findings.md`) — facts only, no severity ratings, no recommendations.
2. Architect (separate review session) classified severity, identified cross-cutting patterns, formulated remediation scope.

Files read in full: `prisma/schema.prisma`, both trade endpoints, `src/lib/marketResolve.ts`, `src/lib/challengeStatus.ts`, `src/lib/payment/activation.ts`, all three admin resolve/expire endpoints, both lifecycle crons (`expire-challenges`, `end-of-day-check`), `src/app/api/user/positions/route.ts`, `mode/route.ts`, `stats/route.ts`, `admin/users/[id]/action/route.ts`. Full list in raw findings file (lines 1033-1054).

Note: brief had escaped pipes (`\|`) in 5 rg commands. Used corrected PCRE2 syntax. Brief preserved as historical record.

---

## Executive summary

**13 findings:** 2 CRITICAL, 5 HIGH, 4 MEDIUM, 2 LOW.

**Business invariant (from product owner):** open positions on ended challenges must be read-only, must not touch other balances (sandbox / new challenge), must remain attributed to the originating challenge in audit trail.

**Verdict:** The invariant is **partially** violated by current code. Critical-severity violations exist in `marketResolve.ts` (running balance chain not scoped by `challengeId`, and Trade/BalanceLog/realizedPnl rows are still inserted against ended-challenge positions). Both are active bugs running on dev today.

**Two-phase remediation required:**

### Pre-Phase-4.B emergency fixes — Phase 4.A.2 (HOT-FIX)

Two CRITICAL findings (#1, #2) are bugs corrupting the audit trail and balance chain right now. They cannot wait the 2-3 days Phase 4.B needs. A separate short hot-fix phase (Phase 4.A.2) must land first:

- **Fix `marketResolve.ts:65-69`**: scope `lastLog` lookup by `challengeId` (currently userId-only → cross-pollutes sandbox and challenge balance chains).
- **Fix `marketResolve.ts:77-117`**: when `position.challengeId` references a non-active challenge, skip Trade insert + BalanceLog insert + Position.realizedPnl assignment entirely. Currently only the Challenge balance update is gated; the audit-trail rows go in regardless and ChallengeDailyPnL cron retroactively picks them up.

Scope details in Phase 4.A.2 section below.

### Phase 4.B (planned)

End-of-challenge finalize + position isolation guards. Built around an **auto-close-at-finalize** pattern: open positions are closed at the last known market price (with sell spread) at the moment a challenge transitions to a terminal status. This converts ghost positions into proper closed rows with PnL attributed to the originating challenge before that challenge is finalized.

Scope details in Phase 4.B section below.

### Findings overview

| # | Severity | Title | Phase |
|---|---|---|---|
| 1 | CRITICAL | `marketResolve.ts` writes Trade + BalanceLog + realizedPnl to ended-challenge audit trail | 4.A.2 |
| 2 | CRITICAL | `marketResolve.ts` runningBalance chain not scoped by challengeId | 4.A.2 |
| 3 | HIGH | Sell rejects old-challenge positions via incidental `POSITION_NOT_FOUND`, not explicit guard | 4.B |
| 4 | HIGH | `cron/expire-challenges` and `cron/end-of-day-check` don't close positions | 4.B |
| 5 | HIGH | Open positions of failed/expired challenges become ghost rows (invisible to UI, unsellable) | 4.B |
| 6 | HIGH | Status-flip in buy/sell catch handlers is non-transactional split | 4.B |
| 7 | HIGH | `Market.status="resolved"` update and `resolveMarketPositions` not in single tx | 4.B (defer ok) |
| 8 | MEDIUM | No DB-level uniqueness on `(userId)` for active Challenge rows | TECH-DEBT |
| 9 | MEDIUM | `findFirst({status:"active"})` undefined ordering when multiple active rows exist | TECH-DEBT (resolved by #8) |
| 10 | MEDIUM | `Position.status`, `Challenge.status`, `Trade.action`, `BalanceLog.type` are bare String (no enum, no CHECK) | TECH-DEBT |
| 11 | MEDIUM | All time checks use container-local JS `new Date()`, no DB `NOW()` | TECH-DEBT |
| 12 | LOW | `/api/user/positions` doesn't return historical (closed/resolved) positions | TECH-DEBT |
| 13 | LOW | `D1` endpoint has unresolved `// TODO [A1]: replace with native walletId filter` | TECH-DEBT |

---

## Block A — Trade flow

### A1. Sell endpoint — `src/app/api/trade/sell/route.ts`

**Position lookup** (`sell/route.ts:183-185`):
```ts
const position = await tx.position.findFirst({
  where: { userId, marketId, side, challengeId, status: "open" },
});
```

`challengeId` filter is present. Source: `findFirst({ where: { userId, status: "active" } })` at line 165-168 → `activeChallenge?.id ?? null`. If no active challenge → `challengeId = null` → query filters Position.challengeId IS NULL.

**Consequence (factual):** user with a `failed/expired/passed` challenge holding open positions cannot sell them — `findFirst({ status: "active" })` returns null, lookup filters by `challengeId: null`, the open position with non-null challengeId is not found → `POSITION_NOT_FOUND` thrown at line 187.

This **happens** to satisfy the business invariant ("sell of old positions — reject") but **incidentally**, not by explicit guard. See finding #3.

**Challenge status check:** none separately. The `findFirst({ status: "active" })` query is the only filter.

**expiresAt check** (`sell/route.ts:170-172`): present. Time source `new Date()` (JS). On throw → bare `prisma.challenge.update` in catch handler at line 510-533 (non-transactional, see finding #6).

**PnL target:** active challenge id (= `position.challengeId` necessarily, since lookup enforces). Three writes inside main tx:
- BalanceLog `challengeId` ← local active id (line 243-252)
- Challenge.realizedBalance update gated by `if (activeChallenge && challengeId)` (line 301-304)
- Trade `challengeId` ← local active id (line 221-230)

**Transaction wrapper:** entire main flow inside `prisma.$transaction(async (tx) => {...})` (`sell/route.ts:164-394`). Status-flip in catch handlers (line 485-494, 512-519) is OUTSIDE this tx — see finding #6.

**Time source:** all `new Date()` (JS clock). No DB `NOW()`.

### A2. Buy endpoint — `src/app/api/trade/buy/route.ts`

**Position.challengeId on create** (`buy/route.ts:351-361`): set to `activeChallenge?.id ?? null` (line 227). Sandbox positions get NULL.

**Mode discriminator** (`buy/route.ts:223-227`): identical pattern to sell. Presence of `Challenge` row with `status="active"`. No request-body field, no header, no User column. Same in sell, user/me, user/mode, user/positions, etc.

**Status / expiresAt checks** (`buy/route.ts:229-243`): expiresAt check present (line 229), MarketEndedError check present (line 241). Both use `new Date()`. No explicit status check (covered by `findFirst({ status: "active" })`).

**Transaction wrapper:** `prisma.$transaction(async (tx) => {...}, { timeout: 15000 })` at lines 223-475. Status-flip in catch handlers (line 572-581, 597-606) is OUTSIDE — see finding #6.

---

## Block B — Position resolve

### B1. Position resolve mechanism

Only ONE site sets `Position.status = "resolved"`: `src/lib/marketResolve.ts:108-117` (shared lib). `Position.status = "closed"` set in two places: `sell/route.ts:215` (full close via sell) and `admin/expire-challenges/route.ts:94` (admin expiry).

### B2. Market resolve flow — `src/lib/marketResolve.ts`

**NO `/api/cron/resolve-markets` exists.** Resolution runs via Coolify cron task (hourly, `0 * * * *`) hitting `POST /api/admin/cleanup-stale-markets` with `x-admin-key` header (per `docs/CRON_SCHEDULE.md:18`). Three admin endpoints invoke `resolveMarketPositions`:
- `src/app/api/admin/cleanup-stale-markets/route.ts:77` (scheduled)
- `src/app/api/admin/resolve-markets/route.ts:98` (manual bulk)
- `src/app/api/admin/markets/[id]/action/route.ts:71` (single-market force_resolve)

**Flow** (`marketResolve.ts`):
```
caller: prisma.market.update({ status: "resolved", winningOutcome, resolvedExternalAt })
    ↑ bare update, NOT in tx with what follows — see finding #7
resolveMarketPositions(marketId, winningOutcome, ...)
    ↓
prisma.position.findMany({ marketId, status: "open", resolvedAt: null })
    ↑ no challengeId filter (sweeps sandbox + all challenge positions for this market)
for each position:
    prisma.$transaction(async (tx) => {       ← per-position tx, marketResolve.ts:49
        fresh = tx.position.findUnique({ id })
        if (fresh.resolvedAt !== null) skip
        payout = isWinner ? shares * 1.0 : 0
        profit = payout - costBasis
        lastLog = tx.balanceLog.findFirst({
            where: { userId: fresh.userId },   ← finding #2: userId-only, NOT scoped by challengeId
            orderBy: { createdAt: desc }
        })
        trade = tx.trade.create({ challengeId: fresh.challengeId, realizedPnl: profit, ... })
        balanceLog = tx.balanceLog.create({ challengeId: fresh.challengeId, runningBalance, ... })
        tx.position.update({ status: "resolved", resolvedAt, shares: 0, realizedPnl, closedAt })
        if (fresh.challengeId) {
            challenge = tx.challenge.findUnique({ id: fresh.challengeId })
            if (challenge && challenge.status === "active") {    ← finding #1: gates ONLY balance update
                tx.challenge.update({ realizedBalance, peakBalance, peakEquity, resolvedPositionsCount })
                if drawdown violated → status = "failed", ...
                else → checkAndMarkPassed(tx, fresh.challengeId)
            }
            // else: challenge exists but NOT active → balance update skipped,
            //       BUT Trade and BalanceLog rows ALREADY inserted above
        }
    }, { timeout: 15000 })
```

**Target balance selection:** by `position.challengeId` (FK on the row), not by `user.activeChallenge`. `user.activeChallenge` is never consulted in `marketResolve.ts`.

**Behaviour for non-active source challenge:** balance update skipped (line 125 gate). But:
- `Trade` row (with `realizedPnl: profit`) — inserted (line 77-86)
- `BalanceLog` row (with `runningBalance` based on userId-wide lastLog) — inserted (line 94-105)
- `Position.realizedPnl` — assigned (line 113-114)
- `Position.status = "resolved"` — set (line 111)

ChallengeDailyPnL cron aggregates `Trade.realizedPnl WHERE realizedPnl IS NOT NULL GROUP BY challengeId` (`schema.prisma:300-310` comments + `cron/daily-pnl-aggregate/route.ts:71`) — picks up these post-finalize Trade rows and writes them to a `(challengeId, date)` unique row in `ChallengeDailyPnL`. **The audit trail of a finalized challenge can therefore change after finalization.**

See findings #1 and #2.

---

## Block C — Balance writes

### C1. Challenge.realizedBalance / peakBalance / peakEquity / startBalance

All assignment sites:

| file:line | trigger | target Challenge source | sandbox isolation |
|---|---|---|---|
| `payment/activation.ts:130-131` | Challenge create from Payment | new row | n/a |
| `marketResolve.ts:156-158` | Market resolve | `position.challengeId`, gated by `status === "active"` (line 125) | sandbox: position.challengeId=NULL → branch skipped (line 120) |
| `marketResolve.ts:163` | Drawdown violated during resolve | Same as above | Same gate |
| `trade/buy/route.ts:437` | Buy in challenge mode | `activeChallenge.id` (line 227, 436) | guarded by `if (activeChallenge && challengeId)` (line 396) |
| `trade/sell/route.ts:303` | Sell in challenge mode | Same as buy | Same guard (line 257) |
| `admin/expire-challenges/route.ts:104` | Admin expiry per-position loop | iterated row from findMany({ status: "active", expiresAt < now }) | Active+expired only |
| `admin/expire-challenges/route.ts:127` | Admin expiry final status | Same iteration | Same |
| `admin/users/[id]/action/route.ts:43` | Admin reset_balance | `activeChallenge.id` | Active only |
| `admin/users/[id]/action/route.ts:80` | Admin start_challenge | new row | n/a |
| `admin/users/[id]/action/route.ts:121` | Admin assign_plan | new row | n/a |

**NOT FOUND:** `startingBalance` (brief typo for `startBalance`).

### C2. Sandbox balance writes

**`sandboxBalance` is not a DB column.** Schema has no such column on User or Challenge. Sandbox balance is computed at read time from `BalanceLog.runningBalance` where `challengeId IS NULL` (`user/mode/route.ts:64-72`).

BalanceLog rows with `challengeId: null` written by:
- `register/route.ts:94-105` (registration seed, amount=10.00)
- `trade/buy/route.ts:384-393` (sandbox buy: local `challengeId = null`)
- `trade/sell/route.ts:243-252` (sandbox sell)
- `marketResolve.ts:94-105` (resolve of sandbox position: `position.challengeId` was null)
- `admin/users/[id]/action/route.ts:27-38` (admin reset_balance for sandbox user)

### C3. BalanceLog entries

All `balanceLog.create` sites (9 total). `challengeId` source for each — see raw findings lines 642-653. Critical observation: every challenge-mode trade writes `challengeId = activeChallenge.id`, and the runningBalance is read from a previous BalanceLog scoped to `userId + challengeId` in buy/sell — but **not** in `marketResolve.ts` (finding #2).

### C4. Raw SQL balance writes

**NOT FOUND.** All balance mutations go through Prisma ORM. Raw SQL is limited to advisory locks (`pg_advisory_xact_lock`), aggregation reads (`SUM(cost)`), and `ChallengeDailyPnL` INSERT (aggregation table, not a balance column).

### C5. Prisma increment/decrement

No `{ increment }` / `{ decrement }` on balance columns. All balance writes use explicit value assignment. Increment used only on counters: `version`, `tradingDaysCount`, `resolvedPositionsCount`, `errorCount`, `lifetimePaid`.

---

## Block D — UI/API positions

### D1. `/api/user/positions/route.ts` (132 lines, read in full)

Query at line 30-48:
```ts
const positions = await prisma.position.findMany({
  where: activeChallenge
    ? { userId, status: "open", challengeId: activeChallenge.id }
    : { userId, status: "open", challengeId: null },
  ...
});
```

- Returns only `status: "open"` positions.
- Filters by `activeChallenge.id` if user has active challenge; else by `challengeId: null` (sandbox).
- **Historical (closed/resolved) positions NOT returned.**
- **Open positions of failed/expired challenges NOT returned** — they're tied to a non-active challengeId that no longer matches `activeChallenge.id`.

TODO comment at line 24: `// TODO [A1]: replace with native walletId filter after wallet model implementation` — see finding #13.

### D2. UI components

- `src/app/dashboard/page.tsx`: line 93 fetches `/api/user/positions`, renders via `PositionRow`. No client-side filter for "current vs past". Sandbox sub-card shown only when `modeData.mode === "challenge"`.
- `src/app/markets/[id]/page.tsx`: line 215 fetches same endpoint, uses for full-sell enforcement in `TradeModal`.

No UI distinguishes current challenge positions from historical. Historical positions are simply invisible.

---

## Block E — Challenge lifecycle

### E1. Status mutations

All 14 sites where `Challenge.status` is mutated:

| file:line | trigger | new status | open positions handling | tx wrapper |
|---|---|---|---|---|
| `lib/challengeStatus.ts:63-69` | `checkAndMarkPassed`, called from `marketResolve.ts:172` | `"passed"` + endedAt | **Other open positions untouched** | Inside caller's tx |
| `marketResolve.ts:153-168` | Drawdown violated during resolve | `"failed"` + drawdownViolated + reason + endedAt | **Other open positions untouched**; CURRENT position resolved in same tx | Inside per-position tx |
| `trade/sell/route.ts:361-363` | Auto-pass on sell | `"passed"` + endedAt | **Open positions of this challenge untouched** | Inside main sell tx |
| `trade/sell/route.ts:485-494` (catch) | DrawdownViolatedError | `"failed"` + drawdownViolated + reason + endedAt | **Untouched**; main sell tx already rolled back | **NO** — bare update (finding #6) |
| `trade/sell/route.ts:512-519` (catch) | ChallengeExpiredError | `"failed"` + `"Challenge period expired"` + endedAt | **Untouched**; sell tx rolled back | **NO** (finding #6) |
| `trade/buy/route.ts:572-581` (catch) | DrawdownViolatedError | `"failed"` + drawdownViolated + reason + endedAt | **Untouched**; buy tx rolled back | **NO** (finding #6) |
| `trade/buy/route.ts:597-606` (catch) | ChallengeExpiredError | `"failed"` + reason + endedAt | **Untouched** | **NO** (finding #6) |
| `admin/expire-challenges/route.ts:42-44` | Stale market freeze | `"frozen"` | Skipped (first stale market breaks loop) | NO |
| `admin/expire-challenges/route.ts:125-128` | Admin expiry final | `"passed"` (if profit met) or `"expired"` | **Positions ALREADY closed** by per-position loop (lines 70-108) | NO for status, YES for per-position close |
| `cron/expire-challenges/route.ts:30-37` | Cron: expired challenges | `"failed"` + reason `"Challenge period expired"` + endedAt | **Open positions NOT closed** (finding #4) | NO |
| `cron/end-of-day-check/route.ts:108-115` | Phase 4.A end-of-day rule #7 | `"failed"` + reason (no trading / volume below min) + endedAt | **Open positions NOT closed** (finding #4) | NO |
| `admin/users/[id]/action/route.ts:54-57` | Admin `fail_challenge` | `"failed"` + drawdownViolated + `"Admin action"` + endedAt | Untouched | NO |
| `admin/users/[id]/action/route.ts:65-68` | Admin `pass_challenge` | `"passed"` + profitTargetMet + endedAt | Untouched | NO |
| `admin/users/[id]/action/route.ts:107-110` | Admin `assign_plan`: end existing | `"failed"` + `"Replaced by admin plan assignment"` + endedAt | Untouched | YES — inside tx that also creates replacement (line 103) |

**Pattern:** out of 14 status-mutation sites, only ONE (`admin/expire-challenges/route.ts:70-108`) closes open positions before flipping status. The other 13 leave open positions as-is. This is the root cause of finding #5.

### E2. New challenge activation flow

Three challenge-create paths:
- `lib/payment/activation.ts:99-178` (paid plan activation, advisory-lock protected)
- `admin/users/[id]/action/route.ts:77-92` (admin start_challenge, 10000 hardcoded)
- `admin/users/[id]/action/route.ts:113-142` (admin assign_plan, ends existing first)

**None of them touch `Position` rows.** Old positions retain original `challengeId`. No `User.activeChallengeId` column to flip. Active-challenge resolution is recomputed per-request via `findFirst({ status: "active" })`.

Concurrency: `payment/activation.ts` does not check for existing active challenge before creating new. Relies on advisory lock on `paymentId` (line 103) + `Payment.challengeId !== null` early-return (line 84). If another entry-point for challenge-creation ever appears without going through `activatePayment`, two active rows for one user becomes possible. See finding #8.

---

## Block F — Affiliate / payment (light touch)

Single read of `Challenge.realizedBalance` from affiliate/payout subsystem:

`src/app/api/user/payout/route.ts:150`:
```ts
const profit = round2(challenge.realizedBalance - challenge.startBalance);
```

`challenge` fetched at `:94-96` via `findFirst({ where: { id: challengeId, userId, status: "passed" } })` — `challengeId` from request body. Endpoint reads a specific challenge by id (filtered by status="passed"), NOT the active one. Affiliate ledger system (`AffiliateLedger`, `AffiliateConversion`) is decoupled from `Challenge` balances; conversion creation is fire-and-forget after `activatePayment` (`payment/activation.ts:194-198`).

**No affiliate code reads `Challenge.realizedBalance` or `peakBalance`.** Phase 4.0 audit of affiliate completes here; deeper audit is TASK-FINAL-1.

---

## Cross-cutting findings

### CC1. Time source

Every time check uses container-local JS `new Date()`. No `NOW()` / `CURRENT_TIMESTAMP` anywhere. 12 distinct check sites enumerated in raw findings lines 867-881. Container clock drift would shift all comparisons uniformly. Acceptable for current scale but documented. See finding #11.

### CC2. Transaction boundaries

Buy/sell flows wrap their main path in `$transaction`. **But** status-flip in catch handlers (DrawdownViolatedError, ChallengeExpiredError, and Market.status="resolved" before resolveMarketPositions) is a bare update OUTSIDE any tx. If the bare update fails after the main tx already rolled back, state is inconsistent:
- Challenge stays `"active"` with violated drawdown or past expiresAt → next trade hits same error → same bare update.
- Eventually consistent; window for repeated failed-state trades is open.

Full enumeration: raw findings lines 884-906. See finding #6, #7.

### CC3. Sandbox ↔ Challenge symmetry

**Challenge → Sandbox leak** (challenge-mode trade writing to sandbox BalanceLog/Position/Trade): **NOT FOUND.** All writes use local `challengeId` derived from `activeChallenge?.id ?? null`. When active challenge exists, all new rows have `challengeId = active.id`.

**Sandbox → Challenge leak** (sandbox trade writing to Challenge.realizedBalance): **NOT FOUND.** Update gated by `if (activeChallenge && challengeId)` at `buy/route.ts:396` and `sell/route.ts:257`.

**Resolve-time cross-pollution** (finding #2): `marketResolve.ts:65-69` reads `lastLog` scoped by `userId` only — runningBalance chain may span sandbox + challenge BalanceLog rows. This is the only real symmetry violation, and it's CRITICAL.

### CC4. Discriminator

Two different mechanisms in codebase:
- **Trade endpoints + read endpoints** (buy, sell, mode, positions, me, stats): discriminator = `Challenge.findFirst({ userId, status: "active" })` presence.
- **`marketResolve.ts`**: discriminator = `Position.challengeId` value (read from row itself).

Inconsistency is intentional (resolve needs to attribute PnL to the originating challenge, not the current active one) but creates the cracks exploited by findings #1, #2, #5.

---

## Findings — full detail

### CRITICAL

#### Finding #1 — Ended-challenge audit trail polluted on resolve
**Severity:** CRITICAL
**Files:** `src/lib/marketResolve.ts:77-117, 120-174`
**Phase:** 4.A.2 (hot-fix)

When `position.challengeId` references a Challenge with `status != "active"` (failed/passed/expired/frozen), the gate at line 125 (`if (challenge && challenge.status === "active")`) skips the Challenge balance update — but the lines before it still execute:
- `Trade` row created with `challengeId = position.challengeId` and `realizedPnl = profit` (line 77-86)
- `BalanceLog` row created with `challengeId = position.challengeId` (line 94-105)
- `Position.status = "resolved"`, `Position.realizedPnl = ...` (line 108-117)

Downstream: `cron/daily-pnl-aggregate/route.ts:71` aggregates `Trade.realizedPnl WHERE realizedPnl IS NOT NULL GROUP BY challengeId, DATE(createdAt)`. Trade rows inserted post-finalization land in `ChallengeDailyPnL`, modifying the finalized challenge's daily PnL history retroactively.

**Impact:** finalized challenge's audit trail (Trade rows, BalanceLog rows, ChallengeDailyPnL rows) changes after finalization. Payout calculation (`user/payout/route.ts:150`) reads `Challenge.realizedBalance` directly, so payouts are NOT corrupted — but reporting, accounting, and any future code reading Trade aggregates per challenge will see post-finalize mutations.

**Fix (Phase 4.A.2):** skip Trade insert + BalanceLog insert + Position.realizedPnl assignment when source challenge is non-active. Position should still flip to `"resolved"` to prevent re-processing, but with `realizedPnl = 0` (or a flag indicating "resolved post-finalize, PnL not credited"). Or: skip entire resolve for non-active-challenge positions — but only if Phase 4.B auto-close-at-finalize is in place (so positions never reach resolve in non-active state).

**Phase 4.A.2 decision required** (see Phase 4.A.2 section below).

#### Finding #2 — runningBalance chain not scoped by challengeId in resolve
**Severity:** CRITICAL
**Files:** `src/lib/marketResolve.ts:65-69`
**Phase:** 4.A.2 (hot-fix)

```ts
const lastLog = await tx.balanceLog.findFirst({
  where: { userId: fresh.userId },
  orderBy: { createdAt: "desc" },
  select: { runningBalance: true },
});
```

Filter is `userId` only. By contrast, `sell/route.ts:233-238` and `buy/route.ts:263-268` scope `lastLog` lookup by `userId + challengeId`.

**Impact:** the `BalanceLog.runningBalance` chain for a challenge can be derived from a sandbox `BalanceLog` row (or vice versa). Two scenarios:
- User has sandbox positions and an active challenge. Market resolves a sandbox position. The new BalanceLog's `balanceBefore` is read from whatever the latest BalanceLog is for that user — which may be a challenge-mode `trade_open` row. The sandbox runningBalance chain becomes nonsensical.
- Same in reverse: challenge position resolves, reads runningBalance from a sandbox row.

**Fix (Phase 4.A.2):** scope by `userId + challengeId` (exact equal or NULL):
```ts
where: { userId: fresh.userId, challengeId: fresh.challengeId }
```

### HIGH

#### Finding #3 — Sell rejects old-challenge positions via incidental POSITION_NOT_FOUND
**Severity:** HIGH
**Files:** `src/app/api/trade/sell/route.ts:165-187`
**Phase:** 4.B

Current behaviour satisfies the business invariant ("sell of old positions — reject") by accident: `findFirst({ status: "active" })` returns null for users with only failed/passed challenges, position lookup filters by `challengeId: null`, no row matches → throw `POSITION_NOT_FOUND`. Error message is misleading (position exists; it's just sealed off).

If discriminator mechanism ever changes (e.g. activeChallenge resolved differently, or multiple-active-challenges scenario per finding #9), invariant breaks silently.

**Fix (Phase 4.B):** explicit 3-condition guard before any sell work:
```ts
if (position.challengeId !== activeChallenge?.id) throw new ChallengeIsolationError();
if (activeChallenge.status !== "active") throw new ChallengeNotActiveError();
if (activeChallenge.expiresAt && now > activeChallenge.expiresAt) throw new ChallengeExpiredError();
```

#### Finding #4 — Cron lifecycle paths don't close positions
**Severity:** HIGH
**Files:** `src/app/api/cron/expire-challenges/route.ts:30-37`, `src/app/api/cron/end-of-day-check/route.ts:108-115`
**Phase:** 4.B

Both crons flip `Challenge.status` to terminal value (`"failed"`) without touching open positions. By contrast, `admin/expire-challenges/route.ts:70-108` (separate admin endpoint, not invoked by cron) DOES close positions in a per-position tx before final status.

**Impact:** ghost positions accumulate. See finding #5.

**Fix (Phase 4.B):** crons must invoke auto-close-at-finalize before status flip. Pattern reference: `admin/expire-challenges/route.ts:70-108`.

#### Finding #5 — Ghost positions on failed/expired challenges
**Severity:** HIGH
**Files:** Multiple — emergent behaviour from #4 + `user/positions/route.ts:30-48` + `marketResolve.ts:36-42`
**Phase:** 4.B

When a challenge fails/expires via cron path or buy/sell catch handler (findings #4, #6), its open positions remain in DB with `status="open", challengeId=<failed_id>`:
- `/api/user/positions` filters by active challenge id OR null → ghost positions invisible in UI.
- Sell endpoint can't find them (finding #3) → unsellable.
- When their market resolves: `marketResolve.ts:36-42` finds them via `findMany({ marketId, status: "open" })` (no challengeId filter), processes them under non-active-challenge branch → audit trail pollution (finding #1).
- They become "resolved" with realizedPnl assigned but no balance reflection anywhere.

**Fix (Phase 4.B):** auto-close-at-finalize. All positions get closed (status="closed", realizedPnl based on last market price minus sell spread) at the moment of status transition, in same tx as status flip. No position ever has `status="open"` + `challenge.status != "active"`.

#### Finding #6 — Non-transactional status-flip on trade errors
**Severity:** HIGH
**Files:** `trade/sell/route.ts:485-494, 512-519`, `trade/buy/route.ts:572-581, 597-606`
**Phase:** 4.B

Status-flip on `DrawdownViolatedError` and `ChallengeExpiredError` runs in the catch handler via bare `prisma.challenge.update` AFTER the main tx has rolled back. If this bare update fails (DB hiccup, connection dropped, etc.), challenge stays `"active"` with violated drawdown or past expiresAt. The next trade hits the same condition → same bare update → same risk.

Eventually consistent in practice but inconsistent during the window.

**Fix (Phase 4.B):** restructure so status transition happens in a fresh, wrapped tx (not as catch-handler bare update). Include auto-close-at-finalize in the same tx. If even this fails — log + alert, do not silently leave the challenge active.

#### Finding #7 — Market.status update and resolveMarketPositions not in single tx
**Severity:** HIGH (defer to Phase 4.B optional / TECH-DEBT)
**Files:** `admin/resolve-markets/route.ts:87-95`, `admin/cleanup-stale-markets/route.ts:65-73`, `admin/markets/[id]/action/route.ts:60-68`
**Phase:** 4.B (defer ok)

`Market.status="resolved"` is set via bare `prisma.market.update`, then `resolveMarketPositions` is called separately. Two-step. If process dies between them, market is resolved but positions remain `status="open"`. Recoverable by re-running resolve (positions still match `status="open"` filter), but window exists.

**Fix:** wrap both in single $transaction. Lower priority — recovery exists.

### MEDIUM

#### Finding #8 — No DB uniqueness on active Challenge per user
**Severity:** MEDIUM
**Files:** `prisma/schema.prisma:193-241`, `lib/payment/activation.ts:99-178`
**Phase:** TECH-DEBT

Schema has no `@@unique` partial index on `Challenge(userId) WHERE status = 'active'`. Current single-active invariant is enforced by:
1. Advisory lock on `paymentId` in `payment/activation.ts:103`.
2. `Payment.challengeId !== null` early-return at line 84.

This works for the paid-payment path. Any other entry-point (manual admin create, future feature, race in admin assign_plan) could create a second active row.

**Fix:** add partial unique index via UNMANAGED_DDL (Prisma DSL can't express partial). Schema reconciliation work.

#### Finding #9 — findFirst({status:"active"}) ordering undefined
**Severity:** MEDIUM
**Files:** Every site using `findFirst({ where: { userId, status: "active" } })` — 8+ locations
**Phase:** TECH-DEBT (resolved by #8)

If #8 is fixed (partial unique index), #9 is moot. Until then: `findFirst` without `orderBy` returns first row per Prisma's default ordering (implementation-defined). If multiple active rows ever exist, different code paths could see different "active" challenges.

#### Finding #10 — Status/type fields are bare String, not enum
**Severity:** MEDIUM
**Files:** `prisma/schema.prisma` — Position.status (line 25), Challenge.status (line 64), Trade.action (line 143), BalanceLog.type (line 117)
**Phase:** TECH-DEBT

No DB enum, no CHECK constraint. Code enforces value sets by convention. Typo would compile and pass tests for the path that wrote it; only readers would see the wrong value. `"frozen"` status appears in two places only (`admin/expire-challenges/route.ts:44`, `ChallengeFailedModal.tsx`) — other code paths don't handle it explicitly.

**Fix:** schema migration to Prisma enums for all four. Separate phase.

#### Finding #11 — Container-local JS clock for all time checks
**Severity:** MEDIUM
**Files:** 12 sites enumerated in CC1 above
**Phase:** TECH-DEBT

No use of Postgres `NOW()`. All time comparisons against `new Date()`. Container clock drift would shift uniformly, so internal consistency holds, but external comparisons (e.g. external Polymarket events with their own timestamps) could misalign.

**Fix:** introduce `getNow()` helper centralized + optionally back it with DB time. Lower priority.

### LOW

#### Finding #12 — /api/user/positions doesn't return historical
**Severity:** LOW
**Files:** `src/app/api/user/positions/route.ts:30-48`
**Phase:** TECH-DEBT (UI)

Endpoint returns only `status: "open"`. User cannot see their past resolved/closed positions through this endpoint. Other endpoints (`user/stats/route.ts:15`) sum closed positions but don't list them.

**Fix:** add `?include=history` flag or separate endpoint.

#### Finding #13 — Unresolved TODO for walletId filter
**Severity:** LOW
**Files:** `src/app/api/user/positions/route.ts:24`
**Phase:** TECH-DEBT

`// TODO [A1]: replace with native walletId filter after wallet model implementation` — architectural note pointing to future wallet model. Not a bug. Tracked.

---

## Pre-Phase-4.B blockers — Phase 4.A.2 (HOT-FIX)

Two CRITICAL findings are bugs running on dev today. They must be fixed before Phase 4.B work begins.

**Scope:**

### Phase 4.A.2 Task 1 — Fix runningBalance chain scope
**File:** `src/lib/marketResolve.ts:65-69`
**Change:** add `challengeId: fresh.challengeId` to where clause. Verify Prisma matches NULL exactly.

### Phase 4.A.2 Task 2 — Decision on resolve writes for ended-challenge positions

Two options, pending architect + product owner decision:

**Option A — Skip resolve entirely for non-active challenge positions:**
- Gate the whole resolve loop body on `challenge.status === "active"`.
- Positions stay `status="open"` after market resolution if their challenge is ended.
- Requires Phase 4.B auto-close-at-finalize to ensure no position ever reaches resolve in non-active state. Standalone, this option creates orphan positions for any challenge ended before its open markets resolved.

**Option B — Resolve but don't write audit trail to ended challenge:**
- Gate is moved earlier (before Trade insert at line 77).
- Position flips to `"resolved"` with `realizedPnl = 0` (or a marker).
- No Trade row, no BalanceLog row, no balance update.
- Audit trail is silent about post-finalize resolves.

**Recommendation:** Option A, but only if it's deployed as part of a coordinated 4.A.2 + 4.B sequence where 4.B's auto-close lands within days. If 4.B will slip, go with Option B as standalone safety net.

### Phase 4.A.2 deliverable

- 2 file changes (`marketResolve.ts` only — Task 1 + Task 2).
- 1 test for the chain-scope fix.
- 1 test for the ended-challenge resolve behaviour matching the chosen option.
- No new tables, no migrations, no UI changes.
- Estimated 0.5-1 day with Claude Code.

### Phase 4.A.2 acceptance criteria

- New BalanceLog rows during resolve have `runningBalance` derived from a same-`(userId, challengeId)` predecessor only.
- (Option A) No Trade / BalanceLog / Position state change occurs for positions whose `challengeId` references non-active challenge.
- (Option B) Position flips to `"resolved"` with `realizedPnl = 0`, no Trade or BalanceLog row written.
- ChallengeDailyPnL cron output for finalized challenges remains stable after subsequent market resolutions.

---

## Phase 4.B scope recommendation

Phase 4.B focuses on **end-of-challenge finalize + isolation guards**. Core pattern: **auto-close-at-finalize** — at every status transition from `"active"` to terminal, close all open positions of that challenge in the same transaction, attributing PnL to the originating challenge based on last known market price minus sell spread.

### Phase 4.B Must

1. **New cron `end-of-challenge-finalize`** implementing rules #9-12 from BUSINESS_RULES.md.

2. **Auto-close-at-finalize implementation** — shared function (reference: `admin/expire-challenges/route.ts:70-108`). Applied at:
   - New cron `end-of-challenge-finalize`
   - `cron/expire-challenges/route.ts:30-37` — invoke auto-close before status flip (fixes finding #4)
   - `cron/end-of-day-check/route.ts:108-115` — same (fixes finding #4)
   - `trade/sell/route.ts:485-494, 512-519` (catch handlers) — invoke auto-close in fresh wrapped tx (fixes finding #6)
   - `trade/buy/route.ts:572-581, 597-606` (catch handlers) — same (fixes finding #6)
   - `lib/challengeStatus.ts:checkAndMarkPassed` — auto-close before passing
   - `marketResolve.ts:153-168` — auto-close other open positions of this challenge when drawdown violation flips it to failed
   - `admin/users/[id]/action/route.ts:54-57, 65-68, 107-110` — apply to admin force-status actions
   - `admin/expire-challenges/route.ts` — already has it, refactor to use shared function

3. **Explicit sell guard** at `trade/sell/route.ts` (fixes finding #3):
   ```ts
   if (!position) throw new PositionNotFoundError();
   if (position.challengeId !== activeChallenge?.id) throw new ChallengeIsolationError();
   if (activeChallenge && activeChallenge.status !== "active") throw new ChallengeNotActiveError();
   if (activeChallenge?.expiresAt && new Date() > activeChallenge.expiresAt) throw new ChallengeExpiredError();
   ```
   Distinct error codes for each, distinct UI messages.

4. **Wrap status transitions in $transaction** (fixes finding #6, partial fix for #7):
   - Catch-handler status flips → wrapped tx including auto-close.
   - Cron status flips → wrapped tx including auto-close.

### Phase 4.B Should

5. **Market.status="resolved"` + `resolveMarketPositions` joined in tx** (fixes finding #7). Lower priority; recovery exists.

6. **`/api/user/positions` returns historical with explicit scope flag** (addresses finding #12 / #13 indirectly). Optional in Phase 4.B; can be Phase 4.C.

### Phase 4.B Could (TECH-DEBT, not Phase 4.B)

- Finding #8: partial unique index on `Challenge(userId) WHERE status='active'` — separate UNMANAGED_DDL task.
- Finding #10: status/type → Prisma enums — separate schema migration phase.
- Finding #11: centralized `getNow()` helper — separate small task.
- Finding #12, #13: positions UI/history — separate UI phase.

### Phase 4.B acceptance criteria

- For every status transition from `"active"` to terminal, all open positions of that challenge are closed atomically with the status flip. No ghost positions can exist (status="open" + challenge.status != "active").
- Sell endpoint rejects any position whose challenge is not the current active one, with distinct error codes per failure reason.
- Buy endpoint rejects when challenge is expired (already does — preserve).
- Resolve of a market never finds positions of non-active challenges (because finalize already closed them).
- All status transitions are inside a transaction with their position-close work.

---

## Cross-cutting summary

| Concern | Status | Findings |
|---|---|---|
| Time source consistency | All JS, no DB clock | #11 (MEDIUM, defer) |
| Transaction boundaries | Main paths wrapped; catch handlers + lifecycle crons NOT | #6 (HIGH, Phase 4.B) |
| Sandbox→Challenge balance leak | NOT FOUND in normal flow | clean |
| Challenge→Sandbox balance leak | NOT FOUND in normal flow | clean |
| Resolve-time cross-pollution | **runningBalance chain leaks** | #2 (CRITICAL, Phase 4.A.2) |
| Discriminator consistency | Two mechanisms (active-lookup vs position.challengeId), intentional | structural — not a bug |
| Ended-challenge audit trail integrity | **Post-finalize Trade/BalanceLog writes corrupt history** | #1 (CRITICAL, Phase 4.A.2) |
| Ghost positions on terminal status | Pervasive (13 of 14 transition sites) | #4, #5 (HIGH, Phase 4.B) |

---

## Closing notes

- Audit raw findings preserved at `/tmp/phase-4-0-raw-findings.md` during discovery session. Architect reviewed in separate session; severity ratings and Phase 4.A.2/4.B scope are architect's judgment.
- Affiliate subsystem deeper audit remains TASK-FINAL-1 (out of scope here).
- Phase 4.B brief to be drafted on top of this document after Phase 4.A.2 lands.

## Coverage

Schema, all 6 audit blocks (A–F), and 4 cross-cutting axes (CC1–CC4) covered. 8 AMBIGUOUS items in raw findings resolved or flagged for Phase 4.A.2 / Phase 4.B. 7 NOT FOUND items confirmed (no `startingBalance` column, no `sandboxBalance` column, no `User.activeChallengeId`, no `cron/resolve-markets`, no raw-SQL balance writes, no `increment` on balance columns, no affiliate dependency on Challenge balance).

Full raw findings: see `/tmp/phase-4-0-raw-findings.md` (not committed; this document is the canonical record).
