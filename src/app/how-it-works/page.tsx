export const metadata = {
  title: "How it works — FundedForecast",
  description: "From sign-up to payout in 7 steps.",
};

const steps = [
  {
    n: 1,
    title: "Create your account",
    body: "Sign up with email and password. No credit card, no KYC at this stage. Takes under a minute.",
  },
  {
    n: 2,
    title: "Practice in sandbox",
    body: "Every account starts with a free sandbox balance. Place trades on real Polymarket data without any time limit. Use it to learn the interface and calibrate your strategy.",
  },
  {
    n: 3,
    title: "Choose a challenge plan",
    body: "Pick the account size and rules that match your risk profile. Each plan defines starting balance, profit target, drawdown limits, and minimum trading days.",
  },
  {
    n: 4,
    title: "Accept rules and pay the fee",
    body: "Review the rules, accept the terms, and pay the one-time challenge fee. We accept crypto via NOWPayments. The fee is your only cost — no recurring charges.",
  },
  {
    n: 5,
    title: "Trade prediction markets",
    body: "Your challenge account activates immediately. Buy and sell YES/NO contracts on live events. Every trade is recorded with execution price, position size, and running balance.",
  },
  {
    n: 6,
    title: "Meet the targets",
    body: "Reach the profit target while staying inside daily and total drawdown limits. Trade on at least the minimum number of UTC days. Once all targets are met, the challenge passes.",
  },
  {
    n: 7,
    title: "Request your payout",
    body: "Submit a payout request from your account page. Specify amount, wallet network, and address. Once an admin verifies the request, USDT is sent to your wallet. Profit splits and minimums are listed on each plan page.",
  },
];

export default function HowItWorksPage() {
  return (
    <main style={{ background: "#060a10", color: "#F1F5F9", fontFamily: "'Inter', -apple-system, sans-serif", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 40px 120px" }}>

        <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 16 }}>
          How it works
        </h1>
        <p style={{ fontSize: 17, color: "#94A3B8", lineHeight: 1.6, marginBottom: 64, maxWidth: 680 }}>
          From sign-up to payout in seven steps.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {steps.map((s) => (
            <div
              key={s.n}
              style={{
                display: "grid",
                gridTemplateColumns: "56px 1fr",
                gap: 24,
                alignItems: "start",
                padding: 28,
                borderRadius: 14,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #22C55E, #16A34A)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 17,
                  color: "#071A0E",
                }}
              >
                {s.n}
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.01em" }}>
                  {s.title}
                </h2>
                <p style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.7, margin: 0 }}>
                  {s.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 64, padding: "32px 28px", borderRadius: 14, background: "rgba(34, 197, 94, 0.06)", border: "1px solid rgba(34, 197, 94, 0.2)" }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: "#F1F5F9" }}>Ready to start?</h3>
          <p style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.6, marginBottom: 20 }}>
            Practice for free in the sandbox or jump straight into a challenge.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href="/markets" style={ctaPrimary}>Try the sandbox</a>
            <a href="/#plans" style={ctaSecondary}>View plans</a>
          </div>
        </div>

      </div>
    </main>
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
