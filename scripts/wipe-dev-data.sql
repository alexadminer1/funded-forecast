-- scripts/wipe-dev-data.sql
-- Phase 0.9 — wipe dev test data (challenges, trades, positions, balance logs,
-- payments, payouts, affiliate test data). Reset sandbox balance to $10
-- for test users (alexadminer, test1..test8).
--
-- DOES NOT TOUCH:
--   - User, UserConsent, Subscription (legacy Stripe), Market, ChallengePlan
--   - Affiliate (profile records, only Click/Conversion/Ledger/Payout wiped)
--   - PaymentWatcherState (chain sync state)
--
-- USAGE (run by Alexey, NOT Claude Code, NOT Architect):
--   1) Backup first: bash scripts/backup-dev-db.sh
--   2) Open SSH tunnel: ssh -L 15432:10.0.1.9:5432 ff-dev
--   3) In another shell:
--        psql -h 127.0.0.1 -p 15432 -U postgres -d fundedforecast \
--             -f scripts/wipe-dev-data.sql
--      (password via .pgpass or PGPASSWORD env)
--
-- BalanceLog format mirrors src/app/api/register/route.ts:94-105 exactly.
-- Rename of type 'challenge_start' -> 'sandbox_welcome' is tracked as
-- TECH-DEBT-3 (post-Phase-1).

BEGIN;

-- 1. ChallengeDailyPnL (Cascade on Challenge, explicit for control)
DELETE FROM "ChallengeDailyPnL";

-- 2. BalanceLog (depends on Trade SetNull, Challenge SetNull)
DELETE FROM "BalanceLog";

-- 3. PaymentTransaction (depends on Payment SetNull)
DELETE FROM "PaymentTransaction";

-- 4. Payment (depends on Challenge SetNull)
DELETE FROM "Payment";

-- 5. PayoutRequest (Restrict on Challenge — MUST be before Challenge)
DELETE FROM "PayoutRequest";

-- 6. AffiliateLedger (Restrict on Conversion AND Payout)
DELETE FROM "AffiliateLedger";

-- 7. AffiliatePayout (Restrict on Affiliate — we do NOT delete Affiliate)
DELETE FROM "AffiliatePayout";

-- 8. AffiliateConversion (Restrict on Affiliate)
DELETE FROM "AffiliateConversion";

-- 9. AffiliateClick (Restrict on Affiliate)
DELETE FROM "AffiliateClick";

-- 10. Trade (Restrict on User — we do NOT delete User)
DELETE FROM "Trade";

-- 11. Position (Restrict on User — we do NOT delete User)
DELETE FROM "Position";

-- 12. Challenge (Restrict on User — we do NOT delete User)
DELETE FROM "Challenge";

-- 13. Recreate sandbox welcome BalanceLog for test users
--     EXACT mirror of src/app/api/register/route.ts:94-105
INSERT INTO "BalanceLog"
  ("userId", "tradeId", "challengeId", "type", "amount",
   "balanceBefore", "balanceAfter", "runningBalance", "createdAt")
SELECT
  id,
  NULL,
  NULL,
  'challenge_start',
  10.00,
  0.00,
  10.00,
  10.00,
  NOW()
FROM "User"
WHERE username IN (
  'alexadminer','test1','test2','test3','test4','test5','test6','test7','test8'
);

-- 14. Reset User.lastTradeAt
UPDATE "User"
SET "lastTradeAt" = NULL
WHERE username IN (
  'alexadminer','test1','test2','test3','test4','test5','test6','test7','test8'
);

-- Verification (counts after wipe)
SELECT 'Challenge'          AS table_name, COUNT(*) AS remaining FROM "Challenge"
UNION ALL SELECT 'Trade',                 COUNT(*) FROM "Trade"
UNION ALL SELECT 'Position',              COUNT(*) FROM "Position"
UNION ALL SELECT 'BalanceLog',            COUNT(*) FROM "BalanceLog"
UNION ALL SELECT 'ChallengeDailyPnL',     COUNT(*) FROM "ChallengeDailyPnL"
UNION ALL SELECT 'Payment',               COUNT(*) FROM "Payment"
UNION ALL SELECT 'PaymentTransaction',    COUNT(*) FROM "PaymentTransaction"
UNION ALL SELECT 'PayoutRequest',         COUNT(*) FROM "PayoutRequest"
UNION ALL SELECT 'AffiliateClick',        COUNT(*) FROM "AffiliateClick"
UNION ALL SELECT 'AffiliateConversion',   COUNT(*) FROM "AffiliateConversion"
UNION ALL SELECT 'AffiliateLedger',       COUNT(*) FROM "AffiliateLedger"
UNION ALL SELECT 'AffiliatePayout',       COUNT(*) FROM "AffiliatePayout";

-- Expected:
--   Challenge=0, Trade=0, Position=0, ChallengeDailyPnL=0,
--   Payment=0, PaymentTransaction=0, PayoutRequest=0,
--   AffiliateClick=0, AffiliateConversion=0,
--   AffiliateLedger=0, AffiliatePayout=0,
--   BalanceLog = N (one per matched test user; N <= 9).
--
-- If BalanceLog < 9, some test usernames don't exist in dev DB — verify
-- before committing.

COMMIT;
