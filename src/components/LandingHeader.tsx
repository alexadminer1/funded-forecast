"use client";
import { useState } from "react";

export default function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="ff-header" style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: "rgba(8,12,20,0.80)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{
        maxWidth: 900, margin: "0 auto",
        padding: "16px 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "relative",
      }}>
      {/* Logo */}
      <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: "linear-gradient(135deg, #22C55E, #16A34A)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, fontWeight: 800, color: "#071A0E",
          boxShadow: "0 0 16px rgba(34,197,94,0.35)",
        }}>F</div>
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em", color: "#F1F5F9" }}>FundedForecast</span>
      </a>

      {/* Center nav */}
      <nav className="ff-nav" style={{ display: "flex", gap: 32, alignItems: "center", position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
        <a href="#how" style={{ fontSize: 14, color: "#94A3B8", textDecoration: "none", fontWeight: 500 }}>How it works</a>
        <a href="#plans" style={{ fontSize: 14, color: "#94A3B8", textDecoration: "none", fontWeight: 500 }}>Pricing</a>
        <a href="#faq" style={{ fontSize: 14, color: "#94A3B8", textDecoration: "none", fontWeight: 500 }}>FAQ</a>
        <a href="/affiliates" style={{ fontSize: 14, color: "#94A3B8", textDecoration: "none", fontWeight: 500 }}>Affiliates</a>
      </nav>

      {/* Right buttons */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <a href="/login" className="ff-login-btn" style={{
          fontSize: 13, fontWeight: 600, color: "#94A3B8",
          padding: "7px 18px", borderRadius: 9, textDecoration: "none",
          border: "1px solid rgba(255,255,255,0.1)",
        }}>Login</a>
        <a href="/login?mode=register" style={{
          fontSize: 13, fontWeight: 700, background: "#22C55E", color: "#071A0E",
          padding: "8px 20px", borderRadius: 9, textDecoration: "none",
          boxShadow: "0 0 20px rgba(34,197,94,0.25)",
        }}>Get started</a>
        <button className="ff-hamburger" onClick={() => setMenuOpen(!menuOpen)} style={{
          background: "transparent", border: "none",
          cursor: "pointer", padding: 4, flexDirection: "column", gap: 5,
          display: "none",
        }}>
          <span style={{ width: 22, height: 2, background: "#F1F5F9", borderRadius: 2, display: "block" }} />
          <span style={{ width: 22, height: 2, background: "#F1F5F9", borderRadius: 2, display: "block" }} />
          <span style={{ width: 22, height: 2, background: "#F1F5F9", borderRadius: 2, display: "block" }} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: "rgba(8,12,20,0.97)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", flexDirection: "column", padding: "16px 24px", gap: 4,
        }}>
          {[
            { label: "How it works", href: "#how" },
            { label: "Pricing", href: "#plans" },
            { label: "FAQ", href: "#faq" },
            { label: "Affiliates", href: "/affiliates" },
          ].map(({ label, href }) => (
            <a key={label} href={href} onClick={() => setMenuOpen(false)} style={{
              fontSize: 15, color: "#94A3B8", textDecoration: "none",
              fontWeight: 500, padding: "12px 0",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}>{label}</a>
          ))}
          <a href="/login" onClick={() => setMenuOpen(false)} style={{ fontSize: 15, color: "#94A3B8", textDecoration: "none", fontWeight: 500, padding: "12px 0" }}>Login</a>
        </div>
      )}
      </div>
    </header>
  );
}
