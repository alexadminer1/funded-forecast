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
  const [hasAffiliate, setHasAffiliate] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) return;
    setHasToken(true);
    setUserLoading(true);
    Promise.all([
      apiFetch<{ success: boolean; user: User }>("/api/user/me")
        .then((data) => { if (data.success) setUser(data.user); })
        .catch(() => {}),
      apiFetch<{ affiliate: { id: number } | null }>("/api/affiliate/me")
        .then((data) => { setHasAffiliate(!!data.affiliate); })
        .catch(() => {}),
    ]).finally(() => setUserLoading(false));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleLogout() {
    removeToken();
    setUser(null);
    setMenuOpen(false);
    router.push("/");
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const navLinks = [
    { href: "/markets",     label: "Markets" },
    { href: "/dashboard",   label: "Dashboard" },
    { href: "/history",     label: "History" },
    { href: "/faq",         label: "FAQ" },
    { href: "/leaderboard", label: "Leaderboard" },
  ];

  const isLoggedIn = hasToken || !!user;
  const affiliateHref = hasAffiliate ? "/affiliate" : "/affiliates";

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

      <style jsx>{`
        @media (max-width: 768px) {
          :global(.hdr-nav) { display: none !important; }
          :global(.hdr-progress) { display: none !important; }
          :global(.hdr-username) { display: none !important; }
          :global(.hdr-signout) { display: none !important; }
          :global(.hdr-hamburger) { display: flex !important; }
          :global(header) { padding: 0 14px !important; }
        }
        @media (max-width: 480px) {
          :global(.hdr-balance) { padding: 4px 8px !important; font-size: 11px !important; }
          :global(.hdr-balance-label) { display: none !important; }
        }
      `}</style>

      {/* Logo */}
      <a href={isLoggedIn ? "/markets" : "/"} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
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

      {/* Nav — desktop only */}
      {isLoggedIn && (
        <nav className="hdr-nav" style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {navLinks.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              style={{
                color:      isActive(href) ? "#F1F5F9" : "#64748B",
                textDecoration: "none",
                fontSize:   13.5,
                fontWeight: isActive(href) ? 600 : 400,
                padding:    "5px 12px",
                borderRadius: 7,
                background: isActive(href) ? "rgba(255,255,255,0.06)" : "transparent",
                transition: "color 0.15s, background 0.15s",
              }}
            >
              {label}
            </a>
          ))}
          <a
            key="affiliate"
            href={affiliateHref}
            style={{
              color: isActive("/affiliate") || isActive("/affiliates") ? "#F1F5F9" : "#64748B",
              textDecoration: "none",
              fontSize: 13.5,
              fontWeight: isActive("/affiliate") || isActive("/affiliates") ? 600 : 400,
              padding: "5px 12px",
              borderRadius: 7,
              background: isActive("/affiliate") || isActive("/affiliates") ? "rgba(255,255,255,0.06)" : "transparent",
              transition: "color 0.15s, background 0.15s",
            }}
          >
            Affiliates
          </a>
        </nav>
      )}

      {!isLoggedIn && (
        <a
          href="/affiliates"
          className="hdr-nav"
          style={{
            color: "#64748B",
            textDecoration: "none",
            fontSize: 13.5,
            fontWeight: 400,
            padding: "5px 12px",
            borderRadius: 7,
          }}
        >
          Affiliates
        </a>
      )}

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>

        {isLoggedIn && (
          <>
            {/* Challenge progress — desktop only */}
            {user?.activeChallenge && (() => {
              const ch = user.activeChallenge!;
              const profitPct = ch.startBalance > 0
                ? ((ch.realizedBalance - ch.startBalance) / ch.startBalance) * 100
                : 0;
              const progress = Math.min(Math.max(profitPct / ch.profitTargetPct, 0), 1);
              const planName = ch.plan?.name ?? "Evaluation";
              const badgeColor =
                planName.toLowerCase().includes("elite") ? "#F59E0B" :
                planName.toLowerCase().includes("pro") ? "#3B82F6" : "#94A3B8";
              return (
                <div className="hdr-progress" style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 140 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: badgeColor,
                      textTransform: "uppercase", letterSpacing: "0.08em",
                    }}>{planName}</span>
                    <span style={{ fontSize: 10, color: "#475569" }}>
                      {Math.max(0, profitPct) > 0 ? "+" : ""}{Math.max(0, profitPct).toFixed(1)}% / {ch.profitTargetPct}%
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 4,
                      width: `${progress * 100}%`,
                      background: progress >= 1 ? "#22C55E" : `linear-gradient(90deg, ${badgeColor}99, ${badgeColor})`,
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                </div>
              );
            })()}

            {/* Balance */}
            <div className="hdr-balance" style={{
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.2)",
              borderRadius: 8, padding: "5px 13px",
              fontSize: 13, display: "flex", alignItems: "center", gap: 6,
              flexShrink: 0,
            }}>
              <span className="hdr-balance-label" style={{ color: "#475569", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Balance</span>
              <span style={{ color: "#22C55E", fontWeight: 700, fontSize: 14 }}>
                ${user?.balance.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "0.00"}
              </span>
            </div>

            {/* @username — desktop only */}
            <a href="/account" className="hdr-username" style={{ fontSize: 13, color: "#475569", fontWeight: 500, textDecoration: "none" }}>@{user?.username ?? ""}</a>

            {/* Sign out — desktop only */}
            <button
              onClick={handleLogout}
              className="hdr-signout"
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, padding: "5px 13px",
                color: "#64748B", cursor: "pointer", fontSize: 13,
                transition: "border-color 0.15s, color 0.15s",
              }}
            >Sign out</button>

            {/* Hamburger — mobile only */}
            <button
              className="hdr-hamburger"
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, padding: "6px 8px",
                cursor: "pointer", flexDirection: "column", gap: 4,
                display: "none",
                flexShrink: 0,
              }}
              aria-label="Menu"
            >
              <span style={{ width: 18, height: 2, background: "#F1F5F9", borderRadius: 2, display: "block" }} />
              <span style={{ width: 18, height: 2, background: "#F1F5F9", borderRadius: 2, display: "block" }} />
              <span style={{ width: 18, height: 2, background: "#F1F5F9", borderRadius: 2, display: "block" }} />
            </button>
          </>
        )}

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
              flexShrink: 0,
            }}
          >
            Get Started
          </a>
        )}
      </div>

      {/* Mobile menu — opens below header */}
      {menuOpen && isLoggedIn && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          background: "rgba(7,13,25,0.97)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "8px 14px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          zIndex: 49,
        }}>
          {navLinks.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              style={{
                color: isActive(href) ? "#22C55E" : "#94A3B8",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: isActive(href) ? 600 : 500,
                padding: "12px 8px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}
            >{label}</a>
          ))}
          <a
            href={affiliateHref}
            onClick={() => setMenuOpen(false)}
            style={{
              color: isActive("/affiliate") || isActive("/affiliates") ? "#22C55E" : "#94A3B8",
              textDecoration: "none",
              fontSize: 15,
              fontWeight: 500,
              padding: "12px 8px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}
          >Affiliates</a>
          <a
            href="/account"
            onClick={() => setMenuOpen(false)}
            style={{
              color: "#94A3B8",
              textDecoration: "none",
              fontSize: 15,
              fontWeight: 500,
              padding: "12px 8px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}
          >My account {user?.username ? `(@${user.username})` : ""}</a>
          <button
            onClick={handleLogout}
            style={{
              background: "transparent",
              border: "none",
              color: "#EF4444",
              fontSize: 15,
              fontWeight: 500,
              padding: "12px 8px",
              textAlign: "left",
              cursor: "pointer",
            }}
          >Sign out</button>
        </div>
      )}
    </header>
  );
}
