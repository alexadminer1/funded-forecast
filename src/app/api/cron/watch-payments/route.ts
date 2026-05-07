export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { runWatcher } from "@/lib/payment/watcher";

/**
 * Cron-triggered on-chain payment watcher.
 *
 * Schedule: every minute via Coolify Scheduled Task.
 * Auth: Bearer CRON_SECRET (same pattern as expire-payments).
 *
 * Runs the watcher loop:
 *   1. Reads new ERC-20 Transfer events from Alchemy on the receiver address
 *   2. Inserts each as PaymentTransaction (idempotent on chainId+txHash+logIndex)
 *   3. Matches against active Payment by amountUnits
 *   4. Advances confirmations on all in-flight transactions
 *   5. Promotes Payment to CONFIRMED when confirmations >= required
 *
 * maxDuration is set to 60s to allow for slow Alchemy responses + many logs
 * in the chunk. Typical run is well under 5s.
 *
 * Idempotent across runs: if cron fires twice in the same minute, second run
 * will see no new logs (state.lastProcessedBlock already advanced) and just
 * re-tick confirmations — cheap.
 *
 * Step 5 will hook activation flow (Challenge create + AffiliateConversion)
 * into the CONFIRMED transition; for now Payment.status just stops at CONFIRMED.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runWatcher();
    return NextResponse.json({ success: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WATCH_PAYMENTS] watcher failed:", err);
    return NextResponse.json(
      { success: false, error: "Watcher run failed", message },
      { status: 500 }
    );
  }
}
