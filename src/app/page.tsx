"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, apiFetch, setToken } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!getToken()) { setChecked(true); return; }
    apiFetch<{ success: boolean }>("/api/user/me")
      .then((d) => { if (d.success) router.replace("/markets"); else setChecked(true); })
      .catch(() => setChecked(true));
  }, []);

  function handleContinue() {
    if (!email.trim()) return;
    router.push(`/login?email=${encodeURIComponent(email)}`);
  }

  if (!checked) return null;

  const stats = [
    { value: "$10,000", label: "Paper capital" },
    { value: "100+", label: "Live markets" },
    { value: "80%", label: "Profit share" },
    { value: "Real-time", label: "Price data" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#070D19",
      color: "#F1F5F9",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      overflowX: "hidden",
    }}>
      {/* Glow */}
      <div style={{
        position: "fixed",
        top: -160,
        left: "50%",
        transform: "translateX(-50%)",
        width: 800,
        height: 500,
        background: "radial-gradient(ellipse, rgba(34,197,94,0.12) 0%, transparent 65%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* Minimal header */}
      <header style={{
        position: "relative",
        zIndex: 10,
        padding: "20px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: "linear-gradient(135deg, #22C55E, #16A34A)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 800, color: "#071A0E",
            boxShadow: "0 0 16px rgba(34,197,94,0.35)",
          }}>F</div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em" }}>FundedForecast</span>
        </div>
        <a href="/login" style={{
          fontSize: 13, color: "#64748B", textDecoration: "none",
          padding: "6px 16px", borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.08)",
          transition: "color 0.15s, border-color 0.15s",
        }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#64748B"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
        >
          Sign in
        </a>
      </header>

      {/* Hero */}
      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 24px 60px",
        position: "relative",
        zIndex: 1,
        textAlign: "center",
      }}>
        {/* Badge */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(34,197,94,0.08)",
          border: "1px solid rgba(34,197,94,0.2)",
          borderRadius: 20,
          padding: "5px 14px",
          fontSize: 12,
          fontWeight: 600,
          color: "#22C55E",
          letterSpacing: "0.04em",
          marginBottom: 32,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 6px rgba(34,197,94,0.8)", display: "inline-block" }} />
          LIVE MARKETS · PAPER TRADING
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: "clamp(36px, 6vw, 64px)",
          fontWeight: 800,
          letterSpacing: "-0.04em",
          lineHeight: 1.1,
          marginBottom: 20,
          maxWidth: 680,
          background: "linear-gradient(180deg, #F1F5F9 0%, #94A3B8 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          Trade predictions.<br />Get funded.
        </h1>

        <p style={{
          fontSize: 17,
          color: "#64748B",
          maxWidth: 440,
          lineHeight: 1.65,
          marginBottom: 44,
          letterSpacing: "-0.01em",
        }}>
          Prove your forecasting skills on real Polymarket events. Pass the challenge, earn up to 80% of profits.
        </p>

        {/* Form */}
        <div style={{
          width: "100%",
          maxWidth: 400,
          background: "linear-gradient(160deg, #0D1521 0%, #070D19 100%)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
          marginBottom: 64,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#F1F5F9", marginBottom: 4, letterSpacing: "-0.01em" }}>
            Start for free
          </div>
          <div style={{ fontSize: 13, color: "#475569", marginBottom: 20 }}>
            No credit card required.
          </div>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleContinue()}
            style={{
              width: "100%",
              padding: "11px 14px",
              borderRadius: 9,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "#060C16",
              color: "#F1F5F9",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
              marginBottom: 10,
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(34,197,94,0.4)")}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />

          <button
            onClick={handleContinue}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 9,
              background: "#22C55E",
              color: "#071A0E",
              border: "none",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "-0.01em",
              boxShadow: "0 0 24px rgba(34,197,94,0.25)",
              marginBottom: 14,
              transition: "box-shadow 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 0 36px rgba(34,197,94,0.4)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 0 24px rgba(34,197,94,0.25)")}
          >
            Continue →
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <span style={{ fontSize: 12, color: "#334155" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          </div>

          {/* Google */}
          <button
            onClick={() => router.push("/login")}
            style={{
              width: "100%",
              padding: "11px",
              borderRadius: 9,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#94A3B8",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLElement).style.color = "#F1F5F9"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Stats */}
        <div style={{
          display: "flex",
          gap: 0,
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden",
          background: "rgba(13,21,33,0.6)",
          backdropFilter: "blur(12px)",
        }}>
          {stats.map(({ value, label }, i) => (
            <div key={label} style={{
              padding: "18px 28px",
              textAlign: "center",
              borderRight: i < stats.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#22C55E", letterSpacing: "-0.03em", marginBottom: 3 }}>{value}</div>
              <div style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: "20px 32px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        display: "flex",
        justifyContent: "center",
        gap: 24,
        fontSize: 12,
        color: "#334155",
        position: "relative",
        zIndex: 1,
      }}>
        <a href="/markets" style={{ color: "#334155", textDecoration: "none" }}>Markets</a>
        <a href="/login" style={{ color: "#334155", textDecoration: "none" }}>Sign In</a>
      </footer>
    </div>
  );
}
