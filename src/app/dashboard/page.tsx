"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { User, Position } from "@/lib/types";

interface Challenge {
  id: number;
  stage: string;
  status: string;
  startBalance: number;
  realizedBalance: number;
  peakBalance: number;
  profitTargetPct: number;
  maxTotalDdPct: number;
  minTradingDays: number;
  tradingDaysCount: number;
  profitTargetMet: boolean;
  drawdownViolated: boolean;
}

interface ModeData {
  mode: "sandbox" | "challenge";
  currentBalance: number;
  challenge: Challenge | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [modeData, setModeData] = useState<ModeData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    if (!getToken()) { router.push("/login"); return; }
    Promise.all([
      apiFetch<{ success: boolean; user: User }>("/api/user/me"),
      apiFetch<{ success: boolean; positions: Position[] }>("/api/user/positions"),
      apiFetch<ModeData & { success: boolean }>("/api/user/mode"),
    ]).then(([userData, posData, mode]) => {
      if (userData.success) setUser(userData.user);
      if (posData.success) setPositions(posData.positions);
      if (mode.success) setModeData({ mode: mode.mode, currentBalance: mode.currentBalance, challenge: mode.challenge });
    }).finally(() => setLoading(false));
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
      Loading...
    </div>
  );
  if (!user) return null;

  const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);

  const activeBalance = modeData?.mode === "challenge" && modeData.challenge
    ? modeData.challenge.realizedBalance
    : user.balance;

  const portfolioValue = activeBalance + positions.reduce((s, p) => s + p.currentValue, 0);

  const stats = [
    { label: "Available Balance", value: `$${activeBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "#22C55E", sub: modeData?.mode === "challenge" ? "challenge balance" : "paper capital" },
    { label: "Open Positions", value: String(user.openPositionsCount), color: "#3B82F6", sub: "active trades" },
    { label: "Unrealized PnL", value: `${totalUnrealized >= 0 ? "+" : ""}$${totalUnrealized.toFixed(2)}`, color: totalUnrealized >= 0 ? "#22C55E" : "#EF4444", sub: "open positions" },
    { label: "Portfolio Value", value: `$${portfolioValue.toFixed(2)}`, color: "#F59E0B", sub: "balance + positions" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px", animation: "fadeIn 0.3s ease" }}>

        {/* Page header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4, color: "var(--text-primary)" }}>
              Welcome back, {user.firstName}
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
              @{user.username} · {user.membershipStatus === "active" ? "Pro Member" : "Free Plan"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href="/account" style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8", padding: "7px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", textDecoration: "none" }}>My Account</a>
            <a href="/markets" style={{ fontSize: 13, fontWeight: 700, background: "#22C55E", color: "#071A0E", padding: "8px 18px", borderRadius: 8, textDecoration: "none" }}>Trade →</a>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 32 }}>
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

        {/* Challenge block */}
        {modeData && (
          <div style={{ marginBottom: 36 }}>
            {modeData.mode === "sandbox" ? (
              <div style={{
                background: "#1E293B",
                border: "1px solid #334155",
                borderRadius: 12,
                padding: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 20,
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    Sandbox Mode
                  </div>
                  <div style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.5 }}>
                    You&apos;re trading in sandbox. Start an evaluation to earn real payouts.
                  </div>
                </div>
                <a
                  href="/account/plans"
                  style={{
                    flexShrink: 0,
                    background: "#22C55E",
                    color: "#071A0E",
                    borderRadius: 9,
                    padding: "10px 22px",
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    textDecoration: "none",
                    transition: "background 0.15s",
                  }}
                >
                  Get Funded →
                </a>
              </div>
            ) : modeData.challenge ? (
              <ChallengeCard challenge={modeData.challenge} />
            ) : null}
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

function ChallengeCard({ challenge: c }: { challenge: Challenge }) {
  const target = parseFloat((c.startBalance * (1 + c.profitTargetPct / 100)).toFixed(2));
  const progress = Math.max(0, Math.min(100,
    parseFloat((((c.realizedBalance - c.startBalance) / (target - c.startBalance)) * 100).toFixed(1))
  ));
  const violated = c.drawdownViolated;

  return (
    <div style={{
      background: "#1E293B",
      border: "1px solid #334155",
      borderRadius: 12,
      padding: 24,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: violated ? "#EF4444" : "#22C55E", boxShadow: violated ? "0 0 8px rgba(239,68,68,0.6)" : "0 0 8px rgba(34,197,94,0.6)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
            Evaluation Challenge
          </span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
          color: violated ? "#EF4444" : "#22C55E",
          background: violated ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
          border: `1px solid ${violated ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)"}`,
          borderRadius: 4, padding: "3px 9px",
        }}>
          {violated ? "VIOLATED" : "ACTIVE"}
        </span>
      </div>

      {/* Metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Current Balance", value: `$${c.realizedBalance.toFixed(2)}` },
          { label: "Target", value: `$${target.toFixed(2)}` },
          { label: "Max Drawdown", value: `${c.maxTotalDdPct}%` },
          { label: "Trading Days", value: `${c.tradingDaysCount} / ${c.minTradingDays}` },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Profit progress */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
          <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>Profit progress</span>
          <span style={{ fontSize: 11, color: progress >= 100 ? "#22C55E" : "#94A3B8", fontWeight: 700 }}>{progress.toFixed(1)}% of {c.profitTargetPct}% target</span>
        </div>
        <div style={{ height: 8, background: "#334155", borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${Math.min(100, progress)}%`,
            background: progress >= 100 ? "#22C55E" : "linear-gradient(90deg, #16A34A, #22C55E)",
            borderRadius: 4, transition: "width 0.4s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
          <span style={{ fontSize: 10, color: "#334155" }}>${c.startBalance.toLocaleString()}</span>
          <span style={{ fontSize: 10, color: "#334155" }}>${target.toLocaleString()}</span>
        </div>
      </div>

      {/* Drawdown meter */}
      {(() => {
        const maxLoss = c.startBalance * (c.maxTotalDdPct / 100);
        const currentLoss = Math.max(0, c.startBalance - c.realizedBalance);
        const ddUsed = Math.min(100, (currentLoss / maxLoss) * 100);
        const ddColor = ddUsed >= 80 ? "#EF4444" : ddUsed >= 50 ? "#F59E0B" : "#22C55E";
        return (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>Drawdown used</span>
              <span style={{ fontSize: 11, color: ddColor, fontWeight: 700 }}>{ddUsed.toFixed(1)}% of {c.maxTotalDdPct}% limit</span>
            </div>
            <div style={{ height: 8, background: "#334155", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${ddUsed}%`,
                background: ddUsed >= 80 ? "#EF4444" : ddUsed >= 50 ? "#F59E0B" : "#22C55E",
                borderRadius: 4, transition: "width 0.4s ease",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
              <span style={{ fontSize: 10, color: "#334155" }}>$0 lost</span>
              <span style={{ fontSize: 10, color: "#334155" }}>max -${maxLoss.toFixed(0)}</span>
            </div>
          </div>
        );
      })()}
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
