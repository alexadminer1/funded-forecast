-- P0.2.c Migration: add peakEquity field for equity-aware MLL
-- Run manually in Coolify DB Terminal AFTER deploy of schema change
--
-- Step 1: ALTER TABLE (Prisma client уже знает поле после deploy)
ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "peakEquity" DOUBLE PRECISION;

-- Step 2: Backfill existing active challenges
-- Initial peakEquity = current peakBalance (treat current cash peak as starting equity peak)
-- After first trade Wave C код будет пересчитывать с учётом open positions
UPDATE "Challenge"
SET "peakEquity" = "peakBalance"
WHERE status = 'active' AND "peakEquity" IS NULL;

-- Verify
SELECT id, "userId", status, "peakBalance", "peakEquity"
FROM "Challenge"
WHERE status = 'active'
ORDER BY id;
