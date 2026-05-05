export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { REFCODE, ATTRIBUTION } from "@/lib/affiliate/constants";

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host")
            ?? request.headers.get("host")
            ?? "tradepredictions.online";
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

function redirectHome(request: NextRequest): NextResponse {
  return NextResponse.redirect(`${getBaseUrl(request)}/`, 302);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  try {
    const { code } = await params;

    // validate refCode format
    if (
      !code ||
      code.length < REFCODE.minLength ||
      code.length > REFCODE.maxLength ||
      !REFCODE.pattern.test(code)
    ) {
      return redirectHome(request);
    }

    // look up active affiliate
    const affiliate = await prisma.affiliate.findFirst({
      where:  { refCode: code, status: "approved" },
      select: { id: true },
    });

    if (!affiliate) {
      return redirectHome(request);
    }

    // determine client IP
    const forwarded = request.headers.get("x-forwarded-for");
    const ip =
      (forwarded ? forwarded.split(",")[0].trim() : null) ??
      request.headers.get("x-real-ip") ??
      "unknown";

    // SHA-256 of IP — no salt in MVP
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex");

    // TODO: rate limit — requires dedicated Ratelimit instance (100 clicks / 24h per ipHash).
    // Existing ratelimit.ts uses pathname-based keys and does not support custom keys.
    // Add an `affiliateClick` limiter to ratelimit.ts in a follow-up step.

    const cookieId = crypto.randomUUID();

    // request metadata
    const countryCode =
      request.headers.get("cf-ipcountry") ??
      request.headers.get("x-vercel-ip-country") ??
      null;

    const userAgent  = request.headers.get("user-agent")?.slice(0, 500) ?? null;
    const referer    = request.headers.get("referer")?.slice(0, 500) ?? null;
    const landingUrl = request.url.slice(0, 500);

    const sp          = request.nextUrl.searchParams;
    const utmSource   = sp.get("utm_source")?.slice(0, 200)   ?? null;
    const utmMedium   = sp.get("utm_medium")?.slice(0, 200)   ?? null;
    const utmCampaign = sp.get("utm_campaign")?.slice(0, 200) ?? null;
    const utmContent  = sp.get("utm_content")?.slice(0, 200)  ?? null;

    // expiresAt = now + ATTRIBUTION.windowDays
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ATTRIBUTION.windowDays);

    // write click — redirect without cookie if this fails
    let clickWritten = false;
    try {
      await prisma.affiliateClick.create({
        data: {
          affiliateId:       affiliate.id,
          refCode:           code,
          ipHash,
          ipSalt:            null,
          countryCode,
          userAgent,
          referer,
          landingUrl,
          utmSource,
          utmMedium,
          utmCampaign,
          utmContent,
          cookieId,
          convertedToUserId: null,
          expiresAt,
        },
      });
      clickWritten = true;
    } catch (err) {
      console.warn("[AFFILIATE_TRACKING] click write failed", err);
    }

    const response = redirectHome(request);

    if (clickWritten) {
      response.cookies.set("aff_id", cookieId, {
        httpOnly: true,
        secure:   true,
        sameSite: "lax",
        path:     "/",
        maxAge:   60 * 24 * 60 * 60, // 60 days
      });
    }

    return response;
  } catch (err) {
    console.error("[AFFILIATE_TRACKING] route error", err);
    return NextResponse.redirect(`${getBaseUrl(request)}/`, 302);
  }
}
