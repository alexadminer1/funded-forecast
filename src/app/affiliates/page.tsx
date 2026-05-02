"use client";
import { useEffect, useState } from "react";
import { getToken } from "@/lib/api";
import LandingHeader from "@/components/LandingHeader";

const TIERS = [
  { name: "Starter", pct: "10%", color: "#475569" },
  { name: "Bronze",  pct: "15%", color: "#D97706" },
  { name: "Silver",  pct: "20%", color: "#94A3B8" },
  { name: "Gold",    pct: "25%", color: "#F59E0B" },
];

const TRUST_ITEMS = [
  "Up to 25% commission",
  "Manual review, no spam",
  "Transparent reporting",
  "Built for serious creators",
];

const WHY_CARDS = [
  {
    title: "A product worth your audience's trust",
    desc: "FundedForecast is a prop firm focused on Polymarket-style prediction markets — a niche your audience hasn't been pitched to death yet. You promote something genuinely new, not another saturated funded-FX clone.",
  },
  {
    title: "Tiered commission, capped at 25%",
    desc: "Start at 10% and grow to 25% across four tiers. We don't promise unrealistic ceilings or jackpot rewards — just a clear, sustainable rate that holds up over time.",
  },
  {
    title: "Quality over volume",
    desc: "Every affiliate is reviewed manually before approval, and tier upgrades go through the same human review. This keeps the program clean, protects your brand from being lumped in with low-quality promoters, and means real partners aren't competing with bot farms.",
  },
  {
    title: "Honest tracking and reporting",
    desc: "Your dashboard shows clicks, conversions, pending and available commission in real time. Nothing is buried in fine print — what you see is what gets paid out after the standard review period.",
  },
];

const HOW_STEPS = [
  { n: "01", title: "Apply",                        desc: "Submit a short application telling us who you are, where you'll promote FundedForecast, and the audience you reach. Approval is manual — usually a few business days." },
  { n: "02", title: "Get your referral link",       desc: "Once approved, you receive a unique link in the format /r/{yourCode} and access to your affiliate dashboard with live tracking." },
  { n: "03", title: "Promote to your audience",    desc: "Share the link wherever your audience already trusts you — content, newsletters, reviews, comparisons. Use the angle that fits your voice; we're not prescriptive about format." },
  { n: "04", title: "Earn on first purchases",     desc: "When a referred user completes their first purchase, commission is recorded in your dashboard as pending. After the standard hold and review period, it moves to available." },
  { n: "05", title: "Request payout",              desc: "Submit a payout request from your dashboard once you have available commission. Each request is reviewed by our team before being processed." },
];

const RULES = [
  "Commission is paid only on the first purchase of each referred user, at the rate of your tier at the time of that purchase.",
  "Self-referrals, refunded purchases, chargebacks, and any traffic flagged as fraudulent are not commissionable.",
  "Promotion must be honest — no fabricated earnings claims, no impersonating FundedForecast, and no incentivized clicks or fake reviews.",
  "Tier upgrades and payouts are reviewed manually; we may request additional information about traffic sources before approval.",
  "Minimum payout rules will be confirmed before production launch.",
];

const FAQ_ITEMS = [
  { q: "Who can join the affiliate program?",          a: "Content creators, traders, educators, and finance-focused publishers whose audience overlaps with prop trading or prediction markets. We approve based on audience fit and content quality, not follower count alone." },
  { q: "How much can I earn per referral?",            a: "Commission ranges from 10% to 25% of the referred user's first purchase, depending on your tier. There's no separate bonus or jackpot system — the published rates are what you earn." },
  { q: "When does commission become payable?",         a: "After a referred purchase, commission is recorded as pending. It moves to available once the standard hold and review period passes (this covers refund and chargeback windows). You can request payout from your available balance." },
  { q: "How are tier upgrades decided?",               a: "Manually by our team. We look at the volume and quality of referred traffic, conversion behavior, and how you represent the product. We don't auto-promote based on raw sales count." },
  { q: "Why is approval required to join?",            a: "To keep the program clean. Manual review filters out low-quality and incentivized traffic, which protects payout rates and makes sure serious partners aren't competing with spam." },
  { q: "What happens if a referred user refunds or charges back?", a: "That commission is reversed. We only pay on completed, retained purchases — this is standard across reputable affiliate programs and keeps the system sustainable." },
];

export default function AffiliatesPage() {
  const [ctaHref, setCtaHref] = useState("/login?next=/affiliate/apply");
  useEffect(() => {
    if (getToken()) setCtaHref("/affiliate/apply");
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#F1F5F9", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <LandingHeader />

      {/* Hero */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "96px 24px 80px", textAlign: "center" }}>
        <div style={{ display: "inline-block", fontSize: 11, fontWeight: 700, color: "#22C55E", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20, padding: "4px 14px", borderRadius: 20, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
          Affiliate Program
        </div>
        <h1 style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 20, marginTop: 0, background: "linear-gradient(180deg, #F1F5F9 0%, #94A3B8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
          Promote a prop firm built for prediction markets
        </h1>
        <p style={{ fontSize: 18, color: "#94A3B8", lineHeight: 1.7, maxWidth: 560, margin: "0 auto 40px" }}>
          Earn 10–25% commission on referred users by sharing FundedForecast with your audience — a transparent program for creators who care about long-term reputation, not hype.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <a href={ctaHref} style={{ display: "inline-block", padding: "13px 32px", borderRadius: 10, background: "#22C55E", color: "#071A0E", fontWeight: 700, fontSize: 15, textDecoration: "none", boxShadow: "0 0 24px rgba(34,197,94,0.3)", letterSpacing: "-0.01em" }}>
            Apply now
          </a>
          <a href="#how-it-works" style={{ display: "inline-block", padding: "13px 32px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", color: "#94A3B8", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>
            See how it works
          </a>
        </div>
      </section>

      {/* Trust strip */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px", display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 4 }}>
          {TRUST_ITEMS.map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
              <span style={{ color: "#22C55E", fontWeight: 700, fontSize: 14 }}>✓</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#CBD5E1" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Why promote */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "72px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Why promote</div>
          <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", color: "#F1F5F9", margin: 0 }}>Why partners promote us</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {WHY_CARDS.map((c) => (
            <div key={c.title} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "24px 22px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 10, lineHeight: 1.35 }}>{c.title}</div>
              <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Commission tiers */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "72px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Commission tiers</div>
            <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", color: "#F1F5F9", margin: 0 }}>Earn more as you grow</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 28 }}>
            {TIERS.map((t) => (
              <div key={t.name} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "28px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.color, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>{t.name}</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: "#F1F5F9", letterSpacing: "-0.04em" }}>{t.pct}</div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>commission</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#475569", textAlign: "center", margin: 0, lineHeight: 1.7 }}>
            Tier upgrades are reviewed manually by our team — they aren't triggered automatically by sales count. We look at traffic quality, audience fit, and how the product is being represented. This keeps the program credible for everyone in it and rewards partners who promote responsibly rather than chasing volume at any cost.
          </p>
        </div>
      </div>

      {/* How it works */}
      <section id="how-it-works" style={{ maxWidth: 900, margin: "0 auto", padding: "72px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>How it works</div>
          <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", color: "#F1F5F9", margin: 0 }}>Five steps to earning</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {HOW_STEPS.map((s, i) => (
            <div key={s.n} style={{ display: "flex", gap: 20, paddingBottom: i < HOW_STEPS.length - 1 ? 32 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#22C55E" }}>{s.n}</div>
                {i < HOW_STEPS.length - 1 && <div style={{ width: 1, flex: 1, background: "rgba(255,255,255,0.06)", marginTop: 8 }} />}
              </div>
              <div style={{ paddingTop: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rules */}
      <div style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "72px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Rules</div>
            <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", color: "#F1F5F9", margin: 0 }}>Program compliance</h2>
          </div>
          <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "32px" }}>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
              {RULES.map((rule) => (
                <li key={rule} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ color: "#22C55E", fontSize: 14, flexShrink: 0, marginTop: 2 }}>•</span>
                  <span style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.6 }}>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "72px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>FAQ</div>
          <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", color: "#F1F5F9", margin: 0 }}>Common questions</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FAQ_ITEMS.map((item) => (
            <div key={item.q} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "22px 24px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 8 }}>{item.q}</div>
              <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>{item.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(34,197,94,0.03)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.04em", color: "#F1F5F9", marginBottom: 16, marginTop: 0 }}>Ready to promote something built to last?</h2>
          <p style={{ fontSize: 16, color: "#64748B", marginBottom: 36, marginTop: 0 }}>
            Apply to join the FundedForecast affiliate program — clear terms, manual review, and a product your audience hasn't seen ten times this month.
          </p>
          <a href={ctaHref} style={{ display: "inline-block", padding: "14px 36px", borderRadius: 10, background: "#22C55E", color: "#071A0E", fontWeight: 700, fontSize: 15, textDecoration: "none", boxShadow: "0 0 28px rgba(34,197,94,0.3)", letterSpacing: "-0.01em" }}>
            Apply now
          </a>
        </div>
      </div>

    </div>
  );
}
