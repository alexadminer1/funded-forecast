"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import LandingHeader from "./LandingHeader";
import { getToken } from "@/lib/api";

export default function HeaderWrapper() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (pathname === "/" || pathname === "/login" || pathname.startsWith("/admin")) {
    return null;
  }

  if (!mounted) return null;

  return getToken() ? <Header /> : <LandingHeader />;
}
