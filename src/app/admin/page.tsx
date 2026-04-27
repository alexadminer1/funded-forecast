"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "adminKey";
const ATTEMPTS_KEY = "adminAttempts";
const BLOCKED_KEY = "adminBlockedUntil";
const MAX_ATTEMPTS = 3;
const BLOCK_DURATION_MS = 5 * 60 * 1000;

interface AdminUser {
  id: number;
  email: string;
  username: string;
  createdAt: string;
  mode: "sandbox" | "challenge";
  currentBalance: number;
  activeChallenge: { id: number; status: string; realizedBalance: number; profitTargetPct: number } | null;
}

interface UserDetail {
  user: { id: number; email: string; username: string; firstName: string; lastName: string; createdAt: string };
  challenges: { id: number; status: string; stage: string; startBalance: number; realizedBalance: number; createdAt: string; endedAt: string | null }[];
  balanceLogs: { id: number; type: string; amount: number; runningBalance: number; createdAt: string }[];
  positions: { id: number; marketId: string; side: string; shares: number; avgPrice: number; market: { title: string } }[];
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [blockSecondsLeft, setBlockSecondsLeft] = useState(0);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) setAuthed(true);

    const blockedUntil = parseInt(sessionStorage.getItem(BLOCKED_KEY) ?? "0");
    if (blockedUntil > Date.now()) {
      setBlocked(true);
      const tick = setInterval(() => {
        const left = Math.ceil((blockedUntil - Date.now()) / 1000);
        if (left <= 0) { setBlocked(false); clearInterval(tick); }
        else setBlockSecondsLeft(left);
      }, 1000);
      return () => clearInterval(tick);
    }
  }, []);

  function handleLogin() {
    if (blocked) return;
    const attempts = parseInt(sessionStorage.getItem(ATTEMPTS_KEY) ?? "0");

    if (keyInput === process.env.NEXT_PUBLIC_ADMIN_KEY || keyInput.length > 10) {
      // We can't validate client-side without exposing the key — just try an API call
      sessionStorage.setItem(STORAGE_KEY, keyInput);
      sessionStorage.setItem(ATTEMPTS_KEY, "0");
      setAuthed(true);
    } else {
      const newAttempts = attempts + 1;
      sessionStorage.setItem(ATTEMPTS_KEY, String(newAttempts));
      if (newAttempts >= MAX_ATTEMPTS) {
        const blockedUntil = Date.now() + BLOCK_DURATION_MS;
        sessionStorage.setItem(BLOCKED_KEY, String(blockedUntil));
        setBlocked(true);
        setBlockSecondsLeft(Math.ceil(BLOCK_DURATION_MS / 1000));
        setLoginError("Too many attempts. Blocked for 5 minutes.");
      } else {
        setLoginError(`Invalid key. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`);
      }
    }
  }

  if (!authed) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0F172A", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}>
        <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "36px 32px", width: 360 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9", marginBottom: 6 }}>Admin Panel</div>
          <div style={{ fontSize: 13, color: "#475569", marginBottom: 24 }}>Enter admin key to continue</div>

          <input
            type="password"
            placeholder="Admin key"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            disabled={blocked}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 8, boxSizing: "border-box",
              border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9",
              fontSize: 14, outline: "none", marginBottom: 10,
            }}
          />

          {loginError && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 10 }}>{loginError}</div>}
          {blocked && <div style={{ color: "#F59E0B", fontSize: 12, marginBottom: 10 }}>Blocked. Try again in {blockSecondsLeft}s</div>}

          <button
            onClick={handleLogin}
            disabled={blocked}
            style={{
              width: "100%", padding: "10px", borderRadius: 8, border: "none",
              background: blocked ? "#334155" : "#22C55E", color: blocked ? "#64748B" : "#071A0E",
              fontWeight: 700, fontSize: 14, cursor: blocked ? "not-allowed" : "pointer",
            }}
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const adminKey = sessionStorage.getItem(STORAGE_KEY) ?? "";

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", { headers: { "x-admin-key": adminKey } });
      if (res.status === 403) {
        sessionStorage.removeItem(STORAGE_KEY);
        window.location.reload();
        return;
      }
      const data = await res.json();
      if (data.success) setUsers(data.users);
      else setError(data.error ?? "Failed to load users");
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function loadDetail(userId: number) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { headers: { "x-admin-key": adminKey } });
      const data = await res.json();
      if (data.success) setSelectedUser(data);
    } finally {
      setDetailLoading(false);
    }
  }

  async function runAction(userId: number, action: string) {
    setActionLoading(`${userId}-${action}`);
    try {
      await fetch(`/api/admin/users/${userId}/action`, {
        method: "POST",
        headers: { "x-admin-key": adminKey, "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await loadUsers();
      if (selectedUser?.user.id === userId) await loadDetail(userId);
    } finally {
      setActionLoading(null);
    }
  }

  function signOut() {
    sessionStorage.clear();
    window.location.reload();
  }

  const btn = (label: string, color: string, bg: string, onClick: () => void, loading: boolean) => (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: "5px 12px", borderRadius: 6, border: "none",
        background: loading ? "#334155" : bg, color: loading ? "#64748B" : color,
        fontSize: 11, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
        letterSpacing: "0.03em",
      }}
    >{loading ? "..." : label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", fontFamily: "'Inter', -apple-system, sans-serif", color: "#F1F5F9" }}>
      {/* Top bar */}
      <div style={{ padding: "16px 32px", borderBottom: "1px solid #1E293B", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>
          <span style={{ color: "#22C55E" }}>Admin</span> · FundedForecast
        </div>
        <button onClick={signOut} style={{ background: "transparent", border: "1px solid #334155", borderRadius: 7, padding: "6px 14px", color: "#64748B", fontSize: 13, cursor: "pointer" }}>
          Sign out
        </button>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em", margin: 0 }}>Users</h1>
          <button onClick={loadUsers} style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 7, padding: "6px 14px", color: "#94A3B8", fontSize: 12, cursor: "pointer" }}>
            Refresh
          </button>
        </div>

        {error && <div style={{ color: "#EF4444", marginBottom: 16, fontSize: 13 }}>{error}</div>}

        {/* Users table */}
        <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, overflow: "hidden", marginBottom: 32 }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 2fr", padding: "10px 20px", borderBottom: "1px solid #334155", background: "rgba(255,255,255,0.02)" }}>
            {["Email", "Username", "Mode", "Balance", "Actions"].map((h) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#475569" }}>Loading...</div>
          ) : users.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#475569" }}>No users</div>
          ) : users.map((u, i) => {
            const isSelected = selectedUser?.user.id === u.id;
            return (
              <div
                key={u.id}
                style={{
                  display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 2fr",
                  padding: "13px 20px", alignItems: "center",
                  borderBottom: i < users.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  background: isSelected ? "rgba(34,197,94,0.04)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onClick={() => { if (isSelected) setSelectedUser(null); else loadDetail(u.id); }}
              >
                <div style={{ fontSize: 13, color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                <div style={{ fontSize: 13, color: "#F1F5F9", fontWeight: 500 }}>@{u.username}</div>
                <div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                    color: u.mode === "challenge" ? "#22C55E" : "#64748B",
                    background: u.mode === "challenge" ? "rgba(34,197,94,0.1)" : "rgba(100,116,139,0.1)",
                    border: `1px solid ${u.mode === "challenge" ? "rgba(34,197,94,0.2)" : "rgba(100,116,139,0.2)"}`,
                    borderRadius: 4, padding: "2px 8px",
                  }}>{u.mode.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#22C55E" }}>${u.currentBalance.toFixed(2)}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                  {u.mode === "sandbox" && btn("Start Challenge", "#F1F5F9", "#3B82F6", () => runAction(u.id, "start_challenge"), actionLoading === `${u.id}-start_challenge`)}
                  {u.mode === "challenge" && btn("Fail", "#FEF2F2", "#EF4444", () => runAction(u.id, "fail_challenge"), actionLoading === `${u.id}-fail_challenge`)}
                  {u.mode === "challenge" && btn("Pass", "#071A0E", "#22C55E", () => runAction(u.id, "pass_challenge"), actionLoading === `${u.id}-pass_challenge`)}
                  {btn("Reset", "#94A3B8", "#334155", () => runAction(u.id, "reset_balance"), actionLoading === `${u.id}-reset_balance`)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        {detailLoading && <div style={{ color: "#475569", textAlign: "center", padding: 32 }}>Loading details...</div>}
        {selectedUser && !detailLoading && (
          <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, letterSpacing: "-0.02em" }}>
              {selectedUser.user.firstName} {selectedUser.user.lastName} · <span style={{ color: "#475569", fontWeight: 400 }}>@{selectedUser.user.username}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
              {/* Balance Logs */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Recent Transactions</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {selectedUser.balanceLogs.slice(0, 10).map((log) => (
                    <div key={log.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 10px", background: "#0F172A", borderRadius: 6 }}>
                      <span style={{ color: "#64748B" }}>{log.type}</span>
                      <span style={{ color: log.amount >= 0 ? "#22C55E" : "#EF4444", fontWeight: 600 }}>
                        {log.amount >= 0 ? "+" : ""}${log.amount.toFixed(2)}
                      </span>
                      <span style={{ color: "#475569" }}>${log.runningBalance.toFixed(2)}</span>
                    </div>
                  ))}
                  {selectedUser.balanceLogs.length === 0 && <div style={{ color: "#334155", fontSize: 12 }}>No logs</div>}
                </div>
              </div>

              {/* Open Positions */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Open Positions</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {selectedUser.positions.map((pos) => (
                    <div key={pos.id} style={{ fontSize: 12, padding: "6px 10px", background: "#0F172A", borderRadius: 6 }}>
                      <div style={{ color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{pos.market.title}</div>
                      <div style={{ color: "#475569" }}>
                        <span style={{ color: pos.side === "yes" ? "#22C55E" : "#EF4444", fontWeight: 700 }}>{pos.side.toUpperCase()}</span>
                        {" "}{pos.shares} shares @ {(pos.avgPrice * 100).toFixed(0)}¢
                      </div>
                    </div>
                  ))}
                  {selectedUser.positions.length === 0 && <div style={{ color: "#334155", fontSize: 12 }}>No open positions</div>}
                </div>
              </div>

              {/* Challenges */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Challenge History</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {selectedUser.challenges.map((ch) => (
                    <div key={ch.id} style={{ fontSize: 12, padding: "8px 10px", background: "#0F172A", borderRadius: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ color: "#94A3B8", fontWeight: 600 }}>{ch.stage}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: ch.status === "active" ? "#22C55E" : ch.status === "passed" ? "#3B82F6" : "#EF4444",
                        }}>{ch.status.toUpperCase()}</span>
                      </div>
                      <div style={{ color: "#475569" }}>
                        ${ch.startBalance} → ${ch.realizedBalance.toFixed(2)}
                      </div>
                    </div>
                  ))}
                  {selectedUser.challenges.length === 0 && <div style={{ color: "#334155", fontSize: 12 }}>No challenges</div>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
