"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";

export default function CheckoutPage() {
  return <Suspense><CheckoutInner /></Suspense>;
}

function CheckoutInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = parseInt(searchParams.get("planId") ?? "0");

  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) { router.push(`/login?mode=register&planId=${planId}`); return; }
    if (!planId) { router.push("/"); return; }

    apiFetch<any>(`/api/plans/${planId}`)
      .then(d => { if (d.success) setPlan(d.plan); else router.push("/"); })
      .finally(() => setLoading(false));
  }, [planId, router]);

  async function handlePay() {
    setPaying(true);
    setError("");
    try {
      const data = await apiFetch<any>("/api/payments/create", {
        method: "POST",
        body: JSON.stringify({ planId }),
      });
      if (data.success && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        setError(data.error ?? "Payment error. Please try again.");
        setPaying(false);
      }
    } catch {
      setError("Request failed. Please try again.");
      setPaying(false);
    }
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#080c14", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>Loading...</div>
  );

  if (!plan) return null;

  const params = [
    { label: "Account Size", value: `$${plan.accountSize?.toLocaleString()}` },
    { label: "Profit Target", value: `${plan.profitTargetPct}%` },
    { label: "Max Loss Limit", value: `${plan.maxLossPct}%` },
    { label: "Daily Loss Limit", value: `${plan.dailyLossPct}%` },
    { label: "Min Trading Days", value: String(plan.minTradingDays) },
    { label: "Profit Share", value: "80%" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#F1F5F9", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "80px 24px" }}>
        <a href="/" style={{ fontSize: 13, color: "#22C55E", textDecoration: "none", display: "inline-block", marginBottom: 40 }}>← Back</a>

        <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", letterSpacing: "0.1em", marginBottom: 8 }}>CHECKOUT</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4, marginTop: 0 }}>{plan.name} Challenge</h1>
        <p style={{ fontSize: 13, color: "#475569", marginBottom: 32 }}>Complete your purchase to start your evaluation</p>

        {/* Plan details */}
        <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "24px", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9" }}>{plan.name} Plan</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: "#22C55E" }}>${plan.price}</span>
          </div>
          {params.map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ fontSize: 13, color: "#64748B" }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#F1F5F9" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Payment info */}
        <div style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 10, padding: "14px 16px", marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#22C55E", marginBottom: 4 }}>Crypto Payment</div>
          <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
            Pay with USDT, USDC, BTC, ETH and 100+ other cryptocurrencies via NOWPayments. You will be redirected to a secure payment page.
          </div>
        </div>

        {/* Future: Card payment placeholder */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10, padding: "14px 16px", marginBottom: 32, opacity: 0.5 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Credit / Debit Card</div>
          <div style={{ fontSize: 12, color: "#334155" }}>Coming soon</div>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#EF4444" }}>
            {error}
            <button onClick={handlePay} style={{ marginLeft: 12, fontSize: 12, color: "#EF4444", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}>Retry</button>
          </div>
        )}

        <button onClick={handlePay} disabled={paying} style={{
          width: "100%", padding: "14px", borderRadius: 10, border: "none",
          background: paying ? "#16532d" : "#22C55E",
          color: paying ? "#4ade80" : "#071A0E",
          fontSize: 15, fontWeight: 700, cursor: paying ? "not-allowed" : "pointer",
          boxShadow: paying ? "none" : "0 0 24px rgba(34,197,94,0.3)",
        }}>
          {paying ? "Redirecting to payment..." : `Pay $${plan.price} with Crypto →`}
        </button>

        <p style={{ fontSize: 11, color: "#334155", textAlign: "center", marginTop: 16 }}>
          Secured by NOWPayments · Not a deposit · Challenge fee only
        </p>
      </div>
    </div>
  );
}
