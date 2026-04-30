export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ height: 28, width: 200, background: "#1E293B", borderRadius: 4, marginBottom: 24, animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ height: 56, padding: 16, borderBottom: i < 7 ? "1px solid var(--border)" : "none", display: "flex", alignItems: "center", gap: 16, animation: "pulse 1.5s ease-in-out infinite" }}>
              <div style={{ height: 14, background: "#1E293B", borderRadius: 4, flex: 1 }} />
              <div style={{ height: 14, background: "#1E293B", borderRadius: 4, width: 100 }} />
              <div style={{ height: 14, background: "#1E293B", borderRadius: 4, width: 80 }} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
