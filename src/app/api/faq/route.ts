export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category");
  const where: { isActive: boolean; category?: string } = { isActive: true };
  if (category) where.category = category;
  const items = await prisma.fAQItem.findMany({ where, orderBy: { order: "asc" } });
  return NextResponse.json(items);
}
