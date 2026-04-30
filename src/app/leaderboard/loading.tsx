export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#F1F5F9" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ height: 12, width: 100, background: "#1E293B", borderRadius: 4, margin: "0 auto 10px", animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ height: 36, width: 240, background: "#1E293B", borderRadius: 4, margin: "0 auto 8px", animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ height: 14, width: 360, background: "#1E293B", borderRadius: 4, margin: "0 auto", animation: "pulse 1.5s ease-in-out infinite" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 32 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 24, height: 180, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
        <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{ height: 48, padding: "14px 20px", borderBottom: i < 9 ? "1px solid rgba(255,255,255,0.04)" : "none", animation: "pulse 1.5s ease-in-out infinite" }}>
              <div style={{ height: 14, background: "#1E293B", borderRadius: 4, width: `${50 + (i * 7) % 40}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
