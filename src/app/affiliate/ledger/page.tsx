"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";

function formatMoney(v: number | null | undefined): string {
  return `$${Number(v ?? 0).toFixed(2)}`;
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

const BUCKET_COLOR: Record<string, string> = {
  pending:   "#F59E0B",
  available: "#22C55E",
  frozen:    "#94A3B8",
  negative:  "#EF4444",
};

const LIMIT = 20;

export default function AffiliateLedgerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!getToken()) { router.push("/login"); return; }
    const me = await apiFetch<any>("/api/affiliate/me");
    if (me.affiliate?.status !== "approved") { router.push("/affiliate"); return; }
    const data = await apiFetch<any>(`/api/affiliate/ledger?page=${page}&limit=${LIMIT}`);
    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
    setHasMore(data.hasMore ?? false);
    setLoading(false);
  }, [router, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#080c14", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>
      Loading...
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#F1F5F9", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "80px 24px 60px" }}>

        <div style={{ marginBottom: 40 }}>
          <a href="/dashboard" style={{ fontSize: 13, color: "#22C55E", textDecoration: "none" }}>← Dashboard</a>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 16, marginBottom: 4 }}>Affiliate Program</h1>
        </div>

        <div style={{ display: "flex", gap: 24, marginBottom: 28 }}>
          <a href="/affiliate" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Overview</a>
          <a href="/affiliate/conversions" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Conversions</a>
          <a href="/affiliate/ledger" style={{ fontSize: 13, fontWeight: 700, color: "#22C55E", textDecoration: "none" }}>Ledger</a>
          <a href="/affiliate/settings" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Settings</a>
          <a href="/affiliate/payouts" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Payouts</a>
        </div>

        <div style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9", marginBottom: 16 }}>Ledger</div>

        {items.length === 0 && total === 0 ? (
          <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "32px", textAlign: "center", fontSize: 13, color: "#475569" }}>
            No ledger entries yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
              <thead>
                <tr>
                  {["Date", "Type", "Bucket", "Amount", "Balance after", "Reason"].map(h => (
                    <th key={h} style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", padding: "12px 16px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => {
                  const bc = BUCKET_COLOR[item.bucket] ?? "#475569";
                  const amountColor = item.amount > 0 ? "#22C55E" : item.amount < 0 ? "#EF4444" : "#F1F5F9";
                  return (
                    <tr key={item.id}>
                      <td style={{ fontSize: 13, color: "#F1F5F9", padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", whiteSpace: "nowrap" }}>{formatDate(item.createdAt)}</td>
                      <td style={{ fontSize: 13, color: "#94A3B8", padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", whiteSpace: "nowrap" }}>{item.type}</td>
                      <td style={{ fontSize: 13, padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: `${bc}18`, color: bc, whiteSpace: "nowrap" }}>{item.bucket}</span>
                      </td>
                      <td style={{ fontSize: 13, fontWeight: 600, color: amountColor, padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", whiteSpace: "nowrap" }}>{formatMoney(item.amount)}</td>
                      <td style={{ fontSize: 13, color: "#F1F5F9", padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", whiteSpace: "nowrap" }}>{formatMoney(item.balanceAfter)}</td>
                      <td style={{ fontSize: 13, color: "#94A3B8", padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>{item.reason ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
              style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #334155", background: "transparent", color: page === 1 ? "#334155" : "#94A3B8", fontSize: 13, cursor: page === 1 ? "not-allowed" : "pointer" }}
            >
              ← Prev
            </button>
            <span style={{ fontSize: 13, color: "#475569" }}>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore}
              style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #334155", background: "transparent", color: !hasMore ? "#334155" : "#94A3B8", fontSize: 13, cursor: !hasMore ? "not-allowed" : "pointer" }}
            >
              Next →
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
