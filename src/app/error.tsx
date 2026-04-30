"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError]", error);
    // TODO: Sentry.captureException(error)
  }, [error]);

  return (
    <div style={{
      minHeight: "60vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      background: "var(--bg-page)",
    }}>
      <div style={{
        maxWidth: 480,
        textAlign: "center",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        padding: "40px 32px",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--text-primary)" }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.6 }}>
          We couldn&apos;t load this page. Try again or go back to the home page.
        </p>
        {error.digest && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 20, fontFamily: "monospace" }}>
            ID: {error.digest}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              borderRadius: "var(--radius-input)",
              border: "none",
              background: "var(--accent)",
              color: "#071A0E",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <Link
            href="/"
            style={{
              padding: "10px 20px",
              borderRadius: "var(--radius-input)",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
