"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch, getToken, removeToken } from "@/lib/api";
import { User } from "@/lib/types";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!getToken()) return;
    setUserLoading(true);
    apiFetch<{ success: boolean; user: User }>("/api/user/me")
      .then((data) => { if (data.success) setUser(data.user); })
      .catch(() => {})
      .finally(() => setUserLoading(false));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleLogout() {
    removeToken();
    setUser(null);
    router.push("/");
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const navLinks = [
    { href: "/markets", label: "Markets" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/history", label: "History" },
    { href: "/faq", label: "FAQ" },
    { href: "/leaderboard", label: "Leaderboard" },
  ];

  const isLoggedIn = !!user;

  return (
    <header style={{
      position: "sticky",
      top: 0,
      zIndex: 50,
      height: 58,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 28px",
      background: scrolled ? "rgba(7,13,25,0.88)" : "rgba(7,13,25,0.6)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderBottom: scrolled ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(255,255,255,0.04)",
      transition: "background 0.2s, border-color 0.2s",
    }}>

      {/* Logo */}
      <a href={isLoggedIn ? "/markets" : "/"} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: "linear-gradient(135deg, #22C55E, #16A34A)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 800, color: "#0a1a0e",
          boxShadow: "0 0 12px rgba(34,197,94,0.3)", flexShrink: 0,
        }}>F</div>
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em", color: "#F1F5F9" }}>
          FundedForecast
        </span>
      </a>

      {/* Nav — only when logged in */}
      {isLoggedIn && (
        <nav style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {navLinks.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              style={{
                color: isActive(href) ? "#F1F5F9" : "#64748B",
                textDecoration: "none",
                fontSize: 13.5,
                fontWeight: isActive(href) ? 600 : 400,
                padding: "5px 12px",
                borderRadius: 7,
                background: isActive(href) ? "rgba(255,255,255,0.06)" : "transparent",
                transition: "color 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => { if (!isActive(href)) (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
              onMouseLeave={(e) => { if (!isActive(href)) (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
            >
              {label}
            </a>
          ))}
        </nav>
      )}

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 280, justifyContent: "flex-end" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, visibility: isLoggedIn ? "visible" : "hidden", position: isLoggedIn ? "static" : "absolute" }}>
          <div style={{
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.2)",
            borderRadius: 8, padding: "5px 13px",
            fontSize: 13, display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ color: "#475569", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Balance</span>
            <span style={{ color: "#22C55E", fontWeight: 700, fontSize: 14 }}>
              ${user?.balance.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "0.00"}
            </span>
          </div>
          <a href="/account" style={{ fontSize: 13, color: "#475569", fontWeight: 500, textDecoration: "none" }}>@{user?.username ?? ""}</a>
          <button
            onClick={handleLogout}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, padding: "5px 13px",
              color: "#64748B", cursor: "pointer", fontSize: 13,
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
          >Sign out</button>
        </div>

        {!userLoading && !isLoggedIn && (
          <a
            href="/login"
            style={{
              background: "#22C55E", color: "#071A0E",
              padding: "7px 18px", borderRadius: 8,
              textDecoration: "none", fontSize: 13, fontWeight: 700,
              letterSpacing: "-0.01em",
              boxShadow: "0 0 16px rgba(34,197,94,0.25)",
              transition: "box-shadow 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(34,197,94,0.4)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(34,197,94,0.25)"; }}
          >
            Get Started
          </a>
        )}
      </div>
    </header>
  );
}
