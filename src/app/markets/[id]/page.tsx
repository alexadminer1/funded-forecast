"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { MarketDetail } from "@/lib/types";

export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tradeModal, setTradeModal] = useState(false);

  useEffect(() => {
    apiFetch<{ success: boolean; market: MarketDetail }>(`/api/markets/${id}`)
      .then((data) => { if (data.success) setMarket(data.market); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
      Loading...
    </div>
  );

  if (!market) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444" }}>
      Market not found.
    </div>
  );

  const endDate = new Date(market.endDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const volume = market.volume24h >= 1000 ? `$${(market.volume24h / 1000).toFixed(1)}k` : `$${market.volume24h.toFixed(0)}`;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px", animation: "fadeIn 0.3s ease" }}>

        {/* Breadcrumb */}
        <a href="/markets" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 13, textDecoration: "none", marginBottom: 28, transition: "color 0.15s" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          All Markets
        </a>

        {/* Category + status */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{market.category}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#22C55E", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.05em" }}>LIVE</span>
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 20, lineHeight: 1.3 }}>
          {market.title}
        </h1>

        {/* Meta */}
        <div style={{ display: "flex", gap: 20, marginBottom: 36, fontSize: 13, color: "var(--text-muted)", flexWrap: "wrap" }}>
          <span>{volume} vol/24h</span>
          <span>·</span>
          <span>Ends {endDate}</span>
          <span>·</span>
          <a href={`https://polymarket.com/event/${market.slug}`} target="_blank" rel="noopener noreferrer"
            style={{ color: "#22C55E", textDecoration: "none" }}>
            Polymarket ↗
          </a>
        </div>

        {/* Prices */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { label: "YES", price: market.yesPrice, color: "#22C55E", bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.2)" },
            { label: "NO", price: market.noPrice, color: "#EF4444", bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.2)" },
          ].map(({ label, price, color, bg, border }) => (
            <div key={label} style={{
              background: bg,
              border: `1px solid ${border}`,
              borderRadius: 12,
              padding: "20px 24px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.08em" }}>{label}</div>
              <div style={{ fontSize: 40, fontWeight: 800, color, letterSpacing: "-0.04em", lineHeight: 1 }}>
                {(price * 100).toFixed(0)}¢
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                {(price * 100).toFixed(1)}% probability
              </div>
            </div>
          ))}
        </div>

        {/* Trade button */}
        <button
          onClick={() => { if (!getToken()) { router.push("/login"); return; } setTradeModal(true); }}
          style={{
            width: "100%",
            padding: "15px",
            background: "#22C55E",
            color: "#071A0E",
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 32,
            letterSpacing: "-0.01em",
            boxShadow: "0 0 24px rgba(34,197,94,0.25)",
            transition: "box-shadow 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 0 36px rgba(34,197,94,0.4)")}
          onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 0 24px rgba(34,197,94,0.25)")}
        >
          Place Paper Trade
        </button>

        {/* Description */}
        {market.description && (
          <div style={{
            background: "linear-gradient(160deg, var(--bg-surface) 0%, var(--bg-page) 100%)",
            borderRadius: 12,
            padding: "22px 24px",
            border: "1px solid var(--border)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Resolution Rules
            </div>
            <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.75, whiteSpace: "pre-wrap", margin: 0 }}>
              {market.description}
            </p>
          </div>
        )}
      </main>

      {tradeModal && <TradeModal market={market} onClose={() => setTradeModal(false)} />}
    </div>
  );
}

function TradeModal({ market, onClose }: { market: MarketDetail; onClose: () => void }) {
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const price = side === "yes" ? market.yesPrice : market.noPrice;
  const cost = parseFloat((amount * price).toFixed(2));
  const payout = parseFloat((amount * 1).toFixed(2));
  const profit = parseFloat((payout - cost).toFixed(2));

  async function handleTrade() {
    setLoading(true);
    setResult(null);
    try {
      const endpoint = action === "buy" ? "/api/trade/buy" : "/api/trade/sell";
      const data = await apiFetch<{ success: boolean; balanceAfter?: number; error?: string }>(endpoint, {
        method: "POST",
        body: JSON.stringify({ marketId: market.id, side, amount, clientPrice: price }),
      });
      if (data.success) {
        setResult({ success: true, message: `${action === "buy" ? "Bought" : "Sold"} ${amount} ${side.toUpperCase()} shares · Balance: $${data.balanceAfter?.toFixed(2)}` });
      } else {
        setResult({ success: false, message: data.error ?? "Trade failed" });
      }
    } catch { setResult({ success: false, message: "Request failed" }); }
    finally { setLoading(false); }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "linear-gradient(160deg, var(--bg-surface) 0%, var(--bg-page) 100%)",
        borderRadius: 16,
        padding: 28,
        width: "100%",
        maxWidth: 460,
        border: "1px solid var(--border)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
        animation: "fadeIn 0.2s ease",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Place Trade</div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, margin: 0, maxWidth: 340 }}>{market.title}</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {/* BUY / SELL */}
        <div style={{ display: "flex", background: "var(--bg-input)", borderRadius: 9, padding: 3, marginBottom: 14, border: "1px solid var(--border-subtle)" }}>
          {(["buy", "sell"] as const).map((a) => (
            <button key={a} onClick={() => setAction(a)} style={{
              flex: 1, padding: "7px", borderRadius: 7, border: "none",
              background: action === a ? "var(--bg-elevated)" : "transparent",
              color: action === a ? "var(--text-primary)" : "var(--text-muted)",
              fontWeight: action === a ? 600 : 400, fontSize: 13, cursor: "pointer",
              textTransform: "uppercase", letterSpacing: "0.05em",
              boxShadow: action === a ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
              transition: "all 0.15s",
            }}>{a}</button>
          ))}
        </div>

        {/* YES / NO */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {(["yes", "no"] as const).map((s) => {
            const color = s === "yes" ? "#22C55E" : "#EF4444";
            const active = side === s;
            return (
              <button key={s} onClick={() => setSide(s)} style={{
                flex: 1, padding: "12px", borderRadius: 9, border: `1px solid ${active ? (s === "yes" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)") : "var(--border)"}`,
                background: active ? (s === "yes" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)") : "transparent",
                color: active ? color : "var(--text-muted)", fontWeight: 700, fontSize: 15, cursor: "pointer",
                transition: "all 0.15s",
              }}>
                {s.toUpperCase()} <span style={{ fontWeight: 400, fontSize: 13 }}>{((s === "yes" ? market.yesPrice : market.noPrice) * 100).toFixed(0)}¢</span>
              </button>
            );
          })}
        </div>

        {/* Shares input */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 7, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Shares</label>
          <input
            type="number" min={1} max={10000} value={amount}
            onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
            style={{
              width: "100%", padding: "11px 14px", borderRadius: "var(--radius-input)",
              border: "1px solid var(--border)", background: "var(--bg-input)",
              color: "var(--text-primary)", fontSize: 16, outline: "none",
              boxSizing: "border-box", transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(34,197,94,0.4)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
        </div>

        {/* Summary */}
        <div style={{ background: "var(--bg-input)", borderRadius: 9, padding: "14px 16px", marginBottom: 18, border: "1px solid var(--border-subtle)" }}>
          {[
            { label: "Cost", value: `$${cost.toFixed(2)}`, color: "var(--text-primary)" },
            { label: "Payout if win", value: `$${payout.toFixed(2)}`, color: "#22C55E" },
            { label: "Profit if win", value: `+$${profit.toFixed(2)}`, color: "#22C55E" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: "var(--text-muted)" }}>{label}</span>
              <span style={{ color, fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>

        {result && (
          <div style={{
            padding: "11px 14px", borderRadius: 8, marginBottom: 14,
            background: result.success ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${result.success ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
            color: result.success ? "#22C55E" : "#EF4444", fontSize: 13,
          }}>
            {result.message}
          </div>
        )}

        <button
          onClick={handleTrade}
          disabled={loading}
          style={{
            width: "100%", padding: "13px", borderRadius: 10,
            background: loading ? "var(--bg-elevated)" : "#22C55E",
            color: loading ? "var(--text-muted)" : "#071A0E",
            border: "none", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: "-0.01em",
            boxShadow: loading ? "none" : "0 0 20px rgba(34,197,94,0.2)",
            transition: "box-shadow 0.15s",
          }}
        >
          {loading ? "Processing..." : `Place ${action.toUpperCase()} · ${side.toUpperCase()}`}
        </button>
      </div>
    </div>
  );
}
