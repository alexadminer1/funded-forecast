"use client";
import { useState, useEffect, useCallback } from "react";
import { maskWallet } from "@/lib/affiliate/wallet";

const API_BASE = "";

type AffiliatePayoutStatus =
  | "requested"
  | "approved"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

type StatusFilter = "all" | AffiliatePayoutStatus;

interface PayoutItem {
  id: number;
  status: AffiliatePayoutStatus;
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
  affiliateId: number;
  affiliateRefCode: string;
  affiliateEmail: string;
}

interface ListResponse {
  items: PayoutItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const STATUS_COLORS: Record<AffiliatePayoutStatus, { bg: string; color: string }> = {
  requested:  { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B" },
  approved:   { bg: "rgba(59,130,246,0.12)",   color: "#3B82F6" },
  processing: { bg: "rgba(139,92,246,0.12)",   color: "#8B5CF6" },
  completed:  { bg: "rgba(34,197,94,0.12)",    color: "#22C55E" },
  failed:     { bg: "rgba(239,68,68,0.12)",    color: "#EF4444" },
  cancelled:  { bg: "rgba(100,116,139,0.12)",  color: "#64748B" },
};

function fmtMoney(v: number) { return `$${Number(v).toFixed(2)}`; }
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const key = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("adminKey") ?? "" : "";
  return fetch(API_BASE + path, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-admin-key": key, ...(opts?.headers ?? {}) },
  }).then(async (r) => {
    if (r.status === 403) return { error: "__forbidden" } as T;
    return r.json() as Promise<T>;
  });
}


export default function AdminAffiliatePayoutsPage() {
  const [authed, setAuthed] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [authError, setAuthError] = useState("");

  const [items, setItems] = useState<PayoutItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const LIMIT = 25;

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(false);

  const [modal, setModal] = useState<{ payout: PayoutItem; action: string } | null>(null);
  const [adminLabel, setAdminLabel] = useState("");
  const [reason, setReason] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const load = useCallback(async (p: number, sf: StatusFilter) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    if (sf !== "all") params.set("status", sf);
    const data = await apiFetch<ListResponse & { error?: string }>(`/api/admin/affiliate/payouts?${params}`);
    if ((data as any).error === "__forbidden") { setAuthed(false); setLoading(false); return; }
    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
    setHasMore(data.hasMore ?? false);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authed) load(page, statusFilter);
  }, [authed, page, statusFilter, load]);

  function tryLogin() {
    if (!keyInput.trim()) { setAuthError("Enter admin key"); return; }
    sessionStorage.setItem("adminKey", keyInput.trim());
    setAuthed(true);
    setAuthError("");
  }

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", background: "#080c14", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "40px 48px", width: 360 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#F1F5F9", marginBottom: 24 }}>Admin — Affiliate Payouts</div>
          <input
            type="password"
            placeholder="Admin key"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && tryLogin()}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #1E293B", background: "#080c14", color: "#F1F5F9", fontSize: 14, marginBottom: 12, boxSizing: "border-box" }}
          />
          {authError && <div style={{ fontSize: 12, color: "#EF4444", marginBottom: 10 }}>{authError}</div>}
          <button onClick={tryLogin} style={{ width: "100%", padding: "10px 0", borderRadius: 8, background: "#22C55E", color: "#071A0E", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>
            Login
          </button>
        </div>
      </div>
    );
  }

  function openModal(payout: PayoutItem, action: string) {
    setModal({ payout, action });
    setAdminLabel("");
    setReason("");
    setTransactionHash("");
    setAdminNote("");
  }

  function closeModal() {
    setModal(null);
    setSubmitting(false);
  }

  async function handleConfirm() {
    if (!modal) return;
    if (!adminLabel.trim()) { alert("Admin label required"); return; }
    if ((modal.action === "reject" || modal.action === "fail") && !reason.trim()) {
      alert("Reason required for this action"); return;
    }
    setSubmitting(true);
    const body: Record<string, string> = { adminLabel: adminLabel.trim() };
    if (reason.trim()) body.reason = reason.trim();
    if (modal.action === "complete" && transactionHash.trim()) body.transactionHash = transactionHash.trim();
    if (modal.action === "complete" && adminNote.trim()) body.adminNote = adminNote.trim();
    const data = await apiFetch<{ ok?: boolean; error?: string }>(
      `/api/admin/affiliate/payouts/${modal.payout.id}/${modal.action}`,
      { method: "POST", body: JSON.stringify(body) },
    );
    setSubmitting(false);
    if (data.ok) {
      setToast({ msg: `Payout #${modal.payout.id} ${modal.action}d`, ok: true });
      closeModal();
      load(page, statusFilter);
      setTimeout(() => setToast(null), 3500);
    } else {
      setToast({ msg: data.error ?? "Error", ok: false });
      setTimeout(() => setToast(null), 4000);
    }
  }

  function copyWallet(wallet: string) {
    navigator.clipboard.writeText(wallet).catch(() => {});
  }

  function showActions(status: AffiliatePayoutStatus): string[] {
    if (status === "requested") return ["approve", "reject"];
    if (status === "approved") return ["complete", "fail"];
    return [];
  }

  const STATUSES: StatusFilter[] = ["all", "requested", "approved", "processing", "completed", "failed", "cancelled"];

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", fontFamily: "'Inter',-apple-system,sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#1E293B", borderBottom: "1px solid #334155", padding: "0 24px", display: "flex", alignItems: "center", height: 52 }}>
        <a href="/admin" style={{ fontSize: 14, fontWeight: 700, color: "#22C55E", marginRight: 8, textDecoration: "none" }}>Admin</a>
        <span style={{ fontSize: 14, color: "#475569", marginRight: "auto" }}>· Affiliate Payouts</span>
        <button
          onClick={() => { sessionStorage.removeItem("adminKey"); setAuthed(false); }}
          style={{ marginLeft: 16, padding: "6px 16px", borderRadius: 7, border: "1px solid #334155", background: "transparent", color: "#475569", fontSize: 13, cursor: "pointer" }}
        >
          Logout
        </button>
      </div>

      {/* Sub-nav */}
      <div style={{ background: "#0F172A", borderBottom: "1px solid #1E293B", padding: "0 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 24, height: 44, alignItems: "center" }}>
          <a href="/admin/affiliate" style={{ fontSize: 13, fontWeight: 500, color: "#475569", textDecoration: "none" }}>Applications</a>
          <a href="/admin/affiliate/payouts" style={{ fontSize: 13, fontWeight: 700, color: "#22C55E", textDecoration: "none" }}>Payouts</a>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 80px", color: "#F1F5F9" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9", margin: 0 }}>Affiliate Payouts</h1>
          <div style={{ fontSize: 13, color: "#475569" }}>Total: {total}</div>
        </div>

        {/* Status filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => { setPage(1); setStatusFilter(s); }}
              style={{
                padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                background: statusFilter === s ? "#22C55E" : "rgba(255,255,255,0.05)",
                color: statusFilter === s ? "#071A0E" : "#94A3B8",
              }}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: "#475569", fontSize: 14 }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ color: "#475569", fontSize: 14 }}>No payouts found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#475569", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>ID</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Status</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Affiliate</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Amount</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Method</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Wallet</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Requested</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Conv.</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(p => {
                  const sc = STATUS_COLORS[p.status];
                  const actions = showActions(p.status);
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "10px 12px", color: "#94A3B8" }}>#{p.id}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: sc.bg, color: sc.color }}>
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontSize: 12, color: "#F1F5F9", fontWeight: 600 }}>{p.affiliateRefCode}</div>
                        <div style={{ fontSize: 11, color: "#475569" }}>{p.affiliateEmail}</div>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700 }}>{fmtMoney(p.amount)}</td>
                      <td style={{ padding: "10px 12px", color: "#94A3B8" }}>{p.paymentMethod}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          title="Click to copy"
                          onClick={() => copyWallet(p.paymentWallet)}
                          style={{ fontFamily: "monospace", fontSize: 11, color: "#94A3B8", cursor: "pointer" }}
                        >
                          {maskWallet(p.paymentWallet)}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#475569", fontSize: 12 }}>{fmtDate(p.requestedAt)}</td>
                      <td style={{ padding: "10px 12px", color: "#94A3B8" }}>{p.conversionsCount}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {actions.map(act => (
                            <button
                              key={act}
                              onClick={() => openModal(p, act)}
                              style={{
                                padding: "4px 10px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
                                background: act === "approve" || act === "complete" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                                color: act === "approve" || act === "complete" ? "#22C55E" : "#EF4444",
                              }}
                            >
                              {act.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {(page > 1 || hasMore) && (
          <div style={{ display: "flex", gap: 12, marginTop: 24, alignItems: "center" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "rgba(255,255,255,0.05)", color: "#94A3B8", cursor: page === 1 ? "not-allowed" : "pointer", fontSize: 13 }}>
              Prev
            </button>
            <span style={{ fontSize: 13, color: "#475569" }}>Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={!hasMore}
              style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "rgba(255,255,255,0.05)", color: "#94A3B8", cursor: !hasMore ? "not-allowed" : "pointer", fontSize: 13 }}>
              Next
            </button>
          </div>
        )}

        {/* Modal */}
        {modal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "32px 36px", width: 440, maxWidth: "95vw" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#F1F5F9", marginBottom: 6, textTransform: "capitalize" }}>
                {modal.action} Payout #{modal.payout.id}
              </div>
              <div style={{ fontSize: 12, color: "#475569", marginBottom: 20 }}>
                {fmtMoney(modal.payout.amount)} · {modal.payout.affiliateEmail} · {modal.payout.paymentMethod}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Admin Label *</label>
                <input
                  value={adminLabel}
                  onChange={e => setAdminLabel(e.target.value)}
                  placeholder="e.g. Alex"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #1E293B", background: "#080c14", color: "#F1F5F9", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>

              {(modal.action === "reject" || modal.action === "fail") && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Reason *</label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={3}
                    placeholder="Reason for rejection/failure"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #1E293B", background: "#080c14", color: "#F1F5F9", fontSize: 13, boxSizing: "border-box", resize: "vertical" }}
                  />
                </div>
              )}

              {modal.action === "complete" && (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Transaction Hash</label>
                    <input
                      value={transactionHash}
                      onChange={e => setTransactionHash(e.target.value)}
                      placeholder="0x... or TRX hash (optional)"
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #1E293B", background: "#080c14", color: "#F1F5F9", fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Admin Note</label>
                    <input
                      value={adminNote}
                      onChange={e => setAdminNote(e.target.value)}
                      placeholder="Optional note"
                      style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #1E293B", background: "#080c14", color: "#F1F5F9", fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 8, border: "none", cursor: submitting ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13,
                    background: modal.action === "approve" || modal.action === "complete" ? "#22C55E" : "#EF4444",
                    color: modal.action === "approve" || modal.action === "complete" ? "#071A0E" : "#fff",
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? "..." : `Confirm ${modal.action}`}
                </button>
                <button
                  onClick={closeModal}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#94A3B8", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{
            position: "fixed", bottom: 28, right: 28, padding: "12px 20px", borderRadius: 10, zIndex: 2000,
            background: toast.ok ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            border: `1px solid ${toast.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: toast.ok ? "#22C55E" : "#EF4444",
            fontSize: 13, fontWeight: 700,
          }}>
            {toast.msg}
          </div>
        )}

      </div>
    </div>
  );
}
