"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { Market } from "@/lib/types";

const CATEGORIES = ["all", "crypto", "politics", "sports", "economy", "tech", "geopolitics", "climate", "culture", "other"];
const PAGE_SIZE = 20;

function SkeletonCard() {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", animation: "pulse 1.5s ease-in-out infinite" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <div style={{ height: 12, background: "#1E293B", borderRadius: 4, width: "30%", marginBottom: 12 }} />
      <div style={{ height: 16, background: "#1E293B", borderRadius: 4, width: "80%", marginBottom: 20 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ height: 32, background: "#1E293B", borderRadius: 6, width: 80 }} />
        <div style={{ height: 32, background: "#1E293B", borderRadius: 6, width: 80 }} />
      </div>
    </div>
  );
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("volume");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const offsetRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchMarkets = useCallback(async (reset = false) => {
    const offset = reset ? 0 : offsetRef.current;
    if (reset) { setLoading(true); setMarkets([]); } else setLoadingMore(true);

    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    params.set("sort", sort);
    if (search) params.set("search", search);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));

    const data = await apiFetch<{ success: boolean; markets: Market[]; hasMore: boolean }>(`/api/markets?${params}`);

    if (data.success) {
      setMarkets(prev => reset ? data.markets : [...prev, ...data.markets]);
      setHasMore(data.hasMore);
      offsetRef.current = offset + data.markets.length;
    }
    setLoading(false);
    setLoadingMore(false);
  }, [category, sort, search]);

  useEffect(() => {
    offsetRef.current = 0;
    fetchMarkets(true);
  }, [fetchMarkets]);

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        fetchMarkets(false);
      }
    }, { threshold: 0.1 });
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, loading, fetchMarkets]);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "48px 24px" }}>

        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 6 }}>Prediction Markets</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Trade event contracts and build your track record.</p>
        </div>

        {/* Search + Sort */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search markets…"
              style={{ width: "100%", padding: "10px 16px 10px 40px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box", outline: "none" }}
            />
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 14 }}>🔍</span>
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, cursor: "pointer" }}>
            <option value="volume">Top Volume</option>
            <option value="ending">Ending Soon</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        {/* Categories */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)} style={{
              padding: "5px 14px", borderRadius: 20, border: "1px solid",
              borderColor: category === c ? "#22C55E" : "var(--border)",
              background: category === c ? "rgba(34,197,94,0.1)" : "transparent",
              color: category === c ? "#22C55E" : "var(--text-muted)",
              fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
            }}>{c}</button>
          ))}
        </div>

        {/* Markets grid */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : markets.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>No markets found</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
            {markets.map(market => <MarketCard key={market.id} market={market} />)}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} style={{ height: 40, marginTop: 16 }} />

        {/* Loading more */}
        {loadingMore && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12, marginTop: 12 }}>
            {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {!hasMore && markets.length > 0 && (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>All markets loaded · {markets.length} total</div>
        )}
      </main>
    </div>
  );
}

function MarketCard({ market }: { market: Market }) {
  const yesColor = "#22C55E";
  const noColor = "#EF4444";
  return (
    <a href={`/markets/${market.id}`} style={{ textDecoration: "none" }}>
      <div style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "20px 24px",
        transition: "border-color 0.15s, box-shadow 0.15s",
        cursor: "pointer",
      }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(34,197,94,0.3)"; el.style.boxShadow = "0 0 0 1px rgba(34,197,94,0.1)"; }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--border)"; el.style.boxShadow = "none"; }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{market.category}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: 20, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{market.title}</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "10px 0", textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: yesColor, letterSpacing: "0.08em", marginBottom: 2 }}>YES</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: yesColor }}>{Math.round(market.yesPrice * 100)}¢</div>
          </div>
          <div style={{ flex: 1, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 0", textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: noColor, letterSpacing: "0.08em", marginBottom: 2 }}>NO</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: noColor }}>{Math.round(market.noPrice * 100)}¢</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>${market.volume24h >= 1000 ? (market.volume24h / 1000).toFixed(1) + "k" : market.volume24h.toFixed(0)} vol/24h</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Ends {new Date(market.endDate).toLocaleDateString()}</span>
        </div>
      </div>
    </a>
  );
}
