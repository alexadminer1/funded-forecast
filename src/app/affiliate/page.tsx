"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";

const card: React.CSSProperties = { background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "24px 28px", marginBottom: 16 };

export default function AffiliatePage() {
  const router = useRouter();
  const [affiliate, setAffiliate] = useState<any>(undefined);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!getToken()) { router.push("/login"); return; }
    const res = await apiFetch<any>("/api/affiliate/me");
    setAffiliate(res.affiliate ?? null);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#080c14", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>
      Loading...
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#F1F5F9", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "80px 24px 60px" }}>

        <div style={{ marginBottom: 40 }}>
          <a href="/dashboard" style={{ fontSize: 13, color: "#22C55E", textDecoration: "none" }}>← Dashboard</a>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 16, marginBottom: 4 }}>Affiliate Program</h1>
        </div>

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
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 4, background: "rgba(34,197,94,0.1)", color: "#22C55E" }}>APPROVED</span>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", marginTop: 14, marginBottom: 6 }}>Affiliate cabinet is active.</div>
              <div style={{ fontSize: 13, color: "#475569" }}>Dashboard coming next.</div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
