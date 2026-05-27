"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch, getToken } from "@/lib/api";
import { MarketDetail } from "@/lib/types";
import { BUY_PRICE_CAP } from "@/lib/engine/constants";
import { applyBuySpread, applySellSpread } from "@/lib/engine/spreads";
import { ChallengeFailedInfo, ChallengeFailedReason } from "@/components/ChallengeFailedModal";
import { isSignificantPriceChange } from "@/lib/priceChange";

type LivePriceData = { yesPrice: number; noPrice: number; updatedAt: number };

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

type RefreshResult =
  | { success: true; livePrice: LivePriceData }
  | { success: false; error: "rate_limited" | "unavailable" };

const REFRESH_SECONDS = 10;
const RETRY_MS = 5000;

export function TradeModal({
  market,
  initialLivePrice,
  onClose,
  onChallengeFailed,
}: {
  market: MarketDetail;
  initialLivePrice: LivePriceData | null;
  onClose: () => void;
  onChallengeFailed: (info: ChallengeFailedInfo) => void;
}) {
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Live-sync state.
  const [modalPrice, setModalPrice] = useState<LivePriceData | null>(initialLivePrice);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_SECONDS);
  const [refreshError, setRefreshError] = useState(false);
  const [confirm, setConfirm] = useState<{ oldPrice: number; newPrice: number } | null>(null);
  const [barWidth, setBarWidth] = useState<"0%" | "100%">("100%");
  const [barAnimate, setBarAnimate] = useState(false);

  // P0.4: fetch user positions for full-sell-only enforcement.
  const [userPositions, setUserPositions] = useState<UserPositionsResp | null>(null);
  const [positionsState, setPositionsState] = useState<"loading" | "loaded" | "error">("loading");

  const mountedRef = useRef(true);
  const inflightRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const secondsRef = useRef(REFRESH_SECONDS);
  const confirmRef = useRef(confirm);
  useEffect(() => { confirmRef.current = confirm; }, [confirm]);

  useEffect(() => {
    apiFetch<UserPositionsResp>("/api/user/positions")
      .then((d) => { if (mountedRef.current) { setUserPositions(d); setPositionsState("loaded"); } })
      .catch(() => { if (mountedRef.current) setPositionsState("error"); });
  }, []);

  // Reset-then-animate the countdown bar: paint 100% (no transition), then on the
  // next frame flip to 0% with a 10s linear transition (double rAF commits the reset).
  const resetBar = useCallback(() => {
    setBarAnimate(false);
    setBarWidth("100%");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!mountedRef.current) return;
      setBarAnimate(true);
      setBarWidth("0%");
    }));
  }, []);

  // Single live-price fetch. Aborts any in-flight fetch first. Keeps `doRefreshRef`
  // current so timers/handlers always call the latest closure (no stale state).
  async function doRefresh(): Promise<RefreshResult> {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    inflightRef.current = true;
    try {
      const token = getToken();
      const res = await fetch(`/api/markets/${market.id}/refresh-price`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });
      if (res.status === 429) return { success: false, error: "rate_limited" };
      if (!res.ok) {
        if (mountedRef.current) { setRefreshError(true); scheduleRetry(); }
        return { success: false, error: "unavailable" };
      }
      const data = await res.json();
      if (data?.success) {
        const lp: LivePriceData = { yesPrice: data.yesPrice, noPrice: data.noPrice, updatedAt: data.updatedAt };
        if (mountedRef.current) {
          setModalPrice(lp);
          setRefreshError(false);
          if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null; }
        }
        return { success: true, livePrice: lp };
      }
      if (mountedRef.current) { setRefreshError(true); scheduleRetry(); }
      return { success: false, error: "unavailable" };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { success: false, error: "rate_limited" };
      }
      if (mountedRef.current) { setRefreshError(true); scheduleRetry(); }
      return { success: false, error: "unavailable" };
    } finally {
      inflightRef.current = false;
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  }
  const doRefreshRef = useRef(doRefresh);
  doRefreshRef.current = doRefresh;

  function scheduleRetry() {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    retryTimeoutRef.current = setTimeout(() => { doRefreshRef.current(); }, RETRY_MS);
  }

  // Countdown loop. Created once; reads refs to avoid stale closures.
  useEffect(() => {
    mountedRef.current = true;
    resetBar();
    tickIntervalRef.current = setInterval(() => {
      if (confirmRef.current) return; // paused during the confirmation decision
      const next = secondsRef.current - 1;
      if (next <= 0) {
        secondsRef.current = REFRESH_SECONDS;
        setSecondsLeft(REFRESH_SECONDS);
        resetBar();
        doRefreshRef.current(); // fetch at the 0 boundary
      } else {
        secondsRef.current = next;
        setSecondsLeft(next);
      }
    }, 1000);
    return () => {
      mountedRef.current = false;
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [resetBar]);

  const sellPosition = userPositions?.positions.find(
    (p) => p.marketId === market.id && p.side === side,
  );
  const sellLockable = action === "sell" && positionsState === "loaded" && !!sellPosition;
  const sellNoPosition = action === "sell" && positionsState === "loaded" && !sellPosition;
  const sellLoading = action === "sell" && positionsState === "loading";
  const sellFetchFailed = action === "sell" && positionsState === "error";

  useEffect(() => {
    if (sellLockable && sellPosition) {
      setAmount(sellPosition.shares);
    }
  }, [sellLockable, sellPosition?.shares, side]);

  // Raw + effective price from the modal's own live price (fallback to first-paint DB).
  const mYes = modalPrice?.yesPrice ?? market.yesPrice;
  const mNo = modalPrice?.noPrice ?? market.noPrice;
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

  // Disabled in the last second before a refresh, during fetch/submit, on error, and
  // on the existing technical invariants (cap, sell-state, amount).
  const submitDisabled =
    loading
    || submitting
    || secondsLeft === 1
    || refreshError
    || capExceeded
    || sellLoading
    || sellNoPosition
    || amount <= 0;

  // Shared POST. priceToUse is the (fresh) raw price sent as clientPrice.
  async function placeTrade(priceToUse: number) {
    setLoading(true);
    setResult(null);
    try {
      const endpoint = action === "buy" ? "/api/trade/buy" : "/api/trade/sell";
      const token = getToken();
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ marketId: market.id, side, amount, clientPrice: priceToUse }),
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
      if (mountedRef.current) setLoading(false);
    }
  }

  // Pre-submit: fetch a fresh price first; if it moved significantly, confirm; else trade.
  async function handleTrade() {
    setSubmitting(true);
    setResult(null);
    try {
      const r = await doRefreshRef.current();
      let priceToUse: number;
      if (r.success) {
        const freshRaw = side === "yes" ? r.livePrice.yesPrice : r.livePrice.noPrice;
        if (isSignificantPriceChange(rawPrice, freshRaw)) {
          setConfirm({ oldPrice: rawPrice, newPrice: freshRaw });
          return; // await user's decision
        }
        priceToUse = freshRaw;
      } else if (r.error === "rate_limited") {
        // 429 fallback: use the last cached modal price (backend re-checks slippage).
        priceToUse = side === "yes" ? mYes : mNo;
      } else {
        setResult({ success: false, message: "Could not verify price. Please try again." });
        return;
      }
      await placeTrade(priceToUse);
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  async function confirmYes() {
    if (!confirm) return;
    const priceToUse = confirm.newPrice;
    setConfirm(null);
    secondsRef.current = REFRESH_SECONDS;
    setSecondsLeft(REFRESH_SECONDS);
    resetBar();
    await placeTrade(priceToUse);
  }

  const btnGreen: React.CSSProperties = {
    width: "100%", padding: "13px", borderRadius: 10, background: "#22C55E",
    color: "#071A0E", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer",
    letterSpacing: "-0.01em", boxShadow: "0 0 20px rgba(34,197,94,0.2)",
  };
  const btnGray: React.CSSProperties = {
    width: "100%", padding: "13px", borderRadius: 10, background: "var(--bg-elevated)",
    color: "var(--text-muted)", border: "1px solid var(--border)", fontSize: 14, fontWeight: 700, cursor: "pointer",
  };

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

        {confirm ? (
          /* Significant-change confirmation (replaces the trade UI). */
          <div style={{ padding: "4px 0" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 12 }}>
              Price changed significantly
            </div>
            <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 20, lineHeight: 1.6 }}>
              The price moved from <strong>{(confirm.oldPrice * 100).toFixed(0)}¢</strong> to <strong>{(confirm.newPrice * 100).toFixed(0)}¢</strong>.
              <br />
              Continue at the new price?
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={confirmYes} disabled={loading} style={{ ...btnGreen, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Processing..." : `Yes, place trade at ${(confirm.newPrice * 100).toFixed(0)}¢`}
              </button>
              <button onClick={onClose} style={btnGray}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
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

            {/* Countdown to next price update */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: refreshError ? "#F59E0B" : "var(--text-muted)", marginBottom: 4 }}>
                {refreshError ? "⚠ Couldn't refresh price" : `Next update in: ${secondsLeft}s`}
              </div>
              <div style={{ height: 4, background: "var(--bg-input)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: refreshError ? "0%" : barWidth,
                  background: "#22C55E",
                  transition: barAnimate && !refreshError ? "width 10s linear" : "none",
                }} />
              </div>
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
              {submitting ? "Checking price..." : loading ? "Processing..." : sellLoading ? "Loading position..." : `Place ${action.toUpperCase()} · ${side.toUpperCase()}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
