"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";

const card: React.CSSProperties = {
  background: "#0d1117",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 12,
  padding: "24px 28px",
  marginBottom: 16,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
};

const METHOD_LABELS: Record<string, string> = {
  usdt_trc20: "USDT (TRC20)",
  usdt_erc20: "USDT (ERC20)",
  usdc_erc20: "USDC (ERC20)",
  usdc_polygon: "USDC (Polygon)",
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  requested: { bg: "rgba(245,158,11,0.12)", fg: "#F59E0B" },
  approved: { bg: "rgba(59,130,246,0.12)", fg: "#3B82F6" },
  processing: { bg: "rgba(168,85,247,0.12)", fg: "#A855F7" },
  completed: { bg: "rgba(34,197,94,0.12)", fg: "#22C55E" },
  failed: { bg: "rgba(239,68,68,0.12)", fg: "#EF4444" },
  cancelled: { bg: "rgba(107,114,128,0.12)", fg: "#9CA3AF" },
};

interface PayoutItem {
  id: number;
  status: string;
  amount: number;
  networkFee: number;
  amountAfterFee: number;
  paymentMethod: string;
  paymentWallet: string;
  network: string;
  requestedAt: string;
  approvedAt: string | null;
  processedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  failureReason: string | null;
  adminNote: string | null;
  transactionHash: string | null;
  conversionsCount: number;
}

interface PayoutsResponse {
  availableBalance: number;
  minPayoutForCurrentMethod: number;
  canRequestPayout: boolean;
  blockingReason: string | null;
  paymentMethod: string | null;
  paymentWallet: string | null;
  walletLockUntil: string | null;
  walletRequiresReview: boolean;
  payouts: PayoutItem[];
}

function blockingMessage(reason: string | null, data: PayoutsResponse | null): string {
  if (!reason) return "";
  switch (reason) {
    case "no_wallet":
      return "Set up your payout wallet in Settings before requesting.";
    case "wallet_locked": {
      const until = data?.walletLockUntil
        ? new Date(data.walletLockUntil).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : "the lock period expires";
      return `Wallet is locked until ${until}.`;
    }
    case "active_payout_exists":
      return "You already have a pending payout request. Wait until it is processed.";
    case "balance_below_min": {
      const min = data?.minPayoutForCurrentMethod ?? 0;
      const bal = data?.availableBalance ?? 0;
      return `Minimum payout is $${min.toFixed(2)}. Current available balance: $${bal.toFixed(2)}.`;
    }
    case "no_approved_conversions":
      return "No approved commissions to pay out yet.";
    default:
      return reason;
  }
}

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `$${n.toFixed(2)}`;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function AffiliatePayoutsPage() {
  const router = useRouter();
  const [data, setData] = useState<PayoutsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<any>("/api/affiliate/payouts");
      if (res.error) {
        setPageError(res.error);
      } else {
        setData(res as PayoutsResponse);
      }
    } catch {
      setPageError("load_failed");
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function handleRequest() {
    if (!data) return;
    const amount = data.availableBalance;
    const confirmed = window.confirm(`You will request a payout of $${amount.toFixed(2)}. Continue?`);
    if (!confirmed) return;

    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await apiFetch<any>("/api/affiliate/payouts", {
        method: "POST",
        body: JSON.stringify({}),
      });

      if (res.error) {
        const msg = blockingMessage(res.error, data) || res.error;
        setActionError(msg);
      } else if (res.ok) {
        setActionSuccess("Payout request submitted.");
        await load();
      }
    } catch {
      setActionError("Failed to submit payout request.");
    }

    setSubmitting(false);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#080c14", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>
        Loading...
      </div>
    );
  }

  if (pageError) {
    const msg =
      pageError === "not_an_affiliate" ? "You are not an affiliate." :
      pageError === "affiliate_not_approved" ? "Your affiliate account is not approved." :
      "Failed to load payouts data.";
    return (
      <div style={{ minHeight: "100vh", background: "#080c14", display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontSize: 14 }}>
        {msg}
      </div>
    );
  }

  if (!data) return null;

  const blockMsg = blockingMessage(data.blockingReason, data);
  const canRequest = data.canRequestPayout && !submitting;
  const buttonLabel = submitting ? "Submitting..." : (data.canRequestPayout ? `Request payout of ${fmtUsd(data.availableBalance)}` : "Cannot request payout");

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#F1F5F9", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "80px 24px 60px" }}>

        <div style={{ marginBottom: 40 }}>
          <a href="/dashboard" style={{ fontSize: 13, color: "#22C55E", textDecoration: "none" }}>← Dashboard</a>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", marginTop: 16, marginBottom: 4 }}>Affiliate Program</h1>
        </div>

        <div style={{ display: "flex", gap: 24, marginBottom: 28 }}>
          <a href="/affiliate" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Overview</a>
          <a href="/affiliate/conversions" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Conversions</a>
          <a href="/affiliate/ledger" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Ledger</a>
          <a href="/affiliate/settings" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Settings</a>
          <a href="/affiliate/payouts" style={{ fontSize: 13, fontWeight: 700, color: "#22C55E", textDecoration: "none" }}>Payouts</a>
        </div>

        {/* DASHBOARD SUMMARY */}
        <div style={card}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Payout dashboard</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 8 }}>
            <div>
              <div style={labelStyle}>Available balance</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#F1F5F9" }}>{fmtUsd(data.availableBalance)}</div>
            </div>
            <div>
              <div style={labelStyle}>Minimum payout</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#F1F5F9" }}>{fmtUsd(data.minPayoutForCurrentMethod)}</div>
            </div>
            <div>
              <div style={labelStyle}>Method</div>
              <div style={{ fontSize: 14, color: "#F1F5F9", marginTop: 4 }}>
                {data.paymentMethod ? (METHOD_LABELS[data.paymentMethod] ?? data.paymentMethod) : "Not set"}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Wallet</div>
              <div style={{ fontSize: 13, color: "#94A3B8", fontFamily: "monospace", marginTop: 4 }}>
                {data.paymentWallet ?? "Not set"}
              </div>
            </div>
          </div>

          {data.walletRequiresReview && (
            <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, fontSize: 13, color: "#F59E0B" }}>
              Your wallet change is pending review.
            </div>
          )}
        </div>

        {/* ACTION BLOCK */}
        <div style={card}>
          {blockMsg && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, fontSize: 13, color: "#F59E0B" }}>
              {blockMsg}
            </div>
          )}

          {actionError && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: 13, color: "#EF4444" }}>
              {actionError}
            </div>
          )}

          {actionSuccess && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, fontSize: 13, color: "#22C55E" }}>
              {actionSuccess}
            </div>
          )}

          <button
            onClick={handleRequest}
            disabled={!canRequest}
            style={{
              padding: "12px 24px",
              borderRadius: 8,
              border: "none",
              background: canRequest ? "#22C55E" : "#1E293B",
              color: canRequest ? "#071A0E" : "#475569",
              fontWeight: 700,
              fontSize: 13,
              cursor: canRequest ? "pointer" : "not-allowed",
            }}
          >
            {buttonLabel}
          </button>
        </div>

        {/* HISTORY */}
        <div style={card}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Payout history</div>

          {data.payouts.length === 0 ? (
            <div style={{ fontSize: 13, color: "#475569" }}>No payout requests yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {data.payouts.map((p) => {
                const sc = STATUS_COLORS[p.status] ?? { bg: "rgba(107,114,128,0.12)", fg: "#9CA3AF" };
                return (
                  <div key={p.id} style={{ background: "#080c14", border: "1px solid #1E293B", borderRadius: 8, padding: "14px 16px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: sc.bg, color: sc.fg, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {p.status}
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{fmtUsd(p.amount)}</span>
                      <span style={{ fontSize: 12, color: "#475569" }}>
                        {METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod} · {p.network}
                      </span>
                      <span style={{ fontSize: 12, color: "#475569", fontFamily: "monospace" }}>{p.paymentWallet}</span>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12, color: "#94A3B8" }}>
                      <span>Requested: {fmtDate(p.requestedAt)}</span>
                      {p.approvedAt && <span>Approved: {fmtDate(p.approvedAt)}</span>}
                      {p.completedAt && <span>Completed: {fmtDate(p.completedAt)}</span>}
                      {p.failedAt && <span>Failed: {fmtDate(p.failedAt)}</span>}
                      {p.cancelledAt && <span>Cancelled: {fmtDate(p.cancelledAt)}</span>}
                      {p.networkFee > 0 && <span>Fee: {fmtUsd(p.networkFee)} → {fmtUsd(p.amountAfterFee)}</span>}
                      <span>Conversions: {p.conversionsCount}</span>
                    </div>

                    {p.transactionHash && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#475569", fontFamily: "monospace", wordBreak: "break-all" }}>
                        TX: {p.transactionHash}
                      </div>
                    )}

                    {p.failureReason && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#EF4444" }}>
                        Reason: {p.failureReason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
