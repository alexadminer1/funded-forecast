"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export type ChallengeFailedReason =
  | "daily_drawdown_exceeded"
  | "mll_breach"
  | "inactivity"
  | "time_limit";

export type ChallengeFailedInfo = {
  reason: ChallengeFailedReason;
  details: string;
};

const REASON_LABEL: Record<ChallengeFailedReason, string> = {
  daily_drawdown_exceeded: "Daily Drawdown Limit",
  mll_breach: "Maximum Loss Limit",
  inactivity: "Inactivity Limit",
  time_limit: "Challenge Time Limit",
};

export function ChallengeFailedModal({
  info,
  onClose,
}: {
  info: ChallengeFailedInfo;
  onClose: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const readable = REASON_LABEL[info.reason] ?? "challenge rule";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "linear-gradient(160deg, var(--bg-surface) 0%, var(--bg-page) 100%)",
          borderRadius: 16,
          padding: 28,
          width: "100%",
          maxWidth: 460,
          border: "1px solid var(--border)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
          animation: "fadeIn 0.2s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: "#EF4444",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: 8,
              }}
            >
              Challenge ended
            </div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              Your challenge has ended
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              fontSize: 22,
              cursor: "pointer",
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <p
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            margin: "0 0 14px",
          }}
        >
          Your existing positions moved against you and triggered the{" "}
          <strong style={{ color: "var(--text-primary)" }}>{readable}</strong>. The trade
          was not executed.
        </p>

        <div
          style={{
            padding: "11px 14px",
            borderRadius: 8,
            marginBottom: 22,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            color: "#EF4444",
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 11 }}>
            Reason
          </div>
          {info.details}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => router.push("/account/plans")}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: 10,
              background: "#22C55E",
              color: "#071A0E",
              border: "none",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "-0.01em",
              boxShadow: "0 0 20px rgba(34,197,94,0.2)",
            }}
          >
            Buy new challenge
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: 10,
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "-0.01em",
            }}
          >
            Continue in sandbox
          </button>
        </div>
      </div>
    </div>
  );
}
