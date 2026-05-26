"use client";

import { ReactNode } from "react";

export type ZoneColor = "green" | "yellow" | "red" | "neutral";

const ZONE_COLOR_MAP: Record<ZoneColor, string> = {
  green:   "#22C55E",
  yellow:  "#F59E0B",
  red:     "#EF4444",
  neutral: "var(--text-primary)",
};

interface MetricWidgetProps {
  label: string;
  value: ReactNode;
  caption: string;
  zone?: ZoneColor;
  size?: "large" | "small";
}

export function MetricWidget({
  label,
  value,
  caption,
  zone = "neutral",
  size = "large",
}: MetricWidgetProps) {
  const valueColor = ZONE_COLOR_MAP[zone];
  const valueFontSize = size === "large" ? 28 : 22;

  return (
    <div
      style={{
        background: "linear-gradient(160deg, var(--bg-surface) 0%, var(--bg-page) 100%)",
        borderRadius: "var(--radius-card)",
        padding: "20px 22px",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          marginBottom: 10,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: valueFontSize,
          fontWeight: 800,
          color: valueColor,
          letterSpacing: "-0.03em",
          marginBottom: 6,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {caption}
      </div>
    </div>
  );
}
