"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken, removeToken } from "@/lib/api";
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
      apiFetch<{ success: boolean; positions: Position[]; summary: { totalUnrealizedPnl: number; totalRealizedPnl: number } }>("/api/user/positions"),
    ]).then(([userData, posData]) => {
      if (userData.success) setUser(userData.user);
      if (posData.success) setPositions(posData.positions);
    }).finally(() => setLoading(false));
  }, []);

  function handleLogout() {
    removeToken();
    router.push("/login");
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}>
      Loading...
    </div>
  );

  if (!user) return null;

  const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", color: "#F8FAFC" }}>
<main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
        {/* Welcome */}
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
          Welcome back, {user.firstName}
        </h1>
        <p style={{ color: "#64748B", marginBottom: 40, fontSize: 14 }}>
          @{user.username} · {user.membershipStatus === "active" ? "⭐ Pro Member" : "Free Plan"}
        </p>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 40 }}>
          <StatCard label="Available Balance" value={`$${user.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} color="#22C55E" />
          <StatCard label="Open Positions" value={String(user.openPositionsCount)} color="#3B82F6" />
          <StatCard
            label="Unrealized PnL"
            value={`${totalUnrealized >= 0 ? "+" : ""}$${totalUnrealized.toFixed(2)}`}
            color={totalUnrealized >= 0 ? "#22C55E" : "#EF4444"}
          />
          <StatCard
            label="Total Portfolio Value"
            value={`$${(user.balance + positions.reduce((s, p) => s + p.currentValue, 0)).toFixed(2)}`}
            color="#F59E0B"
          />
        </div>

        {/* Active Challenge */}
        {user.activeChallenge && (
          <div style={{ background: "#1E293B", borderRadius: 12, padding: 24, border: "1px solid #334155", marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#22C55E" }}>
              Active Challenge — {user.activeChallenge.stage.toUpperCase()}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              <MiniStat label="Start Balance" value={`$${user.activeChallenge.startBalance.toLocaleString()}`} />
              <MiniStat label="Current Balance" value={`$${user.activeChallenge.realizedBalance.toFixed(2)}`} />
              <MiniStat label="Profit Target" value={`${user.activeChallenge.profitTargetPct}%`} />
              <MiniStat label="Max Drawdown" value={`${user.activeChallenge.maxTotalDdPct}%`} />
              <MiniStat label="Trading Days" value={`${user.activeChallenge.tradingDaysCount} / ${user.activeChallenge.minTradingDays}`} />
              <MiniStat label="Target Met" value={user.activeChallenge.profitTargetMet ? "✓ Yes" : "Not yet"} />
            </div>
          </div>
        )}

        {/* Open Positions */}
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Open Positions</h2>

        {positions.length === 0 ? (
          <div style={{ background: "#1E293B", borderRadius: 12, padding: 40, textAlign: "center", color: "#64748B", border: "1px solid #334155" }}>
            No open positions.{" "}
            <a href="/markets" style={{ color: "#22C55E", textDecoration: "none" }}>Browse markets →</a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {positions.map((p) => (
              <PositionRow key={p.id} position={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "#1E293B", borderRadius: 12, padding: 20, border: "1px solid #334155" }}>
      <div style={{ fontSize: 12, color: "#64748B", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#F8FAFC" }}>{value}</div>
    </div>
  );
}

function PositionRow({ position: p }: { position: Position }) {
  const pnlColor = p.unrealizedPnl >= 0 ? "#22C55E" : "#EF4444";

  return (
    <a href={`/markets/${p.marketId}`} style={{ textDecoration: "none" }}>
      <div style={{
        background: "#1E293B", borderRadius: 12, padding: "16px 20px",
        border: "1px solid #334155", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 16,
      }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22C55E")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#334155")}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#F8FAFC", marginBottom: 4 }}>{p.marketTitle}</div>
          <div style={{ fontSize: 12, color: "#64748B" }}>{p.marketCategory}</div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>Side</div>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: p.side === "yes" ? "#22C55E" : "#EF4444",
            background: p.side === "yes" ? "#22C55E20" : "#EF444420",
            padding: "2px 10px", borderRadius: 4,
          }}>
            {p.side.toUpperCase()}
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>Shares</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{p.shares}</div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>Avg Price</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{(p.avgPrice * 100).toFixed(0)}¢</div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>Current</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{(p.currentPrice * 100).toFixed(0)}¢</div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>Value</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>${p.currentValue.toFixed(2)}</div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>Unrealized PnL</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: pnlColor }}>
            {p.unrealizedPnl >= 0 ? "+" : ""}${p.unrealizedPnl.toFixed(2)}
          </div>
        </div>
      </div>
    </a>
  );
}
