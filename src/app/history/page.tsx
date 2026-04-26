"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";

interface BalanceLog {
  id: number;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  runningBalance: number;
  createdAt: string;
  trade: {
    id: number;
    action: string;
    side: string;
    shares: number;
    price: number;
    marketId: string;
    marketTitle: string;
  } | null;
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  trade_open:      { label: "BUY",             color: "#3B82F6" },
  trade_close:     { label: "SELL",            color: "#22C55E" },
  market_resolve:  { label: "RESOLVED",        color: "#F59E0B" },
  challenge_start: { label: "STARTING BALANCE", color: "#8B5CF6" },
  adjustment:      { label: "ADJUSTMENT",       color: "#64748B" },
  payout:          { label: "PAYOUT",           color: "#22C55E" },
};

export default function HistoryPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<BalanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    loadLogs(0);
  }, []);

  function loadLogs(newOffset: number) {
    setLoading(true);
    apiFetch<{ success: boolean; logs: BalanceLog[]; pagination: { total: number } }>(
      `/api/user/balance/history?limit=${LIMIT}&offset=${newOffset}`
    ).then((data) => {
      if (data.success) { setLogs(data.logs); setTotal(data.pagination.total); setOffset(newOffset); }
    }).finally(() => setLoading(false));
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px", animation: "fadeIn 0.3s ease" }}>

        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4, color: "var(--text-primary)" }}>Balance History</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{total} transactions</p>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{ background: "var(--bg-surface)", borderRadius: 10, padding: "16px 20px", border: "1px solid var(--border-subtle)", height: 64, animation: "pulse 1.8s ease-in-out infinite" }} />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 80, fontSize: 14 }}>No transactions yet.</div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {logs.map((log) => <LogRow key={log.id} log={log} />)}
            </div>

            {/* Pagination */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
              <button
                onClick={() => loadLogs(Math.max(0, offset - LIMIT))}
                disabled={offset === 0}
                style={{
                  padding: "8px 18px", borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: offset === 0 ? "var(--text-muted)" : "var(--text-secondary)",
                  cursor: offset === 0 ? "not-allowed" : "pointer", fontSize: 13,
                  opacity: offset === 0 ? 0.4 : 1, transition: "opacity 0.15s",
                }}
              >← Previous</button>
              <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
              </span>
              <button
                onClick={() => loadLogs(offset + LIMIT)}
                disabled={offset + LIMIT >= total}
                style={{
                  padding: "8px 18px", borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: offset + LIMIT >= total ? "var(--text-muted)" : "var(--text-secondary)",
                  cursor: offset + LIMIT >= total ? "not-allowed" : "pointer", fontSize: 13,
                  opacity: offset + LIMIT >= total ? 0.4 : 1, transition: "opacity 0.15s",
                }}
              >Next →</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function LogRow({ log }: { log: BalanceLog }) {
  const meta = TYPE_META[log.type] ?? { label: log.type, color: "#64748B" };
  const isPositive = log.amount >= 0;
  const date = new Date(log.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{
      background: "linear-gradient(160deg, var(--bg-surface) 0%, var(--bg-page) 100%)",
      borderRadius: 10,
      padding: "13px 18px",
      border: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      gap: 14,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
      transition: "border-color 0.15s",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
    >
      {/* Badge */}
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: meta.color,
        background: `${meta.color}18`,
        border: `1px solid ${meta.color}30`,
        padding: "3px 9px",
        borderRadius: 4,
        whiteSpace: "nowrap",
        letterSpacing: "0.05em",
        flexShrink: 0,
      }}>
        {meta.label}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {log.trade ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {log.trade.marketTitle}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {log.trade.shares} {log.trade.side.toUpperCase()} @ {(log.trade.price * 100).toFixed(0)}¢
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{meta.label}</div>
        )}
      </div>

      {/* Amount */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: isPositive ? "#22C55E" : "#EF4444", letterSpacing: "-0.02em" }}>
          {isPositive ? "+" : ""}${Math.abs(log.amount).toFixed(2)}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>${log.runningBalance.toFixed(2)}</div>
      </div>

      {/* Date */}
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>{date}</div>
    </div>
  );
}
