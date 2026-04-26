"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, apiFetch } from "@/lib/api";
import { setToken } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) { setChecked(true); return; }
    apiFetch<{ success: boolean }>("/api/user/me")
      .then((d) => { if (d.success) router.replace("/markets"); else setChecked(true); })
      .catch(() => setChecked(true));
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ success: boolean; token?: string; error?: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (data.success && data.token) {
        setToken(data.token);
        router.replace("/markets");
      } else {
        setError(data.error ?? "Invalid credentials");
      }
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
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
      background: "#080c14",
      color: "#F1F5F9",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      overflowX: "hidden",
    }}>
      {/* Green glow */}
      <div style={{
        position: "fixed",
        top: -200,
        left: "50%",
        transform: "translateX(-50%)",
        width: 900,
        height: 600,
        background: "radial-gradient(ellipse, rgba(34,197,94,0.13) 0%, transparent 65%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* Nav */}
      <header style={{
        position: "relative",
        zIndex: 10,
        padding: "20px 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        {/* Logo */}
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: "linear-gradient(135deg, #22C55E, #16A34A)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 800, color: "#071A0E",
            boxShadow: "0 0 16px rgba(34,197,94,0.35)",
          }}>F</div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em", color: "#F1F5F9" }}>FundedForecast</span>
        </a>

        {/* Center links */}
        <nav style={{ display: "flex", gap: 32, alignItems: "center" }}>
          {[{ href: "/markets", label: "Markets" }, { href: "#how", label: "How it works" }].map(({ href, label }) => (
            <a key={label} href={href} style={{ fontSize: 14, color: "#64748B", textDecoration: "none", fontWeight: 500, transition: "color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#94A3B8")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#64748B")}
            >{label}</a>
          ))}
        </nav>

        {/* Get started */}
        <a href="/register" style={{
          fontSize: 13, fontWeight: 700,
          background: "#22C55E", color: "#071A0E",
          padding: "8px 20px", borderRadius: 9,
          textDecoration: "none", letterSpacing: "-0.01em",
          boxShadow: "0 0 20px rgba(34,197,94,0.25)",
          transition: "box-shadow 0.15s",
        }}
          onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 0 32px rgba(34,197,94,0.45)")}
          onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 0 20px rgba(34,197,94,0.25)")}
        >Get started</a>
      </header>

      {/* Main */}
      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "64px 24px 80px",
        position: "relative",
        zIndex: 1,
        textAlign: "center",
      }}>
        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
          borderRadius: 20, padding: "5px 14px",
          fontSize: 11.5, fontWeight: 600, color: "#22C55E",
          letterSpacing: "0.05em", marginBottom: 30,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 6px rgba(34,197,94,0.8)", display: "inline-block" }} />
          LIVE MARKETS · PAPER TRADING
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: "clamp(38px, 6vw, 66px)",
          fontWeight: 800, letterSpacing: "-0.04em",
          lineHeight: 1.08, marginBottom: 18, maxWidth: 680,
          background: "linear-gradient(180deg, #F1F5F9 0%, #94A3B8 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        }}>
          Trade predictions.<br />Get funded.
        </h1>

        <p style={{
          fontSize: 17, color: "#64748B", maxWidth: 420,
          lineHeight: 1.65, marginBottom: 48, letterSpacing: "-0.01em",
        }}>
          Prove your forecasting skills on real Polymarket events. Pass the challenge, earn up to 80% of profits.
        </p>

        {/* Login card */}
        <div style={{
          width: "100%", maxWidth: 400,
          background: "linear-gradient(160deg, #0D1521 0%, #080c14 100%)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 18, padding: "28px 28px 24px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
          marginBottom: 56,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", marginBottom: 6, letterSpacing: "-0.02em" }}>
            Sign in to your account
          </div>
          <div style={{ fontSize: 13, color: "#475569", marginBottom: 22 }}>
            No credit card required.
          </div>

          <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="email" placeholder="Email address" value={email}
              onChange={(e) => setEmail(e.target.value)} required
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.08)", background: "#060C16",
                color: "#F1F5F9", fontSize: 14, outline: "none", boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(34,197,94,0.4)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
            />
            <input
              type="password" placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)} required
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.08)", background: "#060C16",
                color: "#F1F5F9", fontSize: 14, outline: "none", boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(34,197,94,0.4)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
            />

            {error && (
              <div style={{ fontSize: 13, color: "#EF4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "9px 12px", textAlign: "left" }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: "100%", padding: "12px", borderRadius: 9,
                background: loading ? "#16532d" : "#22C55E",
                color: "#071A0E", border: "none", fontSize: 14, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer", letterSpacing: "-0.01em",
                boxShadow: loading ? "none" : "0 0 24px rgba(34,197,94,0.25)",
                marginTop: 2, transition: "box-shadow 0.15s",
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.boxShadow = "0 0 36px rgba(34,197,94,0.4)"; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.boxShadow = "0 0 24px rgba(34,197,94,0.25)"; }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <span style={{ fontSize: 12, color: "#334155" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          </div>

          {/* Google */}
          <button
            onClick={() => router.push("/login")}
            style={{
              width: "100%", padding: "11px", borderRadius: 9,
              background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
              color: "#94A3B8", fontSize: 13, fontWeight: 500, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#F1F5F9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#94A3B8"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div style={{ marginTop: 16, fontSize: 13, color: "#475569" }}>
            Don&apos;t have an account?{" "}
            <a href="/register" style={{ color: "#22C55E", textDecoration: "none", fontWeight: 600 }}>Get started</a>
          </div>
        </div>

        {/* Stats */}
        <div style={{
          display: "flex", gap: 0,
          borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden", background: "rgba(13,21,33,0.6)",
          backdropFilter: "blur(12px)",
        }}>
          {stats.map(({ value, label }, i) => (
            <div key={label} style={{
              padding: "18px 28px", textAlign: "center",
              borderRight: i < stats.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#22C55E", letterSpacing: "-0.03em", marginBottom: 3 }}>{value}</div>
              <div style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
