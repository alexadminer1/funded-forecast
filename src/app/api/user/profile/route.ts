export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import bcrypt from "bcryptjs";

function auth(req: NextRequest) {
  const token = req.headers.get("authorization")?.slice(7);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId as number | null;
}

export async function GET(req: NextRequest) {
  const userId = auth(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true, firstName: true, lastName: true, walletAddress: true, walletNetwork: true, createdAt: true },
  });
  const consent = await prisma.userConsent.findUnique({ where: { userId } });
  return NextResponse.json({ success: true, user, consent });
}

export async function PUT(req: NextRequest) {
  const userId = auth(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username, firstName, lastName, walletAddress, walletNetwork, currentPassword, newPassword } = await req.json();

  const updateData: Record<string, string> = {};
  if (username) updateData.username = username;
  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;
  if (walletAddress !== undefined) updateData.walletAddress = walletAddress;
  if (walletNetwork !== undefined) updateData.walletNetwork = walletNetwork;

  if (newPassword) {
    if (newPassword.length < 8) return NextResponse.json({ error: "Password min 8 characters" }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
    if (!user?.password) return NextResponse.json({ error: "Cannot change password" }, { status: 400 });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    updateData.password = await bcrypt.hash(newPassword, 10);
  }

  const updated = await prisma.user.update({ where: { id: userId }, data: updateData });
  return NextResponse.json({ success: true, user: { id: updated.id, email: updated.email, username: updated.username, firstName: updated.firstName, lastName: updated.lastName, walletAddress: updated.walletAddress, walletNetwork: updated.walletNetwork } });
}
