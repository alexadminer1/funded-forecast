export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ height: 28, width: 180, background: "#1E293B", borderRadius: 4, marginBottom: 32, animation: "pulse 1.5s ease-in-out infinite" }} />
        {Array.from({ length: 3 }).map((_, sec) => (
          <div key={sec} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <div style={{ height: 18, width: 140, background: "#1E293B", borderRadius: 4, marginBottom: 20, animation: "pulse 1.5s ease-in-out infinite" }} />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ marginBottom: 14, animation: "pulse 1.5s ease-in-out infinite" }}>
                <div style={{ height: 12, width: 80, background: "#1E293B", borderRadius: 4, marginBottom: 6 }} />
                <div style={{ height: 36, background: "#1E293B", borderRadius: 8 }} />
              </div>
            ))}
          </div>
        ))}
      </main>
    </div>
  );
}
