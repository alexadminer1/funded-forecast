"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { MarketDetail } from "@/lib/types";
import {
  ChallengeFailedModal,
  ChallengeFailedInfo,
} from "@/components/ChallengeFailedModal";
import { TradeModal } from "@/components/TradeModal";

type LivePriceData = { yesPrice: number; noPrice: number; updatedAt: number };
type PriceState = "idle" | "loading" | "fresh" | "stale" | "error";

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
    // While the trade modal is open, it owns the single price poller (avoids
    // double-fetching the rate-limited refresh-price endpoint). On close this
    // effect re-runs and the immediate refresh() below re-syncs the page.
    if (tradeModal) return;

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
  }, [refresh, setPState, tradeModal]);

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
          initialLivePrice={livePrice}
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
