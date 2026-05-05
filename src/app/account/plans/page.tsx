"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";

type Plan = {
  id: number;
  name: string;
  price: number;
  accountSize: number;
  profitTargetPct: number;
  maxLossPct: number;
  dailyLossPct: number;
  minTradingDays: number;
  profitSharePct: number;
  isPopular: boolean;
};

export default function AccountPlansPage(): React.JSX.Element {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) { router.push("/login?mode=login"); return; }
    apiFetch<{ success: boolean; plans: Plan[] }>("/api/plans")
      .then(d => { if (d.success) setPlans(d.plans); else setError("Failed to load plans"); })
      .catch(() => setError("Failed to load plans"))
      .finally(() => setLoading(false));
  }, [router]);

  function handleSelect(planId: number) {
    router.push(`/checkout?planId=${planId}`);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
      Loading plans...
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444" }}>
      {error}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>

        <div style={{ marginBottom: 40, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text-primary)", marginBottom: 10 }}>
            Choose your evaluation plan
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
            Pass the evaluation and earn up to 80% of your profits as real payouts
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {plans.map((plan) => (
            <div
              key={plan.id}
              style={{
                background: plan.isPopular
                  ? "linear-gradient(160deg, #0f2318 0%, #0a1a10 100%)"
                  : "linear-gradient(160deg, var(--bg-surface) 0%, var(--bg-page) 100%)",
                border: plan.isPopular ? "1px solid rgba(34,197,94,0.35)" : "1px solid var(--border)",
                borderRadius: 14,
                padding: 28,
                display: "flex",
                flexDirection: "column",
                position: "relative",
                boxShadow: plan.isPopular ? "0 0 32px rgba(34,197,94,0.08)" : "var(--shadow-card)",
              }}
            >
              {plan.isPopular && (
                <div style={{
                  position: "absolute",
                  top: -11,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#22C55E",
                  color: "#071A0E",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  padding: "3px 14px",
                  borderRadius: 20,
                  whiteSpace: "nowrap",
                }}>
                  BEST VALUE
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: plan.isPopular ? "#22C55E" : "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                  {plan.name}
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.04em", lineHeight: 1 }}>
                  ${plan.accountSize.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>paper capital</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24, flex: 1 }}>
                {[
                  { label: "Entry fee", value: `$${plan.price}` },
                  { label: "Profit target", value: `${plan.profitTargetPct}%` },
                  { label: "Max drawdown", value: `${plan.maxLossPct}%` },
                  { label: "Daily loss limit", value: `${plan.dailyLossPct}%` },
                  { label: "Min trading days", value: `${plan.minTradingDays}` },
                  { label: "Profit share", value: `${plan.profitSharePct}%` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{value}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleSelect(plan.id)}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 9,
                  background: plan.isPopular ? "#22C55E" : "transparent",
                  color: plan.isPopular ? "#071A0E" : "#22C55E",
                  border: plan.isPopular ? "none" : "1px solid rgba(34,197,94,0.4)",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "-0.01em",
                  boxShadow: plan.isPopular ? "0 0 20px rgba(34,197,94,0.25)" : "none",
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
              >
                Get {plan.name} Plan →
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
