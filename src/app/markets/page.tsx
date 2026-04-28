"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { Market } from "@/lib/types";

const CATEGORY_MAP: Record<string, string> = {
  crypto: "crypto", cryptocurrency: "crypto", bitcoin: "crypto", ethereum: "crypto",
  politics: "politics", election: "politics", government: "politics",
  sports: "sports", sport: "sports", football: "sports", basketball: "sports",
  tech: "tech", technology: "tech", ai: "tech", science: "tech",
};

function normalizeCategory(cat: string): string {
  const lower = cat.toLowerCase();
  return CATEGORY_MAP[lower] ?? "other";
}

const SORT_OPTIONS = [
  { value: "volume", label: "Most Active" },
  { value: "ending", label: "Ending Soon" },
  { value: "newest", label: "Newest" },
  { value: "highest", label: "Highest Price" },
  { value: "lowest", label: "Lowest Price" },
];

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

function MarketCard({ market }: { market: Market }) {
  return (
    <a href={`/markets/${market.id}`} style={{ textDecoration: "none" }}>
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", transition: "border-color 0.15s, box-shadow 0.15s", cursor: "pointer" }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(34,197,94,0.3)"; el.style.boxShadow = "0 0 0 1px rgba(34,197,94,0.1)"; }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--border)"; el.style.boxShadow = "none"; }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{market.category}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: 20, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{market.title}</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "10px 0", textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#22C55E", letterSpacing: "0.08em", marginBottom: 2 }}>YES</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#22C55E" }}>{Math.round(market.yesPrice * 100)}¢</div>
          </div>
          <div style={{ flex: 1, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 0", textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#EF4444", letterSpacing: "0.08em", marginBottom: 2 }}>NO</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#EF4444" }}>{Math.round(market.noPrice * 100)}¢</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>${market.volume24h >= 1000 ? (market.volume24h / 1000).toFixed(1) + "k" : market.volume24h.toFixed(0)} vol/24h</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Ends {new Date(market.endDate).toLocaleDateString()}</span>
        </div>
      </div>
    </a>
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

  // Category counts from loaded markets
  const [allMarkets, setAllMarkets] = useState<Market[]>([]);
  const categoryCounts = allMarkets.reduce((acc, m) => {
    const cat = normalizeCategory(m.category);
    acc[cat] = (acc[cat] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const visibleCategories = ["all", ...Object.entries(categoryCounts).filter(([, count]) => count >= 5).map(([cat]) => cat)];

  const fetchMarkets = useCallback(async (reset = false) => {
    const offset = reset ? 0 : offsetRef.current;
    if (reset) { setLoading(true); setMarkets([]); } else setLoadingMore(true);

    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    params.set("sort", sort);
    if (search) params.set("search", search);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));
    params.set("minVolume", "1000");

    const data = await apiFetch<{ success: boolean; markets: Market[]; hasMore: boolean }>(`/api/markets?${params}`);

    if (data.success) {
      setMarkets(prev => reset ? data.markets : [...prev, ...data.markets]);
      if (reset) setAllMarkets(data.markets);
      else setAllMarkets(prev => [...prev, ...data.markets]);
      setHasMore(data.hasMore);
      offsetRef.current = offset + data.markets.length;
    }
    setLoading(false);
    setLoadingMore(false);
  }, [category, sort, search]);

  useEffect(() => { offsetRef.current = 0; fetchMarkets(true); }, [fetchMarkets]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) fetchMarkets(false);
    }, { threshold: 0.1 });
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, loading, fetchMarkets]);

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
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search markets…"
              style={{ width: "100%", padding: "10px 16px 10px 40px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>🔍</span>
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 14, cursor: "pointer" }}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Categories — only show if 5+ markets */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
          {visibleCategories.map(c => (
            <button key={c} onClick={() => setCategory(c)} style={{
              padding: "5px 14px", borderRadius: 20, border: "1px solid",
              borderColor: category === c ? "#22C55E" : "var(--border)",
              background: category === c ? "rgba(34,197,94,0.1)" : "transparent",
              color: category === c ? "#22C55E" : "var(--text-muted)",
              fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
            }}>
              {c === "all" ? `All (${allMarkets.length})` : `${c} (${categoryCounts[c] ?? 0})`}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : markets.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>No markets found</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
            {markets.map(m => <MarketCard key={m.id} market={m} />)}
          </div>
        )}

        <div ref={sentinelRef} style={{ height: 40, marginTop: 16 }} />
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
