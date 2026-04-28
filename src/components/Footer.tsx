export default function Footer() {
  return (
    <footer style={{
      borderTop: "1px solid rgba(255,255,255,0.06)",
      background: "#060a10",
      padding: "60px 40px 0",
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr auto auto", gap: 80, marginBottom: 48 }}>
        <div>
          <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg, #22C55E, #16A34A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#071A0E" }}>F</div>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em", color: "#F1F5F9" }}>FundedForecast</span>
          </a>
          <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, maxWidth: 260, margin: 0 }}>
            Prove your forecasting skills on real Polymarket events. Pass the challenge, earn real payouts.
          </p>
          <p style={{ fontSize: 12, color: "#334155", marginTop: 20 }}>© 2025 FundedForecast. All rights reserved.</p>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Quick Menu</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "How it works", href: "/#how" },
              { label: "Pricing", href: "/#plans" },
              { label: "FAQ", href: "/#faq" },
              { label: "Contact", href: "/contact" },
              { label: "Support", href: "mailto:support@fundedforecast.com" },
            ].map(({ label, href }) => (
              <a key={label} href={href} style={{ fontSize: 13, color: "#64748B", textDecoration: "none" }}>{label}</a>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Information</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Terms & Conditions", href: "/terms-of-use" },
              { label: "Privacy Policy", href: "/privacy-policy" },
              { label: "Risk Disclosure", href: "/risk-disclosure" },
            ].map(({ label, href }) => (
              <a key={label} href={href} style={{ fontSize: 13, color: "#64748B", textDecoration: "none" }}>{label}</a>
            ))}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 900, margin: "0 auto", borderTop: "1px solid rgba(255,255,255,0.04)", padding: "20px 0", display: "flex", justifyContent: "center" }}>
        <p style={{ fontSize: 12, color: "#334155", margin: 0 }}>
          support@fundedforecast.com · Not a Deposit · Not Financial Advice · May Lose Value
        </p>
      </div>
    </footer>
  );
}
