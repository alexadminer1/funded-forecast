import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload?.userId) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const newToken = signToken({ userId: payload.userId });

  return NextResponse.json({ success: true, token: newToken });
}
