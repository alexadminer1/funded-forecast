"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";
import LandingHeader from "./LandingHeader";

// Public pages (no auth) — show LandingHeader
const PUBLIC_PATHS = new Set<string>([
  "/privacy",
  "/terms",
  "/risk-disclosure",
  "/contact",
]);

export default function HeaderWrapper() {
  const pathname = usePathname();

  // Routes that render their own header (don't show anything global)
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/admin") ||
    pathname === "/affiliates" ||
    pathname.startsWith("/affiliates/")
  ) {
    return null;
  }

  // Public marketing/legal pages — show landing header (works without auth)
  if (PUBLIC_PATHS.has(pathname)) {
    return <LandingHeader />;
  }

  // Authenticated app pages — show internal Header
  return <Header />;
}
