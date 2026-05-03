import { NextRequest } from "next/server";
import crypto from "crypto";

export function hashIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    (forwarded ? forwarded.split(",")[0].trim() : null) ??
    request.headers.get("x-real-ip") ??
    "unknown";
  return crypto.createHash("sha256").update(ip).digest("hex");
}
