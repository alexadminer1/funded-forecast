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
  "First eligible purchase commissionable",
  "Transparent referral tracking",
  "Manual review before payout",
];

const WHY_CARDS = [
  {
    title: "Prediction-market challenge platform",
    desc: "FundedForecast lets traders prove their forecasting skills on real Polymarket events.",
  },
  {
    title: "Simple referral link",
    desc: "One unique link. Share it anywhere. Track every click and conversion in your dashboard.",
  },
  {
    title: "Clear commission tiers",
    desc: "Four tiers with defined rates. Your rate at conversion time is locked in — no retroactive changes.",
  },
  {
    title: "Affiliate dashboard",
    desc: "Monitor balances, view conversions, and track your ledger in real time from your cabinet.",
  },
];

const HOW_STEPS = [
  { n: "01", title: "Apply",                              desc: "Submit your affiliate application through your FundedForecast account." },
  { n: "02", title: "Get approved",                       desc: "Our team reviews your application. You'll be notified once a decision is made." },
  { n: "03", title: "Share your link",                    desc: "Get your unique /r/{refCode} link and share it on your channels." },
  { n: "04", title: "Referred user buys a challenge",     desc: "When a referred user makes their first eligible purchase, a conversion is recorded." },
  { n: "05", title: "Commission becomes available",       desc: "After the hold and review period, commission moves from pending to available in your balance." },
];

const RULES = [
  "Self-referrals are not eligible.",
  "Chargebacks, refunds, and fraud cases are not paid.",
  "Only the first eligible purchase is commissionable in the current program.",
  "Payouts are reviewed manually; minimum payout rules will be confirmed before production launch.",
  "Affiliates must follow all applicable marketing and legal rules.",
];

const FAQ_ITEMS = [
  { q: "Who can apply?",                               a: "Anyone with a FundedForecast account can apply. Approval is required." },
  { q: "How much can I earn?",                         a: "Commission ranges from 10% to 25% depending on your tier." },
  { q: "When does commission become available?",       a: "After the hold and review period for each conversion." },
  { q: "What is the minimum payout?",                  a: "Payouts are reviewed manually and minimum payout rules will be confirmed before production launch." },
  { q: "Can I run paid ads?",                          a: "Paid promotion is allowed if it follows marketing rules. Some channels may require approval — contact support if uncertain." },
  { q: "What happens with refunds or chargebacks?",    a: "Refunds, chargebacks, fraud, or self-referrals may reject or claw back commission." },
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
          Earn with FundedForecast
        </h1>
        <p style={{ fontSize: 18, color: "#94A3B8", lineHeight: 1.7, maxWidth: 560, margin: "0 auto 40px" }}>
          Promote FundedForecast and earn commission when referred users buy their first eligible challenge.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <a href={ctaHref} style={{ display: "inline-block", padding: "13px 32px", borderRadius: 10, background: "#22C55E", color: "#071A0E", fontWeight: 700, fontSize: 15, textDecoration: "none", boxShadow: "0 0 24px rgba(34,197,94,0.3)", letterSpacing: "-0.01em" }}>
            Apply now
          </a>
          <a href="#how-it-works" style={{ display: "inline-block", padding: "13px 32px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", color: "#94A3B8", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>
            How it works
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
          <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", color: "#F1F5F9", margin: 0 }}>A platform worth sharing</h2>
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
            Tier upgrades are reviewed based on affiliate performance and program rules. Commission rate is snapshotted at conversion creation. Program terms may change.
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
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.04em", color: "#F1F5F9", marginBottom: 16, marginTop: 0 }}>Ready to start?</h2>
          <p style={{ fontSize: 16, color: "#64748B", marginBottom: 36, marginTop: 0 }}>
            Join the FundedForecast affiliate program and earn commission by sharing your unique referral link.
          </p>
          <a href={ctaHref} style={{ display: "inline-block", padding: "14px 36px", borderRadius: 10, background: "#22C55E", color: "#071A0E", fontWeight: 700, fontSize: 15, textDecoration: "none", boxShadow: "0 0 28px rgba(34,197,94,0.3)", letterSpacing: "-0.01em" }}>
            Apply to become an affiliate
          </a>
        </div>
      </div>

    </div>
  );
}
