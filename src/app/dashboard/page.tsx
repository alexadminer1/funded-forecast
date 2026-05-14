"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { User, Position } from "@/lib/types";

interface Challenge {
  id: number;
  stage: string;
  status: string;
  startBalance: number;
  realizedBalance: number;
  peakBalance: number;
  profitTargetPct: number;
  maxTotalDdPct: number;
  minTradingDays: number;
  tradingDaysCount: number;
  qualifyingTradingDaysCount: number;
  todayBuyVolume: number;
  minDailyVolumeUsd: number;
  profitTargetMet: boolean;
  drawdownViolated: boolean;
}

interface LastChallenge {
  id: number;
  status: "passed" | "failed";
  violationReason: string | null;
  profitTargetMet: boolean;
  endedAt: string | null;
}

interface ModeData {
  mode: "sandbox" | "challenge";
  currentBalance: number;
  challenge: Challenge | null;
  lastChallenge: LastChallenge | null;
  sandboxBalance: number | null;
  sandboxPositionsCount: number | null;
}

type PastChallenge = {
  id: number;
  planName: string | null;
  status: "passed" | "failed" | "expired";
  startedAt: string;
  endedAt: string | null;
  startBalance: number;
  finalBalance: number;
  pnl: number;
  profitTargetPct: number;
  profitTargetProgress: number;
  maxTotalDdPct: number;
  drawdownUsed: number;
  tradingDaysCount: number;
  minTradingDays: number;
  profitTargetMet: boolean;
  drawdownViolated: boolean;
  violationReason: string | null;
  positionsCount: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [modeData, setModeData] = useState<ModeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pastChallenges, setPastChallenges] = useState<PastChallenge[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<PastChallenge | null>(null);

  const loadData = useCallback(() => {
    if (!getToken()) { router.push("/login"); return; }
    Promise.all([
      apiFetch<{ success: boolean; user: User }>("/api/user/me"),
      apiFetch<{ success: boolean; positions: Position[] }>("/api/user/positions"),
      apiFetch<ModeData & { success: boolean }>("/api/user/mode"),
      apiFetch<{ success: boolean; challenges: PastChallenge[] }>("/api/user/challenges")
        .catch(() => null),
    ]).then(([userData, posData, mode, challengesData]) => {
      if (userData.success) setUser(userData.user);
      if (posData.success) setPositions(posData.positions);
      if (mode.success) setModeData({
        mode:                  mode.mode,
        currentBalance:        mode.currentBalance,
        challenge:             mode.challenge,
        lastChallenge:         mode.lastChallenge,
        sandboxBalance:        mode.sandboxBalance ?? null,
        sandboxPositionsCount: mode.sandboxPositionsCount ?? null,
      });
      if (challengesData?.success) setPastChallenges(challengesData.challenges);
    }).finally(() => setLoading(false));
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
      Loading...
    </div>
  );
  if (!user) return null;

  const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);

  const activeBalance = modeData?.mode === "challenge" && modeData.challenge
    ? modeData.challenge.realizedBalance
    : user.balance;

  const portfolioValue = activeBalance + positions.reduce((s, p) => s + p.currentValue, 0);

  const stats = [
    { label: "Available Balance", value: `$${activeBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "#22C55E", sub: modeData?.mode === "challenge" ? "challenge balance" : "paper capital" },
    { label: "Open Positions", value: String(user.openPositionsCount), color: "#3B82F6", sub: "active trades" },
    { label: "Unrealized PnL", value: `${totalUnrealized >= 0 ? "+" : ""}$${totalUnrealized.toFixed(2)}`, color: totalUnrealized >= 0 ? "#22C55E" : "#EF4444", sub: "open positions" },
    { label: "Portfolio Value", value: `$${portfolioValue.toFixed(2)}`, color: "#F59E0B", sub: "balance + positions" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      {selectedChallenge && (
        <ChallengeDetailModal
          challenge={selectedChallenge}
          onClose={() => setSelectedChallenge(null)}
        />
      )}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px", animation: "fadeIn 0.3s ease" }}>

        {/* Page header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4, color: "var(--text-primary)" }}>
              Welcome back, {user.firstName}
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
              @{user.username} · {user.activeChallenge?.plan?.name ? `${user.activeChallenge.plan.name} Member` : "Free Plan"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href="/account" style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8", padding: "7px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", textDecoration: "none" }}>My Account</a>
            <a href="/markets" style={{ fontSize: 13, fontWeight: 700, background: "#22C55E", color: "#071A0E", padding: "8px 18px", borderRadius: 8, textDecoration: "none" }}>Trade →</a>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 32 }}>
          {stats.map(({ label, value, color, sub }) => (
            <div key={label} style={{
              background: "linear-gradient(160deg, var(--bg-surface) 0%, var(--bg-page) 100%)",
              borderRadius: "var(--radius-card)",
              padding: "20px 22px",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.03)",
            }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: "-0.03em", marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Challenge block */}
        {modeData && (
          <div style={{ marginBottom: 36 }}>
            {modeData.mode === "sandbox" ? (
              modeData.lastChallenge ? (
                <PostChallengeBanner last={modeData.lastChallenge} />
              ) : (
                <SandboxBanner />
              )
            ) : modeData.challenge ? (
              <ChallengeCard challenge={modeData.challenge} />
            ) : null}
          </div>
        )}

        {/* Past Challenges */}
        {pastChallenges.length > 0 && (
          <PastChallengesSection
            challenges={pastChallenges}
            onSelect={(c) => setSelectedChallenge(c)}
          />
        )}

        {/* Sandbox secondary — shown only during active challenge */}
        {modeData?.mode === "challenge" && modeData.sandboxBalance !== null && (
          <SandboxSecondaryCard
            balance={modeData.sandboxBalance}
            positionsCount={modeData.sandboxPositionsCount ?? 0}
          />
        )}

        {/* Positions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>Open Positions</h2>
          <a href="/markets" style={{ fontSize: 13, color: "#22C55E", textDecoration: "none" }}>Browse markets →</a>
        </div>

        {positions.length === 0 ? (
          <div style={{
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-card)",
            padding: 48,
            textAlign: "center",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
            fontSize: 14,
          }}>
            No open positions yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {positions.map((p) => <PositionRow key={p.id} position={p} />)}
          </div>
        )}
      </main>
    </div>
  );
}

function ChallengeCard({ challenge: c }: { challenge: Challenge }) {
  const target = parseFloat((c.startBalance * (1 + c.profitTargetPct / 100)).toFixed(2));
  const progress = Math.max(0, Math.min(100,
    parseFloat((((c.realizedBalance - c.startBalance) / (target - c.startBalance)) * 100).toFixed(1))
  ));
  const violated = c.drawdownViolated;

  return (
    <div style={{
      background: "#1E293B",
      border: "1px solid #334155",
      borderRadius: 12,
      padding: 24,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: violated ? "#EF4444" : "#22C55E", boxShadow: violated ? "0 0 8px rgba(239,68,68,0.6)" : "0 0 8px rgba(34,197,94,0.6)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
            Evaluation Challenge
          </span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
          color: violated ? "#EF4444" : "#22C55E",
          background: violated ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
          border: `1px solid ${violated ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)"}`,
          borderRadius: 4, padding: "3px 9px",
        }}>
          {violated ? "VIOLATED" : "ACTIVE"}
        </span>
      </div>

      {/* Metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Current Balance", value: `$${c.realizedBalance.toFixed(2)}` },
          { label: "Target", value: `$${target.toFixed(2)}` },
          { label: "Max Drawdown", value: `${c.maxTotalDdPct}%` },
          { label: "Trading Days", value: `${c.tradingDaysCount} / ${c.minTradingDays}` },
          { label: "Qualifying Days", value: `${c.qualifyingTradingDaysCount ?? 0} / ${c.minTradingDays}` },
          {
            label: "Daily Volume",
            value: `$${(c.todayBuyVolume ?? 0).toFixed(2)} / $${(c.minDailyVolumeUsd ?? 0).toFixed(2)}`,
          },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Profit progress */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
          <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>Profit progress</span>
          <span style={{ fontSize: 11, color: progress >= 100 ? "#22C55E" : "#94A3B8", fontWeight: 700 }}>{progress.toFixed(1)}% of {c.profitTargetPct}% target</span>
        </div>
        <div style={{ height: 8, background: "#334155", borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${Math.min(100, progress)}%`,
            background: progress >= 100 ? "#22C55E" : "linear-gradient(90deg, #16A34A, #22C55E)",
            borderRadius: 4, transition: "width 0.4s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
          <span style={{ fontSize: 10, color: "#334155" }}>${c.startBalance.toLocaleString()}</span>
          <span style={{ fontSize: 10, color: "#334155" }}>${target.toLocaleString()}</span>
        </div>
      </div>

      {/* Drawdown meter */}
      {(() => {
        const maxLoss = c.startBalance * (c.maxTotalDdPct / 100);
        const currentLoss = Math.max(0, c.startBalance - c.realizedBalance);
        const ddUsed = Math.min(100, (currentLoss / maxLoss) * 100);
        const ddColor = ddUsed >= 80 ? "#EF4444" : ddUsed >= 50 ? "#F59E0B" : "#22C55E";
        return (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>Drawdown used</span>
              <span style={{ fontSize: 11, color: ddColor, fontWeight: 700 }}>{ddUsed.toFixed(1)}% of {c.maxTotalDdPct}% limit</span>
            </div>
            <div style={{ height: 8, background: "#334155", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${ddUsed}%`,
                background: ddUsed >= 80 ? "#EF4444" : ddUsed >= 50 ? "#F59E0B" : "#22C55E",
                borderRadius: 4, transition: "width 0.4s ease",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
              <span style={{ fontSize: 10, color: "#334155" }}>$0 lost</span>
              <span style={{ fontSize: 10, color: "#334155" }}>max -${maxLoss.toFixed(0)}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function PositionRow({ position: p }: { position: Position }) {
  const pnlColor = p.unrealizedPnl >= 0 ? "#22C55E" : "#EF4444";
  return (
    <a href={`/markets/${p.marketId}`} style={{ textDecoration: "none" }}>
      <div style={{
        background: "linear-gradient(160deg, var(--bg-surface) 0%, var(--bg-page) 100%)",
        borderRadius: 12,
        padding: "15px 20px",
        border: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        boxShadow: "var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.02)",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
        onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(34,197,94,0.3)"; el.style.boxShadow = "var(--shadow-hover)"; }}
        onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--border)"; el.style.boxShadow = "var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.02)"; }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.marketTitle}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{p.marketCategory}</div>
        </div>

        {[
          { label: "Side", value: p.side.toUpperCase(), color: p.side === "yes" ? "#22C55E" : "#EF4444", pill: true },
          { label: "Shares", value: String(p.shares) },
          { label: "Avg", value: `${(p.avgPrice * 100).toFixed(0)}¢` },
          { label: "Current", value: `${(p.currentPrice * 100).toFixed(0)}¢` },
          { label: "Value", value: `$${p.currentValue.toFixed(2)}` },
        ].map(({ label, value, color, pill }) => (
          <div key={label} style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</div>
            {pill ? (
              <div style={{ fontSize: 11, fontWeight: 700, color, background: p.side === "yes" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", padding: "2px 8px", borderRadius: 4 }}>{value}</div>
            ) : (
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{value}</div>
            )}
          </div>
        ))}

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Unrealized</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: pnlColor, letterSpacing: "-0.02em" }}>
            {p.unrealizedPnl >= 0 ? "+" : ""}${p.unrealizedPnl.toFixed(2)}
          </div>
        </div>
      </div>
    </a>
  );
}

function SandboxBanner() {
  return (
    <div style={{
      background:     "#1E293B",
      border:         "1px solid #334155",
      borderRadius:   12,
      padding:        24,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "space-between",
      gap:            20,
    }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          Sandbox Mode
        </div>
        <div style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.5 }}>
          You&apos;re trading in sandbox. Start an evaluation to earn real payouts.
        </div>
      </div>
      <a
        href="/account/plans"
        style={{
          flexShrink:     0,
          background:     "#22C55E",
          color:          "#071A0E",
          borderRadius:   9,
          padding:        "10px 22px",
          fontSize:       13,
          fontWeight:     700,
          letterSpacing:  "-0.01em",
          textDecoration: "none",
        }}
      >
        Get Funded →
      </a>
    </div>
  );
}

type LastChallengeBannerProps = {
  last: {
    status:          "passed" | "failed";
    violationReason: string | null;
    profitTargetMet: boolean;
  };
};

function PostChallengeBanner({ last }: LastChallengeBannerProps) {
  const isPassed  = last.status === "passed";
  const isExpired = last.status === "failed" && last.violationReason === "Challenge period expired";

  let title: string;
  let body:  string;
  let ctaLabel: string;
  let ctaHref:  string;
  let accent:   string;
  let bg:       string;
  let border:   string;
  let label:    string;

  if (isPassed) {
    title    = "Challenge passed";
    body     = "You passed the challenge. You can now request a payout.";
    ctaLabel = "Request payout →";
    ctaHref  = "/account";
    accent   = "#22C55E";
    bg       = "rgba(34,197,94,0.06)";
    border   = "rgba(34,197,94,0.25)";
    label    = "PASSED";
  } else if (isExpired) {
    title    = "Challenge expired";
    body     = "Your challenge period has ended. Buy a new plan to start a new evaluation.";
    ctaLabel = "Buy new challenge →";
    ctaHref  = "/account/plans";
    accent   = "#F59E0B";
    bg       = "rgba(245,158,11,0.06)";
    border   = "rgba(245,158,11,0.25)";
    label    = "EXPIRED";
  } else {
    title    = "Challenge failed";
    body     = last.violationReason ?? "You did not meet the challenge requirements.";
    ctaLabel = "Buy new challenge →";
    ctaHref  = "/account/plans";
    accent   = "#EF4444";
    bg       = "rgba(239,68,68,0.06)";
    border   = "rgba(239,68,68,0.25)";
    label    = "FAILED";
  }

  return (
    <div style={{
      background:     bg,
      border:         `1px solid ${border}`,
      borderRadius:   12,
      padding:        24,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "space-between",
      gap:            20,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          {label}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9", marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.5 }}>
          {body}
        </div>
      </div>
      <a
        href={ctaHref}
        style={{
          flexShrink:     0,
          background:     accent,
          color:          "#071A0E",
          borderRadius:   9,
          padding:        "10px 22px",
          fontSize:       13,
          fontWeight:     700,
          letterSpacing:  "-0.01em",
          textDecoration: "none",
        }}
      >
        {ctaLabel}
      </a>
    </div>
  );
}

/* ── Past Challenges ───────────────────────────────────────────────── */

function PastChallengesSection({
  challenges,
  onSelect,
}: {
  challenges: PastChallenge[];
  onSelect: (c: PastChallenge) => void;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: 0 }}>
          Past Challenges
        </h2>
        <span style={{
          fontSize: 11, fontWeight: 700, color: "#64748B",
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20, padding: "2px 8px",
        }}>{challenges.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {challenges.map((c) => (
          <PastChallengeRow key={c.id} challenge={c} onClick={() => onSelect(c)} />
        ))}
      </div>
    </div>
  );
}

function PastChallengeRow({ challenge: c, onClick }: { challenge: PastChallenge; onClick: () => void }) {
  const cfg = {
    passed:  { color: "#22C55E", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.2)",   label: "PASSED"  },
    failed:  { color: "#EF4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.2)",   label: "FAILED"  },
    expired: { color: "#64748B", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.2)", label: "EXPIRED" },
  }[c.status];

  const dateStr = new Date(c.endedAt ?? c.startedAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  const subtext = c.status === "passed" ? "Profit target reached"
    : c.status === "expired" ? "Time expired"
    : (c.violationReason ?? "Challenge failed");
  const pnlColor = c.pnl >= 0 ? "#22C55E" : "#EF4444";
  const pnlStr = `${c.pnl >= 0 ? "+" : "−"}$${Math.abs(c.pnl).toFixed(2)}`;

  return (
    <div
      onClick={onClick}
      style={{
        background: "linear-gradient(160deg, var(--bg-surface) 0%, var(--bg-page) 100%)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "13px 16px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 14,
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
    >
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
        color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
        borderRadius: 4, padding: "3px 7px", flexShrink: 0,
      }}>{cfg.label}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
          {c.planName ?? "Challenge"} · {dateStr}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {subtext}
        </div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
          ${c.finalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: pnlColor }}>{pnlStr}</div>
      </div>

      <div style={{ color: "#334155", fontSize: 16, flexShrink: 0, lineHeight: 1 }}>›</div>
    </div>
  );
}

/* ── Sandbox Secondary ─────────────────────────────────────────────── */

function SandboxSecondaryCard({ balance, positionsCount }: { balance: number; positionsCount: number }) {
  return (
    <div style={{
      background: "rgba(15,23,42,0.6)",
      border: "1px solid rgba(255,255,255,0.05)",
      borderRadius: 12,
      padding: "16px 20px",
      marginBottom: 32,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Sandbox
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: "#334155",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 4, padding: "1px 6px",
          }}>PAUSED</span>
        </div>
        <div style={{ fontSize: 11, color: "#334155", marginBottom: 12 }}>Paused during active challenge</div>
        <div style={{ display: "flex", gap: 24 }}>
          <div>
            <div style={{ fontSize: 10, color: "#334155", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Balance</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>
              ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#334155", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Positions</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>{positionsCount}</div>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#1E293B", maxWidth: 220, textAlign: "right", lineHeight: 1.6 }}>
        Your sandbox balance and history are preserved. Trading resumes after this challenge ends.
      </div>
    </div>
  );
}

/* ── Challenge Detail Modal ────────────────────────────────────────── */

function ChallengeDetailModal({
  challenge: c,
  onClose,
}: {
  challenge: PastChallenge;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const cfg = {
    passed:  { color: "#22C55E", label: "PASSED"  },
    failed:  { color: "#EF4444", label: "FAILED"  },
    expired: { color: "#64748B", label: "EXPIRED" },
  }[c.status];

  const fmt = (d: string | null) => d
    ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

  const pnlPct = c.startBalance > 0 ? ((c.pnl / c.startBalance) * 100).toFixed(2) : "0.00";
  const pnlColor = c.pnl >= 0 ? "#22C55E" : "#EF4444";
  const pnlLabel = `${c.pnl >= 0 ? "+" : "−"}$${Math.abs(c.pnl).toFixed(2)} (${c.pnl >= 0 ? "+" : ""}${pnlPct}%)`;

  const rows: Array<{ label: string; value: string; color?: string }> = [
    { label: "Started",          value: fmt(c.startedAt) },
    { label: "Ended",            value: fmt(c.endedAt) },
    { label: "Starting balance", value: `$${c.startBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
    { label: "Final balance",    value: `$${c.finalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
    { label: "P&L",              value: pnlLabel, color: pnlColor },
    { label: "Profit target",    value: `${c.profitTargetPct}% ($${(c.startBalance * c.profitTargetPct / 100).toFixed(0)})` },
    { label: "Target progress",  value: `${c.profitTargetProgress}% of ${c.profitTargetPct}%` },
    { label: "Max drawdown",     value: `${c.maxTotalDdPct}% ($${(c.startBalance * c.maxTotalDdPct / 100).toFixed(0)})` },
    { label: "Drawdown used",    value: `${c.drawdownUsed}% of ${c.maxTotalDdPct}%` },
    { label: "Trading days",     value: `${c.tradingDaysCount} / ${c.minTradingDays}` },
    { label: "Positions",        value: String(c.positionsCount) },
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 200, padding: "0 20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1E293B",
          border: "1px solid #334155",
          borderRadius: 14,
          padding: "24px 28px",
          maxWidth: 480,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              {c.planName ?? "Challenge"} Challenge
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
              color: cfg.color,
              background: `${cfg.color}1a`,
              border: `1px solid ${cfg.color}40`,
              borderRadius: 4, padding: "3px 8px",
            }}>{cfg.label}</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "none",
              color: "#475569", cursor: "pointer",
              fontSize: 20, lineHeight: 1, padding: "0 2px",
            }}
          >✕</button>
        </div>

        {/* Stats */}
        <div>
          {rows.map(({ label, value, color }) => (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}>
              <span style={{ fontSize: 12, color: "#64748B" }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: color ?? "var(--text-primary)" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Violation reason */}
        {c.violationReason && (
          <div style={{
            marginTop: 16,
            background: "rgba(239,68,68,0.07)",
            border: "1px solid rgba(239,68,68,0.15)",
            borderRadius: 8, padding: "10px 14px",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#EF4444", letterSpacing: "0.07em", marginBottom: 4 }}>
              VIOLATION REASON
            </div>
            <div style={{ fontSize: 12, color: "#FCA5A5", lineHeight: 1.5 }}>{c.violationReason}</div>
          </div>
        )}
      </div>
    </div>
  );
}
