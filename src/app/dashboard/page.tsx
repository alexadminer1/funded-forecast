"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { User, Position } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    Promise.all([
      apiFetch<{ success: boolean; user: User }>("/api/user/me"),
      apiFetch<{ success: boolean; positions: Position[] }>("/api/user/positions"),
    ]).then(([userData, posData]) => {
      if (userData.success) setUser(userData.user);
      if (posData.success) setPositions(posData.positions);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
      Loading...
    </div>
  );
  if (!user) return null;

  const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const portfolioValue = user.balance + positions.reduce((s, p) => s + p.currentValue, 0);

  const stats = [
    { label: "Available Balance", value: `$${user.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "#22C55E", sub: "paper capital" },
    { label: "Open Positions", value: String(user.openPositionsCount), color: "#3B82F6", sub: "active trades" },
    { label: "Unrealized PnL", value: `${totalUnrealized >= 0 ? "+" : ""}$${totalUnrealized.toFixed(2)}`, color: totalUnrealized >= 0 ? "#22C55E" : "#EF4444", sub: "open positions" },
    { label: "Portfolio Value", value: `$${portfolioValue.toFixed(2)}`, color: "#F59E0B", sub: "balance + positions" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px", animation: "fadeIn 0.3s ease" }}>

        {/* Page header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4, color: "var(--text-primary)" }}>
            Welcome back, {user.firstName}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            @{user.username} · {user.membershipStatus === "active" ? "Pro Member" : "Free Plan"}
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 40 }}>
          {stats.map(({ label, value, color, sub }) => (
            <div key={label} style={{
              background: "linear-gradient(160deg, var(--bg-surface) 0%, var(--bg-page) 100%)",
              borderRadius: "var(--radius-card)",
              padding: "20px 22px",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.03)",
            }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: "-0.03em", marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Challenge */}
        {user.activeChallenge && (
          <div style={{
            background: "linear-gradient(160deg, var(--bg-surface) 0%, var(--bg-page) 100%)",
            borderRadius: "var(--radius-card)",
            padding: "22px 24px",
            border: "1px solid rgba(34,197,94,0.15)",
            boxShadow: "0 0 32px rgba(34,197,94,0.04), var(--shadow-card)",
            marginBottom: 36,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 8px rgba(34,197,94,0.6)" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#22C55E", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Active Challenge — {user.activeChallenge.stage.toUpperCase()}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
              {[
                { label: "Start Balance", value: `$${user.activeChallenge.startBalance.toLocaleString()}` },
                { label: "Current Balance", value: `$${user.activeChallenge.realizedBalance.toFixed(2)}` },
                { label: "Profit Target", value: `${user.activeChallenge.profitTargetPct}%` },
                { label: "Max Drawdown", value: `${user.activeChallenge.maxTotalDdPct}%` },
                { label: "Trading Days", value: `${user.activeChallenge.tradingDaysCount} / ${user.activeChallenge.minTradingDays}` },
                { label: "Target Met", value: user.activeChallenge.profitTargetMet ? "✓ Yes" : "Not yet" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Positions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>Open Positions</h2>
          <a href="/markets" style={{ fontSize: 13, color: "#22C55E", textDecoration: "none" }}>Browse markets →</a>
        </div>

        {positions.length === 0 ? (
          <div style={{
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-card)",
            padding: 48,
            textAlign: "center",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
            fontSize: 14,
          }}>
            No open positions yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {positions.map((p) => <PositionRow key={p.id} position={p} />)}
          </div>
        )}
      </main>
    </div>
  );
}

function PositionRow({ position: p }: { position: Position }) {
  const pnlColor = p.unrealizedPnl >= 0 ? "#22C55E" : "#EF4444";
  return (
    <a href={`/markets/${p.marketId}`} style={{ textDecoration: "none" }}>
      <div style={{
        background: "linear-gradient(160deg, var(--bg-surface) 0%, var(--bg-page) 100%)",
        borderRadius: 12,
        padding: "15px 20px",
        border: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        boxShadow: "var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.02)",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
        onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(34,197,94,0.3)"; el.style.boxShadow = "var(--shadow-hover)"; }}
        onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--border)"; el.style.boxShadow = "var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.02)"; }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.marketTitle}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{p.marketCategory}</div>
        </div>

        {[
          { label: "Side", value: p.side.toUpperCase(), color: p.side === "yes" ? "#22C55E" : "#EF4444", pill: true },
          { label: "Shares", value: String(p.shares) },
          { label: "Avg", value: `${(p.avgPrice * 100).toFixed(0)}¢` },
          { label: "Current", value: `${(p.currentPrice * 100).toFixed(0)}¢` },
          { label: "Value", value: `$${p.currentValue.toFixed(2)}` },
        ].map(({ label, value, color, pill }) => (
          <div key={label} style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</div>
            {pill ? (
              <div style={{ fontSize: 11, fontWeight: 700, color, background: p.side === "yes" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", padding: "2px 8px", borderRadius: 4 }}>{value}</div>
            ) : (
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{value}</div>
            )}
          </div>
        ))}

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Unrealized</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: pnlColor, letterSpacing: "-0.02em" }}>
            {p.unrealizedPnl >= 0 ? "+" : ""}${p.unrealizedPnl.toFixed(2)}
          </div>
        </div>
      </div>
    </a>
  );
}
