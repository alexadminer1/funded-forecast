export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const userId = payload.userId as number;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  try {
    const [logs, total] = await Promise.all([
      prisma.balanceLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          amount: true,
          balanceBefore: true,
          balanceAfter: true,
          runningBalance: true,
          createdAt: true,
          trade: {
            select: {
              id: true,
              action: true,
              side: true,
              amount: true,
              price: true,
              market: {
                select: { id: true, title: true },
              },
            },
          },
        },
      }),
      prisma.balanceLog.count({ where: { userId } }),
    ]);

    const formatted = logs.map((log) => ({
      id: log.id,
      type: log.type,
      amount: log.amount,
      balanceBefore: log.balanceBefore,
      balanceAfter: log.balanceAfter,
      runningBalance: log.runningBalance,
      createdAt: log.createdAt,
      trade: log.trade ? {
        id: log.trade.id,
        action: log.trade.action,
        side: log.trade.side,
        shares: log.trade.amount,
        price: log.trade.price,
        marketId: log.trade.market.id,
        marketTitle: log.trade.market.title,
      } : null,
    }));

    return NextResponse.json({
      success: true,
      logs: formatted,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });

  } catch (error) {
    console.error("[BALANCE-HISTORY]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
