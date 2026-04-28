"use client";
import { useState, useEffect } from "react";

type Entry = { rank: number; username: string; plan: string; totalPnl: number; winRate: number; trades: number };

const BADGE: Record<number, { icon: string; color: string }> = {
  1: { icon: "🥇", color: "#F59E0B" },
  2: { icon: "🥈", color: "#94A3B8" },
  3: { icon: "🥉", color: "#CD7F32" },
};

const PLAN_COLOR: Record<string, string> = {
  Starter: "#64748B",
  Pro: "#3B82F6",
  Elite: "#22C55E",
};

export default function LeaderboardPage() {
  const [data, setData] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setCurrentUser(payload.username ?? null);
      }
    } catch {}
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?period=${period}&limit=50`)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.leaderboard); })
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#F1F5F9", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 24px 80px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", letterSpacing: "0.1em", marginBottom: 10 }}>LEADERBOARD</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8, marginTop: 0 }}>Top Traders</h1>
          <p style={{ fontSize: 15, color: "#64748B", marginBottom: 0 }}>Rankings based on realized PnL from completed challenges.</p>
        </div>

        {/* Period filter */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 40 }}>
          {[{ v: "all", l: "All Time" }, { v: "30d", l: "30 Days" }, { v: "7d", l: "7 Days" }].map(({ v, l }) => (
            <button key={v} onClick={() => setPeriod(v)} style={{
              padding: "7px 20px", borderRadius: 8, border: "1px solid",
              borderColor: period === v ? "#22C55E" : "rgba(255,255,255,0.08)",
              background: period === v ? "rgba(34,197,94,0.1)" : "transparent",
              color: period === v ? "#22C55E" : "#64748B",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>{l}</button>
          ))}
        </div>

        {/* Top 3 */}
        {!loading && data.length >= 3 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 32 }}>
            {data.slice(0, 3).map(entry => (
              <div key={entry.rank} style={{
                background: entry.rank === 1 ? "rgba(245,158,11,0.06)" : "#0d1117",
                border: `1px solid ${entry.rank === 1 ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 14, padding: "24px 20px", textAlign: "center",
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{BADGE[entry.rank].icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", marginBottom: 4 }}>@{entry.username}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: PLAN_COLOR[entry.plan] ?? "#64748B", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>{entry.plan}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#22C55E", marginBottom: 4 }}>${entry.totalPnl.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: "#475569" }}>{entry.winRate}% win · {entry.trades} trades</div>
              </div>
            ))}
          </div>
        )}

        {/* Full table */}
        <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 100px 120px 80px 80px", padding: "10px 20px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {["#", "Trader", "Plan", "PnL", "Win %", "Trades"].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: "48px 0", textAlign: "center", color: "#475569" }}>Loading...</div>
          ) : data.length === 0 ? (
            <div style={{ padding: "48px 0", textAlign: "center", color: "#475569" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
              <div style={{ fontSize: 14 }}>No completed challenges yet. Be the first!</div>
            </div>
          ) : (
            data.map((entry, i) => {
              const isMe = currentUser && entry.username === currentUser;
              return (
                <div key={entry.rank} style={{
                  display: "grid", gridTemplateColumns: "48px 1fr 100px 120px 80px 80px",
                  padding: "14px 20px",
                  borderBottom: i < data.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  background: isMe ? "rgba(34,197,94,0.05)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                  borderLeft: isMe ? "2px solid #22C55E" : "2px solid transparent",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: BADGE[entry.rank] ? BADGE[entry.rank].color : "#475569" }}>
                    {BADGE[entry.rank] ? BADGE[entry.rank].icon : `#${entry.rank}`}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: isMe ? 700 : 500, color: isMe ? "#22C55E" : "#F1F5F9" }}>
                    @{entry.username}{isMe ? " (you)" : ""}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: PLAN_COLOR[entry.plan] ?? "#64748B" }}>{entry.plan}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: entry.totalPnl >= 0 ? "#22C55E" : "#EF4444" }}>
                    {entry.totalPnl >= 0 ? "+" : ""}${entry.totalPnl.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 13, color: "#94A3B8" }}>{entry.winRate}%</div>
                  <div style={{ fontSize: 13, color: "#64748B" }}>{entry.trades}</div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#334155" }}>
          Rankings update in real time · Min. 5 completed trades required · Completed challenges only
        </div>
      </div>
    </div>
  );
}
