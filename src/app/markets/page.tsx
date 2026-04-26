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
      .then((data) => {
        if (data.success) setMarkets(data.markets);
      })
      .finally(() => setLoading(false));
  }, [category, sort, search]);

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", color: "#F8FAFC" }}>
<main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        {/* Title */}
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Markets</h1>
        <p style={{ color: "#94A3B8", marginBottom: 32 }}>
          Explore live event contracts and make your predictions.
        </p>

        {/* Search + Sort */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <input
            type="text"
            placeholder="Search markets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #1E293B",
              background: "#1E293B",
              color: "#F8FAFC",
              fontSize: 14,
              outline: "none",
            }}
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #1E293B",
              background: "#1E293B",
              color: "#F8FAFC",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <option value="volume">Popular</option>
            <option value="ending">Ending Soon</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        {/* Categories */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: "6px 16px",
                borderRadius: 20,
                border: "1px solid",
                borderColor: category === cat ? "#22C55E" : "#1E293B",
                background: category === cat ? "#22C55E20" : "transparent",
                color: category === cat ? "#22C55E" : "#94A3B8",
                fontSize: 13,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Markets Grid */}
        {loading ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{
                background: "#1E293B",
                borderRadius: 12,
                padding: 20,
                border: "1px solid #334155",
                animation: "pulse 1.5s ease-in-out infinite",
              }}>
                <div style={{ height: 12, background: "#334155", borderRadius: 4, width: "40%", marginBottom: 16 }} />
                <div style={{ height: 16, background: "#334155", borderRadius: 4, width: "90%", marginBottom: 8 }} />
                <div style={{ height: 16, background: "#334155", borderRadius: 4, width: "70%", marginBottom: 24 }} />
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <div style={{ flex: 1, height: 60, background: "#334155", borderRadius: 8 }} />
                  <div style={{ flex: 1, height: 60, background: "#334155", borderRadius: 8 }} />
                </div>
                <div style={{ height: 12, background: "#334155", borderRadius: 4, width: "60%" }} />
              </div>
            ))}
          </div>
        ) : markets.length === 0 ? (
          <div style={{ textAlign: "center", color: "#94A3B8", padding: 64 }}>
            No markets found.
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}>
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
    <a
      href={`/markets/${market.id}`}
      style={{ textDecoration: "none" }}
    >
      <div style={{
        background: "#1E293B",
        borderRadius: 12,
        padding: 20,
        border: "1px solid #334155",
        cursor: "pointer",
        transition: "border-color 0.2s",
      }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22C55E")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#334155")}
      >
        {/* Category + Status */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#22C55E",
            textTransform: "uppercase",
            letterSpacing: 1,
          }}>
            {market.category}
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#22C55E",
            background: "#22C55E20",
            padding: "2px 8px",
            borderRadius: 4,
          }}>
            LIVE
          </span>
        </div>

        {/* Title */}
        <p style={{
          fontSize: 15,
          fontWeight: 600,
          color: "#F8FAFC",
          marginBottom: 16,
          lineHeight: 1.4,
          minHeight: 42,
        }}>
          {market.title}
        </p>

        {/* YES / NO prices */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <div style={{
            flex: 1,
            background: "#22C55E15",
            border: "1px solid #22C55E40",
            borderRadius: 8,
            padding: "8px 12px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 2 }}>YES</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#22C55E" }}>
              {(market.yesPrice * 100).toFixed(0)}¢
            </div>
          </div>
          <div style={{
            flex: 1,
            background: "#EF444415",
            border: "1px solid #EF444440",
            borderRadius: 8,
            padding: "8px 12px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 2 }}>NO</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#EF4444" }}>
              {(market.noPrice * 100).toFixed(0)}¢
            </div>
          </div>
        </div>

        {/* Meta */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "#64748B",
        }}>
          <span>Vol 24h {volume}</span>
          <span>Ends {endDate}</span>
        </div>
      </div>
    </a>
  );
}
