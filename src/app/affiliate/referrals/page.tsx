"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  maskedUsername:    string;
  joinedAt:          string;
  status:            string;
  commissionAmount:  number | null;
  pendingUntil:      string | null;
  challengeActivity: string;
};

type ApiResponse = {
  summary: {
    totalReferred:   number;
    converted:       number;
    conversionRate:  number;
    totalCommission: number;
  };
  pagination: { page: number; pageSize: number; totalPages: number };
  rows:       Row[];
};

const STATUS_COLORS: Record<string, string> = {
  "Registered":   "#64748B",
  "Pending hold": "#F59E0B",
  "Approved":     "#3B82F6",
  "Paid":         "#22C55E",
  "Rejected":     "#EF4444",
  "Unknown":      "#475569",
};

const card: React.CSSProperties = {
  background:   "#0d1117",
  border:       "1px solid rgba(255,255,255,0.06)",
  borderRadius: 12,
  padding:      "20px 22px",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatMoney(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return "$" + n.toFixed(2);
}

export default function ReferralsPage(): React.JSX.Element {
  const router                          = useRouter();
  const [data, setData]                 = useState<ApiResponse | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [page, setPage]                 = useState(1);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login?mode=login");
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/affiliate/referrals?page=${page}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async r => {
        if (r.status === 401) { router.push("/login?mode=login"); return null; }
        if (r.status === 403) {
          const b = await r.json().catch(() => ({})) as { error?: string };
          throw new Error(b.error === "not_an_affiliate" ? "You are not an affiliate" : "Affiliate not approved");
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ApiResponse>;
      })
      .then(d => { if (d) setData(d); })
      .catch(e => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [page, router]);

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#F1F5F9", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 80px" }}>
        <a href="/affiliate" style={{ fontSize: 13, color: "#22C55E", textDecoration: "none", display: "inline-block", marginBottom: 20 }}>← Back to dashboard</a>

        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 24px" }}>Affiliate Program</h1>

        {/* Nav tabs */}
        <div style={{ display: "flex", gap: 24, borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 28, paddingBottom: 12 }}>
          <a href="/affiliate"             style={{ color: "#64748B", textDecoration: "none", fontSize: 14 }}>Overview</a>
          <a href="/affiliate/referrals"   style={{ color: "#22C55E", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>Referrals</a>
          <a href="/affiliate/conversions" style={{ color: "#64748B", textDecoration: "none", fontSize: 14 }}>Conversions</a>
          <a href="/affiliate/ledger"      style={{ color: "#64748B", textDecoration: "none", fontSize: 14 }}>Ledger</a>
          <a href="/affiliate/settings"    style={{ color: "#64748B", textDecoration: "none", fontSize: 14 }}>Settings</a>
          <a href="/affiliate/payouts"     style={{ color: "#64748B", textDecoration: "none", fontSize: 14 }}>Payouts</a>
        </div>

        {loading && <div style={{ color: "#64748B" }}>Loading…</div>}
        {error   && <div style={{ color: "#EF4444" }}>{error}</div>}

        {data && !loading && !error && (
          <>
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 28 }}>
              <div style={card}>
                <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Total referred</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{data.summary.totalReferred}</div>
              </div>
              <div style={card}>
                <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Converted</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{data.summary.converted}</div>
              </div>
              <div style={card}>
                <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Conversion rate</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{(data.summary.conversionRate * 100).toFixed(1)}%</div>
              </div>
              <div style={card}>
                <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Commission earned</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#22C55E" }}>{formatMoney(data.summary.totalCommission)}</div>
              </div>
            </div>

            {/* Table */}
            {data.rows.length === 0 ? (
              <div style={{ ...card, textAlign: "center", padding: "60px 20px", color: "#64748B" }}>
                No referrals yet. Share your link to invite users.
              </div>
            ) : (
              <div style={card}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <th style={{ textAlign: "left", padding: "12px 8px", fontWeight: 600, color: "#94A3B8", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>User</th>
                        <th style={{ textAlign: "left", padding: "12px 8px", fontWeight: 600, color: "#94A3B8", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Joined</th>
                        <th style={{ textAlign: "left", padding: "12px 8px", fontWeight: 600, color: "#94A3B8", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</th>
                        <th style={{ textAlign: "left", padding: "12px 8px", fontWeight: 600, color: "#94A3B8", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Commission</th>
                        <th style={{ textAlign: "left", padding: "12px 8px", fontWeight: 600, color: "#94A3B8", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Hold until</th>
                        <th style={{ textAlign: "left", padding: "12px 8px", fontWeight: 600, color: "#94A3B8", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Challenge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "14px 8px", fontWeight: 500 }}>{r.maskedUsername}</td>
                          <td style={{ padding: "14px 8px", color: "#94A3B8" }}>{formatDate(r.joinedAt)}</td>
                          <td style={{ padding: "14px 8px" }}>
                            <span style={{
                              display:      "inline-block",
                              padding:      "3px 10px",
                              borderRadius: 6,
                              background:   (STATUS_COLORS[r.status] ?? "#475569") + "20",
                              color:        STATUS_COLORS[r.status] ?? "#475569",
                              fontSize:     12,
                              fontWeight:   600,
                            }}>{r.status}</span>
                          </td>
                          <td style={{ padding: "14px 8px", color: r.commissionAmount ? "#22C55E" : "#475569", fontWeight: 600 }}>{formatMoney(r.commissionAmount)}</td>
                          <td style={{ padding: "14px 8px", color: "#94A3B8" }}>{r.pendingUntil ? formatDate(r.pendingUntil) : "—"}</td>
                          <td style={{ padding: "14px 8px", color: "#94A3B8", fontSize: 13 }}>{r.challengeActivity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {data.pagination.totalPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      style={{
                        background:   "transparent",
                        border:       "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 6,
                        padding:      "6px 14px",
                        color:        page <= 1 ? "#334155" : "#F1F5F9",
                        cursor:       page <= 1 ? "not-allowed" : "pointer",
                        fontSize:     13,
                      }}
                    >Previous</button>
                    <span style={{ color: "#94A3B8", fontSize: 13 }}>Page {data.pagination.page} of {data.pagination.totalPages}</span>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= data.pagination.totalPages}
                      style={{
                        background:   "transparent",
                        border:       "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 6,
                        padding:      "6px 14px",
                        color:        page >= data.pagination.totalPages ? "#334155" : "#F1F5F9",
                        cursor:       page >= data.pagination.totalPages ? "not-allowed" : "pointer",
                        fontSize:     13,
                      }}
                    >Next</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
