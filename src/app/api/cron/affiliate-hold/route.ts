export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeLedgerEntries } from "@/lib/affiliate/ledger";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const errors: number[] = [];
  let processed = 0;

  try {
    const conversions = await prisma.affiliateConversion.findMany({
      where: {
        status:      "pending",
        pendingUntil: { lte: now },
        affiliate: {
          status: { notIn: ["suspended", "banned"] },
        },
      },
      orderBy: { pendingUntil: "asc" },
      take:    200,
      select: {
        id:               true,
        affiliateId:      true,
        commissionAmount: true,
      },
    });

    for (const conversion of conversions) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.affiliateConversion.update({
            where: { id: conversion.id },
            data: {
              status:             "approved",
              previousStatus:     "pending",
              approvedAt:         now,
              lastStatusChangeAt: now,
            },
          });

          await writeLedgerEntries(
            conversion.affiliateId,
            [
              {
                type:         "commission_pending",
                bucket:       "pending",
                amount:       -conversion.commissionAmount,
                conversionId: conversion.id,
                reason:       "hold released",
              },
              {
                type:         "commission_approved",
                bucket:       "available",
                amount:       conversion.commissionAmount,
                conversionId: conversion.id,
                reason:       "hold released",
              },
            ],
            tx,
          );
        });

        processed++;
      } catch (err) {
        console.error(`[AFFILIATE_HOLD] conversion ${conversion.id} failed`, err);
        errors.push(conversion.id);
      }
    }

    return NextResponse.json({ processed, skipped: 0, errors });
  } catch (err) {
    console.error("[AFFILIATE_HOLD] batch query failed", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
