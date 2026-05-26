"use client";

import { MetricWidget, ZoneColor } from "./MetricWidget";

// Local mirror of src/lib/user/active-challenge.ts ActiveChallenge.
// Numerics are optional here to defend against stale cached /api/user/me
// responses where new Phase 5 fields are missing — see ?? 0 defaults
// in render below.
interface WidgetChallenge {
  id: number;
  startBalance?: number;
  currentBalance?: number;
  dailyDrawdownPercent?: number;
  dailyLossLimitPercent?: number;
  maxLossLimitPercent?: number;
  daysRemaining?: number;
  consistency?: number;
  mllAmount?: number;
  mllBufferAmount?: number;
  resolvedPositionsCount?: number;
  uniqueEventsCount?: number;
}

const RESOLVED_TARGET = 35;
const UNIQUE_EVENTS_TARGET = 30;
const CONSISTENCY_LIMIT_PCT = 25;

function dailyDdZone(currentPct: number, limitPct: number): ZoneColor {
  if (limitPct <= 0) return "neutral";
  const usage = currentPct / limitPct;
  if (usage >= 0.9) return "red";
  if (usage >= 0.6) return "yellow";
  return "green";
}

function mllBufferZone(bufferAmount: number, maxLossAmount: number): ZoneColor {
  if (bufferAmount <= 0) return "red";
  if (maxLossAmount <= 0) return "neutral";
  const ratio = bufferAmount / maxLossAmount;
  if (ratio > 0.5) return "green";
  if (ratio >= 0.2) return "yellow";
  return "red";
}

function daysRemainingZone(days: number): ZoneColor {
  if (days >= 4) return "green";
  if (days >= 2) return "yellow";
  return "red";
}

function resolvedPositionsZone(count: number): ZoneColor {
  if (count >= 25) return "green";
  if (count >= 11) return "yellow";
  return "red";
}

function uniqueEventsZone(count: number): ZoneColor {
  if (count >= 21) return "green";
  if (count >= 10) return "yellow";
  return "red";
}

function consistencyZone(pct: number): ZoneColor {
  if (pct > 22) return "red";
  if (pct >= 15) return "yellow";
  return "green";
}

interface ChallengeWidgetsProps {
  challenge: WidgetChallenge;
}

export function ChallengeWidgets({ challenge: c }: ChallengeWidgetsProps) {
  // Defensive defaults — protect against stale cached /api/user/me responses
  // where new Phase 5 fields are not yet present.
  const dailyDdPct        = c.dailyDrawdownPercent ?? 0;
  const dailyDdLimit      = c.dailyLossLimitPercent ?? 0;
  const mllBuffer         = c.mllBufferAmount ?? 0;
  const mllAmount         = c.mllAmount ?? 0;
  const maxLossLimitPct   = c.maxLossLimitPercent ?? 0;
  const daysRemaining     = c.daysRemaining ?? 0;
  const resolvedCount     = c.resolvedPositionsCount ?? 0;
  const uniqueEventsCount = c.uniqueEventsCount ?? 0;
  const currentBalance    = c.currentBalance ?? 0;
  const startBalance      = c.startBalance ?? 0;
  const consistencyRatio  = c.consistency ?? 0;

  const hasProfit = currentBalance > startBalance && startBalance > 0;
  const consistencyPctDisplay = consistencyRatio * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Top row — 3 large widgets */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <MetricWidget
          label="Daily P&L"
          value={`${dailyDdPct.toFixed(1)}%`}
          caption={`Daily DD (limit ${dailyDdLimit}%)`}
          zone={dailyDdZone(dailyDdPct, dailyDdLimit)}
          size="large"
        />
        <MetricWidget
          label="MLL buffer"
          value={`$${mllBuffer.toFixed(0)}`}
          caption={`to MLL limit (${maxLossLimitPct}%)`}
          zone={mllBufferZone(mllBuffer, mllAmount)}
          size="large"
        />
        <MetricWidget
          label="Days remaining"
          value={String(daysRemaining)}
          caption="days left of 10"
          zone={daysRemainingZone(daysRemaining)}
          size="large"
        />
      </div>

      {/* Bottom row — 3 smaller widgets */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <MetricWidget
          label="Resolved positions"
          value={`${resolvedCount} / ${RESOLVED_TARGET}`}
          caption="resolved positions"
          zone={resolvedPositionsZone(resolvedCount)}
          size="small"
        />
        <MetricWidget
          label="Unique events"
          value={`${uniqueEventsCount} / ${UNIQUE_EVENTS_TARGET}`}
          caption="unique events"
          zone={uniqueEventsZone(uniqueEventsCount)}
          size="small"
        />
        <MetricWidget
          label="Consistency"
          value={hasProfit ? `${consistencyPctDisplay.toFixed(0)}%` : "—"}
          caption={
            hasProfit
              ? `biggest winning day (limit ${CONSISTENCY_LIMIT_PCT}%)`
              : "no profit yet"
          }
          zone={hasProfit ? consistencyZone(consistencyPctDisplay) : "neutral"}
          size="small"
        />
      </div>
    </div>
  );
}
