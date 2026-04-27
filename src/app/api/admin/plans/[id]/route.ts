export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function checkAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.ADMIN_API_KEY;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const plan = await prisma.challengePlan.update({ where: { id: Number(params.id) }, data: body });
  return NextResponse.json({ success: true, plan });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.challengePlan.update({ where: { id: Number(params.id) }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
