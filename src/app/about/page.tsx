export const metadata = {
  title: "About — FundedForecast",
  description: "Funded Forecast is a skill-based forecasting platform built on real prediction markets.",
};

export default function AboutPage() {
  return (
    <main style={{ background: "#060a10", color: "#F1F5F9", fontFamily: "'Inter', -apple-system, sans-serif", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 40px 120px" }}>

        <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 16 }}>
          About FundedForecast
        </h1>
        <p style={{ fontSize: 17, color: "#94A3B8", lineHeight: 1.6, marginBottom: 56, maxWidth: 680 }}>
          A skill-based forecasting platform built on real prediction markets. Prove your edge, pass the challenge, get paid for accuracy.
        </p>

        <Section title="What is FundedForecast">
          <p>
            FundedForecast is a challenge-based platform where forecasters demonstrate their skill on live prediction markets. We don&apos;t teach trading or sell signals — we measure performance against transparent rules and reward those who pass.
          </p>
        </Section>

        <Section title="Why prediction markets">
          <p>
            Prediction markets aggregate information from thousands of participants into a single price. They cover politics, sports, economics, crypto, and current events. Forecasting these markets requires research, calibration, and discipline — exactly the skills we evaluate.
          </p>
          <p>
            Our challenges use real Polymarket data, so the markets you see reflect actual public sentiment in real time.
          </p>
        </Section>

        <Section title="The challenge model">
          <p>
            You purchase a challenge plan, receive a virtual account, and trade prediction markets under defined rules. Hit the profit target while staying inside the risk limits — and the account graduates. Break a rule and the challenge ends.
          </p>
          <p>
            No real capital is at risk during the challenge. The plan fee is your only cost.
          </p>
        </Section>

        <Section title="Risk-first rules">
          <p>
            Every plan has three guardrails:
          </p>
          <ul style={{ paddingLeft: 20, color: "#94A3B8", lineHeight: 1.8 }}>
            <li>Maximum total drawdown — you can&apos;t lose more than X% of starting balance.</li>
            <li>Maximum daily drawdown — you can&apos;t lose more than X% in a single UTC day.</li>
            <li>Position size cap — no single trade can exceed X% of your balance.</li>
          </ul>
          <p>
            Rules apply uniformly. There are no surprise restrictions, no consistency clauses, no hidden minimum trade counts beyond the disclosed minimum trading days.
          </p>
        </Section>

        <Section title="Transparency">
          <p>
            Every trade, balance change, and challenge outcome is logged. Resolved markets are settled against Polymarket&apos;s on-chain results. Our internal audit endpoint continuously checks balance integrity, drawdown calculations, and position consistency.
          </p>
          <p>
            If our system makes a mistake, you can see it.
          </p>
        </Section>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 64 }}>
          <a href="/markets" style={ctaPrimary}>Try the sandbox</a>
          <a href="/#plans" style={ctaSecondary}>View plans</a>
        </div>

      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, letterSpacing: "-0.01em" }}>{title}</h2>
      <div style={{ fontSize: 15, color: "#94A3B8", lineHeight: 1.7, display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

const ctaPrimary: React.CSSProperties = {
  display: "inline-block",
  padding: "13px 24px",
  borderRadius: 10,
  background: "linear-gradient(135deg, #22C55E, #16A34A)",
  color: "#071A0E",
  fontWeight: 700,
  fontSize: 14,
  textDecoration: "none",
};

const ctaSecondary: React.CSSProperties = {
  display: "inline-block",
  padding: "13px 24px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.04)",
  color: "#F1F5F9",
  border: "1px solid rgba(255,255,255,0.08)",
  fontWeight: 600,
  fontSize: 14,
  textDecoration: "none",
};
