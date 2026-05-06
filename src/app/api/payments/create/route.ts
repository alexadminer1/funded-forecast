export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { hashIp } from "@/lib/ip";
import { limiters } from "@/lib/ratelimit";
import { getPaymentConfig } from "@/lib/payment/config";
import { findFreeAmount, unitsToUsdString } from "@/lib/payment/amount";
import { parsePlanId } from "@/lib/payment/validators";

/**
 * Maximum concurrent active invoices per user.
 * Active = AWAITING_PAYMENT | SEEN_ON_CHAIN | CONFIRMING | UNDERPAID, not yet expired.
 * Hardcoded business rule, not env-configurable.
 */
const MAX_ACTIVE_INVOICES_PER_USER = 3;

/**
 * Postgres advisory lock keyspace (32-bit integer).
 * Per-receiver lock prevents concurrent invoice creation from racing on amount uniqueness.
 * Hash function is deterministic, not cryptographic — collision probability is irrelevant
 * for lock keys (worst case: two unrelated receivers share a lock, slight serialisation).
 */
function advisoryLockKey(chainId: number, receiverAddress: string): number {
  const input = `${chainId}:${receiverAddress.toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0; // |0 keeps it 32-bit signed
  }
  return hash;
}

function auth(req: NextRequest): number | null {
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

const ACTIVE_PAYMENT_STATUSES = [
  PaymentStatus.AWAITING_PAYMENT,
  PaymentStatus.SEEN_ON_CHAIN,
  PaymentStatus.CONFIRMING,
  PaymentStatus.UNDERPAID,
];

/**
 * Format payment row as API response.
 * BigInt values are stringified (JSON.stringify cannot serialize BigInt natively).
 * Distinguishes:
 *   - planAmountUsd: original plan price ($39.99)
 *   - amountUsd / amountUsdc: unique invoice amount, may differ ($39.97)
 */
function serializeInvoice(payment: {
  id: string;
  receiverAddress: string;
  expectedAmountUnits: bigint;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  planAmountUsd: Prisma.Decimal;
  expiresAt: Date;
  confirmationsRequired: number;
}) {
  const amountString = unitsToUsdString(payment.expectedAmountUnits, payment.tokenDecimals);
  return {
    success: true,
    paymentId: payment.id,
    address: payment.receiverAddress,
    planAmountUsd: payment.planAmountUsd.toFixed(2),
    amountUsd: amountString,
    amountUsdc: amountString,
    expectedAmountUnits: payment.expectedAmountUnits.toString(),
    chainId: payment.chainId,
    tokenAddress: payment.tokenAddress,
    tokenSymbol: payment.tokenSymbol,
    tokenDecimals: payment.tokenDecimals,
    expiresAt: payment.expiresAt.toISOString(),
    confirmationsRequired: payment.confirmationsRequired,
  };
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const userId = auth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit (5/min per user)
  const rl = await limiters.paymentCreate.limit(`user:${userId}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": Math.ceil((rl.reset - Date.now()) / 1000).toString() } }
    );
  }

  // 3. Body parse
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const planId = parsePlanId((body as { planId?: unknown }).planId);
  if (planId === null) {
    return NextResponse.json({ error: "Invalid planId" }, { status: 400 });
  }

  // 4. Load config (env vars). Throws on missing/invalid env — caught below.
  let config;
  try {
    config = getPaymentConfig();
  } catch (err) {
    console.error("[payments/create] config error:", err);
    return NextResponse.json(
      { error: "Payment system misconfigured" },
      { status: 500 }
    );
  }

  // 5. Load plan
  const plan = await prisma.challengePlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) {
    return NextResponse.json({ error: "Plan not found or inactive" }, { status: 404 });
  }
  if (!Number.isInteger(plan.priceCents) || plan.priceCents <= 0) {
    return NextResponse.json({ error: "Plan has no price configured" }, { status: 400 });
  }

  const now = new Date();

  // 6. Idempotency — return existing active invoice for (userId, planId) if any
  const existing = await prisma.payment.findFirst({
    where: {
      userId,
      planId,
      status: PaymentStatus.AWAITING_PAYMENT,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return NextResponse.json(serializeInvoice(existing));
  }

  // 7. Per-user cap on active invoices
  const activeCount = await prisma.payment.count({
    where: {
      userId,
      status: { in: ACTIVE_PAYMENT_STATUSES },
      expiresAt: { gt: now },
    },
  });
  if (activeCount >= MAX_ACTIVE_INVOICES_PER_USER) {
    return NextResponse.json(
      { error: "Too many pending invoices. Please wait for them to expire or complete." },
      { status: 409 }
    );
  }

  // 8. Create invoice in transaction with advisory lock
  const ipHash = hashIp(req);
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  const lockKey = advisoryLockKey(config.chainId, config.receiverAddress);
  const planAmountDecimal = new Prisma.Decimal(plan.priceCents).div(100);
  const expiresAt = new Date(now.getTime() + config.invoiceWindowMinutes * 60_000);

  try {
    const payment = await prisma.$transaction(async (tx) => {
      // Advisory lock (transaction-scoped, released on COMMIT/ROLLBACK)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      // Load occupied amount slots within active window
      const occupiedRows = await tx.payment.findMany({
        where: {
          chainId: config.chainId,
          tokenAddress: config.usdcAddress,
          receiverAddress: config.receiverAddress,
          status: { in: ACTIVE_PAYMENT_STATUSES },
          expiresAt: { gt: now },
        },
        select: { expectedAmountUnits: true },
      });
      const occupied = new Set(occupiedRows.map((r) => r.expectedAmountUnits));

      // Find free amount within ±offsetCents of plan price
      const free = findFreeAmount(
        plan.priceCents,
        config.amountOffsetCents,
        config.usdcDecimals,
        occupied
      );
      if (!free) {
        throw new SlotExhaustedError();
      }

      // Insert Payment row. Partial unique index Payment_active_amount_unique
      // is the second line of defense against races.
      return tx.payment.create({
        data: {
          userId,
          planId,
          status: PaymentStatus.AWAITING_PAYMENT,
          chainId: config.chainId,
          tokenSymbol: config.usdcSymbol,
          tokenAddress: config.usdcAddress,
          tokenDecimals: config.usdcDecimals,
          receiverAddress: config.receiverAddress,
          planAmountUsd: planAmountDecimal,
          expectedAmountUnits: free.units,
          confirmationsRequired: config.confirmationsRequired,
          expiresAt,
          // createdByIp stores HASHED IP (SHA-256). Field name is historical;
          // GDPR-compliant. Real IP is never persisted.
          createdByIp: ipHash,
          createdUserAgent: userAgent,
        },
      });
    });

    return NextResponse.json(serializeInvoice(payment));
  } catch (err) {
    if (err instanceof SlotExhaustedError) {
      return NextResponse.json(
        { error: "Payment slot temporarily unavailable. Please retry in a minute." },
        { status: 503 }
      );
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Unique constraint violation on Payment_active_amount_unique partial index.
      // Should be extremely rare given advisory lock, but possible if lock wasn't held.
      return NextResponse.json(
        { error: "Concurrent invoice creation conflict. Please retry." },
        { status: 503 }
      );
    }
    console.error("[payments/create] unexpected error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

class SlotExhaustedError extends Error {
  constructor() {
    super("All amount slots taken in active window");
    this.name = "SlotExhaustedError";
  }
}
