export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";

// NOWPayments integration removed 2026-05-05.
// On-chain payment system replaces this. Endpoint kept as 410 Gone
// to avoid breaking links during transition. Will be replaced in
// Step 2 of on-chain migration.
export async function POST() {
  return NextResponse.json(
    { error: "Payment provider migration in progress. Please try again later." },
    { status: 410 }
  );
}
