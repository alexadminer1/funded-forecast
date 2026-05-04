"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { maskWallet } from "@/lib/affiliate/wallet";

const STORAGE_KEY  = "adminKey";
const ATTEMPTS_KEY = "adminAttempts";
const BLOCKED_KEY  = "adminBlockedUntil";
const MAX_ATTEMPTS = 3;
const BLOCK_MS     = 5 * 60 * 1000;

type TabKey = "overview" | "conversions" | "ledger" | "referred" | "audit" | "payouts";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview",    label: "Overview"       },
  { key: "conversions", label: "Conversions"    },
  { key: "ledger",      label: "Ledger"         },
  { key: "referred",    label: "Referred Users" },
  { key: "audit",       label: "Audit Log"      },
  { key: "payouts",     label: "Payouts"        },
];

const STATUS_COLORS: Record<string, string> = {
  pending:   "#F59E0B",
  approved:  "#22C55E",
  rejected:  "#EF4444",
  suspended: "#F97316",
  banned:    "#DC2626",
};

function fmt(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d as string).toLocaleString();
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d as string).toLocaleDateString();
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
      background: `${color}18`, color, whiteSpace: "nowrap",
    }}>{label.toUpperCase()}</span>
  );
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

export default function AdminAffiliateDetailPage() {
  const [authed,     setAuthed]     = useState(false);
  const [keyInput,   setKeyInput]   = useState("");
  const [loginError, setLoginError] = useState("");
  const [blocked,    setBlocked]    = useState(false);
  const [blockLeft,  setBlockLeft]  = useState(0);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY)) setAuthed(true);
    const until = parseInt(sessionStorage.getItem(BLOCKED_KEY) ?? "0");
    if (until > Date.now()) {
      setBlocked(true);
      const tick = setInterval(() => {
        const left = Math.ceil((until - Date.now()) / 1000);
        if (left <= 0) { setBlocked(false); clearInterval(tick); } else setBlockLeft(left);
      }, 1000);
      return () => clearInterval(tick);
    }
  }, []);

  function handleLogin() {
    if (blocked || keyInput.length < 6) { setLoginError("Invalid key."); return; }
    sessionStorage.setItem(STORAGE_KEY, keyInput);
    setAuthed(true);
    setLoginError("");
  }

  function handleBlock() {
    const newA = parseInt(sessionStorage.getItem(ATTEMPTS_KEY) ?? "0") + 1;
    sessionStorage.setItem(ATTEMPTS_KEY, String(newA));
    if (newA >= MAX_ATTEMPTS) {
      const until = Date.now() + BLOCK_MS;
      sessionStorage.setItem(BLOCKED_KEY, String(until));
      setBlocked(true); setBlockLeft(Math.ceil(BLOCK_MS / 1000));
      setLoginError("Too many attempts. Blocked for 5 minutes.");
    } else {
      setLoginError(`Invalid key. ${MAX_ATTEMPTS - newA} attempts left.`);
    }
    sessionStorage.removeItem(STORAGE_KEY);
    setAuthed(false);
  }

  function handleLogout() {
    sessionStorage.removeItem(STORAGE_KEY);
    setAuthed(false);
    setKeyInput("");
  }

  if (!authed) return (
    <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "36px 32px", width: 360 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9", marginBottom: 6 }}>Admin Panel</div>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 24 }}>Enter admin key to continue</div>
        <input
          type="password" placeholder="Admin key" value={keyInput}
          onChange={e => setKeyInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          disabled={blocked}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 8, boxSizing: "border-box", border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 14, outline: "none", marginBottom: 10 }}
        />
        {loginError && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 10 }}>{loginError}</div>}
        {blocked    && <div style={{ color: "#F59E0B", fontSize: 12, marginBottom: 10 }}>Blocked. Try again in {blockLeft}s</div>}
        <button onClick={handleLogin} disabled={blocked}
          style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: blocked ? "#334155" : "#22C55E", color: blocked ? "#64748B" : "#071A0E", fontWeight: 700, fontSize: 14, cursor: blocked ? "not-allowed" : "pointer" }}
        >Sign In</button>
      </div>
    </div>
  );

  return <AffiliateDetail onInvalidKey={handleBlock} onLogout={handleLogout} />;
}

// ─── Detail component ─────────────────────────────────────────────────────────

function getModalConfig(kind: string | null, affiliate: any) {
  switch (kind) {
    case "suspend":         return { title: "Suspend affiliate",           warning: "Affiliate will not earn new commissions until unsuspended." };
    case "unsuspend":       return { title: "Unsuspend affiliate",         warning: "Affiliate will resume earning commissions." };
    case "ban":             return { title: "Ban affiliate",               warning: "Permanent action. Affiliate cannot earn future commissions. Existing balance is NOT forfeited automatically." };
    case "forfeit_pending": return { title: "Forfeit pending balance",     warning: `Will forfeit ${fmtUsd(affiliate?.balancePending ?? 0)} from pending balance. Available balance is preserved. This action is logged and reflected in ledger.` };
    case "forfeit_full":    return { title: "Forfeit pending + available", warning: `Will forfeit ${fmtUsd(affiliate?.balancePending ?? 0)} pending + ${fmtUsd(affiliate?.balanceAvailable ?? 0)} available = ${fmtUsd((affiliate?.balancePending ?? 0) + (affiliate?.balanceAvailable ?? 0))} total. Paid balance is preserved. This action is logged.` };
    default:                return { title: "", warning: "" };
  }
}

function AffiliateDetail({ onInvalidKey, onLogout }: { onInvalidKey: () => void; onLogout: () => void }) {
  const { id } = useParams<{ id: string }>();
  const [data,      setData]      = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [activeTab,    setActiveTab]    = useState<TabKey>("overview");
  const [modalOpen,    setModalOpen]    = useState<"suspend" | "unsuspend" | "ban" | "forfeit_pending" | "forfeit_full" | null>(null);
  const [modalLabel,   setModalLabel]   = useState("");
  const [modalReason,  setModalReason]  = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError,   setModalError]   = useState<string | null>(null);
  const [successMsg,   setSuccessMsg]   = useState<string | null>(null);

  // Payouts tab state (lazy load)
  const [payoutsData,    setPayoutsData]    = useState<any[] | null>(null);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsError,   setPayoutsError]   = useState<string | null>(null);

  // Payout action modal state
  const [payoutModalAction, setPayoutModalAction] = useState<"approve" | "reject" | "complete" | "fail" | null>(null);
  const [payoutModalRow,    setPayoutModalRow]    = useState<any | null>(null);
  const [payoutModalLabel,  setPayoutModalLabel]  = useState("");
  const [payoutModalReason, setPayoutModalReason] = useState("");
  const [payoutModalTxHash, setPayoutModalTxHash] = useState("");
  const [payoutModalNote,   setPayoutModalNote]   = useState("");
  const [payoutModalLoading, setPayoutModalLoading] = useState(false);
  const [payoutModalError,   setPayoutModalError]   = useState<string | null>(null);

  const apiFetch = useCallback(async function<T = any>(url: string, opts: RequestInit = {}): Promise<T> {
    const key = sessionStorage.getItem(STORAGE_KEY) ?? "";
    const res = await fetch(url, {
      ...opts,
      headers: { "x-admin-key": key, "Content-Type": "application/json", ...opts.headers },
    });
    if (res.status === 401 || res.status === 403) { onInvalidKey(); throw new Error("Forbidden"); }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }, [onInvalidKey]);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    apiFetch(`/api/admin/affiliate/${id}`)
      .then(d => { setData(d); setError(null); })
      .catch(e => { if (e.message !== "Forbidden") setError(e.message); })
      .finally(() => setLoading(false));
  }, [id, apiFetch]);

  useEffect(() => { load(); }, [load]);

  const loadPayouts = useCallback(async () => {
    if (!id) return;
    setPayoutsLoading(true);
    setPayoutsError(null);
    try {
      const res = await apiFetch<{ items: any[] }>(`/api/admin/affiliate/payouts?affiliateId=${id}&limit=100`);
      setPayoutsData(res.items ?? []);
    } catch (e: any) {
      if (e?.message !== "Forbidden") {
        setPayoutsError(String(e?.message ?? e));
      }
    } finally {
      setPayoutsLoading(false);
    }
  }, [id, apiFetch]);

  useEffect(() => {
    if (activeTab === "payouts" && payoutsData === null && !payoutsLoading) {
      loadPayouts();
    }
  }, [activeTab, payoutsData, payoutsLoading, loadPayouts]);

  function openPayoutModal(action: "approve" | "reject" | "complete" | "fail", row: any) {
    setPayoutModalAction(action);
    setPayoutModalRow(row);
    setPayoutModalLabel("");
    setPayoutModalReason("");
    setPayoutModalTxHash("");
    setPayoutModalNote("");
    setPayoutModalError(null);
  }

  function closePayoutModal() {
    setPayoutModalAction(null);
    setPayoutModalRow(null);
    setPayoutModalLabel("");
    setPayoutModalReason("");
    setPayoutModalTxHash("");
    setPayoutModalNote("");
    setPayoutModalError(null);
    setPayoutModalLoading(false);
  }

  async function handlePayoutConfirm() {
    if (!payoutModalAction || !payoutModalRow) return;
    setPayoutModalError(null);

    const label = payoutModalLabel.trim();
    const reason = payoutModalReason.trim();
    const txHash = payoutModalTxHash.trim();
    const note = payoutModalNote.trim();

    if (!label) { setPayoutModalError("adminLabel required"); return; }
    if ((payoutModalAction === "reject" || payoutModalAction === "fail") && !reason) {
      setPayoutModalError("reason required");
      return;
    }

    setPayoutModalLoading(true);
    const body: any = { adminLabel: label };
    if (reason) body.reason = reason;
    if (payoutModalAction === "complete") {
      if (txHash) body.transactionHash = txHash;
      if (note) body.adminNote = note;
    }

    try {
      const res = await apiFetch<any>(`/api/admin/affiliate/payouts/${payoutModalRow.id}/${payoutModalAction}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res?.error) {
        setPayoutModalError(res.message || res.error);
        setPayoutModalLoading(false);
        return;
      }
      setSuccessMsg(`Payout ${payoutModalAction}d.`);
      setTimeout(() => setSuccessMsg(null), 2500);
      closePayoutModal();
      // Refetch payouts only
      setPayoutsData(null);
    } catch (e: any) {
      setPayoutModalError(String(e?.message ?? "Request failed"));
      setPayoutModalLoading(false);
    }
  }

  async function handleAction() {
    if (!modalOpen || !modalLabel.trim() || !modalReason.trim()) { setModalError("Admin label and reason are required."); return; }
    setModalLoading(true);
    setModalError(null);
    try {
      const endpoint = (modalOpen === "forfeit_pending" || modalOpen === "forfeit_full") ? "forfeit" : modalOpen;
      const body: Record<string, string> = { adminLabel: modalLabel.trim(), reason: modalReason.trim() };
      if (modalOpen === "forfeit_pending") body.scope = "pending_only";
      if (modalOpen === "forfeit_full")    body.scope = "pending_and_available";
      const res = await fetch(`/api/admin/affiliate/${id}/${endpoint}`, {
        method: "POST",
        headers: { "x-admin-key": sessionStorage.getItem(STORAGE_KEY) ?? "", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401 || res.status === 403) { onInvalidKey(); return; }
      const json = await res.json();
      if (!res.ok) { setModalError(json.message ?? json.error ?? `Error ${res.status}`); return; }
      setModalOpen(null); setModalLabel(""); setModalReason("");
      setSuccessMsg("Action completed."); setTimeout(() => setSuccessMsg(null), 4000);
      load();
    } catch { setModalError("Network error"); } finally { setModalLoading(false); }
  }

  const cell: React.CSSProperties = { fontSize: 13, padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.04)", color: "#94A3B8", whiteSpace: "nowrap" };
  const th: React.CSSProperties   = { fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", padding: "10px 14px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap", borderBottom: "1px solid #334155" };

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", fontFamily: "'Inter',-apple-system,sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#1E293B", borderBottom: "1px solid #334155", padding: "0 24px", display: "flex", alignItems: "center", height: 52 }}>
        <a href="/admin" style={{ fontSize: 14, fontWeight: 700, color: "#22C55E", marginRight: 8, textDecoration: "none" }}>Admin</a>
        <span style={{ fontSize: 14, color: "#475569", marginRight: 8 }}>·</span>
        <a href="/admin/affiliate" style={{ fontSize: 14, color: "#94A3B8", textDecoration: "none", marginRight: "auto" }}>Affiliates</a>
        <button onClick={onLogout} style={{ padding: "6px 16px", borderRadius: 7, border: "1px solid #334155", background: "transparent", color: "#475569", fontSize: 13, cursor: "pointer" }}>Logout</button>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>

        {loading && <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "60px 0" }}>Loading…</div>}
        {error   && <div style={{ color: "#EF4444", fontSize: 13, textAlign: "center", padding: "60px 0" }}>Error: {error}</div>}

        {data && (() => {
          const { affiliate, conversions, ledger, referredUsers, clickStats, auditLog, riskFlags } = data;
          const sc = STATUS_COLORS[affiliate.status] ?? "#475569";

          return (
            <>
              {/* Summary card */}
              <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "24px 28px", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9" }}>
                        {affiliate.user?.email ?? `User #${affiliate.userId}`}
                      </span>
                      <Badge label={affiliate.status} color={sc} />
                      {affiliate.suspiciousFlag && <Badge label="⚠ Suspicious" color="#EF4444" />}
                      {affiliate.isVerified      && <Badge label="Verified"     color="#22C55E" />}
                    </div>
                    <div style={{ fontSize: 13, color: "#64748B" }}>
                      @{affiliate.user?.username ?? "—"} · refCode: <span style={{ fontFamily: "monospace", color: "#22C55E" }}>{affiliate.refCode}</span> · ID #{affiliate.id}
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                      Tier: <strong style={{ color: "#94A3B8" }}>{affiliate.tier}</strong>
                      &nbsp;·&nbsp;KYC: <strong style={{ color: "#94A3B8" }}>{affiliate.kycStatus}</strong>
                      &nbsp;·&nbsp;Joined: {fmtDate(affiliate.createdAt)}
                    </div>
                  </div>

                  {/* Balances */}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {[
                      { label: "Pending",   val: affiliate.balancePending,   color: "#F59E0B" },
                      { label: "Available", val: affiliate.balanceAvailable, color: "#22C55E" },
                      { label: "Frozen",    val: affiliate.balanceFrozen,    color: "#3B82F6" },
                      { label: "Negative",  val: affiliate.balanceNegative,  color: "#EF4444" },
                    ].map(b => (
                      <div key={b.label} style={{ background: "#0F172A", border: "1px solid #334155", borderRadius: 8, padding: "10px 16px", minWidth: 100 }}>
                        <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{b.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: b.val > 0 ? b.color : "#334155" }}>{fmtUsd(b.val)}</div>
                      </div>
                    ))}
                    <div style={{ background: "#0F172A", border: "1px solid #334155", borderRadius: 8, padding: "10px 16px", minWidth: 100 }}>
                      <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Lifetime</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#94A3B8" }}>{fmtUsd(affiliate.lifetimeEarned)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Admin Actions */}
              {(() => {
                const st          = affiliate.status;
                const canBalance  = ["approved", "suspended", "banned"].includes(st);
                const showSuspend      = st === "approved";
                const showUnsuspend    = st === "suspended";
                const showBan          = st === "approved" || st === "suspended";
                const showForfeitPend  = canBalance && affiliate.balancePending > 0;
                const showForfeitFull  = canBalance && (affiliate.balancePending > 0 || affiliate.balanceAvailable > 0);
                if (!showSuspend && !showUnsuspend && !showBan && !showForfeitPend && !showForfeitFull) return null;
                return (
                  <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "18px 24px", marginBottom: 24 }}>
                    <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Admin Actions</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {showSuspend      && <button onClick={() => setModalOpen("suspend")}          style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid #F97316", background: "rgba(249,115,22,0.1)",  color: "#F97316", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Suspend</button>}
                      {showUnsuspend    && <button onClick={() => setModalOpen("unsuspend")}        style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid #22C55E", background: "rgba(34,197,94,0.1)",   color: "#22C55E", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Unsuspend</button>}
                      {showBan          && <button onClick={() => setModalOpen("ban")}              style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid #DC2626", background: "rgba(220,38,38,0.1)",   color: "#DC2626", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Ban</button>}
                      {showForfeitPend  && <button onClick={() => setModalOpen("forfeit_pending")}  style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid #DC2626", background: "rgba(220,38,38,0.08)", color: "#DC2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Forfeit Pending</button>}
                      {showForfeitFull  && <button onClick={() => setModalOpen("forfeit_full")}     style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid #DC2626", background: "rgba(220,38,38,0.08)", color: "#DC2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Forfeit Pending + Available</button>}
                    </div>
                  </div>
                );
              })()}

              {/* Risk flags */}
              {(riskFlags.sameIpAtRegistration || riskFlags.hasNegativeBalance || riskFlags.manyClicksZeroConversions || riskFlags.negativeBalanceOverLimit) && (
                <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "14px 20px", marginBottom: 24, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#EF4444", marginRight: 4 }}>RISK FLAGS</span>
                  {riskFlags.sameIpAtRegistration      && <Badge label={`IP Match${riskFlags.reason ? `: ${riskFlags.reason}` : ""}`}   color="#EF4444" />}
                  {riskFlags.negativeBalanceOverLimit   && <Badge label={`Negative balance > $1000`}                                      color="#EF4444" />}
                  {riskFlags.hasNegativeBalance && !riskFlags.negativeBalanceOverLimit && <Badge label="Negative balance"                 color="#F97316" />}
                  {riskFlags.manyClicksZeroConversions  && <Badge label="50+ clicks, 0 conversions"                                       color="#F97316" />}
                  {riskFlags.recentVelocity24h > 0      && <Badge label={`${riskFlags.recentVelocity24h} conversions in 24h`}             color="#F59E0B" />}
                </div>
              )}

              {/* Click stats strip */}
              <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                {[
                  { label: "Total Clicks",    val: clickStats.totalClicks    },
                  { label: "Unique IPs",      val: clickStats.uniqueIpHashes },
                  { label: "With Conversion", val: clickStats.withConversion  },
                  { label: "Referred Users",  val: referredUsers.length       },
                  { label: "Conversions",     val: conversions.length         },
                ].map(s => (
                  <div key={s.label} style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 8, padding: "10px 18px" }}>
                    <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9" }}>{s.val}</div>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
                {TABS.map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    style={{
                      padding: "7px 16px", borderRadius: 7, cursor: "pointer", fontSize: 13,
                      border:      `1px solid ${activeTab === t.key ? "#22C55E" : "#334155"}`,
                      background:  activeTab === t.key ? "rgba(34,197,94,0.1)" : "transparent",
                      color:       activeTab === t.key ? "#22C55E" : "#94A3B8",
                      fontWeight:  activeTab === t.key ? 700 : 400,
                    }}
                  >{t.label}</button>
                ))}
              </div>

              {/* ── Overview ── */}
              {activeTab === "overview" && (
                <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "24px 28px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px 32px" }}>
                    {[
                      ["Approved At",    fmtDate(affiliate.approvedAt)],
                      ["Approved By",    affiliate.approvedBy ?? "—"],
                      ["Rejected At",    fmtDate(affiliate.rejectedAt)],
                      ["Suspended At",   fmtDate(affiliate.suspendedAt)],
                      ["Banned At",      fmtDate(affiliate.bannedAt)],
                      ["Rejection Reason", affiliate.rejectionReason ?? "—"],
                      ["Wallet",         affiliate.paymentWallet ?? "—"],
                      ["Wallet Network", affiliate.paymentMethod ?? "—"],
                      ["Wallet Lock Until", fmtDate(affiliate.walletLockUntil)],
                      ["Wallet Requires Review", affiliate.walletRequiresReview ? "Yes" : "No"],
                      ["KYC Status",     affiliate.kycStatus],
                      ["KYC Country",    affiliate.kycCountry ?? "—"],
                      ["KYC Admin Note", affiliate.kycAdminNote ?? "—"],
                      ["Custom Rate",    affiliate.customCommissionRate != null ? `${(affiliate.customCommissionRate * 100).toFixed(1)}%` : "— (tier default)"],
                      ["Lifetime Paid",  fmtUsd(affiliate.lifetimePaid)],
                      ["Lifetime Clawed Back", fmtUsd(affiliate.lifetimeClawedBack)],
                      ["30d Sales Count", String(affiliate.salesCount30d)],
                      ["Suspicious Reason", affiliate.suspiciousReason ?? "—"],
                      ["Promo Channels", affiliate.applicationData && typeof affiliate.applicationData === "object" ? (affiliate.applicationData as any).promoChannels ?? "—" : "—"],
                      ["Audience",       affiliate.applicationData && typeof affiliate.applicationData === "object" ? (affiliate.applicationData as any).audience ?? "—" : "—"],
                      ["User Registration IP (hash)", affiliate.user?.registrationIpHash ?? "—"],
                    ].map(([label, val]) => (
                      <div key={label as string}>
                        <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 13, color: "#94A3B8", fontFamily: String(val).startsWith("0x") || String(val).length === 64 ? "monospace" : undefined, wordBreak: "break-all" }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Conversions ── */}
              {activeTab === "conversions" && (
                <div style={{ overflowX: "auto" }}>
                  {conversions.length === 0
                    ? <div style={{ color: "#475569", fontSize: 13, padding: "32px", textAlign: "center", background: "#1E293B", border: "1px solid #334155", borderRadius: 12 }}>No conversions.</div>
                    : (
                      <table style={{ width: "100%", borderCollapse: "collapse", background: "#1E293B", border: "1px solid #334155", borderRadius: 12, overflow: "hidden" }}>
                        <thead><tr>{["ID", "Referred User", "Gross", "Commission", "Rate", "Status", "Pending Until", "Created"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                        <tbody>
                          {conversions.map((c: any) => {
                            const csc = STATUS_COLORS[c.status] ?? "#475569";
                            return (
                              <tr key={c.id}>
                                <td style={{ ...cell, color: "#64748B" }}>{c.id}</td>
                                <td style={cell}>{c.referredUser?.email ?? `#${c.referredUserId}`}</td>
                                <td style={{ ...cell, color: "#F1F5F9" }}>{fmtUsd(c.grossAmount)}</td>
                                <td style={{ ...cell, color: "#22C55E", fontWeight: 700 }}>{fmtUsd(c.commissionAmount)}</td>
                                <td style={cell}>{(c.commissionRate * 100).toFixed(0)}%</td>
                                <td style={cell}><Badge label={c.status} color={csc} /></td>
                                <td style={cell}>{fmtDate(c.pendingUntil)}</td>
                                <td style={cell}>{fmt(c.createdAt)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )
                  }
                </div>
              )}

              {/* ── Ledger ── */}
              {activeTab === "ledger" && (
                <div style={{ overflowX: "auto" }}>
                  {ledger.length === 0
                    ? <div style={{ color: "#475569", fontSize: 13, padding: "32px", textAlign: "center", background: "#1E293B", border: "1px solid #334155", borderRadius: 12 }}>No ledger entries.</div>
                    : (
                      <table style={{ width: "100%", borderCollapse: "collapse", background: "#1E293B", border: "1px solid #334155", borderRadius: 12, overflow: "hidden" }}>
                        <thead><tr>{["ID", "Type", "Bucket", "Amount", "Balance After", "Reason", "Created"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                        <tbody>
                          {ledger.map((e: any) => (
                            <tr key={e.id}>
                              <td style={{ ...cell, color: "#64748B" }}>{e.id}</td>
                              <td style={{ ...cell, fontFamily: "monospace", fontSize: 11 }}>{e.type}</td>
                              <td style={cell}>{e.bucket}</td>
                              <td style={{ ...cell, color: e.amount >= 0 ? "#22C55E" : "#EF4444", fontWeight: 700 }}>{e.amount >= 0 ? "+" : ""}{fmtUsd(e.amount)}</td>
                              <td style={cell}>{fmtUsd(e.balanceAfter)}</td>
                              <td style={{ ...cell, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{e.reason ?? "—"}</td>
                              <td style={cell}>{fmt(e.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  }
                </div>
              )}

              {/* ── Referred Users ── */}
              {activeTab === "referred" && (
                <div style={{ overflowX: "auto" }}>
                  {referredUsers.length === 0
                    ? <div style={{ color: "#475569", fontSize: 13, padding: "32px", textAlign: "center", background: "#1E293B", border: "1px solid #334155", borderRadius: 12 }}>No referred users.</div>
                    : (
                      <table style={{ width: "100%", borderCollapse: "collapse", background: "#1E293B", border: "1px solid #334155", borderRadius: 12, overflow: "hidden" }}>
                        <thead><tr>{["ID", "Email", "Username", "IP Match", "Joined"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                        <tbody>
                          {referredUsers.map((u: any) => {
                            const ipMatch = u.registrationIpHash && affiliate.user?.registrationIpHash && u.registrationIpHash === affiliate.user.registrationIpHash;
                            return (
                              <tr key={u.id}>
                                <td style={{ ...cell, color: "#64748B" }}>{u.id}</td>
                                <td style={{ ...cell, color: "#F1F5F9" }}>{u.email}</td>
                                <td style={cell}>@{u.username}</td>
                                <td style={cell}>{ipMatch ? <Badge label="⚠ IP Match" color="#EF4444" /> : <span style={{ color: "#334155" }}>—</span>}</td>
                                <td style={cell}>{fmtDate(u.createdAt)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )
                  }
                </div>
              )}

              {/* ── Audit Log ── */}
              {activeTab === "audit" && (
                <div style={{ overflowX: "auto" }}>
                  {auditLog.length === 0
                    ? <div style={{ color: "#475569", fontSize: 13, padding: "32px", textAlign: "center", background: "#1E293B", border: "1px solid #334155", borderRadius: 12 }}>No audit log entries.</div>
                    : (
                      <table style={{ width: "100%", borderCollapse: "collapse", background: "#1E293B", border: "1px solid #334155", borderRadius: 12, overflow: "hidden" }}>
                        <thead><tr>{["ID", "Action", "Metadata", "Created"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                        <tbody>
                          {auditLog.map((e: any) => (
                            <tr key={e.id}>
                              <td style={{ ...cell, color: "#64748B" }}>{e.id}</td>
                              <td style={{ ...cell, fontFamily: "monospace", color: "#22C55E" }}>{e.action}</td>
                              <td style={{ ...cell, fontFamily: "monospace", fontSize: 11, maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", color: "#64748B" }}>
                                {e.metadata ? JSON.stringify(e.metadata) : "—"}
                              </td>
                              <td style={cell}>{fmt(e.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  }
                </div>
              )}

              {/* ── Payouts ── */}
              {activeTab === "payouts" && (
                <div>
                  {payoutsLoading && payoutsData === null ? (
                    <div style={{ color: "#94A3B8", fontSize: 13, padding: "12px 0" }}>Loading payouts…</div>
                  ) : payoutsError ? (
                    <div style={{ color: "#EF4444", fontSize: 13, padding: "12px 0" }}>Error: {payoutsError}</div>
                  ) : !payoutsData || payoutsData.length === 0 ? (
                    <div style={{ color: "#94A3B8", fontSize: 13, padding: "12px 0" }}>No payouts for this affiliate.</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #334155" }}>
                            <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>ID</th>
                            <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</th>
                            <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>Amount</th>
                            <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>Method</th>
                            <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>Wallet</th>
                            <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>Requested</th>
                            <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payoutsData.map((row: any) => {
                            const showApproveReject = row.status === "requested";
                            const showCompleteFail = row.status === "approved";
                            return (
                              <tr key={row.id} style={{ borderBottom: "1px solid #1E293B" }}>
                                <td style={{ padding: "10px 12px", color: "#94A3B8", fontFamily: "monospace" }}>#{row.id}</td>
                                <td style={{ padding: "10px 12px" }}>
                                  <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "#0F172A", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{row.status}</span>
                                </td>
                                <td style={{ padding: "10px 12px", textAlign: "right", color: "#F1F5F9", fontWeight: 600 }}>${Number(row.amount).toFixed(2)}</td>
                                <td style={{ padding: "10px 12px", color: "#94A3B8" }}>{row.paymentMethod}</td>
                                <td style={{ padding: "10px 12px", color: "#94A3B8", fontFamily: "monospace", fontSize: 12 }}>{maskWallet(row.paymentWallet)}</td>
                                <td style={{ padding: "10px 12px", color: "#94A3B8", fontSize: 12 }}>{row.requestedAt ? new Date(row.requestedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}</td>
                                <td style={{ padding: "10px 12px" }}>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    {showApproveReject && (
                                      <>
                                        <button onClick={() => openPayoutModal("approve", row)} style={{ padding: "4px 10px", fontSize: 11, borderRadius: 5, border: "1px solid #22C55E", background: "transparent", color: "#22C55E", cursor: "pointer" }}>Approve</button>
                                        <button onClick={() => openPayoutModal("reject", row)} style={{ padding: "4px 10px", fontSize: 11, borderRadius: 5, border: "1px solid #EF4444", background: "transparent", color: "#EF4444", cursor: "pointer" }}>Reject</button>
                                      </>
                                    )}
                                    {showCompleteFail && (
                                      <>
                                        <button onClick={() => openPayoutModal("complete", row)} style={{ padding: "4px 10px", fontSize: 11, borderRadius: 5, border: "1px solid #22C55E", background: "transparent", color: "#22C55E", cursor: "pointer" }}>Complete</button>
                                        <button onClick={() => openPayoutModal("fail", row)} style={{ padding: "4px 10px", fontSize: 11, borderRadius: 5, border: "1px solid #EF4444", background: "transparent", color: "#EF4444", cursor: "pointer" }}>Fail</button>
                                      </>
                                    )}
                                    {!showApproveReject && !showCompleteFail && (
                                      <span style={{ color: "#475569", fontSize: 12 }}>—</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {successMsg && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#22C55E", color: "#071A0E", padding: "12px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, zIndex: 999 }}>
          {successMsg}
        </div>
      )}

      {modalOpen && (() => {
        const cfg          = getModalConfig(modalOpen, data?.affiliate);
        const confirmBg    = modalLoading ? "#334155" : modalOpen === "unsuspend" ? "#22C55E" : modalOpen === "suspend" ? "#F97316" : "#DC2626";
        const confirmColor = modalLoading ? "#64748B" : modalOpen === "unsuspend" ? "#071A0E" : "#fff";
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "28px 32px", width: 440, maxWidth: "90vw" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9", marginBottom: 8 }}>{cfg.title}</div>
              <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 20, lineHeight: "1.5" }}>{cfg.warning}</div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Admin Label</label>
                <input value={modalLabel} onChange={e => setModalLabel(e.target.value)} placeholder="e.g. admin-ui"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 7, boxSizing: "border-box", border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 13, outline: "none" }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Reason</label>
                <textarea value={modalReason} onChange={e => setModalReason(e.target.value)} placeholder="Describe the reason for this action" rows={3}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 7, boxSizing: "border-box", border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
              </div>
              {modalError && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 14 }}>{modalError}</div>}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => { setModalOpen(null); setModalLabel(""); setModalReason(""); setModalError(null); }} disabled={modalLoading}
                  style={{ padding: "8px 20px", borderRadius: 7, border: "1px solid #334155", background: "transparent", color: "#94A3B8", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                <button onClick={handleAction} disabled={modalLoading}
                  style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: confirmBg, color: confirmColor, fontSize: 13, fontWeight: 700, cursor: modalLoading ? "not-allowed" : "pointer" }}>
                  {modalLoading ? "Processing…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {payoutModalAction && payoutModalRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "28px 32px", width: 540, maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9", marginBottom: 16, textTransform: "capitalize" }}>
              {payoutModalAction} payout #{payoutModalRow.id}
            </div>
            <div style={{ background: "#0F172A", border: "1px solid #334155", borderRadius: 8, padding: "12px 14px", marginBottom: 18, fontSize: 12, color: "#94A3B8" }}>
              <div style={{ marginBottom: 6 }}><span style={{ color: "#475569" }}>Amount:</span> <span style={{ color: "#F1F5F9", fontWeight: 600 }}>${Number(payoutModalRow.amount).toFixed(2)}</span></div>
              <div style={{ marginBottom: 6 }}><span style={{ color: "#475569" }}>Method:</span> {payoutModalRow.paymentMethod} ({payoutModalRow.network})</div>
              <div style={{ marginBottom: 6, fontFamily: "monospace", wordBreak: "break-all" }}><span style={{ color: "#475569", fontFamily: "inherit" }}>Wallet:</span> {payoutModalRow.paymentWallet}</div>
              <div style={{ marginBottom: 6 }}><span style={{ color: "#475569" }}>Requested:</span> {payoutModalRow.requestedAt ? new Date(payoutModalRow.requestedAt).toLocaleString("en-US") : "—"}</div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Admin Label *</label>
              <input value={payoutModalLabel} onChange={e => setPayoutModalLabel(e.target.value)} placeholder="e.g. admin-ui"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 7, boxSizing: "border-box", border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 13, outline: "none" }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
                Reason {(payoutModalAction === "reject" || payoutModalAction === "fail") ? "*" : "(optional)"}
              </label>
              <textarea value={payoutModalReason} onChange={e => setPayoutModalReason(e.target.value)} rows={3}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 7, boxSizing: "border-box", border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
            </div>

            {payoutModalAction === "complete" && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Transaction Hash (optional)</label>
                  <input value={payoutModalTxHash} onChange={e => setPayoutModalTxHash(e.target.value)} placeholder="0x..."
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 7, boxSizing: "border-box", border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 13, outline: "none", fontFamily: "monospace" }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Admin Note (optional)</label>
                  <textarea value={payoutModalNote} onChange={e => setPayoutModalNote(e.target.value)} rows={2}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 7, boxSizing: "border-box", border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
                </div>
              </>
            )}

            {payoutModalError && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 14 }}>{payoutModalError}</div>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={closePayoutModal} disabled={payoutModalLoading}
                style={{ padding: "8px 20px", borderRadius: 7, border: "1px solid #334155", background: "transparent", color: "#94A3B8", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={handlePayoutConfirm} disabled={payoutModalLoading}
                style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: (payoutModalAction === "approve" || payoutModalAction === "complete") ? "#22C55E" : "#EF4444", color: (payoutModalAction === "approve" || payoutModalAction === "complete") ? "#071A0E" : "#fff", fontSize: 13, fontWeight: 700, cursor: payoutModalLoading ? "not-allowed" : "pointer" }}>
                {payoutModalLoading ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
