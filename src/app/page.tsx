import LoginForm from "@/components/LoginForm";
import { prisma } from "@/lib/prisma";

async function getContent(): Promise<Record<string, string>> {
  try {
    const blocks = await prisma.contentBlock.findMany();
    const map: Record<string, string> = {};
    for (const b of blocks) map[b.key] = b.value;
    return map;
  } catch {
    return {};
  }
}

async function getPlans() {
  try {
    return await prisma.challengePlan.findMany({ where: { isActive: true }, orderBy: { order: "asc" } });
  } catch {
    return [];
  }
}

function parseJson(val: string | undefined, fallback: { title: string; desc: string }) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

const card: React.CSSProperties = {
  background: "#0d1117",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 12,
  padding: "20px 22px",
};

const h2: React.CSSProperties = {
  fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em",
  color: "#F1F5F9", marginBottom: 20, marginTop: 0,
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", letterSpacing: "0.1em", marginBottom: 10 }}>{children}</div>;
}

export default async function Home() {
  const content = await getContent();
  const plans = await getPlans();

  const heroTitle = content.hero_title ?? "Trade predictions. Get funded.";
  const heroSubtitle = content.hero_subtitle ?? "Prove your forecasting skills on real Polymarket events. Pass the challenge, earn up to 80% of profits.";
  const ctaText = content.cta_text ?? "Start your evaluation";

  const steps = [
    { step: "01", ...parseJson(content.how_it_works_1, { title: "Sign up", desc: "Create a free account and receive $10,000 in paper capital instantly. No deposit required." }) },
    { step: "02", ...parseJson(content.how_it_works_2, { title: "Trade markets", desc: "Buy and sell YES/NO shares on real Polymarket events. Live prices, real spreads." }) },
    { step: "03", ...parseJson(content.how_it_works_3, { title: "Get funded", desc: "Hit 10% profit target in 10+ trading days without exceeding 10% drawdown. Earn 80% of profits." }) },
  ];

  const icons = ["◈", "◎", "◉", "◆"];
  const features = [
    parseJson(content.feature_1, { title: "Real market data", desc: "All prices sourced directly from Polymarket. No artificial spreads or fake liquidity." }),
    parseJson(content.feature_2, { title: "Paper capital", desc: "$10,000 virtual balance. Trade real markets without financial risk." }),
    parseJson(content.feature_3, { title: "Fair evaluation", desc: "10% profit target over minimum 10 trading days. Clear, transparent rules." }),
    parseJson(content.feature_4, { title: "80% profit share", desc: "Pass the evaluation and keep 80% of all profits generated on your funded account." }),
  ];

  const stats = [
    { value: "$10,000", label: "Paper capital" },
    { value: "100+", label: "Live markets" },
    { value: "80%", label: "Profit share" },
    { value: "Real-time", label: "Price data" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "#080c14", color: "#F1F5F9",
      display: "flex", flexDirection: "column",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      overflowX: "hidden",
    }}>
      {/* Green glow */}
      <div style={{
        position: "fixed", top: -200, left: "50%", transform: "translateX(-50%)",
        width: 900, height: 600,
        background: "radial-gradient(ellipse, rgba(34,197,94,0.13) 0%, transparent 65%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* Nav */}
      <header style={{ position: "relative", zIndex: 10, padding: "20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: "linear-gradient(135deg, #22C55E, #16A34A)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 800, color: "#071A0E",
            boxShadow: "0 0 16px rgba(34,197,94,0.35)",
          }}>F</div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em", color: "#F1F5F9" }}>FundedForecast</span>
        </a>
        <nav style={{ display: "flex", gap: 32, alignItems: "center" }}>
          <a href="#how" style={{ fontSize: 14, color: "#64748B", textDecoration: "none", fontWeight: 500 }}>How it works</a>
        </nav>
        <a href="/login?mode=register" style={{
          fontSize: 13, fontWeight: 700, background: "#22C55E", color: "#071A0E",
          padding: "8px 20px", borderRadius: 9, textDecoration: "none", letterSpacing: "-0.01em",
          boxShadow: "0 0 20px rgba(34,197,94,0.25)",
        }}>Get started</a>
      </header>

      {/* Main */}
      <main style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        padding: "64px 24px 80px", position: "relative", zIndex: 1, textAlign: "center",
      }}>
        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
          borderRadius: 20, padding: "5px 14px",
          fontSize: 11.5, fontWeight: 600, color: "#22C55E",
          letterSpacing: "0.05em", marginBottom: 30,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 6px rgba(34,197,94,0.8)", display: "inline-block" }} />
          LIVE MARKETS · PAPER TRADING
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: "clamp(38px, 6vw, 66px)", fontWeight: 800, letterSpacing: "-0.04em",
          lineHeight: 1.08, marginBottom: 18, maxWidth: 680,
          background: "linear-gradient(180deg, #F1F5F9 0%, #94A3B8 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        }}>
          {heroTitle.split(". ").map((line, i, arr) => (
            <span key={i}>{line}{i < arr.length - 1 ? "." : ""}{i < arr.length - 1 && <br />}</span>
          ))}
        </h1>

        <p style={{ fontSize: 17, color: "#64748B", maxWidth: 420, lineHeight: 1.65, marginBottom: 48, letterSpacing: "-0.01em" }}>
          {heroSubtitle}
        </p>

        {/* Login form — client component */}
        <LoginForm ctaText="Sign In" />

        {/* Stats */}
        <div style={{
          display: "flex", gap: 0, borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden", background: "rgba(13,21,33,0.6)", backdropFilter: "blur(12px)", marginBottom: 120,
        }}>
          {stats.map(({ value, label }, i) => (
            <div key={label} style={{ padding: "18px 28px", textAlign: "center", borderRight: i < stats.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#22C55E", letterSpacing: "-0.03em", marginBottom: 3 }}>{value}</div>
              <div style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <section id="how" style={{ width: "100%", maxWidth: 900, marginBottom: 120, textAlign: "left" }}>
          <SectionLabel>HOW IT WORKS</SectionLabel>
          <h2 style={h2}>Three steps to funding</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {steps.map(({ step, title, desc }) => (
              <div key={step} style={card}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", letterSpacing: "0.08em", marginBottom: 12 }}>{step}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9", marginBottom: 8, letterSpacing: "-0.02em" }}>{title}</div>
                <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Choose Your Challenge */}
        {plans.length > 0 && (
          <section id="plans" style={{ width: "100%", maxWidth: 960, marginBottom: 120, textAlign: "left" }}>
            <SectionLabel>PRICING</SectionLabel>
            <h2 style={h2}>Choose your challenge</h2>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${plans.length}, 1fr)`, gap: 16 }}>
              {plans.map((plan) => {
                const params = [
                  { label: "Profit Target", value: `${plan.profitTargetPct}%` },
                  { label: "Max Loss Limit", value: `${plan.maxLossPct}%` },
                  { label: "Daily Loss Limit", value: `${plan.dailyLossPct}%` },
                  { label: "Min Trading Days", value: String(plan.minTradingDays) },
                  { label: "Profit Share", value: "80%" },
                  { label: "Refundable Fee", value: `$${plan.price}` },
                ];
                return (
                <div key={plan.id} style={{
                  background: "#0F1A0F",
                  border: `1px solid ${plan.isPopular ? "#22C55E" : "#1a3a1a"}`,
                  borderRadius: 16,
                  padding: "24px 20px",
                  position: "relative",
                  boxShadow: plan.isPopular ? "0 0 40px rgba(34,197,94,0.10)" : "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                }}>
                  {/* -50% badge top right */}
                  <div style={{
                    position: "absolute", top: 14, right: 14,
                    background: "#F59E0B", color: "#000",
                    fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
                    padding: "3px 8px", borderRadius: 6,
                  }}>-50%</div>

                  {/* Best value badge */}
                  {plan.isPopular && (
                    <div style={{
                      position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
                      background: "#22C55E", color: "#071A0E", fontSize: 10, fontWeight: 800,
                      letterSpacing: "0.08em", padding: "4px 16px", borderRadius: 20, whiteSpace: "nowrap",
                    }}>BEST VALUE</div>
                  )}

                  {/* Account size */}
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: "#F1F5F9", letterSpacing: "-0.04em", lineHeight: 1.1 }}>
                      ${plan.accountSize.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 12, color: "#4B6A4B", fontWeight: 500, marginTop: 3 }}>Account Size</div>
                  </div>

                  {/* GET PLAN button */}
                  <a href={`/login?mode=register&planId=${plan.id}`} style={{
                    display: "block", textAlign: "center",
                    background: "#22C55E", color: "#071A0E",
                    fontSize: 14, fontWeight: 800, letterSpacing: "0.04em",
                    padding: "13px", borderRadius: 10, textDecoration: "none",
                    boxShadow: "0 0 24px rgba(34,197,94,0.25)",
                    marginBottom: 10,
                  }}>GET PLAN →</a>

                  {/* Price row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, justifyContent: "center" }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: "#F1F5F9" }}>${plan.price}</span>
                    <span style={{ fontSize: 14, color: "#475569", textDecoration: "line-through" }}>${plan.price * 2}</span>
                  </div>

                  {/* Params list */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {params.map(({ label, value }, i) => (
                      <div key={label} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "9px 0",
                        borderTop: i === 0 ? "1px solid #1a3a1a" : "1px solid #1a3a1a",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, color: "#3a5a3a" }}>ⓘ</span>
                          <span style={{ fontSize: 13, color: "#94A3B8" }}>{label}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#22C55E" }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Live markets preview */}
        <section style={{ width: "100%", maxWidth: 900, marginBottom: 120, textAlign: "left" }}>
          <SectionLabel>MARKETS</SectionLabel>
          <h2 style={h2}>Live market preview</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { title: "Will Bitcoin exceed $120,000 before July 2026?", category: "Crypto", yes: 62, no: 38, vol: "$84k" },
              { title: "Will the US hold a federal election in November 2026?", category: "Politics", yes: 91, no: 9, vol: "$210k" },
              { title: "Will the NBA Finals go to 7 games in 2026?", category: "Sports", yes: 34, no: 66, vol: "$31k" },
            ].map(({ title, category, yes, no, vol }) => (
              <div key={title} style={{ ...card, display: "flex", alignItems: "center", gap: 20, padding: "16px 20px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{category}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#F1F5F9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#22C55E", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, padding: "4px 10px" }}>YES {yes}¢</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#EF4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "4px 10px" }}>NO {no}¢</span>
                </div>
                <div style={{ fontSize: 12, color: "#475569", flexShrink: 0 }}>{vol} vol</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, textAlign: "center" }}>
            <a href="/markets" style={{ fontSize: 13, color: "#22C55E", textDecoration: "none" }}>View all markets →</a>
          </div>
        </section>

        {/* Why traders choose us */}
        <section style={{ width: "100%", maxWidth: 900, marginBottom: 120, textAlign: "left" }}>
          <SectionLabel>ADVANTAGES</SectionLabel>
          <h2 style={h2}>Why traders choose us</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {features.map(({ title, desc }, i) => (
              <div key={title} style={card}>
                <div style={{ fontSize: 20, marginBottom: 12, color: "#22C55E" }}>{icons[i]}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", marginBottom: 6, letterSpacing: "-0.02em" }}>{title}</div>
                <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Earnings examples */}
        <section style={{ width: "100%", maxWidth: 900, marginBottom: 120, textAlign: "left" }}>
          <SectionLabel>RESULTS</SectionLabel>
          <h2 style={h2}>Earnings examples</h2>
          <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", background: "rgba(255,255,255,0.02)", padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Trader", "Profit", "Payout (80%)", "Status"].map((h) => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</div>
              ))}
            </div>
            {[
              { trader: "@forecast_king", profit: "$1,420", payout: "$1,136", status: "Funded" },
              { trader: "@prob_wizard", profit: "$890", payout: "$712", status: "Funded" },
              { trader: "@markets_pro", profit: "$2,100", payout: "$1,680", status: "Funded" },
              { trader: "@alpha_caller", profit: "$540", payout: "$432", status: "In progress" },
            ].map(({ trader, profit, payout, status }, i) => (
              <div key={trader} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "14px 20px", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                <div style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500 }}>{trader}</div>
                <div style={{ fontSize: 13, color: "#22C55E", fontWeight: 700 }}>{profit}</div>
                <div style={{ fontSize: 13, color: "#F1F5F9", fontWeight: 600 }}>{payout}</div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: status === "Funded" ? "#22C55E" : "#F59E0B", background: status === "Funded" ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)", border: `1px solid ${status === "Funded" ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)"}`, borderRadius: 4, padding: "2px 8px", letterSpacing: "0.04em" }}>{status.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Risk rules */}
        <section style={{ width: "100%", maxWidth: 900, marginBottom: 120, textAlign: "left" }}>
          <SectionLabel>RULES</SectionLabel>
          <h2 style={h2}>Evaluation criteria</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { value: "10%", label: "Profit target", desc: "Grow your $10,000 account by at least $1,000 to pass." },
              { value: "10%", label: "Max drawdown", desc: "Never lose more than $1,000 from the starting balance." },
              { value: "10", label: "Min trading days", desc: "Trade on at least 10 separate calendar days." },
            ].map(({ value, label, desc }) => (
              <div key={label} style={{ ...card, textAlign: "center" }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: "#22C55E", letterSpacing: "-0.04em", marginBottom: 6 }}>{value}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#F1F5F9", marginBottom: 8 }}>{label}</div>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ width: "100%", maxWidth: 600, textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.04em", color: "#F1F5F9", marginBottom: 12 }}>
            Ready to get funded?
          </h2>
          <p style={{ fontSize: 15, color: "#475569", marginBottom: 28, lineHeight: 1.6 }}>
            Join 2,400+ traders proving their skills on real Polymarket events.
          </p>
          <a href="/login?mode=register" style={{
            display: "inline-block", background: "#22C55E", color: "#071A0E",
            fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em",
            padding: "14px 40px", borderRadius: 10, textDecoration: "none",
            border: "1px solid rgba(34,197,94,0.4)",
          }}>
            {ctaText} →
          </a>
        </section>
      </main>
    </div>
  );
}
