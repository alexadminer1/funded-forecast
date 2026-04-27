export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const blocks = await prisma.contentBlock.findMany({ orderBy: { key: "asc" } });
  const content: Record<string, string> = {};
  for (const b of blocks) content[b.key] = b.value;
  return NextResponse.json({ success: true, content });
}
