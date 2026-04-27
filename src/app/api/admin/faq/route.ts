export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const items = await prisma.fAQItem.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { category, question, answer, order } = await req.json();
  const item = await prisma.fAQItem.create({ data: { category, question, answer, order: order ?? 0 } });
  return NextResponse.json(item);
}
