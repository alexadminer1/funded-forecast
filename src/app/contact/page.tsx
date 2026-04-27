export default function ContactPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#F1F5F9", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <a href="/" style={{ fontSize: 13, color: "#22C55E", textDecoration: "none", display: "inline-block", marginBottom: 40 }}>← Back to home</a>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 12 }}>Contact Us</h1>
        <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7, marginBottom: 48 }}>
          Have a question or need support? Reach out and we&apos;ll get back to you as soon as possible.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <a href="mailto:support@fundedforecast.com" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12, padding: "20px 24px", textDecoration: "none",
            color: "#F1F5F9", fontSize: 15, fontWeight: 600,
          }}>
            <span style={{ fontSize: 20 }}>✉️</span>
            support@fundedforecast.com
          </a>
        </div>
        <p style={{ fontSize: 13, color: "#334155", marginTop: 40 }}>We typically respond within 24 hours.</p>
      </div>
    </div>
  );
}
