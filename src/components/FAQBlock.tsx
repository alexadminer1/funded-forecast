"use client";
import { useState } from "react";

type FAQItem = { id: number; question: string; answer: string };

export default function FAQBlock({ platform, rules }: { platform: FAQItem[]; rules: FAQItem[] }) {
  const [tab, setTab] = useState<"platform" | "rules">("platform");
  const [open, setOpen] = useState<number | null>(null);
  const items = tab === "platform" ? platform : rules;

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
        <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 30, padding: 4, gap: 4 }}>
          {(["platform", "rules"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setOpen(null); }} style={{
              padding: "8px 24px", borderRadius: 24, border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 600,
              background: tab === t ? "#22C55E" : "transparent",
              color: tab === t ? "#071A0E" : "#64748B",
              transition: "all 0.2s",
            }}>
              {t === "platform" ? "Our Platform" : "Challenge Rules"}
            </button>
          ))}
        </div>
      </div>

      {/* Accordion */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <div key={item.id} onClick={() => setOpen(open === item.id ? null : item.id)} style={{
            background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12, padding: "18px 22px", cursor: "pointer",
            transition: "border-color 0.2s",
            borderColor: open === item.id ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.06)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#F1F5F9", letterSpacing: "-0.01em" }}>{item.question}</span>
              <span style={{ color: "#22C55E", fontSize: 18, flexShrink: 0, marginLeft: 16, transition: "transform 0.2s", display: "inline-block", transform: open === item.id ? "rotate(180deg)" : "rotate(0deg)" }}>⌄</span>
            </div>
            {open === item.id && (
              <div style={{ marginTop: 12, fontSize: 14, color: "#64748B", lineHeight: 1.7 }}>{item.answer}</div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", marginTop: 32, fontSize: 14, color: "#475569" }}>
        Still can&apos;t find the answer you&apos;re looking for?{" "}
        <a href="mailto:support@fundedforecast.com" style={{ color: "#22C55E", textDecoration: "none" }}>Contact support →</a>
      </div>
    </div>
  );
}
