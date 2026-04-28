import { NextRequest, NextResponse } from "next/server";
import { getLimiter } from "@/lib/ratelimit";

function getIdentifier(req: NextRequest): string {
  // Try to get userId from JWT
  try {
    const auth = req.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload?.userId) return `uid:${payload.userId}`;
    }
  } catch {}
  // Fallback to IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
  return `ip:${ip}`;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only rate limit API routes
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  const limiter = getLimiter(pathname);
  const identifier = getIdentifier(req);

  const { success, limit, remaining, reset } = await limiter.limit(identifier);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many requests", retryAfter },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(reset),
        },
      }
    );
  }

  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Limit", String(limit));
  res.headers.set("X-RateLimit-Remaining", String(remaining));
  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
