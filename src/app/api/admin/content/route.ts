export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const blocks = await prisma.contentBlock.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json({ success: true, blocks });
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: { key: string; value: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { key, value } = body;
  if (!key || value === undefined) return NextResponse.json({ error: "key and value required" }, { status: 400 });
  const block = await prisma.contentBlock.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  return NextResponse.json({ success: true, block });
}
