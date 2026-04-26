"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch, getToken, removeToken } from "@/lib/api";
import { User } from "@/lib/types";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!getToken()) return;
    apiFetch<{ success: boolean; user: User }>("/api/user/me")
      .then((data) => { if (data.success) setUser(data.user); })
      .catch(() => {});
  }, []);

  function handleLogout() {
    removeToken();
    setUser(null);
    router.push("/login");
  }

  const navLink = (href: string, label: string) => (
    <a
      href={href}
      style={{
        color: pathname === href ? "#F8FAFC" : "#64748B",
        textDecoration: "none",
        fontSize: 14,
        fontWeight: pathname === href ? 600 : 400,
        borderBottom: pathname === href ? "2px solid #22C55E" : "2px solid transparent",
        paddingBottom: 2,
      }}
    >
      {label}
    </a>
  );

  return (
    <header style={{
      borderBottom: "1px solid #1E293B",
      padding: "0 32px",
      height: 56,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "#0F172A",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      {/* Logo */}
      <a href="/markets" style={{ textDecoration: "none" }}>
        <span style={{ fontWeight: 700, fontSize: 18, color: "#22C55E" }}>
          FundedForecast
        </span>
      </a>

      {/* Nav */}
      <nav style={{ display: "flex", gap: 28, alignItems: "center" }}>
        {navLink("/markets", "Markets")}
        {user && navLink("/dashboard", "Dashboard")}
        {user && navLink("/history", "History")}
      </nav>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {user ? (
          <>
            {/* Balance */}
            <div style={{
              background: "#1E293B",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 13,
            }}>
              <span style={{ color: "#64748B", marginRight: 6 }}>Balance</span>
              <span style={{ color: "#22C55E", fontWeight: 700 }}>
                ${user.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Username */}
            <div style={{ fontSize: 13, color: "#94A3B8" }}>
              @{user.username}
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              style={{
                background: "none",
                border: "1px solid #334155",
                borderRadius: 8,
                padding: "6px 14px",
                color: "#64748B",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <a
            href="/login"
            style={{
              background: "#22C55E",
              color: "#0F172A",
              padding: "8px 20px",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Log In
          </a>
        )}
      </div>
    </header>
  );
}
