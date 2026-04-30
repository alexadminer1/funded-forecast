function SkeletonBox({ height, width = "100%" }: { height: number; width?: string | number }) {
  return (
    <div style={{
      height,
      width,
      background: "#1E293B",
      borderRadius: 8,
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  );
}

export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ marginBottom: 32 }}>
          <SkeletonBox height={32} width={220} />
          <div style={{ marginTop: 8 }}>
            <SkeletonBox height={14} width={320} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 32 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
              <SkeletonBox height={12} width={80} />
              <div style={{ marginTop: 12 }}><SkeletonBox height={28} width={140} /></div>
            </div>
          ))}
        </div>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
          <SkeletonBox height={20} width={180} />
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => <SkeletonBox key={i} height={48} />)}
          </div>
        </div>
      </main>
    </div>
  );
}
