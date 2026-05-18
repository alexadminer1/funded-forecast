export const dynamic = 'force-dynamic'
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Phase 4.A.2 Task 3 — read-only impact assessment for findings #1 + #2
// from docs/PHASE_4_0_AUDIT.md. Run BEFORE merge of Phase 4.A.2 to size
// pre-existing corrupted rows.
//
// Auth: x-admin-key header (matches other admin endpoints).
//
// Queries are pure SELECTs over a fixed window (default 30 days). No
// writes, no mutations. Safe to run against prod.

const ADMIN_KEY = process.env.ADMIN_API_KEY;
const DEFAULT_WINDOW_DAYS = 30;

// Escalation thresholds — see brief PHASE_4_A_2_BRIEF.md §"Action на основе результатов".
const ESCALATION_USD_THRESHOLD   = 100;
const ESCALATION_USERS_THRESHOLD = 50;

interface ChainLeakRow {
  id: number;
  userId: number;
  challengeId: number | null;
  type: string;
  createdAt: Date;
  runningBalance: number;
  prevChallengeId: number | null;
  prevRunningBalance: number | null;
}

interface AuditCorruptionRow {
  id: number;
  userId: number;
  challengeId: number | null;
  realizedPnl: Prisma.Decimal | null;
  createdAt: Date;
  challengeStatusNow: string;
  challengeEndedAt: Date | null;
}

function detectEnvironment(): "dev" | "prod" | "unknown" {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (url.includes("dev.")) return "dev";
  if (url.includes("tradepredictions.online")) return "prod";
  return "unknown";
}

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let windowDays = DEFAULT_WINDOW_DAYS;
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const raw = (body as { windowDays?: unknown }).windowDays;
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0 && raw <= 365) {
      windowDays = Math.floor(raw);
    }
  } catch {
    // Body is optional.
  }

  const checkedAt = new Date();

  try {
    // ───────────────────────────────────────────────────────────────
    // Query 1 — Chain leak detection (finding #2).
    // BalanceLog rows of type=market_resolve whose immediate
    // predecessor (by createdAt, same userId) has a DIFFERENT
    // challengeId. Under the buggy chain-scope code, the resolve
    // would have computed balanceBefore from that predecessor.
    // ───────────────────────────────────────────────────────────────
    const chainLeakRows = await prisma.$queryRaw<ChainLeakRow[]>(Prisma.sql`
      SELECT
        bl."id",
        bl."userId",
        bl."challengeId",
        bl."type",
        bl."createdAt",
        bl."runningBalance",
        prev."challengeId"    AS "prevChallengeId",
        prev."runningBalance" AS "prevRunningBalance"
      FROM "BalanceLog" bl
      LEFT JOIN LATERAL (
        SELECT "challengeId", "runningBalance"
        FROM "BalanceLog"
        WHERE "userId" = bl."userId"
          AND "createdAt" < bl."createdAt"
        ORDER BY "createdAt" DESC
        LIMIT 1
      ) prev ON true
      WHERE bl."type" = 'market_resolve'
        AND bl."createdAt" > NOW() - (${windowDays}::int || ' days')::interval
        AND prev."challengeId" IS DISTINCT FROM bl."challengeId"
      ORDER BY bl."createdAt" DESC
    `);

    const chainLeakUsers = new Set(chainLeakRows.map(r => r.userId));

    // ───────────────────────────────────────────────────────────────
    // Query 2 — Audit trail corruption (finding #1).
    // Trade rows with action='resolve' written against a Challenge
    // that was NOT active at the moment of resolve. We cannot know
    // status at the historical moment, but the conservative proxy:
    //   - challenge.status != 'active' at read time
    //   - AND (endedAt IS NULL OR endedAt < trade.createdAt)
    // The endedAt filter excludes challenges that ended AFTER the
    // trade (those were active when the trade landed; current
    // status reflects later transition).
    // ───────────────────────────────────────────────────────────────
    const auditCorruptionRows = await prisma.$queryRaw<AuditCorruptionRow[]>(Prisma.sql`
      SELECT
        t."id",
        t."userId",
        t."challengeId",
        t."realizedPnl",
        t."createdAt",
        c."status"  AS "challengeStatusNow",
        c."endedAt" AS "challengeEndedAt"
      FROM "Trade" t
      JOIN "Challenge" c ON c."id" = t."challengeId"
      WHERE t."action" = 'resolve'
        AND t."createdAt" > NOW() - (${windowDays}::int || ' days')::interval
        AND c."status" != 'active'
        AND (c."endedAt" IS NULL OR c."endedAt" < t."createdAt")
      ORDER BY t."createdAt" DESC
    `);

    const auditCorruptionUsers      = new Set(auditCorruptionRows.map(r => r.userId));
    const auditCorruptionChallenges = new Set(
      auditCorruptionRows
        .map(r => r.challengeId)
        .filter((id): id is number => id !== null),
    );

    let cumulativeAbsPnl = 0;
    for (const row of auditCorruptionRows) {
      if (row.realizedPnl !== null) {
        cumulativeAbsPnl += Math.abs(Number(row.realizedPnl));
      }
    }
    cumulativeAbsPnl = Math.round(cumulativeAbsPnl * 100) / 100;

    // ───────────────────────────────────────────────────────────────
    // Aggregate metrics + escalation trigger.
    // ───────────────────────────────────────────────────────────────
    const unionUsers = new Set<number>([...chainLeakUsers, ...auditCorruptionUsers]);

    const exceeded =
      cumulativeAbsPnl > ESCALATION_USD_THRESHOLD ||
      unionUsers.size  > ESCALATION_USERS_THRESHOLD;

    let exceededReason = "none";
    if (cumulativeAbsPnl > ESCALATION_USD_THRESHOLD && unionUsers.size > ESCALATION_USERS_THRESHOLD) {
      exceededReason = `cumulativeAbsRealizedPnl ${cumulativeAbsPnl} > ${ESCALATION_USD_THRESHOLD} AND uniqueUsers ${unionUsers.size} > ${ESCALATION_USERS_THRESHOLD}`;
    } else if (cumulativeAbsPnl > ESCALATION_USD_THRESHOLD) {
      exceededReason = `cumulativeAbsRealizedPnl ${cumulativeAbsPnl} > ${ESCALATION_USD_THRESHOLD}`;
    } else if (unionUsers.size > ESCALATION_USERS_THRESHOLD) {
      exceededReason = `uniqueUsers ${unionUsers.size} > ${ESCALATION_USERS_THRESHOLD}`;
    }

    return NextResponse.json({
      success:     true,
      environment: detectEnvironment(),
      windowDays,
      checkedAt:   checkedAt.toISOString(),
      chainLeak: {
        totalRows:    chainLeakRows.length,
        uniqueUsers:  chainLeakUsers.size,
        sampleRows:   chainLeakRows.slice(0, 10).map(r => ({
          id:                 r.id,
          userId:             r.userId,
          challengeId:        r.challengeId,
          type:               r.type,
          createdAt:          r.createdAt.toISOString(),
          runningBalance:     r.runningBalance,
          prevChallengeId:    r.prevChallengeId,
          prevRunningBalance: r.prevRunningBalance,
        })),
      },
      auditCorruption: {
        totalRows:                auditCorruptionRows.length,
        uniqueUsers:              auditCorruptionUsers.size,
        uniqueChallenges:         auditCorruptionChallenges.size,
        cumulativeAbsRealizedPnl: cumulativeAbsPnl.toFixed(2),
        sampleRows:               auditCorruptionRows.slice(0, 10).map(r => ({
          id:                 r.id,
          userId:             r.userId,
          challengeId:        r.challengeId,
          realizedPnl:        r.realizedPnl !== null ? Number(r.realizedPnl).toString() : null,
          createdAt:          r.createdAt.toISOString(),
          challengeStatusNow: r.challengeStatusNow,
          challengeEndedAt:   r.challengeEndedAt ? r.challengeEndedAt.toISOString() : null,
        })),
      },
      escalationTrigger: {
        thresholds: {
          cumulativeUsdAbove:  ESCALATION_USD_THRESHOLD,
          affectedUsersAbove:  ESCALATION_USERS_THRESHOLD,
        },
        exceeded,
        reason: exceededReason,
      },
    });
  } catch (err) {
    console.error("[RESOLVE-CORRUPTION-AUDIT] failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Internal server error", message },
      { status: 500 },
    );
  }
}
