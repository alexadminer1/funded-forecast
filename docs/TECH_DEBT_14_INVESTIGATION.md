# TECH-DEBT-14 — DLL Drawdown Calculation Investigation

## Metadata

- **Date:** 2026-05-25
- **Phase:** TECH-DEBT-14 investigation (read-only discovery)
- **Branch:** `feature/tech-debt-14-dll-investigation`
- **Predecessor:** PHILO-1 merged into `develop` @ `f3e0574`
- **Source ticket:** `BACKLOG.md` → TECH-DEBT-14 (created Session 21, 2026-05-25)
- **Methodology:** static code reading (Blocks A–E, G) + DB inspection on dev (Block F) + manual formula substitution. No code changes, no migrations, no DB writes.
- **Output:** classification + recommendations + ready-to-run prod query. No fix implementation in this phase.

---

## Executive summary

The DLL violation message `"Daily drawdown 5.83% exceeded limit 5%"` against a final P&L of `−0.04%` is **not a bug**. The DLL formula executes correctly with the inputs it sees. The mismatch perceived by the smoke-test reporter arose from two compounding factors:

1. **DLL is cash-only by design** — `realizedBalance` (the variable used by the check) tracks cash only and does not include the market value of open positions. A buy of `$X` immediately drops `realizedBalance` by `$X`, registering as drawdown, even though the trader still owns inventory worth ~`$X`. This is asymmetric with MLL, which is equity-aware.
2. **Auto-close after fail inflates the post-fail balance** — when DLL trips, the catch handler in `trade/buy/route.ts:431-450` opens a fresh transaction and closes all open positions via `closeOpenPositionsForChallenge(..., "failed_drawdown")`. The proceeds of that close raise `realizedBalance` *after* the failure was already locked in. The user then sees a dashboard balance close to startBalance and reasonably asks "why did I fail?".

**Classification:** (ii) Intentional design + (iii) UX confusion. Not a bug, not a regression. No code fix required.

**Primary recommendation:** documentation update of `BUSINESS_RULES.md` rule #5 to make the cash-only nature of DLL explicit (full draft in §R1 below). Secondary recommendations: violation-reason enrichment, UI tooltip, and two unrelated coverage findings spun out as TECH-DEBT-15 and TECH-DEBT-16.

**PHILO-1 prod release:** not blocked by this investigation. DLL logic was untouched by PHILO-1.

---

## Reproduction case (corrected from DB ground truth)

The reporter's sequence in the original ticket described "two buys, one sell, then a rejected buy". The DB shows the third trade was not a user sell but an auto-close fired *because* of the rejection. Corrected chronology for Challenge id=51 (test8, Starter $1000):

| Time (UTC)        | Event                                                       | Δ realizedBalance | realizedBalance after | DB row                                                  |
|-------------------|-------------------------------------------------------------|-------------------|-----------------------|---------------------------------------------------------|
| 04:54:08          | Challenge created (`realizedBalance = startBalance = $1000`)| —                 | $1000.00              | `Challenge` id=51, `BalanceLog` id=218 (`challenge_start`) |
| 05:15:42          | Buy 1: 22 YES @ $0.095, cost $2.09. **Lazy reset fires** → `dayStartBalance=$1000`, `dayStartDate=05:15:42`. | −2.09 | $997.91 | `Trade` id=112 (`action='buy'`), `BalanceLog` id=219, `Position` id=84 opened |
| 05:16:39          | Buy 2: 71 YES @ $0.095, cost $6.75 (augments position 84)   | −6.75             | $991.16               | `Trade` id=113, `BalanceLog` id=220                     |
| ~05:18:02 (in-tx) | **Buy 3 attempt:** 63 NO @ ~$0.7852 effective, cost ~$49.47. DLL check evaluates with `realizedBalance=$991.16`, `cost=$49.47`, `dayStart=$1000`. `dailyDrawdownPct = 5.83`. Throws `DrawdownViolatedError`. Main tx rolls back; no `Trade` or `BalanceLog` row written. | — (rolled back)   | $991.16 (unchanged)   | No DB row. `Challenge.violationReason` set in catch-handler fresh tx. |
| 05:18:02.606      | **Auto-close** (catch handler, fresh tx): position 84 closed at YES price ~$0.0912, proceeds $8.48. | +8.48             | **$999.64**           | `Trade` id=115 (`action='auto_close_finalize'`), `BalanceLog` id=222, `Position` id=84 closed |
| 05:18:02.625      | Challenge `status='failed'`, `drawdownViolated=true`, `endedAt` set, `violationReason="Daily drawdown 5.83% exceeded limit 5%"`. | —                 | $999.64               | `Challenge` id=51 update |

The user observes `realizedBalance=$999.64` and final P&L `−$0.36` (−0.04%) on the dashboard *after* the event finished, and the perception of mismatch follows.

---

## Findings

### Block A — Trigger site inventory

- `DrawdownViolatedError` is defined twice as a file-local class: `trade/buy/route.ts:27` and `trade/sell/route.ts:25` (architectural decision per sell-route comment at lines 55-57; not deduplicated to a shared module).
- DLL throw sites (daily drawdown category): `trade/buy/route.ts:330` and `trade/sell/route.ts:347`. Both share identical formula and identical reason-string construction.
- `marketResolve.ts` has **no** DLL check (only an MLL inline check at lines 163-178). See §R4 below.
- `src/lib/engine/` exports only spread/cap/min-daily-volume constants. DLL logic lives inline in trade routes and in the UI helper `src/lib/user/active-challenge.ts`. No shared engine helper for DLL.
- `challengeStatus.ts` covers pass-checking only; no DLL logic.

### Block B — DLL formula (canonical)

Identical at `trade/buy/route.ts:298-336` and `trade/sell/route.ts:308-353`:

```ts
const newRealizedBalance = parseFloat(
  (activeChallenge.realizedBalance - cost).toFixed(2)        // buy
  // or + proceeds for sell
);
// ... MLL check (equity-aware, separate path) ...

const dayStart = activeChallenge.dayStartBalance ?? newRealizedBalance;
if (dayStart > 0) {
  const dailyDrawdownPct = parseFloat(
    (((dayStart - newRealizedBalance) / dayStart) * 100).toFixed(2)
  );
  if (dailyDrawdownPct >= activeChallenge.maxDailyDdPct) {
    throw new DrawdownViolatedError(
      challengeId,
      `Daily drawdown ${dailyDrawdownPct}% exceeded limit ${activeChallenge.maxDailyDdPct}%`,
      "daily_drawdown_exceeded"
    );
  }
}
```

Variable sources:

| Variable                  | Source                                                                                                |
|---------------------------|-------------------------------------------------------------------------------------------------------|
| `dayStart`                | `Challenge.dayStartBalance` (Float?, Prisma column). Lazy-reset write outside main tx on first trade of UTC day. Fallback `?? newRealizedBalance` only fires when DB value is null. |
| `newRealizedBalance`      | Local variable. `= Challenge.realizedBalance − cost` (buy) or `+ proceeds` (sell). Reflects post-trade cash state.        |
| `Challenge.realizedBalance`| Prisma Float column. Cash-only. Mutated atomically inside `prisma.$transaction` by trade-buy, trade-sell, marketResolve, closeChallengePositions.   |
| `cost`                    | `amount × applyBuySpread(rawPrice).effectivePrice` (line 212).                                       |
| `maxDailyDdPct`           | Prisma column on Challenge, snapshotted from `plan.dailyLossPct` at activation (`payment/activation.ts:133`).             |

### Block C — Violation message construction (single source)

The `dailyDrawdownPct` interpolated into the violation reason is the **same** local variable that triggered the check. There is no second computation, no formula divergence between gate and message. The reason persisted to `Challenge.violationReason` and surfaced to the client via 409 response are byte-identical.

### Block D — `realizedBalance` is a single-source cash column

- Stored Prisma column (`Float`, non-null) on `Challenge`.
- Initial value at challenge creation: `plan.accountSize`.
- All mutators are inside `prisma.$transaction`: trade-buy (`− cost`), trade-sell (`+ proceeds`), marketResolve (`+ payout`), closeChallengePositions (`+ totalProceeds`).
- `realizedBalance` does **not** include open-position market value. The `equity` derivation (`src/lib/equity.ts:50-58`) adds open positions; it is used by the MLL equity branch only.
- Verdict: single source of truth, cash-only by construction. No competing definitions.

### Block E — Transaction boundary

In `trade/buy/route.ts` the relevant sequence inside `prisma.$transaction(async tx => …)` is, schematically:

```
[177]     activeChallenge = tx.challenge.findFirst({ where: { userId, status: "active" } })
            // snapshot of DB before any in-tx writes
[241-296] tx.position.update/create; tx.trade.create; tx.balanceLog.create
            // ledger rows reflect would-be balance, but Challenge.realizedBalance
            // column is not yet updated
[298-336] DLL check (using local newRealizedBalance, not a re-read)
[338-341] tx.challenge.update({ realizedBalance: newRealizedBalance, ... })
            // only reached if checks did not throw
```

If the DLL throws, the entire main tx rolls back. The catch handler at `:431-450` then opens a **separate** `prisma.$transaction` that calls `closeOpenPositionsForChallenge(..., "failed_drawdown")` and writes `Challenge.status='failed'`, `drawdownViolated=true`, `violationReason=error.reason`. This second tx commits, which is how the auto-close `Trade` and `BalanceLog` rows appear after the failure moment.

The lazy reset at lines 154-171 runs on `prisma` (not `tx`) before the main tx opens, so it persists even when the main tx rolls back. For the test8 case this is benign — the first trade of the day succeeded, so the snapshot was already correct.

### Block F — DB reconstruction (Challenge id=51)

`Challenge` id=51 (test8, Starter $1000) confirms the corrected chronology in the table above. Three relevant `Trade` rows: ids 112, 113, 115 — the third with `action='auto_close_finalize'`, not `'sell'`. Four `BalanceLog` rows: 218 (challenge_start), 219 (trade_open), 220 (trade_open), 222 (trade_close at auto-close moment). Single `Position` row id=84 opened by buy 1, augmented by buy 2, closed by auto-close.

Formula substitution with the actual DB state at the moment of the rejected attempt:

```
realizedBalance  = $991.16   (post buy-1 and buy-2, no committed sell yet)
dayStartBalance  = $1000.00
cost             = $49.47

newRealizedBalance = 991.16 − 49.47 = 941.69
dailyDrawdownPct   = ((1000 − 941.69) / 1000) × 100 = 5.831%
                   rounded to 2 decimals → 5.83%
```

Exact match with the persisted violation reason. The formula executed correctly with the inputs it had.

### Block G — UI counterpart and its asymmetries

UI helper `src/lib/user/active-challenge.ts:171-188` computes a dashboard-facing `dailyDrawdownPercent` for `/api/user/me` and `/api/user/mode`. It differs from the enforcement formula in three ways:

| Aspect            | Enforcement (trade routes)                       | UI helper (`active-challenge.ts`)                                   |
|-------------------|--------------------------------------------------|---------------------------------------------------------------------|
| `dayStart` source | `dayStartBalance ?? newRealizedBalance`          | If `dayStartDate ISO == today` AND `dayStartBalance != null` → `dayStartBalance`; else → `realizedBalance` (treats stale snapshot as no-drawdown) |
| "Current" value   | `newRealizedBalance` (= `realizedBalance − cost` of would-be trade) | `realizedBalance` (raw column, no hypothetical cost subtraction)    |
| Negative clamp    | none                                             | `Math.max(0, dayStart − realizedBalance)` (UI never displays negative DD) |

Implications:

1. The dashboard never reflects "what would the drawdown be if I clicked Buy with this size right now" — it only reflects committed state. The enforcement check is the first place that hypothetical state appears, and it appears as part of the violation message that the user only sees if the trade actually trips the limit. So the user perceives the violation number as coming from nowhere.
2. The UI defensively handles stale `dayStartBalance` (a value from a prior UTC day that hasn't been lazy-reset yet because the user hasn't traded today). Enforcement does not — but in practice the lazy reset fires before the main tx opens, so the staleness window inside enforcement is zero.
3. Negative DLL values (i.e. trader is net up on the day) are clamped to 0 in UI and pass through enforcement (where they trivially never breach the limit anyway).

---

## Algebraic identity (why reporter's $58.31 reconstruction looked right)

When no committed sells have happened yet today, the DLL formula simplifies:

```
dayStart − newRealizedBalance
  = dayStart − (realizedBalance − cost_new)
  = (dayStart − realizedBalance) + cost_new
  = sum_of_committed_buy_costs_today + cost_new
  = total buy cost the trader has put up today (committed + would-be)
```

Dividing by `dayStart` gives `dailyDrawdownPct = (total today buy cost) / dayStart`. In the test8 case `($2.09 + $6.75 + $49.47) / $1000 = 5.831%`. The reporter's intuition "sum of buys / startBalance" was **numerically equivalent** to the actual formula in this particular event sequence — it just happened to coincide because no sell had committed yet. With even a single committed sell earlier in the day, the identity breaks (`realizedBalance` would have risen, `dayStart − realizedBalance` would have shrunk, and the equivalence would no longer hold).

This is why the original ticket's hypothesis felt strongly supported by the 5.83% match: the formula reduces to that exact ratio under that exact event shape.

---

## Classification

### (i) Bug — RULED OUT

The formula is mathematically correct against its stated intent. Block F substitution matches the persisted violation reason to two decimal places. Single-source variable interpolation (Block C). No competing `realizedBalance` definitions (Block D). The check evaluates at the right point in the transaction boundary (Block E).

### (ii) Intentional design — PRIMARY CLASSIFICATION

DLL is a **cash-only** brake. `realizedBalance` is cash. Open-position value is not counted. This is asymmetric with MLL, which is equity-aware via `computeEquity(tx, challengeId, newRealizedBalance) = realizedBalance + openPositionsValue`.

The asymmetry is structural, not incidental:

- **MLL** is a trailing limit on total loss across the lifetime of the challenge, with a peak-based baseline (`newPeakBalance − maxLossAmount`). Using equity makes sense — the rule asks "how far have you fallen from your best", and best-case must include unrealized gains.
- **DLL** is an intraday brake on cash exposure. A trader who commits a large fraction of startBalance to buys today registers immediately as drawdown, even if the inventory is worth the cash. The rule effectively limits how much fresh capital a trader can deploy per day, not how much equity they can lose.

This shapes a specific challenge phenotype: a trader who buys $50 of a $1000 challenge "uses up" their entire DLL budget on day one regardless of whether the position is winning or losing. To trade further today they must first sell something (which raises `realizedBalance` and pulls drawdown back down). This is consistent with the product philosophy section in `BUSINESS_RULES.md` ("user must be able to fail freely") and with the target 2-3% pass rate.

### (iii) UX confusion — SECONDARY CLASSIFICATION

The cash-only nature of DLL is not documented in `BUSINESS_RULES.md` rule #5 nor surfaced in the violation reason. Combined with the auto-close mechanism (which raises `realizedBalance` *after* the failure), the user is left with a final dashboard state that suggests a small loss while a violation reason cites a much larger drawdown percentage. The information needed to reconcile the two — that the percentage was computed at the in-flight rejected-trade moment, and that the auto-close subsequently restored the cash — is nowhere visible.

This is fixable with docs + a small reason-message change. No engine logic change required.

---

## Recommendations

### R1 (P1, blocker for next docs phase) — Rewrite `BUSINESS_RULES.md` rule #5

Replace the current rule #5 block in `docs/BUSINESS_RULES.md`. Full proposed text below; the next Architect-executor should be able to paste it with minimal editing.

> #### 5. DLL breach (daily, cash-only)
>
> - **Rule:** `(dayStartBalance − newRealizedBalance) / dayStartBalance × 100 >= dailyLossPct` → instant fail
> - Evaluated post-trade inside the trade transaction. `newRealizedBalance = realizedBalance − cost` (buy) or `+ proceeds` (sell). If the check breaches, the transaction rolls back; the failure is then committed in a separate transaction along with auto-close of any open positions.
> - `dayStartBalance` is a snapshot of `realizedBalance` taken at the first trade attempt of each UTC day (lazy reset). It does not move during the day.
> - Active only in challenge phase (not in sandbox).
> - **Cash-only by design.** `realizedBalance` tracks cash only — it does **not** include the market value of open positions. A buy of $X drops `realizedBalance` by $X immediately, contributing $X of drawdown for the day, even if the inventory is currently worth $X. Selling raises `realizedBalance` by the sale proceeds and pulls drawdown back down.
> - **Contrast with MLL (rule #6):** MLL uses equity (`realizedBalance + open-positions value`); DLL uses `realizedBalance` only.
> - **Why this asymmetry:** DLL is an intraday brake on fresh cash deployment, not a measure of equity loss. MLL covers equity loss across the lifetime of the challenge.
> - **Worked example:** Starter $1000, DLL 5%. Trader buys $50 worth of YES shares at the start of day 1. `realizedBalance` drops from $1000 to $950 → daily drawdown 5.0% → DLL trips. Even if the YES position is still worth approximately $50, the rule has fired. To deploy more capital today the trader must first sell.
> - **Reaction:** `Challenge.status='failed'`, `drawdownViolated=true`, `violationReason="Daily drawdown X% exceeded limit Y%"`. Open positions are auto-closed at current market prices in the same failure event; the proceeds raise `realizedBalance` post-failure but do not affect the fail decision.

Scope: single file (`docs/BUSINESS_RULES.md`), replace the rule #5 subsection only. Estimated 15-30 min. Branch from develop, separate PR.

### R2 (P2, defer) — Violation reason enrichment

Current reason: `Daily drawdown 5.83% exceeded limit 5%`.

Proposed (illustrative, exact phrasing TBD): `Daily drawdown 5.83% exceeded limit 5% (computed at attempted trade cost $49.47; open positions worth $X.XX not counted by DLL — see rules doc)`.

Considerations:
- Reason string is persisted to `Challenge.violationReason` and surfaced in the failed-challenge email template (`src/lib/email-templates/challenge-failed.ts`). Length and format constraints there must be checked first.
- Could be implemented as a structured second field (`violationDetails` JSON) rather than appending to the string, to avoid format coupling with downstream consumers.
- Lower priority than R1 — R1 alone gives a user who reads the docs enough to reconcile the perception.

Scope: trade routes + email template + possibly Challenge schema (new column). Separate phase if pursued.

### R3 (P2, defer) — UI tooltip on DLL gauge

Dashboard DLL gauge in `src/app/dashboard/page.tsx` does not explain the cash-only nature. A tooltip on hover ("DLL counts cash exposure only; open positions are not credited") would surface the design without requiring users to read the rules doc.

Scope: dashboard UI only. Defer until Phase 5 (UI widgets) or later.

### R4 (P2, separate ticket — TECH-DEBT-15 proposed) — `marketResolve.ts` does not check DLL

`src/lib/marketResolve.ts:152-195` updates `realizedBalance` when a market resolves (winner gets `shares × $1`, loser gets `0`). It checks MLL inline (`:163-178`) but **does not check DLL**. If a market resolves at a loss large enough to trip DLL for the current UTC day, the resolve event will not fail the challenge — only an MLL breach will.

Whether this is a coverage gap or intentional (resolve events are not "trades" and arguably shouldn't count toward intraday brakes) is for the architect to decide. Proposed as a separate `TECH-DEBT-15` for discovery — not necessarily a bug, but worth a deliberate decision documented in `BUSINESS_RULES.md`.

Out of scope for the TECH-DEBT-14 docs fix.

### R5 (P3, separate ticket — TECH-DEBT-16 proposed) — Auto-close not distinguished from user sell in History

The auto-close written by `closeOpenPositionsForChallenge(..., "failed_drawdown")` writes a `Trade` row with `action='auto_close_finalize'`. The history view, the failed-challenge email, and the dashboard balance trajectory do not visually distinguish this from a user-initiated sell. Users perceive their "final trade" as their own sell and reconstruct the event timeline incorrectly — exactly what happened with the smoke test reporter, who described "I bought twice, sold once, then attempted a buy".

A small UI label ("System auto-close after challenge failure") on rows with `action='auto_close_finalize'` would eliminate that confusion. Out of scope here; proposed as `TECH-DEBT-16`.

---

## Affected users assessment

Dev DB query (Block F task B):
- Total challenges failed with `violationReason LIKE 'Daily drawdown%'`: **1**
- Of which `realizedBalance / startBalance > 0.98` (final loss <2%): **1** — Challenge id=51, the test8 smoke-test case
- Date range: 2026-05-25 only

The dev DB contains a thin synthetic dataset (6 challenges total, all failed, dominated by `No trading activity` fails). It cannot answer "how many users on prod were affected". Given the classification (intentional design, not bug), this assessment is informational rather than decision-blocking: there are no "wrongly failed" users to compensate. Prod numbers would inform future product decisions about whether to consider an equity-aware DLL.

### Prod inspection (manual, by Алексей via Coolify DB Terminal)

Run on `ff-sandbox-db` (Coolify → Resources → ff-sandbox-db → Terminal → `psql -U postgres -d <db>`):

```sql
-- Count of DLL fails in last 30 days
SELECT COUNT(*)
FROM "Challenge"
WHERE "violationReason" LIKE 'Daily drawdown%'
  AND "endedAt" >= NOW() - INTERVAL '30 days';
```

```sql
-- DLL fails where final cash loss was less than 2% (potentially perceived as mismatch)
SELECT id,
       "userId",
       "violationReason",
       "startBalance",
       "realizedBalance",
       ROUND((("startBalance" - "realizedBalance") / "startBalance" * 100)::numeric, 2) AS final_loss_pct,
       "endedAt"
FROM "Challenge"
WHERE "violationReason" LIKE 'Daily drawdown%'
  AND "endedAt" >= NOW() - INTERVAL '30 days'
  AND "realizedBalance" / "startBalance" > 0.98
ORDER BY "endedAt" DESC;
```

Both queries are read-only `SELECT`s. Non-blocking for PHILO-1 release. Output informs future product decisions only.

---

## Out of scope (explicit non-actions)

- No change to DLL formula. Cash-only behaviour is the intended design.
- No change to MLL (equity-aware behaviour remains correct).
- No conversion of DLL to equity-aware. That would be a product-philosophy change, not a fix; it would also affect target pass rate.
- No code changes anywhere. This phase is investigation + docs recommendation only.
- No prod DB writes. Manual prod query is read-only and run by Алексей.
- No new BACKLOG entries auto-added — TECH-DEBT-15 and TECH-DEBT-16 are *proposed* in §R4/§R5 for Алексей's decision.

---

## Open questions

None. Reproduction is fully accounted for; classification is unambiguous; the path forward is a documentation fix scoped in §R1.

---

## Files read during investigation

| File                                          | Read scope                    |
|-----------------------------------------------|-------------------------------|
| `src/app/api/trade/buy/route.ts`              | full (1-510)                  |
| `src/app/api/trade/sell/route.ts`             | full (1-650)                  |
| `src/lib/marketResolve.ts`                    | full (1-224)                  |
| `src/lib/user/active-challenge.ts`            | full (1-218)                  |
| `src/lib/equity.ts`                           | full (1-60)                   |
| `src/lib/challengeStatus.ts`                  | full (1-79)                   |
| `src/lib/engine/constants.ts`                 | exports listing               |
| `src/lib/engine/spreads.ts`                   | exports listing               |
| `prisma/schema.prisma`                        | DLL-relevant columns          |
| `src/lib/payment/activation.ts`               | grep (initialization writes)  |
| `src/lib/closeChallengePositions.ts`          | grep (realizedBalance writes) |
| dev DB tables: Challenge, Trade, BalanceLog, Position | SELECT-only Block F   |

Raw working notes preserved in `/tmp/dll-investigation-raw.md` and `/tmp/dll-investigation-block-f.md` (gitignored).

---

## Next steps (for Алексей)

1. Review this report on the `feature/tech-debt-14-dll-investigation` branch.
2. Decide on the five recommendations:
   - R1 — schedule as the next small docs phase (Architect-executor chat, single-file edit).
   - R2/R3 — defer to Phase 5 (UI widgets) or beyond.
   - R4 (TECH-DEBT-15) and R5 (TECH-DEBT-16) — add to `BACKLOG.md` if you want them tracked, or discard.
3. Run the §"Prod inspection" queries in Coolify DB Terminal at your convenience (non-blocking).
4. Commit + push this report; PR `feature/tech-debt-14-dll-investigation → develop`; merge.
5. Mark TECH-DEBT-14 in `BACKLOG.md` as `INVESTIGATED — design issue, no fix required, docs update R1 follows`. Do not mark CLOSED until R1 docs phase is merged.
6. Update `SESSION_LOG.md` with this phase's outcome.
