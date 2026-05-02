"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";

export default function HeaderWrapper() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/login" || pathname.startsWith("/admin") || pathname === "/affiliates" || pathname.startsWith("/affiliates/")) return null;
  return <Header />;
}
