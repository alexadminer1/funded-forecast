"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { MarketDetail } from "@/lib/types";
import { BUY_PRICE_CAP } from "@/lib/engine/constants";
import {
  applyBuySpread,
  applySellSpread,
} from "@/lib/engine/spreads";
import {
  ChallengeFailedModal,
  ChallengeFailedInfo,
  ChallengeFailedReason,
} from "@/components/ChallengeFailedModal";

type LivePriceData = { yesPrice: number; noPrice: number; updatedAt: number };
type PriceState = "idle" | "loading" | "fresh" | "stale" | "error";

type UserPositionsResp = {
  success: boolean;
  activeChallenge: {
    id: number;
    startBalance: number;
    todayBuyVolume: number;
    minDailyVolumeUsd: number;
  } | null;
  positions: Array<{
    id: number;
    marketId: string;
    side: "yes" | "no";
    shares: number;
  }>;
};

export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tradeModal, setTradeModal] = useState(false);
  const [challengeFailed, setChallengeFailed] = useState<ChallengeFailedInfo | null>(null);

  const [livePrice, setLivePrice] = useState<LivePriceData | null>(null);
  const [priceState, setPriceState] = useState<PriceState>("idle");
  const [errorCountdown, setErrorCountdown] = useState(0);

  const livePriceRef = useRef<LivePriceData | null>(null);
  const priceStateRef = useRef<PriceState>("idle");
  const lastActivityRef = useRef<number>(Date.now());
  const inflightRef = useRef(false);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setPrice = useCallback((v: LivePriceData | null) => { livePriceRef.current = v; setLivePrice(v); }, []);
  const setPState = useCallback((v: PriceState) => { priceStateRef.current = v; setPriceState(v); }, []);

  const stopErrorCountdown = useCallback(() => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    setErrorCountdown(0);
  }, []);

  const startErrorCountdown = useCallback(() => {
    setPState("error");
    setErrorCountdown(20);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setErrorCountdown((c) => {
        if (c <= 1) {
          if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
          setPState("stale"); // user must manually refresh after the cooldown
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, [setPState]);

  const refresh = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    loadingTimerRef.current = setTimeout(() => setPState("loading"), 300);
    try {
      const token = getToken();
      const res = await fetch(`/api/markets/${id}/refresh-price`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (loadingTimerRef.current) { clearTimeout(loadingTimerRef.current); loadingTimerRef.current = null; }
      if (res.status === 429) return; // rate limited — keep current state, no error
      if (!res.ok) { startErrorCountdown(); return; } // 503 etc → error + 20s countdown
      const data = await res.json();
      if (data?.success) {
        stopErrorCountdown();
        setPrice({ yesPrice: data.yesPrice, noPrice: data.noPrice, updatedAt: data.updatedAt });
        setPState("fresh");
      } else {
        startErrorCountdown();
      }
    } catch {
      if (loadingTimerRef.current) { clearTimeout(loadingTimerRef.current); loadingTimerRef.current = null; }
      startErrorCountdown();
    } finally {
      inflightRef.current = false;
    }
  }, [id, setPrice, setPState, startErrorCountdown, stopErrorCountdown]);

  // Initial market load (metadata + first-paint prices).
  useEffect(() => {
    apiFetch<{ success: boolean; market: MarketDetail }>(`/api/markets/${id}`)
      .then((data) => { if (data.success) setMarket(data.market); })
      .finally(() => setLoading(false));
  }, [id]);

  // Live price: initial fetch + 10s auto-refresh (paused when inactive >30s or tab hidden),
  // activity/visibility listeners, immediate refresh on resume. Cleans up on unmount.
  useEffect(() => {
    refresh();

    const markActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener("mousemove", markActivity, { passive: true });
    window.addEventListener("scroll", markActivity, { passive: true });
    window.addEventListener("keydown", markActivity);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        lastActivityRef.current = Date.now();
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    refreshIntervalRef.current = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      if (Date.now() - lastActivityRef.current > 30_000) return;
      const lp = livePriceRef.current;
      if (lp && Date.now() - lp.updatedAt > 10_000 && priceStateRef.current === "fresh") {
        setPState("stale");
      }
      refresh();
    }, 10_000);

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      window.removeEventListener("mousemove", markActivity);
      window.removeEventListener("scroll", markActivity);
      window.removeEventListener("keydown", markActivity);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, setPState]);

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

  // Displayed prices prefer the live value; fall back to the first-paint DB price.
  const displayYes = livePrice?.yesPrice ?? market.yesPrice;
  const displayNo = livePrice?.noPrice ?? market.noPrice;

  // Primary action button driven by the price state machine.
  const tradeBtn = (() => {
    if (priceState === "error") return { label: `Market temporarily unavailable, retry in ${errorCountdown}s`, disabled: true, onClick: () => {} };
    if (priceState === "loading") return { label: "Refreshing...", disabled: true, onClick: () => {} };
    if (priceState === "stale") return { label: "Refresh prices", disabled: false, onClick: () => { refresh(); } };
    if (!livePrice) return { label: "Loading price...", disabled: true, onClick: () => {} };
    return { label: "Place Paper Trade", disabled: false, onClick: () => { if (!getToken()) { router.push("/login"); return; } setTradeModal(true); } };
  })();

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
            { label: "YES", price: displayYes, color: "#22C55E", bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.2)" },
            { label: "NO", price: displayNo, color: "#EF4444", bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.2)" },
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

        {/* Price freshness indicator */}
        <div style={{ fontSize: 11, color: priceState === "stale" || priceState === "error" ? "#F59E0B" : "var(--text-muted)", marginBottom: 10, textAlign: "center", minHeight: 14 }}>
          {priceState === "loading" && "Refreshing prices..."}
          {priceState === "fresh" && "Live price · auto-refreshes every 10s"}
          {priceState === "stale" && "Prices may be delayed — refresh to trade"}
          {priceState === "error" && "Polymarket unavailable"}
        </div>

        {/* Trade button (price state machine) */}
        <button
          onClick={tradeBtn.onClick}
          disabled={tradeBtn.disabled}
          style={{
            width: "100%",
            padding: "15px",
            background: tradeBtn.disabled ? "var(--bg-elevated)" : "#22C55E",
            color: tradeBtn.disabled ? "var(--text-muted)" : "#071A0E",
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: tradeBtn.disabled ? "not-allowed" : "pointer",
            marginBottom: 32,
            letterSpacing: "-0.01em",
            boxShadow: tradeBtn.disabled ? "none" : "0 0 24px rgba(34,197,94,0.25)",
            transition: "box-shadow 0.15s",
          }}
        >
          {tradeBtn.label}
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

      {tradeModal && (
        <TradeModal
          market={market}
          livePrice={livePrice}
          onClose={() => setTradeModal(false)}
          onChallengeFailed={(info) => {
            setTradeModal(false);
            setChallengeFailed(info);
          }}
        />
      )}
      {challengeFailed && (
        <ChallengeFailedModal
          info={challengeFailed}
          onClose={() => {
            setChallengeFailed(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function TradeModal({
  market,
  livePrice,
  onClose,
  onChallengeFailed,
}: {
  market: MarketDetail;
  livePrice: LivePriceData | null;
  onClose: () => void;
  onChallengeFailed: (info: ChallengeFailedInfo) => void;
}) {
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // P0.4: fetch user positions for full-sell-only enforcement.
  const [userPositions, setUserPositions] = useState<UserPositionsResp | null>(null);
  const [positionsState, setPositionsState] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    apiFetch<UserPositionsResp>("/api/user/positions")
      .then((d) => { setUserPositions(d); setPositionsState("loaded"); })
      .catch(() => setPositionsState("error"));
  }, []);

  const sellPosition = userPositions?.positions.find(
    (p) => p.marketId === market.id && p.side === side,
  );
  const sellLockable = action === "sell" && positionsState === "loaded" && !!sellPosition;
  const sellNoPosition = action === "sell" && positionsState === "loaded" && !sellPosition;
  const sellLoading = action === "sell" && positionsState === "loading";
  const sellFetchFailed = action === "sell" && positionsState === "error";

  // Sync amount to position.shares when sell mode is locked.
  useEffect(() => {
    if (sellLockable && sellPosition) {
      setAmount(sellPosition.shares);
    }
  }, [sellLockable, sellPosition?.shares, side]);

  // P0.4: raw + effective price computation. Prefer the live price (fallback DB).
  const mYes = livePrice?.yesPrice ?? market.yesPrice;
  const mNo = livePrice?.noPrice ?? market.noPrice;
  const rawPrice = side === "yes" ? mYes : mNo;

  const capExceeded = action === "buy" && rawPrice >= BUY_PRICE_CAP;

  let effectivePrice = rawPrice;
  let spreadPct = 0;
  if (action === "buy" && !capExceeded) {
    const r = applyBuySpread(rawPrice);
    effectivePrice = r.effectivePrice;
    spreadPct = r.spreadPct;
  } else if (action === "sell") {
    const r = applySellSpread(rawPrice);
    effectivePrice = r.effectivePrice;
    spreadPct = r.spreadPct;
  }

  const cost = parseFloat((amount * effectivePrice).toFixed(2));
  const payoutIfWin = parseFloat((amount * 1).toFixed(2));
  const profitIfWin = parseFloat((payoutIfWin - cost).toFixed(2));

  // Pre-trade rejects for rules #2/#3/#4 removed in TASK-PHILO-1.
  // The Buy button gates only on technical invariants (cap, sell-state, loading).
  const submitDisabled =
    loading
    || capExceeded
    || sellLoading
    || sellNoPosition
    || amount <= 0;

  async function handleTrade() {
    setLoading(true);
    setResult(null);
    try {
      const endpoint = action === "buy" ? "/api/trade/buy" : "/api/trade/sell";
      const token = getToken();
      // clientPrice is the live raw price the user saw; the server re-fetches the
      // live price and checks slippage against it (closes the stale-price arbitrage).
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ marketId: market.id, side, amount, clientPrice: rawPrice }),
      });

      let data: {
        success?: boolean;
        balanceAfter?: number;
        error?: string;
        error_code?: string;
        reason?: ChallengeFailedReason;
        details?: string;
      };
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      // P0.4.bis — pre-trade challenge failure → structured modal, no inline toast.
      if (res.status === 409 && data.error_code === "CHALLENGE_FAILED_PRE_TRADE" && data.reason) {
        onChallengeFailed({
          reason: data.reason,
          details: data.details ?? "Your challenge has ended.",
        });
        return;
      }

      if (res.ok && data.success) {
        setResult({
          success: true,
          message: `${action === "buy" ? "Bought" : "Sold"} ${amount} ${side.toUpperCase()} shares · Balance: $${data.balanceAfter?.toFixed(2)}`,
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
                {s.toUpperCase()} <span style={{ fontWeight: 400, fontSize: 13 }}>{((s === "yes" ? mYes : mNo) * 100).toFixed(0)}¢</span>
              </button>
            );
          })}
        </div>

        {/* Shares input */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 7, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Shares{sellLockable ? " (full sell only)" : ""}
          </label>
          <input
            type="number" min={1} max={10000} value={amount}
            readOnly={sellLockable}
            disabled={sellLoading || sellNoPosition}
            onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
            style={{
              width: "100%", padding: "11px 14px", borderRadius: "var(--radius-input)",
              border: "1px solid var(--border)", background: "var(--bg-input)",
              color: sellLockable ? "var(--text-muted)" : "var(--text-primary)",
              fontSize: 16, outline: "none",
              boxSizing: "border-box", transition: "border-color 0.15s",
              cursor: sellLockable ? "not-allowed" : "text",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(34,197,94,0.4)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
          {sellFetchFailed && (
            <div style={{ fontSize: 11, color: "#F59E0B", marginTop: 6 }}>
              Could not load position size — manual input fallback.
            </div>
          )}
        </div>

        {/* P0.4 reject banners */}
        {capExceeded && (
          <div style={{
            padding: "11px 14px", borderRadius: 8, marginBottom: 14,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            color: "#EF4444", fontSize: 13,
          }}>
            Buy cap: price ${rawPrice.toFixed(4)} is at or above ${BUY_PRICE_CAP.toFixed(2)}. Trade not allowed.
          </div>
        )}
        {sellNoPosition && (
          <div style={{
            padding: "11px 14px", borderRadius: 8, marginBottom: 14,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            color: "#EF4444", fontSize: 13,
          }}>
            No {side.toUpperCase()} position to sell in this market.
          </div>
        )}

        {/* Preview / Summary */}
        <div style={{ background: "var(--bg-input)", borderRadius: 9, padding: "14px 16px", marginBottom: 18, border: "1px solid var(--border-subtle)" }}>
          {[
            { label: "Raw price", value: `$${rawPrice.toFixed(4)}`, color: "var(--text-primary)" },
            ...(capExceeded ? [] : [
              { label: `Spread (${spreadPct}%)`, value: action === "buy" ? `+$${(effectivePrice - rawPrice).toFixed(4)}` : `−$${(rawPrice - effectivePrice).toFixed(4)}`, color: spreadPct > 0 ? "#F59E0B" : "var(--text-muted)" },
              { label: "Effective price", value: `$${effectivePrice.toFixed(4)}`, color: "var(--text-primary)" },
              ...(action === "buy"
                ? [
                  { label: "Cost", value: `$${cost.toFixed(2)}`, color: "var(--text-primary)" },
                  { label: "Payout if win", value: `$${payoutIfWin.toFixed(2)}`, color: "#22C55E" },
                  { label: "Profit if win", value: `+$${profitIfWin.toFixed(2)}`, color: "#22C55E" },
                ]
                : [
                  { label: "Payout", value: `$${cost.toFixed(2)}`, color: "#22C55E" },
                ]),
            ]),
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
          disabled={submitDisabled}
          style={{
            width: "100%", padding: "13px", borderRadius: 10,
            background: submitDisabled ? "var(--bg-elevated)" : "#22C55E",
            color: submitDisabled ? "var(--text-muted)" : "#071A0E",
            border: "none", fontSize: 14, fontWeight: 700, cursor: submitDisabled ? "not-allowed" : "pointer",
            letterSpacing: "-0.01em",
            boxShadow: submitDisabled ? "none" : "0 0 20px rgba(34,197,94,0.2)",
            transition: "box-shadow 0.15s",
          }}
        >
          {loading ? "Processing..." : sellLoading ? "Loading position..." : `Place ${action.toUpperCase()} · ${side.toUpperCase()}`}
        </button>
      </div>
    </div>
  );
}
