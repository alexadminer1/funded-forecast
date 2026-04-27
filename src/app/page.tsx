"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, apiFetch, setToken } from "@/lib/api";

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
      const data = await apiFetch<{ success: boolean; token?: string; error?: string }>("/api/login", {
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
          <a href="#how" style={{ fontSize: 14, color: "#64748B", textDecoration: "none", fontWeight: 500, transition: "color 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#94A3B8")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#64748B")}
          >How it works</a>
        </nav>

        {/* Get started */}
        <a href="/login?mode=register" style={{
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

          <div style={{ marginTop: 12, fontSize: 13, color: "#475569" }}>
            Don&apos;t have an account?{" "}
            <a href="/login?mode=register" style={{ color: "#22C55E", textDecoration: "none", fontWeight: 600 }}>Get started</a>
          </div>
        </div>

        {/* Stats */}
        <div style={{
          display: "flex", gap: 0,
          borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden", background: "rgba(13,21,33,0.6)",
          backdropFilter: "blur(12px)",
          marginBottom: 120,
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

        {/* ── How it works ── */}
        <section id="how" style={{ width: "100%", maxWidth: 900, marginBottom: 120, textAlign: "left" }}>
          <SectionLabel>HOW IT WORKS</SectionLabel>
          <h2 style={h2}>Three steps to funding</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { step: "01", title: "Sign up", desc: "Create a free account and receive $10,000 in paper capital instantly. No deposit required." },
              { step: "02", title: "Trade markets", desc: "Buy and sell YES/NO shares on real Polymarket events. Live prices, real spreads." },
              { step: "03", title: "Get funded", desc: "Hit 10% profit target in 10+ trading days without exceeding 10% drawdown. Earn 80% of profits." },
            ].map(({ step, title, desc }) => (
              <div key={step} style={card}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", letterSpacing: "0.08em", marginBottom: 12 }}>{step}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9", marginBottom: 8, letterSpacing: "-0.02em" }}>{title}</div>
                <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Live markets preview ── */}
        <section style={{ width: "100%", maxWidth: 900, marginBottom: 120, textAlign: "left" }}>
          <SectionLabel>MARKETS</SectionLabel>
          <h2 style={h2}>Live market preview</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { title: "Will Bitcoin exceed $120,000 before July 2026?", category: "Crypto", yes: 62, no: 38, vol: "$84k" },
              { title: "Will the US hold a federal election in November 2026?", category: "Politics", yes: 91, no: 9, vol: "$210k" },
              { title: "Will the NBA Finals go to 7 games in 2026?", category: "Sports", yes: 34, no: 66, vol: "$31k" },
            ].map(({ title, category, yes, no, vol }) => (
              <div key={title} style={{ ...card, display: "flex", alignItems: "center", gap: 20, padding: "16px 20px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{category}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#F1F5F9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#22C55E", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, padding: "4px 10px" }}>YES {yes}¢</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#EF4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "4px 10px" }}>NO {no}¢</span>
                </div>
                <div style={{ fontSize: 12, color: "#475569", flexShrink: 0 }}>{vol} vol</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, textAlign: "center" }}>
            <a href="/markets" style={{ fontSize: 13, color: "#22C55E", textDecoration: "none" }}>View all markets →</a>
          </div>
        </section>

        {/* ── Why traders choose us ── */}
        <section style={{ width: "100%", maxWidth: 900, marginBottom: 120, textAlign: "left" }}>
          <SectionLabel>ADVANTAGES</SectionLabel>
          <h2 style={h2}>Why traders choose us</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {[
              { icon: "◈", title: "Real market data", desc: "All prices sourced directly from Polymarket. No artificial spreads or fake liquidity." },
              { icon: "◎", title: "Paper capital", desc: "$10,000 virtual balance. Trade real markets without financial risk." },
              { icon: "◉", title: "Fair evaluation", desc: "10% profit target over minimum 10 trading days. Clear, transparent rules." },
              { icon: "◆", title: "80% profit share", desc: "Pass the evaluation and keep 80% of all profits generated on your funded account." },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={card}>
                <div style={{ fontSize: 20, marginBottom: 12, color: "#22C55E" }}>{icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", marginBottom: 6, letterSpacing: "-0.02em" }}>{title}</div>
                <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Earnings examples ── */}
        <section style={{ width: "100%", maxWidth: 900, marginBottom: 120, textAlign: "left" }}>
          <SectionLabel>RESULTS</SectionLabel>
          <h2 style={h2}>Earnings examples</h2>
          <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", background: "rgba(255,255,255,0.02)", padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Trader", "Profit", "Payout (80%)", "Status"].map((h) => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</div>
              ))}
            </div>
            {[
              { trader: "@forecast_king", profit: "$1,420", payout: "$1,136", status: "Funded" },
              { trader: "@prob_wizard", profit: "$890", payout: "$712", status: "Funded" },
              { trader: "@markets_pro", profit: "$2,100", payout: "$1,680", status: "Funded" },
              { trader: "@alpha_caller", profit: "$540", payout: "$432", status: "In progress" },
            ].map(({ trader, profit, payout, status }, i) => (
              <div key={trader} style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
                padding: "14px 20px",
                borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none",
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
              }}>
                <div style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500 }}>{trader}</div>
                <div style={{ fontSize: 13, color: "#22C55E", fontWeight: 700 }}>{profit}</div>
                <div style={{ fontSize: 13, color: "#F1F5F9", fontWeight: 600 }}>{payout}</div>
                <div>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: status === "Funded" ? "#22C55E" : "#F59E0B",
                    background: status === "Funded" ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)",
                    border: `1px solid ${status === "Funded" ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)"}`,
                    borderRadius: 4, padding: "2px 8px", letterSpacing: "0.04em",
                  }}>{status.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Risk rules ── */}
        <section style={{ width: "100%", maxWidth: 900, marginBottom: 120, textAlign: "left" }}>
          <SectionLabel>RULES</SectionLabel>
          <h2 style={h2}>Evaluation criteria</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { value: "10%", label: "Profit target", desc: "Grow your $10,000 account by at least $1,000 to pass." },
              { value: "10%", label: "Max drawdown", desc: "Never lose more than $1,000 from the starting balance." },
              { value: "10", label: "Min trading days", desc: "Trade on at least 10 separate calendar days." },
            ].map(({ value, label, desc }) => (
              <div key={label} style={{ ...card, textAlign: "center" }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: "#22C55E", letterSpacing: "-0.04em", marginBottom: 6 }}>{value}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#F1F5F9", marginBottom: 8 }}>{label}</div>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section style={{ width: "100%", maxWidth: 600, textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.04em", color: "#F1F5F9", marginBottom: 12 }}>
            Ready to get funded?
          </h2>
          <p style={{ fontSize: 15, color: "#475569", marginBottom: 28, lineHeight: 1.6 }}>
            Join 2,400+ traders proving their skills on real Polymarket events.
          </p>
          <a href="/login?mode=register" style={{
            display: "inline-block",
            background: "#22C55E", color: "#071A0E",
            fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em",
            padding: "14px 40px", borderRadius: 10,
            textDecoration: "none",
            border: "1px solid rgba(34,197,94,0.4)",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#16A34A")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#22C55E")}
          >
            Start your evaluation →
          </a>
        </section>

      </main>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#0d1117",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 12,
  padding: "20px 22px",
};

const h2: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  letterSpacing: "-0.03em",
  color: "#F1F5F9",
  marginBottom: 20,
  marginTop: 0,
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", letterSpacing: "0.1em", marginBottom: 10 }}>
      {children}
    </div>
  );
}
