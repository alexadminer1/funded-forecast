export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";

// NOWPayments webhook removed 2026-05-05.
// On-chain watcher replaces this. Endpoint kept as 410 Gone
// in case NowPayments still tries to send webhooks during transition.
export async function POST() {
  return NextResponse.json(
    { error: "Webhook endpoint disabled" },
    { status: 410 }
  );
}
