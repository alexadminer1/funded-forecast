"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";

function formatMoney(v: number | null | undefined): string {
  return `$${Number(v ?? 0).toFixed(2)}`;
}

const card: React.CSSProperties = { background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "24px 28px", marginBottom: 16 };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 };

export default function AffiliatePage() {
  const router = useRouter();
  const [affiliate, setAffiliate] = useState<any>(undefined);
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!getToken()) { router.push("/login"); return; }
    const res = await apiFetch<any>("/api/affiliate/me");
    const aff = res.affiliate ?? null;
    setAffiliate(aff);
    if (aff?.status === "approved") {
      const b = await apiFetch<any>("/api/affiliate/balances");
      setBalances(b);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#080c14", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>
      Loading...
    </div>
  );

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const shareUrl = affiliate?.refCode ? `${baseUrl}/r/${affiliate.refCode}` : "";

  function copyShareUrl() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#F1F5F9", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "80px 24px 60px" }}>

        <div style={{ marginBottom: 40 }}>
          <a href="/dashboard" style={{ fontSize: 13, color: "#22C55E", textDecoration: "none" }}>← Dashboard</a>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 16, marginBottom: 4 }}>Affiliate Program</h1>
        </div>

        {affiliate?.status === "approved" && (
          <div style={{ display: "flex", gap: 24, marginBottom: 28 }}>
            <a href="/affiliate" style={{ fontSize: 13, fontWeight: 700, color: "#22C55E", textDecoration: "none" }}>Overview</a>
            <a href="/affiliate/referrals" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Referrals</a>
            <a href="/affiliate/conversions" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Conversions</a>
            <a href="/affiliate/ledger" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Ledger</a>
            <a href="/affiliate/settings" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Settings</a>
            <a href="/affiliate/payouts" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Payouts</a>
          </div>
        )}

        <div style={card}>
          {affiliate === null && (
            <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9", marginBottom: 8 }}>Become an affiliate</div>
              <div style={{ fontSize: 13, color: "#475569", marginBottom: 24 }}>Earn commissions by referring traders to FundedForecast.</div>
              <a href="/affiliate/apply" style={{ display: "inline-block", padding: "10px 24px", borderRadius: 8, background: "#22C55E", color: "#071A0E", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                Apply to become an affiliate →
              </a>
            </div>
          )}

          {affiliate?.status === "pending" && (
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 4, background: "rgba(245,158,11,0.1)", color: "#F59E0B" }}>PENDING</span>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", marginTop: 14, marginBottom: 6 }}>Application under review</div>
              <div style={{ fontSize: 13, color: "#475569" }}>We'll notify you once a decision is made.</div>
            </div>
          )}

          {affiliate?.status === "rejected" && (
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 4, background: "rgba(239,68,68,0.1)", color: "#EF4444" }}>REJECTED</span>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", marginTop: 14, marginBottom: 6 }}>Application rejected</div>
              {affiliate.rejectionReason && (
                <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 8, padding: "10px 14px", background: "rgba(239,68,68,0.05)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.15)" }}>
                  {affiliate.rejectionReason}
                </div>
              )}
            </div>
          )}

          {affiliate?.status === "approved" && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 4, background: "rgba(34,197,94,0.1)", color: "#22C55E" }}>APPROVED</span>
          )}
        </div>

        {affiliate?.status === "approved" && (
          <>
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 20 }}>Your referral link</div>
              <div style={{ marginBottom: 16 }}>
                <div style={labelStyle}>Referral code</div>
                <div style={{ fontFamily: "monospace", fontSize: 15, color: "#22C55E", background: "#080c14", padding: "8px 12px", borderRadius: 6, border: "1px solid #1E293B", display: "inline-block" }}>
                  {affiliate.refCode}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Share URL</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontFamily: "monospace", fontSize: 13, color: "#94A3B8", background: "#080c14", padding: "8px 12px", borderRadius: 6, border: "1px solid #1E293B", flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {shareUrl}
                  </div>
                  <button
                    onClick={copyShareUrl}
                    style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: copied ? "#16a34a" : "#22C55E", color: "#071A0E", fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 20 }}>Balances</div>
              {balances === null ? (
                <div style={{ fontSize: 13, color: "#475569" }}>Loading balances...</div>
              ) : typeof balances.balanceAvailable !== "number" ? (
                <div style={{ fontSize: 13, color: "#EF4444" }}>Failed to load balances</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "#080c14", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10, padding: "16px 20px" }}>
                    <div style={labelStyle}>Available</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "#F1F5F9" }}>{formatMoney(balances.balanceAvailable)}</div>
                  </div>
                  <div style={{ background: "#080c14", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10, padding: "16px 20px" }}>
                    <div style={labelStyle}>Pending</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "#94A3B8" }}>{formatMoney(balances.balancePending)}</div>
                  </div>
                  <div style={{ background: "#080c14", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10, padding: "16px 20px" }}>
                    <div style={labelStyle}>Frozen</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "#94A3B8" }}>{formatMoney(balances.balanceFrozen)}</div>
                  </div>
                  {balances.balanceNegative > 0 && (
                    <div style={{ background: "#080c14", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, padding: "16px 20px" }}>
                      <div style={labelStyle}>Negative</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#EF4444" }}>{formatMoney(balances.balanceNegative)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
