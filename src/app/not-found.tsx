import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh", background: "#080c14", color: "#F1F5F9",
      fontFamily: "'Inter',-apple-system,sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: "24px",
    }}>
      <div>
        <div style={{
          fontSize: 120, fontWeight: 800, letterSpacing: "-0.05em",
          background: "linear-gradient(180deg, #22C55E 0%, rgba(34,197,94,0.2) 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          lineHeight: 1, marginBottom: 16,
        }}>404</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 12, marginTop: 0 }}>
          Page not found
        </h1>
        <p style={{ fontSize: 15, color: "#475569", marginBottom: 40, lineHeight: 1.6 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/" style={{
          display: "inline-block", background: "#22C55E", color: "#071A0E",
          fontSize: 14, fontWeight: 700, padding: "12px 32px", borderRadius: 10,
          textDecoration: "none", boxShadow: "0 0 20px rgba(34,197,94,0.25)",
        }}>← Back to home</Link>
      </div>
    </div>
  );
}
