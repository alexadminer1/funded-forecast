import { prisma } from "@/lib/prisma";

async function getContent() {
  try {
    const block = await prisma.contentBlock.findFirst({ where: { key: "terms_content" } });
    return block?.value ?? "";
  } catch { return ""; }
}

export default async function TermsPage() {
  const content = await getContent();
  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#F1F5F9", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "80px 24px" }}>
        <a href="/" style={{ fontSize: 13, color: "#22C55E", textDecoration: "none", display: "inline-block", marginBottom: 40 }}>← Back to home</a>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>Terms of Use</h1>
        <p style={{ fontSize: 13, color: "#475569", marginBottom: 48 }}>Last updated: January 1, 2025</p>
        <div style={{ fontSize: 15, lineHeight: 1.8, color: "#94A3B8", whiteSpace: "pre-wrap" }}>{content}</div>
      </div>
    </div>
  );
}
