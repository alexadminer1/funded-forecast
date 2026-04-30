import "./admin.css";

export default function Loading() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--admin-bg-page)",
      fontFamily: "'Inter',-apple-system,sans-serif",
    }}>
      <div style={{ display: "flex" }}>
        <aside style={{ width: 240, background: "var(--admin-bg-surface)", minHeight: "100vh", padding: 24, borderRight: "1px solid var(--admin-border)" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ height: 32, background: "var(--admin-border)", borderRadius: 6, marginBottom: 8, opacity: 0.5, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </aside>
        <main style={{ flex: 1, padding: 32 }}>
          <div style={{ height: 28, background: "var(--admin-border)", borderRadius: 6, width: 200, marginBottom: 24, animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ background: "var(--admin-bg-surface)", border: "1px solid var(--admin-border)", borderRadius: 12, overflow: "hidden" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: 56, borderBottom: i < 5 ? "1px solid var(--admin-border)" : "none", padding: 16, animation: "pulse 1.5s ease-in-out infinite" }}>
                <div style={{ height: 14, background: "var(--admin-border)", borderRadius: 4, width: "60%" }} />
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
