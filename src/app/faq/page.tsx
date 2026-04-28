"use client";
import { useState, useMemo } from "react";
import { faqData, FAQCategory } from "./data";

function AccordionItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(!open)} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", padding: "14px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#F1F5F9", lineHeight: 1.5 }}>{q}</span>
        <span style={{ color: "#22C55E", fontSize: 16, flexShrink: 0, transition: "transform 0.2s", display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>⌄</span>
      </div>
      {open && <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.7, marginTop: 10, marginBottom: 0 }}>{a}</p>}
    </div>
  );
}

function CategoryCard({ cat, active, onClick }: { cat: FAQCategory; active: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      background: active ? "rgba(34,197,94,0.08)" : "#0d1117",
      border: `1px solid ${active ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 10, padding: "16px 20px", cursor: "pointer",
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: active ? "#22C55E" : "#F1F5F9", marginBottom: 4 }}>{cat.title}</div>
      <div style={{ fontSize: 12, color: "#475569" }}>{cat.description}</div>
      <div style={{ fontSize: 11, color: "#334155", marginTop: 8 }}>{cat.items.length} questions</div>
    </div>
  );
}

export default function FAQPage() {
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return faqData;
    const q = search.toLowerCase();
    return faqData.map(cat => ({
      ...cat,
      items: cat.items.filter(i => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q)),
    })).filter(cat => cat.items.length > 0);
  }, [search]);

  const displayed = activeId && !search ? filtered.filter(c => c.id === activeId) : filtered;

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#F1F5F9", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 24px 80px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", letterSpacing: "0.1em", marginBottom: 12 }}>HELP CENTER</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 12, marginTop: 0 }}>Advice and answers from<br />the FundedForecast Team</h1>
          <p style={{ fontSize: 15, color: "#64748B", marginBottom: 32 }}>Find clear answers about challenges, trading rules, payouts, accounts, and platform support.</p>
          <div style={{ maxWidth: 480, margin: "0 auto", position: "relative" }}>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setActiveId(null); }}
              placeholder="Search for answers…"
              style={{ width: "100%", padding: "13px 20px 13px 44px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "#0d1117", color: "#F1F5F9", fontSize: 14, boxSizing: "border-box", outline: "none" }}
            />
            <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#334155", fontSize: 16 }}>🔍</span>
          </div>
        </div>

        {/* Category grid — hide when searching */}
        {!search && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 48 }}>
            {faqData.map(cat => (
              <CategoryCard key={cat.id} cat={cat} active={activeId === cat.id} onClick={() => setActiveId(activeId === cat.id ? null : cat.id)} />
            ))}
          </div>
        )}

        {/* FAQ list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {displayed.map(cat => (
            <div key={cat.id}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", letterSpacing: "0.1em", marginBottom: 4 }}>{cat.title.toUpperCase()}</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F1F5F9", marginBottom: 16, marginTop: 0 }}>{cat.description}</h2>
              <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "0 20px" }}>
                {cat.items.map(item => <AccordionItem key={item.q} q={item.q} a={item.a} />)}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div style={{ textAlign: "center", marginTop: 64, padding: "32px", background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9", marginBottom: 8 }}>Still have questions?</div>
          <p style={{ fontSize: 13, color: "#475569", marginBottom: 20 }}>Our support team is here to help.</p>
          <a href="mailto:support@fundedforecast.com" style={{ display: "inline-block", background: "#22C55E", color: "#071A0E", fontSize: 13, fontWeight: 700, padding: "10px 28px", borderRadius: 9, textDecoration: "none" }}>Contact Support →</a>
        </div>

      </div>
    </div>
  );
}
