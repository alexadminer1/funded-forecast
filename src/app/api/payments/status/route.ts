export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";

// NOWPayments status check removed 2026-05-05.
// On-chain payment status endpoint will be created in Step 2.
export async function GET() {
  return NextResponse.json(
    { error: "Endpoint disabled during payment provider migration" },
    { status: 410 }
  );
}
