function SkeletonCard() {
  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "20px 24px",
      animation: "pulse 1.5s ease-in-out infinite",
    }}>
      <div style={{ height: 12, background: "#1E293B", borderRadius: 4, width: "30%", marginBottom: 12 }} />
      <div style={{ height: 16, background: "#1E293B", borderRadius: 4, width: "80%", marginBottom: 20 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ height: 32, background: "#1E293B", borderRadius: 6, width: 80 }} />
        <div style={{ height: 32, background: "#1E293B", borderRadius: 6, width: 80 }} />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ height: 32, background: "#1E293B", borderRadius: 4, width: 280, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ height: 14, background: "#1E293B", borderRadius: 4, width: 360, animation: "pulse 1.5s ease-in-out infinite" }} />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 40, background: "#1E293B", borderRadius: 9, animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ height: 40, width: 140, background: "#1E293B", borderRadius: 9, animation: "pulse 1.5s ease-in-out infinite" }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height: 28, width: 80, background: "#1E293B", borderRadius: 20, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
          {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </main>
    </div>
  );
}
