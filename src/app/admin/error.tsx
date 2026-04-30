"use client";
import { useEffect } from "react";
import Link from "next/link";
import "./admin.css";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AdminError]", error);
    // TODO: Sentry.captureException(error)
  }, [error]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--admin-bg-page)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      fontFamily: "'Inter',-apple-system,sans-serif",
    }}>
      <div style={{
        maxWidth: 480,
        textAlign: "center",
        background: "var(--admin-bg-surface)",
        border: "1px solid var(--admin-border)",
        borderRadius: 12,
        padding: "40px 32px",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--admin-text)" }}>
          Admin error
        </h1>
        <p style={{ fontSize: 14, color: "var(--admin-text-muted)", marginBottom: 24, lineHeight: 1.6 }}>
          The admin panel hit an error. Try again or return to the dashboard.
        </p>
        {error.digest && (
          <div style={{ fontSize: 11, color: "var(--admin-text-dim)", marginBottom: 20, fontFamily: "monospace" }}>
            ID: {error.digest}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "var(--admin-accent)",
              color: "var(--admin-accent-dark)",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <Link
            href="/admin"
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid var(--admin-border)",
              background: "transparent",
              color: "var(--admin-text-muted)",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Admin home
          </Link>
        </div>
      </div>
    </div>
  );
}
