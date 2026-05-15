-- Phase 1: Update ChallengePlan values to new business model
-- Source of truth: docs/BUSINESS_RULES.md
--
-- Changes from old model:
--   - challengePeriodDays: 30 -> 10 (all tiers)
--   - minTradingDays:     15 -> 10 (all tiers, = challengePeriodDays)
--
-- DLL and MLL values are re-asserted explicitly for idempotency,
-- though actual values match current state (Starter 5/10, Pro 4/8, Elite 3/6).
--
-- Other fields (priceCents, profitTargetPct, profitSharePct, accountSize,
-- maxPositionSizePct, payoutCooldownDays, refundableFeeCents,
-- maxPayoutCapCents, minPayoutCents) are NOT changed.
--
-- This migration is idempotent: re-running produces the same final state.

BEGIN;

-- Starter ($1k)
UPDATE "ChallengePlan"
SET "challengePeriodDays" = 10,
    "minTradingDays" = 10,
    "dailyLossPct" = 5,
    "maxLossPct" = 10
WHERE "accountSize" = 1000;

-- Pro ($5k)
UPDATE "ChallengePlan"
SET "challengePeriodDays" = 10,
    "minTradingDays" = 10,
    "dailyLossPct" = 4,
    "maxLossPct" = 8
WHERE "accountSize" = 5000;

-- Elite ($15k)
UPDATE "ChallengePlan"
SET "challengePeriodDays" = 10,
    "minTradingDays" = 10,
    "dailyLossPct" = 3,
    "maxLossPct" = 6
WHERE "accountSize" = 15000;

COMMIT;
