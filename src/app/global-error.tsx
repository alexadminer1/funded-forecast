"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
    // TODO: Sentry.captureException(error)
  }, [error]);

  return (
    <html>
      <body style={{
        margin: 0,
        background: "#070D19",
        color: "#F1F5F9",
        fontFamily: "'Inter', -apple-system, sans-serif",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}>
        <div style={{
          maxWidth: 480,
          textAlign: "center",
          background: "#0D1521",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 14,
          padding: "40px 32px",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "#F1F5F9" }}>
            Critical error
          </h1>
          <p style={{ fontSize: 14, color: "#94A3B8", marginBottom: 24, lineHeight: 1.6 }}>
            Something went seriously wrong. Please reload the page.
          </p>
          {error.digest && (
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 20, fontFamily: "monospace" }}>
              ID: {error.digest}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={() => reset()}
              style={{
                padding: "10px 20px",
                borderRadius: 9,
                border: "none",
                background: "#22C55E",
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
                borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.06)",
                background: "transparent",
                color: "#94A3B8",
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
      </body>
    </html>
  );
}
