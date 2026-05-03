"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY  = "adminKey";
const ATTEMPTS_KEY = "adminAttempts";
const BLOCKED_KEY  = "adminBlockedUntil";
const MAX_ATTEMPTS = 3;
const BLOCK_MS     = 5 * 60 * 1000;
const LIMIT        = 20;

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "suspended" | "banned";

function getAppField(item: any, key: string): string {
  try {
    if (item.applicationData && typeof item.applicationData === "object") {
      const v = item.applicationData[key];
      return typeof v === "string" && v.trim() ? v : "—";
    }
  } catch {}
  return "—";
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

export default function AdminAffiliatePage() {
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
          type="password"
          placeholder="Admin key"
          value={keyInput}
          onChange={e => setKeyInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          disabled={blocked}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 8, boxSizing: "border-box", border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 14, outline: "none", marginBottom: 10 }}
        />
        {loginError && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 10 }}>{loginError}</div>}
        {blocked   && <div style={{ color: "#F59E0B", fontSize: 12, marginBottom: 10 }}>Blocked. Try again in {blockLeft}s</div>}
        <button
          onClick={handleLogin}
          disabled={blocked}
          style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: blocked ? "#334155" : "#22C55E", color: blocked ? "#64748B" : "#071A0E", fontWeight: 700, fontSize: 14, cursor: blocked ? "not-allowed" : "pointer" }}
        >
          Sign In
        </button>
      </div>
    </div>
  );

  return <AffiliateAdmin onInvalidKey={handleBlock} onLogout={handleLogout} />;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:   "#F59E0B",
  approved:  "#22C55E",
  rejected:  "#EF4444",
  suspended: "#F97316",
  banned:    "#DC2626",
};

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all",       label: "All"       },
  { key: "pending",   label: "Pending"   },
  { key: "approved",  label: "Approved"  },
  { key: "rejected",  label: "Rejected"  },
  { key: "suspended", label: "Suspended" },
  { key: "banned",    label: "Banned"    },
];

function AffiliateAdmin({ onInvalidKey, onLogout }: { onInvalidKey: () => void; onLogout: () => void }) {
  const router = useRouter();
  const [items,        setItems]        = useState<any[]>([]);
  const [total,        setTotal]        = useState(0);
  const [hasMore,      setHasMore]      = useState(false);
  const [page,         setPage]         = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading,      setLoading]      = useState(true);
  const [actionMsg,    setActionMsg]    = useState<Record<number, string>>({});

  const apiFetch = useCallback(async function<T = any>(url: string, opts: RequestInit = {}): Promise<T> {
    const key = sessionStorage.getItem(STORAGE_KEY) ?? "";
    const res = await fetch(url, {
      ...opts,
      headers: { "x-admin-key": key, "Content-Type": "application/json", ...opts.headers },
    });
    if (res.status === 401 || res.status === 403) { onInvalidKey(); throw new Error("Forbidden"); }
    return res.json() as Promise<T>;
  }, [onInvalidKey]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (statusFilter !== "all") qs.set("status", statusFilter);
      const data = await apiFetch(`/api/admin/affiliate/applications?${qs}`);
      sessionStorage.removeItem(ATTEMPTS_KEY);
      setItems(data.items   ?? []);
      setTotal(data.total   ?? 0);
      setHasMore(data.hasMore ?? false);
    } catch (e) {
      if ((e as Error).message !== "Forbidden") setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, apiFetch]);

  useEffect(() => { load(); }, [load]);

  function setMsg(id: number, msg: string) {
    setActionMsg(prev => ({ ...prev, [id]: msg }));
    setTimeout(() => setActionMsg(prev => { const n = { ...prev }; delete n[id]; return n; }), 3000);
  }

  async function handleApprove(id: number) {
    const reviewNote = window.prompt("Optional review note (leave empty to skip):");
    if (reviewNote === null) return;
    try {
      const body: any = { adminLabel: "admin-ui" };
      if (reviewNote.trim()) body.reviewNote = reviewNote.trim();
      const res = await apiFetch(`/api/admin/affiliate/${id}/approve`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.affiliate) {
        setMsg(id, "Approved");
        load();
      } else if (res.error === "not_pending") {
        setMsg(id, `Already processed (status: ${res.currentStatus})`);
      } else {
        setMsg(id, res.message ?? "Error");
      }
    } catch (e) {
      if ((e as Error).message !== "Forbidden") setMsg(id, "Network error");
    }
  }

  async function handleReject(id: number) {
    const rejectionReason = window.prompt("Rejection reason (required, 3-500 chars):");
    if (rejectionReason === null) return;
    if (!rejectionReason.trim() || rejectionReason.trim().length < 3) {
      alert("Rejection reason is required (min 3 chars)");
      return;
    }
    try {
      const res = await apiFetch(`/api/admin/affiliate/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ adminLabel: "admin-ui", rejectionReason: rejectionReason.trim() }),
      });
      if (res.affiliate) {
        setMsg(id, "Rejected");
        load();
      } else if (res.error === "not_pending") {
        setMsg(id, `Already processed (status: ${res.currentStatus})`);
      } else {
        setMsg(id, res.message ?? "Error");
      }
    } catch (e) {
      if ((e as Error).message !== "Forbidden") setMsg(id, "Network error");
    }
  }

  const totalPages = Math.ceil(total / LIMIT) || 1;

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", fontFamily: "'Inter',-apple-system,sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#1E293B", borderBottom: "1px solid #334155", padding: "0 24px", display: "flex", alignItems: "center", height: 52 }}>
        <a href="/admin" style={{ fontSize: 14, fontWeight: 700, color: "#22C55E", marginRight: 8, textDecoration: "none" }}>Admin</a>
        <span style={{ fontSize: 14, color: "#475569", marginRight: "auto" }}>· Affiliate Applications</span>
        <button
          onClick={onLogout}
          style={{ marginLeft: 16, padding: "6px 16px", borderRadius: 7, border: "1px solid #334155", background: "transparent", color: "#475569", fontSize: 13, cursor: "pointer" }}
        >
          Logout
        </button>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9", marginBottom: 24 }}>Affiliate Applications</div>

        {/* Status filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => { setStatusFilter(f.key); setPage(1); }}
              style={{
                padding: "6px 16px", borderRadius: 7,
                border: `1px solid ${statusFilter === f.key ? "#22C55E" : "#334155"}`,
                background: statusFilter === f.key ? "rgba(34,197,94,0.1)" : "transparent",
                color: statusFilter === f.key ? "#22C55E" : "#94A3B8",
                fontSize: 13, fontWeight: statusFilter === f.key ? 700 : 400, cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Table / empty / loading */}
        {loading ? (
          <div style={{ color: "#475569", fontSize: 13, padding: "32px 0", textAlign: "center" }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "32px", textAlign: "center", fontSize: 13, color: "#475569" }}>
            No applications found.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#1E293B", border: "1px solid #334155", borderRadius: 12, overflow: "hidden" }}>
              <thead>
                <tr>
                  {["ID", "User", "refCode", "Status", "Promo Channels", "Audience", "Created", "Actions"].map(h => (
                    <th key={h} style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", padding: "12px 16px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap", borderBottom: "1px solid #334155" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => {
                  const sc = STATUS_COLORS[item.status] ?? "#475569";
                  const msg = actionMsg[item.id];
                  return (
                    <tr key={item.id} onClick={() => router.push(`/admin/affiliate/${item.id}`)} style={{ cursor: "pointer" }}>
                      <td style={{ fontSize: 13, color: "#94A3B8",  padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", whiteSpace: "nowrap" }}>{item.id}</td>
                      <td style={{ fontSize: 13, color: "#F1F5F9",  padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", whiteSpace: "nowrap" }}>{item.user?.email ?? "—"}</td>
                      <td style={{ fontSize: 13, fontFamily: "monospace", color: "#22C55E", padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", whiteSpace: "nowrap" }}>{item.refCode}</td>
                      <td style={{ fontSize: 13, padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: `${sc}18`, color: sc, whiteSpace: "nowrap" }}>{item.status.toUpperCase()}</span>
                      </td>
                      <td style={{ fontSize: 13, color: "#94A3B8", padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getAppField(item, "promoChannels")}</td>
                      <td style={{ fontSize: 13, color: "#94A3B8", padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getAppField(item, "audience")}</td>
                      <td style={{ fontSize: 13, color: "#475569", padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", whiteSpace: "nowrap" }}>{formatDate(item.createdAt)}</td>
                      <td style={{ fontSize: 13, padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", whiteSpace: "nowrap" }}>
                        {msg ? (
                          <span style={{ fontSize: 12, color: msg === "Approved" ? "#22C55E" : msg === "Rejected" ? "#EF4444" : "#F59E0B" }}>{msg}</span>
                        ) : item.status === "pending" ? (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleApprove(item.id); }}
                              style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "rgba(34,197,94,0.15)", color: "#22C55E", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReject(item.id); }}
                              style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "rgba(239,68,68,0.15)", color: "#EF4444", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                            >
                              Reject
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
              style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #334155", background: "transparent", color: page === 1 ? "#334155" : "#94A3B8", fontSize: 13, cursor: page === 1 ? "not-allowed" : "pointer" }}
            >
              ← Prev
            </button>
            <span style={{ fontSize: 13, color: "#475569" }}>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore}
              style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #334155", background: "transparent", color: !hasMore ? "#334155" : "#94A3B8", fontSize: 13, cursor: !hasMore ? "not-allowed" : "pointer" }}
            >
              Next →
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
