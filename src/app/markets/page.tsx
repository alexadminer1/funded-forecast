"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Market } from "@/lib/types";

const CATEGORIES = ["all", "crypto", "politics", "sports", "economy", "tech", "geopolitics", "climate", "culture", "other"];

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("volume");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    params.set("sort", sort);
    if (search) params.set("search", search);

    apiFetch<{ success: boolean; markets: Market[] }>(`/api/markets?${params}`)
      .then((data) => { if (data.success) setMarkets(data.markets); })
      .finally(() => setLoading(false));
  }, [category, sort, search]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "48px 24px" }}>

        {/* Page header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            marginBottom: 6,
          }}>
            Prediction Markets
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Trade event contracts and build your track record.
          </p>
        </div>

        {/* Search + Sort */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <svg style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#475569" }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search markets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px 10px 38px",
                borderRadius: "var(--radius-input)",
                border: "1px solid var(--border)",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                fontSize: 14,
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(34,197,94,0.4)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-input)",
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              fontSize: 14,
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="volume">Most Active</option>
            <option value="ending">Ending Soon</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        {/* Categories */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 36 }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: "5px 14px",
                borderRadius: 20,
                border: `1px solid ${category === cat ? "rgba(34,197,94,0.4)" : "var(--border)"}`,
                background: category === cat ? "rgba(34,197,94,0.1)" : "transparent",
                color: category === cat ? "#22C55E" : "var(--text-muted)",
                fontSize: 12.5,
                fontWeight: category === cat ? 600 : 400,
                cursor: "pointer",
                textTransform: "capitalize",
                letterSpacing: "0.01em",
                transition: "all 0.15s",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{
                background: "var(--bg-surface)",
                borderRadius: "var(--radius-card)",
                padding: 22,
                border: "1px solid var(--border-subtle)",
                animation: "pulse 1.8s ease-in-out infinite",
              }}>
                <div style={{ height: 10, background: "var(--bg-elevated)", borderRadius: 4, width: "35%", marginBottom: 18 }} />
                <div style={{ height: 15, background: "var(--bg-elevated)", borderRadius: 4, width: "92%", marginBottom: 8 }} />
                <div style={{ height: 15, background: "var(--bg-elevated)", borderRadius: 4, width: "68%", marginBottom: 28 }} />
                <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                  <div style={{ flex: 1, height: 62, background: "var(--bg-elevated)", borderRadius: 8 }} />
                  <div style={{ flex: 1, height: 62, background: "var(--bg-elevated)", borderRadius: 8 }} />
                </div>
                <div style={{ height: 10, background: "var(--bg-elevated)", borderRadius: 4, width: "55%" }} />
              </div>
            ))}
          </div>
        ) : markets.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "80px 0", fontSize: 14 }}>
            No markets found.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16, animation: "fadeIn 0.3s ease" }}>
            {markets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function MarketCard({ market }: { market: Market }) {
  const endDate = new Date(market.endDate).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  const volume = market.volume24h >= 1000
    ? `$${(market.volume24h / 1000).toFixed(1)}k`
    : `$${market.volume24h.toFixed(0)}`;

  return (
    <a href={`/markets/${market.id}`} style={{ textDecoration: "none", display: "block" }}>
      <div
        style={{
          background: "linear-gradient(160deg, var(--bg-surface) 0%, var(--bg-page) 100%)",
          borderRadius: "var(--radius-card)",
          padding: 22,
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.03)",
          cursor: "pointer",
          transition: "border-color 0.2s, box-shadow 0.2s, transform 0.15s",
          height: "100%",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = "rgba(34,197,94,0.3)";
          el.style.boxShadow = "var(--shadow-hover), inset 0 1px 0 rgba(255,255,255,0.05)";
          el.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = "var(--border)";
          el.style.boxShadow = "var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.03)";
          el.style.transform = "translateY(0)";
        }}
      >
        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}>
            {market.category}
          </span>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#22C55E",
            background: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.2)",
            padding: "2px 8px",
            borderRadius: 4,
            letterSpacing: "0.05em",
          }}>
            LIVE
          </span>
        </div>

        {/* Title */}
        <p style={{
          fontSize: 14.5,
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: 20,
          lineHeight: 1.45,
          minHeight: 44,
          letterSpacing: "-0.01em",
        }}>
          {market.title}
        </p>

        {/* YES / NO */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <div style={{
            flex: 1,
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.2)",
            borderRadius: 9,
            padding: "10px 12px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600, letterSpacing: "0.06em" }}>YES</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#22C55E", letterSpacing: "-0.02em" }}>
              {(market.yesPrice * 100).toFixed(0)}¢
            </div>
          </div>
          <div style={{
            flex: 1,
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 9,
            padding: "10px 12px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600, letterSpacing: "0.06em" }}>NO</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#EF4444", letterSpacing: "-0.02em" }}>
              {(market.noPrice * 100).toFixed(0)}¢
            </div>
          </div>
        </div>

        {/* Meta */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
          <span>{volume} vol/24h</span>
          <span>Ends {endDate}</span>
        </div>
      </div>
    </a>
  );
}
