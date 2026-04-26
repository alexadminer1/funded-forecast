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
    <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}>
      Loading...
    </div>
  );

  if (!market) return (
    <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444" }}>
      Market not found.
    </div>
  );

  const endDate = new Date(market.endDate).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const volume = market.volume24h >= 1000
    ? `$${(market.volume24h / 1000).toFixed(1)}k`
    : `$${market.volume24h.toFixed(0)}`;

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", color: "#F8FAFC" }}>
<main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
        {/* Category + Status */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#22C55E", textTransform: "uppercase", letterSpacing: 1 }}>
            {market.category}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#22C55E", background: "#22C55E20", padding: "2px 8px", borderRadius: 4 }}>
            LIVE
          </span>
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24, lineHeight: 1.3 }}>
          {market.title}
        </h1>

        {/* Meta */}
        <div style={{ display: "flex", gap: 24, marginBottom: 32, fontSize: 14, color: "#64748B" }}>
          <span>Vol 24h {volume}</span>
          <span>Ends {endDate}</span>
          <a
            href={`https://polymarket.com/event/${market.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#22C55E", textDecoration: "none" }}
          >
            View on Polymarket ↗
          </a>
        </div>

        {/* YES / NO prices */}
        <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
          <div style={{ flex: 1, background: "#22C55E15", border: "1px solid #22C55E40", borderRadius: 12, padding: "20px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 4 }}>YES</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#22C55E" }}>
              {(market.yesPrice * 100).toFixed(0)}¢
            </div>
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
              {(market.yesPrice * 100).toFixed(1)}% probability
            </div>
          </div>
          <div style={{ flex: 1, background: "#EF444415", border: "1px solid #EF444440", borderRadius: 12, padding: "20px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 4 }}>NO</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#EF4444" }}>
              {(market.noPrice * 100).toFixed(0)}¢
            </div>
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
              {(market.noPrice * 100).toFixed(1)}% probability
            </div>
          </div>
        </div>

        {/* Trade button */}
        <button
          onClick={() => {
            if (!getToken()) { router.push("/login"); return; }
            setTradeModal(true);
          }}
          style={{
            width: "100%",
            padding: "16px",
            background: "#22C55E",
            color: "#0F172A",
            border: "none",
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 32,
          }}
        >
          Place Paper Trade
        </button>

        {/* Description */}
        {market.description && (
          <div style={{ background: "#1E293B", borderRadius: 12, padding: 24, border: "1px solid #334155" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#94A3B8", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
              Resolution Rules
            </h3>
            <p style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {market.description}
            </p>
          </div>
        )}
      </main>

      {/* Trade Modal */}
      {tradeModal && (
        <TradeModal
          market={market}
          onClose={() => setTradeModal(false)}
        />
      )}
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
        body: JSON.stringify({
          marketId: market.id,
          side,
          amount,
          clientPrice: price,
        }),
      });

      if (data.success) {
        setResult({
          success: true,
          message: action === "buy"
            ? `✓ Bought ${amount} ${side.toUpperCase()} shares. Balance: $${data.balanceAfter?.toFixed(2)}`
            : `✓ Sold ${amount} ${side.toUpperCase()} shares. Balance: $${data.balanceAfter?.toFixed(2)}`,
        });
      } else {
        setResult({ success: false, message: data.error ?? "Trade failed" });
      }
    } catch {
      setResult({ success: false, message: "Request failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "#00000080", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#1E293B", borderRadius: 16, padding: 32, width: "100%", maxWidth: 480, border: "1px solid #334155" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#F8FAFC", maxWidth: 380, lineHeight: 1.4 }}>
            {market.title}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748B", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        {/* BUY / SELL */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["buy", "sell"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAction(a)}
              style={{
                flex: 1, padding: "8px", borderRadius: 8, border: "1px solid",
                borderColor: action === a ? "#22C55E" : "#334155",
                background: action === a ? "#22C55E20" : "transparent",
                color: action === a ? "#22C55E" : "#64748B",
                fontWeight: 600, fontSize: 13, cursor: "pointer", textTransform: "uppercase",
              }}
            >
              {a}
            </button>
          ))}
        </div>

        {/* YES / NO */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["yes", "no"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              style={{
                flex: 1, padding: "12px", borderRadius: 8, border: "1px solid",
                borderColor: side === s ? (s === "yes" ? "#22C55E" : "#EF4444") : "#334155",
                background: side === s ? (s === "yes" ? "#22C55E20" : "#EF444420") : "transparent",
                color: side === s ? (s === "yes" ? "#22C55E" : "#EF4444") : "#64748B",
                fontWeight: 700, fontSize: 15, cursor: "pointer",
              }}
            >
              {s.toUpperCase()} {((s === "yes" ? market.yesPrice : market.noPrice) * 100).toFixed(0)}¢
            </button>
          ))}
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: "#94A3B8", display: "block", marginBottom: 8 }}>
            Shares
          </label>
          <input
            type="number"
            min={1}
            max={10000}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 8,
              border: "1px solid #334155", background: "#0F172A",
              color: "#F8FAFC", fontSize: 16, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Calculations */}
        <div style={{ background: "#0F172A", borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: "#64748B" }}>Estimated cost</span>
            <span style={{ color: "#F8FAFC", fontWeight: 600 }}>${cost.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: "#64748B" }}>Payout if win</span>
            <span style={{ color: "#22C55E", fontWeight: 600 }}>${payout.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "#64748B" }}>Profit if win</span>
            <span style={{ color: "#22C55E", fontWeight: 600 }}>+${profit.toFixed(2)}</span>
          </div>
        </div>

        {/* Result message */}
        {result && (
          <div style={{
            padding: "12px 16px", borderRadius: 8, marginBottom: 16,
            background: result.success ? "#22C55E20" : "#EF444420",
            border: `1px solid ${result.success ? "#22C55E40" : "#EF444440"}`,
            color: result.success ? "#22C55E" : "#EF4444",
            fontSize: 13,
          }}>
            {result.message}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleTrade}
          disabled={loading}
          style={{
            width: "100%", padding: "14px", borderRadius: 10,
            background: loading ? "#334155" : "#22C55E",
            color: loading ? "#64748B" : "#0F172A",
            border: "none", fontSize: 15, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Processing..." : `Place ${action.toUpperCase()} order`}
        </button>
      </div>
    </div>
  );
}
