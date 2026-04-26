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

const TYPE_LABELS: Record<string, string> = {
  trade_open: "BUY",
  trade_close: "SELL",
  market_resolve: "RESOLVED",
  challenge_start: "STARTING BALANCE",
  adjustment: "ADJUSTMENT",
  payout: "PAYOUT",
};

const TYPE_COLORS: Record<string, string> = {
  trade_open: "#EF4444",
  trade_close: "#22C55E",
  market_resolve: "#F59E0B",
  challenge_start: "#3B82F6",
  adjustment: "#94A3B8",
  payout: "#22C55E",
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
      if (data.success) {
        setLogs(data.logs);
        setTotal(data.pagination.total);
        setOffset(newOffset);
      }
    }).finally(() => setLoading(false));
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", color: "#F8FAFC" }}>
<main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Balance History</h1>
        <p style={{ color: "#64748B", marginBottom: 32, fontSize: 14 }}>
          {total} transactions total
        </p>

        {loading ? (
          <div style={{ textAlign: "center", color: "#94A3B8", padding: 64 }}>Loading...</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: "center", color: "#64748B", padding: 64 }}>No transactions yet.</div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {logs.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
            </div>

            {/* Pagination */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
              <button
                onClick={() => loadLogs(Math.max(0, offset - LIMIT))}
                disabled={offset === 0}
                style={{
                  padding: "8px 20px", borderRadius: 8, border: "1px solid #334155",
                  background: offset === 0 ? "transparent" : "#1E293B",
                  color: offset === 0 ? "#334155" : "#F8FAFC",
                  cursor: offset === 0 ? "not-allowed" : "pointer", fontSize: 13,
                }}
              >
                ← Previous
              </button>
              <span style={{ color: "#64748B", fontSize: 13 }}>
                {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
              </span>
              <button
                onClick={() => loadLogs(offset + LIMIT)}
                disabled={offset + LIMIT >= total}
                style={{
                  padding: "8px 20px", borderRadius: 8, border: "1px solid #334155",
                  background: offset + LIMIT >= total ? "transparent" : "#1E293B",
                  color: offset + LIMIT >= total ? "#334155" : "#F8FAFC",
                  cursor: offset + LIMIT >= total ? "not-allowed" : "pointer", fontSize: 13,
                }}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function LogRow({ log }: { log: BalanceLog }) {
  const label = TYPE_LABELS[log.type] ?? log.type;
  const color = TYPE_COLORS[log.type] ?? "#94A3B8";
  const isPositive = log.amount >= 0;
  const date = new Date(log.createdAt).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div style={{
      background: "#1E293B", borderRadius: 10, padding: "14px 20px",
      border: "1px solid #334155", display: "flex", alignItems: "center",
      justifyContent: "space-between", gap: 16,
    }}>
      {/* Type badge */}
      <div style={{
        fontSize: 11, fontWeight: 700, color,
        background: `${color}20`, padding: "3px 10px",
        borderRadius: 4, whiteSpace: "nowrap",
      }}>
        {label}
      </div>

      {/* Market info */}
      <div style={{ flex: 1 }}>
        {log.trade ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#F8FAFC" }}>
              {log.trade.marketTitle}
            </div>
            <div style={{ fontSize: 12, color: "#64748B" }}>
              {log.trade.shares} {log.trade.side.toUpperCase()} shares @ {(log.trade.price * 100).toFixed(0)}¢
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: "#64748B" }}>{label}</div>
        )}
      </div>

      {/* Amount */}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: isPositive ? "#22C55E" : "#EF4444" }}>
          {isPositive ? "+" : ""}${Math.abs(log.amount).toFixed(2)}
        </div>
        <div style={{ fontSize: 11, color: "#64748B" }}>
          Balance: ${log.runningBalance.toFixed(2)}
        </div>
      </div>

      {/* Date */}
      <div style={{ fontSize: 12, color: "#64748B", whiteSpace: "nowrap" }}>
        {date}
      </div>
    </div>
  );
}
