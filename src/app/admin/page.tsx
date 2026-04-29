"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "adminKey";
const ATTEMPTS_KEY = "adminAttempts";
const BLOCKED_KEY = "adminBlockedUntil";
const MAX_ATTEMPTS = 3;
const BLOCK_MS = 5 * 60 * 1000;

type Section = "dashboard" | "users" | "challenges" | "trades" | "balance-logs" | "markets" | "plans" | "content" | "faq" | "reviews" | "leaderboard" | "payouts" | "system";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [blockLeft, setBlockLeft] = useState(0);

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
    const attempts = parseInt(sessionStorage.getItem(ATTEMPTS_KEY) ?? "0");
    // We validate by attempting an API call — store and let AdminDashboard handle 403
    sessionStorage.setItem(STORAGE_KEY, keyInput);
    sessionStorage.setItem(ATTEMPTS_KEY, String(attempts + 1));
    setAuthed(true);
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
  }

  if (!authed) return (
    <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "36px 32px", width: 360 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9", marginBottom: 6 }}>Admin Panel</div>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 24 }}>Enter admin key to continue</div>
        <input type="password" placeholder="Admin key" value={keyInput} onChange={(e) => setKeyInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()} disabled={blocked}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 8, boxSizing: "border-box", border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 14, outline: "none", marginBottom: 10 }} />
        {loginError && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 10 }}>{loginError}</div>}
        {blocked && <div style={{ color: "#F59E0B", fontSize: 12, marginBottom: 10 }}>Blocked. Try again in {blockLeft}s</div>}
        <button onClick={handleLogin} disabled={blocked} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: blocked ? "#334155" : "#22C55E", color: blocked ? "#64748B" : "#071A0E", fontWeight: 700, fontSize: 14, cursor: blocked ? "not-allowed" : "pointer" }}>Sign In</button>
      </div>
    </div>
  );

  return <AdminDashboard onInvalidKey={handleBlock} />;
}

// ─────────────────────────────────────────────────────────────
function AdminDashboard({ onInvalidKey }: { onInvalidKey: () => void }) {
  const [section, setSection] = useState<Section>("dashboard");
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const adminKey = sessionStorage.getItem(STORAGE_KEY) ?? "";

  async function apiFetch<T = unknown>(url: string, opts: RequestInit = {}): Promise<T> {
    const key = sessionStorage.getItem(STORAGE_KEY) ?? '';
    const res = await fetch(url, { ...opts, headers: { 'x-admin-key': key, 'Content-Type': 'application/json', ...opts.headers } });
    if (res.status === 403) { onInvalidKey(); throw new Error('Forbidden'); }
    return res.json();
  }

  const groups = [
    {
      key: "trading",
      label: "Trading",
      items: [
        { key: "challenges", label: "Challenges" },
        { key: "trades", label: "Trades" },
        { key: "balance-logs", label: "Balance Logs" },
        { key: "payouts", label: "Payouts" },
      ],
    },
    {
      key: "markets",
      label: "Markets",
      items: [{ key: "markets", label: "Markets" }],
    },
    {
      key: "users",
      label: "Users",
      items: [{ key: "users", label: "Users" }],
    },
    {
      key: "content",
      label: "Content",
      items: [
        { key: "plans", label: "Plans" },
        { key: "faq", label: "FAQ" },
        { key: "reviews", label: "Reviews" },
        { key: "leaderboard", label: "Leaderboard" },
        { key: "content", label: "Content" },
      ],
    },
    {
      key: "system",
      label: "System",
      items: [{ key: "system", label: "System" }],
    },
  ];

  function getActiveGroup() {
    for (const g of groups) {
      if (g.items.some(i => i.key === section)) return g.key;
    }
    return null;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <style>{`
        @media (max-width: 768px) {
          .admin-nav { display: none !important; }
          .admin-hamburger { display: flex !important; }
          .admin-mobile-menu { display: flex !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ background: "#1E293B", borderBottom: "1px solid #334155", padding: "0 24px", display: "flex", alignItems: "center", height: 52, position: "relative" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#22C55E", marginRight: 8 }}>Admin</span>
        <span style={{ fontSize: 14, color: "#475569", marginRight: "auto" }}>· FundedForecast</span>

        {/* Desktop nav */}
        <div className="admin-nav" style={{ display: "flex", alignItems: "center", height: 52 }}>
          <button onClick={() => { setSection("dashboard"); setOpenGroup(null); }} style={{
            padding: "0 16px", height: 52, border: "none", background: "transparent",
            color: section === "dashboard" ? "#F1F5F9" : "#475569",
            fontWeight: section === "dashboard" ? 700 : 500,
            fontSize: 13, cursor: "pointer",
            borderBottom: section === "dashboard" ? "2px solid #22C55E" : "2px solid transparent",
          }}>Dashboard</button>

          {groups.map(group => {
            const isActive = getActiveGroup() === group.key;
            const isOpen = openGroup === group.key;
            return (
              <div key={group.key} style={{ position: "relative", height: 52, display: "flex", alignItems: "center" }}
                onMouseEnter={() => setOpenGroup(group.key)}
                onMouseLeave={() => setOpenGroup(null)}>
                <button style={{
                  padding: "0 16px", height: 52, border: "none", background: "transparent",
                  color: isActive ? "#F1F5F9" : "#475569",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                  borderBottom: isActive ? "2px solid #22C55E" : "2px solid transparent",
                }}>
                  {group.label}
                  <span style={{ fontSize: 10, opacity: 0.5 }}>▾</span>
                </button>
                {isOpen && (
                  <div style={{
                    position: "absolute", top: 52, left: 0, zIndex: 100,
                    background: "#1E293B", border: "1px solid #334155", borderRadius: 8,
                    minWidth: 160, padding: "6px 0",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  }}>
                    {group.items.map(item => (
                      <button key={item.key} onClick={() => { setSection(item.key as Section); setOpenGroup(null); }} style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "9px 16px", border: "none", background: "transparent",
                        color: section === item.key ? "#22C55E" : "#94A3B8",
                        fontWeight: section === item.key ? 700 : 400,
                        fontSize: 13, cursor: "pointer",
                      }}>{item.label}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={() => { sessionStorage.clear(); window.location.reload(); }} style={{
            marginLeft: 16, padding: "6px 16px", borderRadius: 7,
            border: "1px solid #334155", background: "transparent",
            color: "#475569", fontSize: 13, cursor: "pointer",
          }}>Sign out</button>
        </div>

        {/* Mobile hamburger */}
        <button className="admin-hamburger" onClick={() => setOpenGroup(openGroup === "mobile" ? null : "mobile")} style={{
          display: "none", background: "transparent", border: "none",
          cursor: "pointer", padding: 4, flexDirection: "column", gap: 5,
        }}>
          <span style={{ width: 22, height: 2, background: "#F1F5F9", borderRadius: 2, display: "block" }} />
          <span style={{ width: 22, height: 2, background: "#F1F5F9", borderRadius: 2, display: "block" }} />
          <span style={{ width: 22, height: 2, background: "#F1F5F9", borderRadius: 2, display: "block" }} />
        </button>

        {/* Mobile dropdown */}
        {openGroup === "mobile" && (
          <div className="admin-mobile-menu" style={{
            position: "absolute", top: 52, left: 0, right: 0, zIndex: 200,
            background: "#1E293B", borderBottom: "1px solid #334155",
            padding: "8px 0", display: "none", flexDirection: "column",
          }}>
            <button onClick={() => { setSection("dashboard"); setOpenGroup(null); }} style={{
              padding: "10px 24px", border: "none", background: "transparent",
              color: "#F1F5F9", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left",
            }}>Dashboard</button>
            {groups.flatMap(g => g.items).map(item => (
              <button key={item.key} onClick={() => { setSection(item.key as Section); setOpenGroup(null); }} style={{
                padding: "10px 24px", border: "none", background: "transparent",
                color: section === item.key ? "#22C55E" : "#94A3B8",
                fontSize: 14, cursor: "pointer", textAlign: "left",
              }}>{item.label}</button>
            ))}
            <button onClick={() => { sessionStorage.clear(); window.location.reload(); }} style={{
              padding: "10px 24px", border: "none", background: "transparent",
              color: "#EF4444", fontSize: 14, cursor: "pointer", textAlign: "left",
            }}>Sign out</button>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "32px 24px", maxWidth: 1100, margin: "0 auto" }}>
        {section === "dashboard" && <DashboardSection apiFetch={apiFetch} />}
        {section === "users" && <UsersSection apiFetch={apiFetch} />}
        {section === "challenges" && <ChallengesSection apiFetch={apiFetch} />}
        {section === "trades" && <TradesSection apiFetch={apiFetch} />}
        {section === "balance-logs" && <BalanceLogsSection apiFetch={apiFetch} />}
        {section === "markets" && <MarketsSection apiFetch={apiFetch} />}
        {section === "plans" && <PlansSection apiFetch={apiFetch} />}
        {section === "content" && <ContentSection apiFetch={apiFetch} />}
        {section === "faq" && <FAQSection apiFetch={apiFetch} />}
        {section === "reviews" && <ReviewsSection apiFetch={apiFetch} />}
        {section === "leaderboard" && <LeaderboardSection apiFetch={apiFetch} />}
        {section === "payouts" && <PayoutsSection apiFetch={apiFetch} />}
        {section === "system" && <SystemSection apiFetch={apiFetch} adminKey={adminKey} />}
      </div>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────
const tableWrap: React.CSSProperties = { background: "#1E293B", border: "1px solid #334155", borderRadius: 12, overflow: "hidden", marginTop: 16 };
const thStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" };
const tdStyle: React.CSSProperties = { fontSize: 12, color: "#94A3B8", padding: "11px 16px" };
const SH = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, letterSpacing: "-0.02em" }}>{children}</div>;

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color, background: color + "18", border: `1px solid ${color}30`, borderRadius: 4, padding: "2px 8px" }}>{label.toUpperCase()}</span>;
}

function Btn({ label, bg, color = "#fff", onClick, loading }: { label: string; bg: string; color?: string; onClick: () => void; loading?: boolean }) {
  return (
    <button onClick={onClick} disabled={loading} style={{ padding: "4px 11px", borderRadius: 6, border: "none", background: loading ? "#334155" : bg, color: loading ? "#64748B" : color, fontSize: 11, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
      {loading ? "..." : label}
    </button>
  );
}

function fmt(date: string) { return new Date(date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

function ConfirmDialog({ title, message, onConfirm, onCancel }: { title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={onCancel}>
      <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: 28, width: 360, maxWidth: "90vw" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 24 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "7px 16px", borderRadius: 7, border: "1px solid #334155", background: "transparent", color: "#64748B", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => { onConfirm(); onCancel(); }} style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: "#EF4444", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DashboardSection({ apiFetch }: { apiFetch: (url: string) => Promise<any> }) {
  const [stats, setStats] = useState<{ usersCount: number; activeChallenges: number; tradesToday: number; systemPnl: number } | null>(null);
  useEffect(() => { apiFetch("/api/admin/stats").then((d) => d.success && setStats(d)); }, []);

  const cards = stats ? [
    { label: "Total Users", value: stats.usersCount, color: "#3B82F6" },
    { label: "Active Challenges", value: stats.activeChallenges, color: "#22C55E" },
    { label: "Trades Today", value: stats.tradesToday, color: "#F59E0B" },
    { label: "System PnL", value: `$${(stats.systemPnl ?? 0).toFixed(2)}`, color: (stats.systemPnl ?? 0) >= 0 ? "#22C55E" : "#EF4444" },
  ] : [];

  return (
    <div>
      <SH>Dashboard</SH>
      <div style={{ fontSize: 13, color: "#475569", marginBottom: 20 }}>Platform overview</div>
      {!stats ? <div style={{ color: "#475569" }}>Loading...</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {cards.map(({ label, value, color }) => (
            <div key={label} style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: "20px 22px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: "-0.03em" }}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Users ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function UsersSection({ apiFetch }: { apiFetch: (url: string, opts?: RequestInit) => Promise<any> }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const [detail, setDetail] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [assignPlan, setAssignPlan] = useState<{ userId: number; username: string } | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");

  const load = useCallback(async () => { setLoading(true); const d = await apiFetch("/api/admin/users"); if (d.success) setUsers(d.users); setLoading(false); }, []);
  useEffect(() => {
    load();
    apiFetch("/api/admin/plans").then((d: any) => { if (d.success) setPlans(d.plans); });
  }, []);

  async function action(userId: number, act: string) {
    setActionLoading(`${userId}-${act}`);
    await apiFetch(`/api/admin/users/${userId}/action`, { method: "POST", body: JSON.stringify({ action: act }) });
    await load();
    if (detail?.user?.id === userId) { const d = await apiFetch(`/api/admin/users/${userId}`); if (d.success) setDetail(d); }
    setActionLoading(null);
  }

  function confirmAction(title: string, message: string, fn: () => void) {
    setConfirm({ title, message, onConfirm: fn });
  }

  async function assignPlanToUser() {
    if (!assignPlan || !selectedPlanId) return;
    setActionLoading(`${assignPlan.userId}-assign`);
    await apiFetch(`/api/admin/users/${assignPlan.userId}/action`, {
      method: "POST",
      body: JSON.stringify({ action: "assign_plan", planId: parseInt(selectedPlanId) }),
    });
    setAssignPlan(null);
    setSelectedPlanId("");
    await load();
    setActionLoading(null);
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !q || u.email.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
    const matchM = modeFilter === "all" || u.mode === modeFilter;
    return matchQ && matchM;
  });

  return (
    <div>
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
      <SH>Users</SH>
      <div style={{ display: "flex", gap: 10, marginTop: 16, marginBottom: 4 }}>
        <input placeholder="Search email / username" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 12, outline: "none", width: 240 }} />
        {["all", "sandbox", "challenge"].map(m => (
          <button key={m} onClick={() => setModeFilter(m)} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #334155", background: modeFilter === m ? "#334155" : "transparent", color: modeFilter === m ? "#F1F5F9" : "#475569", fontSize: 12, cursor: "pointer", textTransform: "capitalize" }}>{m}</button>
        ))}
      </div>
      <div style={tableWrap}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 2fr", padding: "9px 16px", borderBottom: "1px solid #334155", background: "rgba(255,255,255,0.02)" }}>
          {["Email", "Username", "Mode", "Balance", "Actions"].map(h => <div key={h} style={thStyle}>{h}</div>)}
        </div>
        {loading ? <div style={{ padding: 32, textAlign: "center", color: "#475569" }}>Loading...</div> :
          filtered.map((u, i) => (
            <div key={u.id} onClick={() => setDetail(null)} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 2fr", padding: "11px 16px", alignItems: "center", borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", cursor: "pointer" }}>
              <div style={tdStyle}>{u.email}</div>
              <div style={{ ...tdStyle, color: "#F1F5F9", fontWeight: 500 }}>@{u.username}</div>
              <div style={tdStyle}><Badge label={u.mode} color={u.mode === "challenge" ? "#22C55E" : "#64748B"} /></div>
              <div style={{ ...tdStyle, color: "#22C55E", fontWeight: 700 }}>${u.currentBalance.toFixed(2)}</div>
              <div style={{ display: "flex", gap: 5, padding: "0 16px", flexWrap: "wrap", alignItems: "center" }} onClick={e => e.stopPropagation()}>
                <Btn label="View" bg="#1E293B" color="#94A3B8" onClick={async () => { const d = await apiFetch(`/api/admin/users/${u.id}`); if (d.success) setDetail(d); }} />
                {u.mode === "sandbox" && <Btn label="Start" bg="#3B82F6" onClick={() => action(u.id, "start_challenge")} loading={actionLoading === `${u.id}-start_challenge`} />}
                {u.mode === "challenge" && <Btn label="Fail" bg="#EF4444" onClick={() => confirmAction("Fail Challenge", "This will permanently fail the user's active challenge. Are you sure?", () => action(u.id, "fail_challenge"))} loading={actionLoading === `${u.id}-fail_challenge`} />}
                {u.mode === "challenge" && <Btn label="Pass" bg="#22C55E" color="#071A0E" onClick={() => confirmAction("Pass Challenge", "This will mark the challenge as passed. Are you sure?", () => action(u.id, "pass_challenge"))} loading={actionLoading === `${u.id}-pass_challenge`} />}
                <Btn label="Reset" bg="#334155" color="#94A3B8" onClick={() => confirmAction("Reset Balance", "This will reset the user's balance to $10,000. Are you sure?", () => action(u.id, "reset_balance"))} loading={actionLoading === `${u.id}-reset_balance`} />
                <Btn label="Assign Plan" bg="#8B5CF6" color="#fff" onClick={() => { setAssignPlan({ userId: u.id, username: u.username }); setSelectedPlanId(""); }} />
              </div>
            </div>
          ))
        }
      </div>

      {assignPlan && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: 28, width: 380 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9", marginBottom: 6 }}>Assign Plan</div>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 20 }}>@{assignPlan.username}</div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Select Plan</div>
              <select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 14 }}>
                <option value="">— Select plan —</option>
                {plans.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} — ${p.accountSize.toLocaleString()} (${p.price})</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 20 }}>
              This will create a new active challenge for this user without payment. Existing active challenge will be replaced.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={assignPlanToUser} disabled={!selectedPlanId || actionLoading !== null} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: selectedPlanId ? "#8B5CF6" : "#334155", color: selectedPlanId ? "#fff" : "#475569", fontWeight: 700, fontSize: 13, cursor: selectedPlanId ? "pointer" : "not-allowed" }}>
                {actionLoading ? "Assigning..." : "Assign Plan"}
              </button>
              <button onClick={() => setAssignPlan(null)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#94A3B8", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div style={{ marginTop: 20, background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>{detail.user.firstName} {detail.user.lastName} · <span style={{ color: "#475569", fontWeight: 400 }}>@{detail.user.username}</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
            <div>
              <div style={{ ...thStyle, marginBottom: 10 }}>Recent Logs</div>
              {detail.balanceLogs.slice(0, 10).map((l: any) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "5px 8px", background: "#0F172A", borderRadius: 5, marginBottom: 3 }}>
                  <span style={{ color: "#64748B" }}>{l.type}</span>
                  <span style={{ color: l.amount >= 0 ? "#22C55E" : "#EF4444", fontWeight: 600 }}>{l.amount >= 0 ? "+" : ""}${l.amount.toFixed(2)}</span>
                  <span style={{ color: "#475569" }}>${l.runningBalance.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ ...thStyle, marginBottom: 10 }}>Open Positions</div>
              {detail.positions.length === 0 ? <div style={{ fontSize: 12, color: "#334155" }}>None</div> :
                detail.positions.map((p: any) => (
                  <div key={p.id} style={{ fontSize: 11, padding: "6px 8px", background: "#0F172A", borderRadius: 5, marginBottom: 3 }}>
                    <div style={{ color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.market.title}</div>
                    <span style={{ color: p.side === "yes" ? "#22C55E" : "#EF4444", fontWeight: 700 }}>{p.side.toUpperCase()}</span>{" "}{p.shares} @ {(p.avgPrice * 100).toFixed(0)}¢
                  </div>
                ))}
            </div>
            <div>
              <div style={{ ...thStyle, marginBottom: 10 }}>Challenges</div>
              {detail.challenges.length === 0 ? <div style={{ fontSize: 12, color: "#334155" }}>None</div> :
                detail.challenges.map((c: any) => (
                  <div key={c.id} style={{ fontSize: 11, padding: "6px 8px", background: "#0F172A", borderRadius: 5, marginBottom: 3 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#94A3B8" }}>{c.stage}</span><Badge label={c.status} color={c.status === "active" ? "#22C55E" : c.status === "passed" ? "#3B82F6" : "#EF4444"} /></div>
                    <div style={{ color: "#475569" }}>${c.startBalance} → ${c.realizedBalance.toFixed(2)}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Challenges ───────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChallengesSection({ apiFetch }: { apiFetch: (url: string, opts?: RequestInit) => Promise<any> }) {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const load = useCallback(async (s: string) => {
    setLoading(true);
    const url = s === "all" ? "/api/admin/challenges" : `/api/admin/challenges?status=${s}`;
    const d = await apiFetch(url);
    if (d.success) setChallenges(d.challenges);
    setLoading(false);
  }, []);

  useEffect(() => { load(filter); }, [filter]);

  async function action(id: number, userId: number, act: string) {
    setActionLoading(`${id}-${act}`);
    await apiFetch(`/api/admin/users/${userId}/action`, { method: "POST", body: JSON.stringify({ action: act }) });
    await load(filter);
    setActionLoading(null);
  }

  function confirmAction(title: string, message: string, fn: () => void) {
    setConfirm({ title, message, onConfirm: fn });
  }

  return (
    <div>
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
      <SH>Challenges</SH>
      <div style={{ display: "flex", gap: 6, marginTop: 16, marginBottom: 4 }}>
        {["all", "active", "passed", "failed"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #334155", background: filter === f ? "#334155" : "transparent", color: filter === f ? "#F1F5F9" : "#475569", fontSize: 12, cursor: "pointer", textTransform: "capitalize" }}>{f}</button>
        ))}
      </div>
      <div style={tableWrap}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr", padding: "9px 16px", borderBottom: "1px solid #334155", background: "rgba(255,255,255,0.02)" }}>
          {["User", "Stage", "Status", "Start Bal", "Current Bal", "Started", "Actions"].map(h => <div key={h} style={thStyle}>{h}</div>)}
        </div>
        {loading ? <div style={{ padding: 32, textAlign: "center", color: "#475569" }}>Loading...</div> :
          challenges.map((c, i) => (
            <div key={c.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr", padding: "10px 16px", alignItems: "center", borderBottom: i < challenges.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div style={tdStyle}>{c.user.email}</div>
              <div style={tdStyle}>{c.stage}</div>
              <div style={tdStyle}><Badge label={c.status} color={c.status === "active" ? "#22C55E" : c.status === "passed" ? "#3B82F6" : "#EF4444"} /></div>
              <div style={{ ...tdStyle, color: "#F1F5F9" }}>${c.startBalance}</div>
              <div style={{ ...tdStyle, color: "#22C55E", fontWeight: 700 }}>${c.realizedBalance.toFixed(2)}</div>
              <div style={{ ...tdStyle, fontSize: 11 }}>{fmt(c.createdAt ?? c.startedAt)}</div>
              <div style={{ display: "flex", gap: 5, padding: "0 16px" }}>
                {c.status === "active" && <Btn label="Fail" bg="#EF4444" onClick={() => confirmAction("Fail Challenge", "This will permanently fail the user's active challenge. Are you sure?", () => action(c.id, c.userId, "fail_challenge"))} loading={actionLoading === `${c.id}-fail_challenge`} />}
                {c.status === "active" && <Btn label="Pass" bg="#22C55E" color="#071A0E" onClick={() => confirmAction("Pass Challenge", "This will mark the challenge as passed. Are you sure?", () => action(c.id, c.userId, "pass_challenge"))} loading={actionLoading === `${c.id}-pass_challenge`} />}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Trades ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TradesSection({ apiFetch }: { apiFetch: (url: string) => Promise<any> }) {
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { apiFetch("/api/admin/trades").then(d => { if (d.success) setTrades(d.trades); setLoading(false); }); }, []);

  return (
    <div>
      <SH>Trades</SH>
      <div style={tableWrap}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr 1fr 1fr", padding: "9px 16px", borderBottom: "1px solid #334155", background: "rgba(255,255,255,0.02)" }}>
          {["User", "Market", "Side", "Action", "Amount", "Price", "Date"].map(h => <div key={h} style={thStyle}>{h}</div>)}
        </div>
        {loading ? <div style={{ padding: 32, textAlign: "center", color: "#475569" }}>Loading...</div> :
          trades.map((t, i) => (
            <div key={t.id} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr 1fr 1fr", padding: "9px 16px", alignItems: "center", borderBottom: i < trades.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div style={tdStyle}>{t.user?.email ?? "-"}</div>
              <div style={{ ...tdStyle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.market?.title ?? t.marketId}</div>
              <div style={tdStyle}><Badge label={t.side} color={t.side === "yes" ? "#22C55E" : "#EF4444"} /></div>
              <div style={tdStyle}>{t.action}</div>
              <div style={tdStyle}>{t.amount}</div>
              <div style={tdStyle}>{(t.price * 100).toFixed(0)}¢</div>
              <div style={{ ...tdStyle, fontSize: 11 }}>{fmt(t.createdAt)}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Balance Logs ─────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BalanceLogsSection({ apiFetch }: { apiFetch: (url: string) => Promise<any> }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { apiFetch("/api/admin/balance-logs").then(d => { if (d.success) setLogs(d.logs); setLoading(false); }); }, []);

  return (
    <div>
      <SH>Balance Logs</SH>
      <div style={tableWrap}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "9px 16px", borderBottom: "1px solid #334155", background: "rgba(255,255,255,0.02)" }}>
          {["User", "Type", "Amount", "Running Balance", "Date"].map(h => <div key={h} style={thStyle}>{h}</div>)}
        </div>
        {loading ? <div style={{ padding: 32, textAlign: "center", color: "#475569" }}>Loading...</div> :
          logs.map((l, i) => (
            <div key={l.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "9px 16px", alignItems: "center", borderBottom: i < logs.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div style={tdStyle}>{l.user?.email ?? "-"}</div>
              <div style={tdStyle}>{l.type}</div>
              <div style={{ ...tdStyle, color: l.amount >= 0 ? "#22C55E" : "#EF4444", fontWeight: 700 }}>{l.amount >= 0 ? "+" : ""}${l.amount.toFixed(2)}</div>
              <div style={{ ...tdStyle, color: "#F1F5F9" }}>${l.runningBalance.toFixed(2)}</div>
              <div style={{ ...tdStyle, fontSize: 11 }}>{fmt(l.createdAt)}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Markets ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MarketsSection({ apiFetch }: { apiFetch: (url: string, opts?: RequestInit) => Promise<any> }) {
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveModal, setResolveModal] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await fetch("/api/markets?limit=100").then(r => r.json());
    if (d.success) setMarkets(d.markets);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  async function marketAction(id: string, action: string, winningOutcome?: string) {
    setActionLoading(`${id}-${action}`);
    await apiFetch(`/api/admin/markets/${id}/action`, { method: "POST", body: JSON.stringify({ action, winningOutcome }) });
    await load();
    setResolveModal(null);
    setActionLoading(null);
  }

  return (
    <div>
      <SH>Markets</SH>
      <div style={tableWrap}>
        <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr 1fr 2fr", padding: "9px 16px", borderBottom: "1px solid #334155", background: "rgba(255,255,255,0.02)" }}>
          {["Title", "Category", "YES", "NO", "Status", "Actions"].map(h => <div key={h} style={thStyle}>{h}</div>)}
        </div>
        {loading ? <div style={{ padding: 32, textAlign: "center", color: "#475569" }}>Loading...</div> :
          markets.map((m, i) => (
            <div key={m.id} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr 1fr 2fr", padding: "9px 16px", alignItems: "center", borderBottom: i < markets.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div style={{ ...tdStyle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</div>
              <div style={tdStyle}>{m.category}</div>
              <div style={{ ...tdStyle, color: "#22C55E", fontWeight: 700 }}>{(m.yesPrice * 100).toFixed(0)}¢</div>
              <div style={{ ...tdStyle, color: "#EF4444", fontWeight: 700 }}>{(m.noPrice * 100).toFixed(0)}¢</div>
              <div style={tdStyle}><Badge label={m.status} color={m.status === "live" ? "#22C55E" : m.status === "resolved" ? "#3B82F6" : "#64748B"} /></div>
              <div style={{ display: "flex", gap: 5, padding: "0 16px" }}>
                {m.status === "live" && <Btn label="Disable" bg="#334155" color="#94A3B8" onClick={() => marketAction(m.id, "disable")} loading={actionLoading === `${m.id}-disable`} />}
                {m.status === "live" && <Btn label="Force Resolve" bg="#F59E0B" color="#071A0E" onClick={() => setResolveModal(m.id)} />}
              </div>
            </div>
          ))}
      </div>

      {resolveModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setResolveModal(null)}>
          <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 12, padding: 28, width: 320 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, marginBottom: 16 }}>Force Resolve</div>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 20 }}>Select winning outcome:</div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn label="YES wins" bg="#22C55E" color="#071A0E" onClick={() => marketAction(resolveModal, "force_resolve", "yes")} loading={actionLoading === `${resolveModal}-force_resolve`} />
              <Btn label="NO wins" bg="#EF4444" onClick={() => marketAction(resolveModal, "force_resolve", "no")} loading={actionLoading === `${resolveModal}-force_resolve`} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Plans ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PlansSection({ apiFetch }: { apiFetch: (url: string, opts?: RequestInit) => Promise<any> }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<string, string | number | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: "", price: "", accountSize: "", profitTargetPct: "10", maxLossPct: "10", dailyLossPct: "5", maxPositionSizePct: "2", minTradingDays: "10", order: "" });
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const load = useCallback(async () => { setLoading(true); const d = await apiFetch("/api/admin/plans"); if (d.success) setPlans(d.plans); setLoading(false); }, []);
  useEffect(() => { load(); }, []);

  function startEdit(p: any) {
    setEditId(p.id);
    setEditData({ name: p.name, price: p.price, accountSize: p.accountSize, profitTargetPct: p.profitTargetPct, maxLossPct: p.maxLossPct, dailyLossPct: p.dailyLossPct, maxPositionSizePct: p.maxPositionSizePct, minTradingDays: p.minTradingDays, isPopular: p.isPopular, isActive: p.isActive, order: p.order });
  }

  async function saveEdit() {
    if (!editId) return;
    setSaving(true);
    await apiFetch(`/api/admin/plans/${editId}`, { method: "PUT", body: JSON.stringify(editData) });
    setSaving(false); setEditId(null); load();
  }

  async function deactivate(id: number) {
    await apiFetch(`/api/admin/plans/${id}`, { method: "DELETE" });
    load();
  }

  async function addPlan() {
    setSaving(true);
    await apiFetch("/api/admin/plans", { method: "POST", body: JSON.stringify({
      name: newPlan.name, price: Number(newPlan.price), accountSize: Number(newPlan.accountSize),
      profitTargetPct: Number(newPlan.profitTargetPct), maxLossPct: Number(newPlan.maxLossPct),
      dailyLossPct: Number(newPlan.dailyLossPct), maxPositionSizePct: Number(newPlan.maxPositionSizePct),
      minTradingDays: Number(newPlan.minTradingDays), order: Number(newPlan.order) || 0,
    }) });
    setSaving(false); setShowAdd(false);
    setNewPlan({ name: "", price: "", accountSize: "", profitTargetPct: "10", maxLossPct: "10", dailyLossPct: "5", maxPositionSizePct: "2", minTradingDays: "10", order: "" });
    load();
  }

  const inpS: React.CSSProperties = { padding: "4px 8px", borderRadius: 5, border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 11, outline: "none", width: "100%" };

  return (
    <div>
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <SH>Plans</SH>
        <Btn label="+ Add Plan" bg="#22C55E" color="#071A0E" onClick={() => setShowAdd(true)} />
      </div>

      {showAdd && (
        <div style={{ background: "#1E293B", border: "1px solid #22C55E", borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#22C55E", marginBottom: 12 }}>New Plan</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
            {(["name", "price", "accountSize", "order"] as const).map(f => (
              <div key={f}><div style={{ fontSize: 10, color: "#475569", marginBottom: 3, textTransform: "capitalize" }}>{f}</div>
              <input style={inpS} value={newPlan[f]} onChange={e => setNewPlan(p => ({ ...p, [f]: e.target.value }))} /></div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
            {(["profitTargetPct", "maxLossPct", "dailyLossPct", "maxPositionSizePct", "minTradingDays"] as const).map(f => (
              <div key={f}><div style={{ fontSize: 10, color: "#475569", marginBottom: 3, textTransform: "capitalize" }}>{f}</div>
              <input style={inpS} value={newPlan[f]} onChange={e => setNewPlan(p => ({ ...p, [f]: e.target.value }))} /></div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn label="Save" bg="#22C55E" color="#071A0E" onClick={addPlan} loading={saving} />
            <Btn label="Cancel" bg="#334155" color="#94A3B8" onClick={() => setShowAdd(false)} />
          </div>
        </div>
      )}

      <div style={tableWrap}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1.5fr 1fr 1fr 1fr 1fr 1fr 2fr", padding: "9px 16px", borderBottom: "1px solid #334155", background: "rgba(255,255,255,0.02)" }}>
          {["Name", "Price", "Account Size", "Profit%", "Max Loss%", "Daily Loss%", "Popular", "Active", "Actions"].map(h => <div key={h} style={thStyle}>{h}</div>)}
        </div>
        {loading ? <div style={{ padding: 32, textAlign: "center", color: "#475569" }}>Loading...</div> :
          plans.map((p, i) => editId === p.id ? (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1.5fr 1fr 1fr 1fr 1fr 1fr 2fr", padding: "8px 16px", alignItems: "center", gap: 4, borderBottom: "1px solid #22C55E40", background: "rgba(34,197,94,0.04)" }}>
              <input style={inpS} value={String(editData.name)} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} />
              <input style={inpS} value={String(editData.price)} onChange={e => setEditData(d => ({ ...d, price: Number(e.target.value) }))} />
              <input style={inpS} value={String(editData.accountSize)} onChange={e => setEditData(d => ({ ...d, accountSize: Number(e.target.value) }))} />
              <input style={inpS} value={String(editData.profitTargetPct)} onChange={e => setEditData(d => ({ ...d, profitTargetPct: Number(e.target.value) }))} />
              <input style={inpS} value={String(editData.maxLossPct)} onChange={e => setEditData(d => ({ ...d, maxLossPct: Number(e.target.value) }))} />
              <input style={inpS} value={String(editData.dailyLossPct)} onChange={e => setEditData(d => ({ ...d, dailyLossPct: Number(e.target.value) }))} />
              <select style={{ ...inpS }} value={String(editData.isPopular)} onChange={e => setEditData(d => ({ ...d, isPopular: e.target.value === "true" }))}><option value="true">Yes</option><option value="false">No</option></select>
              <select style={{ ...inpS }} value={String(editData.isActive)} onChange={e => setEditData(d => ({ ...d, isActive: e.target.value === "true" }))}><option value="true">Yes</option><option value="false">No</option></select>
              <div style={{ display: "flex", gap: 5 }}>
                <Btn label="Save" bg="#22C55E" color="#071A0E" onClick={saveEdit} loading={saving} />
                <Btn label="Cancel" bg="#334155" color="#94A3B8" onClick={() => setEditId(null)} />
              </div>
            </div>
          ) : (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1.5fr 1fr 1fr 1fr 1fr 1fr 2fr", padding: "9px 16px", alignItems: "center", borderBottom: i < plans.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div style={{ ...tdStyle, color: "#F1F5F9", fontWeight: 600 }}>{p.name}</div>
              <div style={{ ...tdStyle, color: "#22C55E", fontWeight: 700 }}>${p.price}</div>
              <div style={{ ...tdStyle }}>${p.accountSize.toLocaleString()}</div>
              <div style={tdStyle}>{p.profitTargetPct}%</div>
              <div style={tdStyle}>{p.maxLossPct}%</div>
              <div style={tdStyle}>{p.dailyLossPct}%</div>
              <div style={tdStyle}><Badge label={p.isPopular ? "Yes" : "No"} color={p.isPopular ? "#22C55E" : "#64748B"} /></div>
              <div style={tdStyle}><Badge label={p.isActive ? "Yes" : "No"} color={p.isActive ? "#22C55E" : "#EF4444"} /></div>
              <div style={{ display: "flex", gap: 5, padding: "0 16px" }}>
                <Btn label="Edit" bg="#3B82F6" onClick={() => startEdit(p)} />
                {p.isActive && <Btn label="Deactivate" bg="#334155" color="#94A3B8" onClick={() => setConfirm({ title: "Deactivate Plan", message: `Deactivate "${p.name}"? It will no longer be shown to users.`, onConfirm: () => deactivate(p.id) })} />}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

const PLAIN_INPUT_KEYS = ["hero_title", "hero_subtitle", "cta_text"];
const JSON_BLOCK_KEYS_PREFIX = ["feature_", "how_it_works_"];

function isJsonBlockKey(key: string) {
  return JSON_BLOCK_KEYS_PREFIX.some(p => key.startsWith(p));
}

function parseJsonBlock(value: string): { title: string; desc: string } {
  try { const p = JSON.parse(value); return { title: p.title ?? "", desc: p.desc ?? "" }; } catch { return { title: value, desc: "" }; }
}

// ─── Content ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ContentSection({ apiFetch }: { apiFetch: (url: string, opts?: RequestInit) => Promise<any> }) {
  const [blocks, setBlocks] = useState<{ key: string; value: string }[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/admin/content").then(d => {
      if (d.success) { setBlocks(d.blocks); const e: Record<string, string> = {}; d.blocks.forEach((b: { key: string; value: string }) => { e[b.key] = b.value; }); setEdits(e); }
    });
  }, []);

  async function save(key: string) {
    setSaving(key);
    await apiFetch("/api/admin/content", { method: "POST", body: JSON.stringify({ key, value: edits[key] }) });
    setSaving(null); setSaved(key); setTimeout(() => setSaved(null), 2000);
  }

  function saveBtn(key: string) {
    return (
      <button onClick={() => save(key)} disabled={saving === key} style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: saved === key ? "#22C55E" : "#334155", color: saved === key ? "#071A0E" : "#94A3B8", fontSize: 12, fontWeight: 700, cursor: saving === key ? "not-allowed" : "pointer", flexShrink: 0 }}>
        {saving === key ? "..." : saved === key ? "Saved ✓" : "Save"}
      </button>
    );
  }

  const inputStyle: React.CSSProperties = { flex: 1, padding: "8px 10px", borderRadius: 7, border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 12, outline: "none" };

  return (
    <div>
      <SH>Content</SH>
      <div style={{ fontSize: 13, color: "#475569", marginTop: 4, marginBottom: 16 }}>Edit landing page content blocks</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {blocks.map(({ key }) => {
          const isPlain = PLAIN_INPUT_KEYS.includes(key);
          const isJson = isJsonBlockKey(key);
          const parsed = isJson ? parseJsonBlock(edits[key] ?? "") : null;

          return (
            <div key={key} style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 10, padding: "14px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{key}</div>
              {isPlain && (
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input value={edits[key] ?? ""} onChange={e => setEdits(p => ({ ...p, [key]: e.target.value }))}
                    style={{ ...inputStyle, width: "100%" }} />
                  {saveBtn(key)}
                </div>
              )}
              {isJson && parsed && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input placeholder="Title" value={parsed.title} onChange={e => {
                    const next = JSON.stringify({ title: e.target.value, desc: parsed.desc });
                    setEdits(p => ({ ...p, [key]: next }));
                  }} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <textarea placeholder="Description" value={parsed.desc} onChange={e => {
                      const next = JSON.stringify({ title: parsed.title, desc: e.target.value });
                      setEdits(p => ({ ...p, [key]: next }));
                    }} rows={2} style={{ ...inputStyle, flex: 1, resize: "vertical", fontFamily: "inherit" }} />
                    {saveBtn(key)}
                  </div>
                </div>
              )}
              {!isPlain && !isJson && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <textarea value={edits[key] ?? ""} onChange={e => setEdits(p => ({ ...p, [key]: e.target.value }))} rows={2}
                    style={{ ...inputStyle, flex: 1, resize: "vertical", fontFamily: "monospace" }} />
                  {saveBtn(key)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legal pages */}
      <div style={{ marginTop: 40, borderTop: "1px solid #1E293B", paddingTop: 32 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 20 }}>Legal Pages</div>
        {[
          { key: "terms_content", label: "Terms of Use" },
          { key: "privacy_content", label: "Privacy Policy" },
          { key: "risk_content", label: "Risk Disclosure" },
        ].map(({ key, label }) => (
          <div key={key} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
            <textarea
              value={edits[key] ?? ""}
              onChange={e => setEdits(p => ({ ...p, [key]: e.target.value }))}
              rows={10}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 13, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }}
            />
            <button onClick={() => save(key)} style={{ marginTop: 8, padding: "7px 20px", borderRadius: 6, border: "none", background: "#22C55E", color: "#071A0E", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Save</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── System ───────────────────────────────────────────────────
function SystemSection({ apiFetch, adminKey }: { apiFetch: (url: string, opts?: RequestInit) => Promise<unknown>; adminKey: string }) {
  const [results, setResults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [syncMarketsResult, setSyncMarketsResult] = useState<string>("");

  async function syncMarkets() {
    setSyncMarketsResult("Syncing batch 1/5...");
    try {
      let totalCreated = 0, totalUpdated = 0, totalSkipped = 0;
      for (let i = 0; i < 5; i++) {
        setSyncMarketsResult(`Syncing batch ${i + 1}/5...`);
        const data = await apiFetch("/api/admin/sync-markets", {
          method: "POST",
          body: JSON.stringify({ offset: i * 30 }),
        });
        const d = data as any;
        totalCreated += d.created ?? 0;
        totalUpdated += d.updated ?? 0;
        totalSkipped += d.skipped ?? 0;
        if (i < 4) await new Promise(r => setTimeout(r, 2000));
      }
      setSyncMarketsResult(JSON.stringify({ success: true, created: totalCreated, updated: totalUpdated, skipped: totalSkipped, total: totalCreated + totalUpdated + totalSkipped }, null, 2));
    } catch (e) {
      setSyncMarketsResult("Error: " + String(e));
    }
  }

  async function run(label: string, url: string) {
    setLoading(label);
    try {
      const res = await fetch(url, { method: "POST", headers: { "x-admin-key": adminKey } });
      const d = await res.json();
      setResults(p => ({ ...p, [label]: JSON.stringify(d, null, 2) }));
    } catch (e) {
      setResults(p => ({ ...p, [label]: String(e) }));
    } finally {
      setLoading(null);
    }
  }

  const actions = [
    { label: "Sync Prices", url: "/api/admin/sync-prices" },
    { label: "Run Resolve", url: "/api/admin/resolve-markets" },
  ];

  return (
    <div>
      <SH>System</SH>
      <div style={{ fontSize: 13, color: "#475569", marginTop: 4, marginBottom: 20 }}>Admin system actions</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: syncMarketsResult ? 12 : 0 }}>
            <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>Sync Markets</div>
            <button onClick={syncMarkets} disabled={syncMarketsResult.startsWith("Syncing batch")} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #334155", background: "#334155", color: syncMarketsResult.startsWith("Syncing batch") ? "#64748B" : "#94A3B8", fontSize: 12, fontWeight: 600, cursor: syncMarketsResult.startsWith("Syncing batch") ? "not-allowed" : "pointer" }}>
              {syncMarketsResult.startsWith("Syncing batch") ? `⏳ ${syncMarketsResult}` : "Sync Markets"}
            </button>
          </div>
          {syncMarketsResult && !syncMarketsResult.startsWith("Syncing batch") && (
            <pre style={{ fontSize: 11, color: "#64748B", background: "#0F172A", padding: "8px 10px", borderRadius: 6, overflow: "auto", margin: 0 }}>
              {syncMarketsResult}
            </pre>
          )}
        </div>
        {actions.map(({ label, url }) => (
          <div key={label} style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: results[label] ? 12 : 0 }}>
              <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{label}</div>
              <Btn label={label} bg="#334155" color="#94A3B8" onClick={() => run(label, url)} loading={loading === label} />
            </div>
            {results[label] && (
              <pre style={{ fontSize: 11, color: "#64748B", background: "#0F172A", padding: "8px 10px", borderRadius: 6, overflow: "auto", margin: 0 }}>
                {results[label]}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Reviews ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReviewsSection({ apiFetch }: { apiFetch: (url: string, opts?: RequestInit) => Promise<any> }) {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", role: "", avatar: "", text: "", rating: 5, order: 0 });
  const [editing, setEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "", avatar: "", text: "", rating: 5, order: 0, isActive: true });

  const load = useCallback(async () => {
    const data = await apiFetch("/api/admin/reviews");
    setItems(data);
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!form.name || !form.text) return;
    await apiFetch("/api/admin/reviews", { method: "POST", body: JSON.stringify(form) });
    setForm({ name: "", role: "", avatar: "", text: "", rating: 5, order: 0 });
    load();
  }

  async function save(id: number) {
    await apiFetch(`/api/admin/reviews/${id}`, { method: "PUT", body: JSON.stringify(editForm) });
    setEditing(null);
    load();
  }

  async function remove(id: number) {
    await apiFetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
    load();
  }

  function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
    return (
      <div style={{ display: "flex", gap: 4 }}>
        {[1,2,3,4,5].map(i => (
          <span key={i} onClick={() => onChange?.(i)} style={{ fontSize: 20, cursor: onChange ? "pointer" : "default", color: i <= value ? "#22C55E" : "#334155" }}>★</span>
        ))}
      </div>
    );
  }

  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 13, boxSizing: "border-box" };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#F1F5F9", marginBottom: 4 }}>Reviews</div>
      <div style={{ fontSize: 13, color: "#475569", marginBottom: 24 }}>Manage reviews shown on the landing page</div>

      {/* Add form */}
      <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>Add new review</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          <input placeholder="Role (e.g. Crypto Trader)" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={inputStyle} />
        </div>
        <input placeholder="Avatar URL (optional)" value={form.avatar} onChange={e => setForm({ ...form, avatar: e.target.value })} style={{ ...inputStyle, marginBottom: 8 }} />
        <textarea placeholder="Review text" value={form.text} onChange={e => setForm({ ...form, text: e.target.value })}
          rows={3} style={{ ...inputStyle, marginBottom: 8, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }} />
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Stars value={form.rating} onChange={v => setForm({ ...form, rating: v })} />
          <input type="number" placeholder="Order" value={form.order} onChange={e => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
            style={{ ...inputStyle, width: 80 }} />
          <button onClick={create} style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "#22C55E", color: "#071A0E", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Add</button>
        </div>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map(item => editing === item.id ? (
          <div key={item.id} style={{ background: "#1E293B", border: "1px solid #22C55E", borderRadius: 10, padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={inputStyle} />
              <input value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} style={inputStyle} />
            </div>
            <input value={editForm.avatar} onChange={e => setEditForm({ ...editForm, avatar: e.target.value })} style={{ ...inputStyle, marginBottom: 8 }} />
            <textarea value={editForm.text} onChange={e => setEditForm({ ...editForm, text: e.target.value })}
              rows={3} style={{ ...inputStyle, marginBottom: 8, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }} />
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <Stars value={editForm.rating} onChange={v => setEditForm({ ...editForm, rating: v })} />
              <input type="number" value={editForm.order} onChange={e => setEditForm({ ...editForm, order: parseInt(e.target.value) || 0 })}
                style={{ ...inputStyle, width: 80 }} />
              <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#94A3B8", fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })} />
                Active
              </label>
              <button onClick={() => save(item.id)} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#22C55E", color: "#071A0E", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Save</button>
              <button onClick={() => setEditing(null)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #334155", background: "transparent", color: "#94A3B8", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div key={item.id} style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, flex: 1 }}>
              {item.avatar ? (
                <img src={item.avatar} alt={item.name} style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#22C55E,#16A34A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#071A0E", flexShrink: 0 }}>{item.name.charAt(0)}</div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: item.isActive ? "#F1F5F9" : "#475569" }}>{item.name}</span>
                  <span style={{ fontSize: 12, color: "#475569" }}>{item.role}</span>
                  <Stars value={item.rating} />
                </div>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{item.text}</div>
                <div style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>order: {item.order} · {item.isActive ? "active" : "hidden"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => { setEditing(item.id); setEditForm({ name: item.name, role: item.role, avatar: item.avatar, text: item.text, rating: item.rating, order: item.order, isActive: item.isActive }); }}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #334155", background: "transparent", color: "#94A3B8", fontSize: 12, cursor: "pointer" }}>Edit</button>
              <button onClick={() => remove(item.id)}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#EF4444", fontSize: 12, cursor: "pointer" }}>Hide</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FAQSection({ apiFetch }: { apiFetch: (url: string, opts?: RequestInit) => Promise<any> }) {
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState<"platform" | "rules">("platform");
  const [form, setForm] = useState({ question: "", answer: "", order: 0 });
  const [editing, setEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ question: "", answer: "", order: 0, isActive: true });

  const load = useCallback(async () => {
    const data = await apiFetch("/api/admin/faq");
    if (Array.isArray(data)) setItems(data);
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((i) => i.category === tab);

  async function create() {
    if (!form.question || !form.answer) return;
    await apiFetch("/api/admin/faq", { method: "POST", body: JSON.stringify({ ...form, category: tab }) });
    setForm({ question: "", answer: "", order: 0 });
    load();
  }

  async function save(id: number) {
    await apiFetch(`/api/admin/faq/${id}`, { method: "PUT", body: JSON.stringify(editForm) });
    setEditing(null);
    load();
  }

  async function remove(id: number) {
    await apiFetch(`/api/admin/faq/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#F1F5F9", marginBottom: 4 }}>FAQ</div>
      <div style={{ fontSize: 13, color: "#475569", marginBottom: 24 }}>Manage FAQ items for the landing page</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["platform", "rules"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "6px 18px", borderRadius: 8, border: "1px solid",
            borderColor: tab === t ? "#22C55E" : "#334155",
            background: tab === t ? "rgba(34,197,94,0.1)" : "transparent",
            color: tab === t ? "#22C55E" : "#475569", cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}>{t === "platform" ? "Our Platform" : "Challenge Rules"}</button>
        ))}
      </div>

      <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>Add new</div>
        <input placeholder="Question" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })}
          style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
        <textarea placeholder="Answer" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })}
          rows={3} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 13, marginBottom: 8, boxSizing: "border-box", resize: "vertical" }} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="number" placeholder="Order" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
            style={{ width: 80, padding: "8px 12px", borderRadius: 6, border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 13 }} />
          <button onClick={create} style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "#22C55E", color: "#071A0E", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Add</button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((item) => editing === item.id ? (
          <div key={item.id} style={{ background: "#1E293B", border: "1px solid #22C55E", borderRadius: 10, padding: 16 }}>
            <input value={editForm.question} onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
            <textarea value={editForm.answer} onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
              rows={3} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 13, marginBottom: 8, boxSizing: "border-box", resize: "vertical" }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="number" value={editForm.order} onChange={(e) => setEditForm({ ...editForm, order: parseInt(e.target.value) || 0 })}
                style={{ width: 80, padding: "8px 12px", borderRadius: 6, border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 13 }} />
              <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#94A3B8", fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />
                Active
              </label>
              <button onClick={() => save(item.id)} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#22C55E", color: "#071A0E", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Save</button>
              <button onClick={() => setEditing(null)} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #334155", background: "transparent", color: "#94A3B8", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div key={item.id} style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: item.isActive ? "#F1F5F9" : "#475569", marginBottom: 4 }}>{item.question}</div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{item.answer}</div>
              <div style={{ fontSize: 11, color: "#334155", marginTop: 6 }}>order: {item.order} · {item.isActive ? "active" : "hidden"}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => { setEditing(item.id); setEditForm({ question: item.question, answer: item.answer, order: item.order, isActive: item.isActive }); }}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #334155", background: "transparent", color: "#94A3B8", fontSize: 12, cursor: "pointer" }}>Edit</button>
              <button onClick={() => remove(item.id)}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#EF4444", fontSize: 12, cursor: "pointer" }}>Hide</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PayoutsSection({ apiFetch }: { apiFetch: (url: string, opts?: RequestInit) => Promise<any> }) {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("pending");
  const [editing, setEditing] = useState<number | null>(null);
  const [txHash, setTxHash] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const load = useCallback(async () => {
    const data = await apiFetch(`/api/admin/payouts?status=${filter}`);
    setItems(Array.isArray(data) ? data : []);
  }, [apiFetch, filter]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: number, status: string) {
    await apiFetch(`/api/admin/payouts/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status, txHash: txHash || undefined, rejectionReason: rejectionReason || undefined }),
    });
    setEditing(null);
    setTxHash("");
    setRejectionReason("");
    load();
  }

  const STATUS_COLOR: Record<string, string> = {
    pending: "#F59E0B",
    approved: "#3B82F6",
    paid: "#22C55E",
    rejected: "#EF4444",
  };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#F1F5F9", marginBottom: 4 }}>Payouts</div>
      <div style={{ fontSize: 13, color: "#475569", marginBottom: 24 }}>Manage payout requests from funded traders</div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {["pending", "approved", "paid", "rejected"].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: "6px 16px", borderRadius: 8, border: "1px solid",
            borderColor: filter === s ? STATUS_COLOR[s] : "#334155",
            background: filter === s ? `${STATUS_COLOR[s]}18` : "transparent",
            color: filter === s ? STATUS_COLOR[s] : "#475569",
            fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
          }}>{s}</button>
        ))}
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#475569", fontSize: 13 }}>No {filter} payouts</div>
        )}
        {items.map(item => (
          <div key={item.id} style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: editing === item.id ? 16 : 0 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9" }}>@{item.user?.username}</span>
                  <span style={{ fontSize: 11, color: "#475569" }}>{item.user?.email}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: `${STATUS_COLOR[item.status]}18`, color: STATUS_COLOR[item.status] }}>{item.status.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 12, color: "#475569", display: "flex", gap: 16 }}>
                  <span>Amount: <span style={{ color: "#22C55E", fontWeight: 700 }}>${item.netAmount}</span></span>
                  <span>Network: <span style={{ color: "#94A3B8" }}>{item.walletNetwork}</span></span>
                  <span>Wallet: <span style={{ color: "#94A3B8", fontFamily: "monospace" }}>{item.walletAddress?.slice(0, 12)}...</span></span>
                  <span>Requested: {new Date(item.requestedAt).toLocaleDateString()}</span>
                </div>
                {item.txHash && <div style={{ fontSize: 11, color: "#22C55E", marginTop: 4, fontFamily: "monospace" }}>TX: {item.txHash}</div>}
                {item.rejectionReason && <div style={{ fontSize: 11, color: "#EF4444", marginTop: 4 }}>Reason: {item.rejectionReason}</div>}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {item.status === "pending" && (
                  <button onClick={() => setEditing(editing === item.id ? null : item.id)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #334155", background: "transparent", color: "#94A3B8", fontSize: 12, cursor: "pointer" }}>Actions</button>
                )}
                {item.status === "approved" && (
                  <button onClick={() => { setEditing(item.id); }} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(34,197,94,0.3)", background: "transparent", color: "#22C55E", fontSize: 12, cursor: "pointer" }}>Mark Paid</button>
                )}
              </div>
            </div>

            {editing === item.id && (
              <div style={{ borderTop: "1px solid #334155", paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {item.status === "pending" && (
                  <>
                    <input placeholder="TX Hash (optional)" value={txHash} onChange={e => setTxHash(e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 13 }} />
                    <input placeholder="Rejection reason (if rejecting)" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 13 }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => updateStatus(item.id, "approved")} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "#3B82F6", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Approve</button>
                      <button onClick={() => updateStatus(item.id, "rejected")} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "#EF4444", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Reject</button>
                      <button onClick={() => setEditing(null)} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #334155", background: "transparent", color: "#94A3B8", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                    </div>
                  </>
                )}
                {item.status === "approved" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input placeholder="TX Hash" value={txHash} onChange={e => setTxHash(e.target.value)}
                      style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 13 }} />
                    <button onClick={() => updateStatus(item.id, "paid")} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "#22C55E", color: "#071A0E", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Mark as Paid</button>
                    <button onClick={() => setEditing(null)} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #334155", background: "transparent", color: "#94A3B8", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LeaderboardSection({ apiFetch }: { apiFetch: (url: string, opts?: RequestInit) => Promise<any> }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<string, string | number | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newEntry, setNewEntry] = useState({ username: "", plan: "Starter", totalPnl: "", winRate: "65", trades: "20", avatarUrl: "" });
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await apiFetch("/api/admin/leaderboard");
    if (d.success) setEntries(d.entries);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, []);

  function startEdit(e: any) {
    setEditId(e.id);
    setEditData({
      username: e.username, plan: e.plan, totalPnl: e.totalPnl, winRate: e.winRate,
      trades: e.trades, avatarUrl: e.avatarUrl ?? "", isActive: e.isActive,
    });
  }

  async function saveEdit() {
    if (!editId) return;
    setSaving(true); setError(null);
    const r = await apiFetch(`/api/admin/leaderboard/${editId}`, {
      method: "PUT",
      body: JSON.stringify({
        username: editData.username,
        plan: editData.plan,
        totalPnl: Number(editData.totalPnl),
        winRate: Number(editData.winRate),
        trades: Number(editData.trades),
        avatarUrl: editData.avatarUrl || null,
        isActive: editData.isActive,
      }),
    });
    setSaving(false);
    if (r.error) { setError(r.error); return; }
    setEditId(null); load();
  }

  async function addEntry() {
    setSaving(true); setError(null);
    const r = await apiFetch("/api/admin/leaderboard", {
      method: "POST",
      body: JSON.stringify({
        username: newEntry.username,
        plan: newEntry.plan,
        totalPnl: Number(newEntry.totalPnl),
        winRate: Number(newEntry.winRate),
        trades: Number(newEntry.trades),
        avatarUrl: newEntry.avatarUrl || null,
        isActive: true,
      }),
    });
    setSaving(false);
    if (r.error) { setError(r.error); return; }
    setShowAdd(false);
    setNewEntry({ username: "", plan: "Starter", totalPnl: "", winRate: "65", trades: "20", avatarUrl: "" });
    load();
  }

  async function deleteEntry(id: number) {
    await apiFetch(`/api/admin/leaderboard/${id}`, { method: "DELETE" });
    load();
  }

  async function toggleActive(e: any) {
    await apiFetch(`/api/admin/leaderboard/${e.id}`, {
      method: "PUT",
      body: JSON.stringify({ isActive: !e.isActive }),
    });
    load();
  }

  const inpS: React.CSSProperties = { padding: "4px 8px", borderRadius: 5, border: "1px solid #334155", background: "#0F172A", color: "#F1F5F9", fontSize: 11, outline: "none", width: "100%" };

  return (
    <div>
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <SH>Leaderboard (showcase)</SH>
        <Btn label="+ Add Entry" bg="#22C55E" color="#071A0E" onClick={() => { setError(null); setShowAdd(true); }} />
      </div>

      {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #EF4444", borderRadius: 8, padding: "10px 14px", color: "#EF4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}

      {showAdd && (
        <div style={{ background: "#1E293B", border: "1px solid #22C55E", borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#22C55E", marginBottom: 12 }}>New Showcase Entry</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
            <div><div style={{ fontSize: 10, color: "#475569", marginBottom: 3 }}>username</div><input style={inpS} value={newEntry.username} onChange={e => setNewEntry(p => ({ ...p, username: e.target.value }))} /></div>
            <div><div style={{ fontSize: 10, color: "#475569", marginBottom: 3 }}>plan</div>
              <select style={inpS} value={newEntry.plan} onChange={e => setNewEntry(p => ({ ...p, plan: e.target.value }))}>
                <option value="Starter">Starter</option><option value="Pro">Pro</option><option value="Elite">Elite</option>
              </select>
            </div>
            <div><div style={{ fontSize: 10, color: "#475569", marginBottom: 3 }}>totalPnl</div><input style={inpS} value={newEntry.totalPnl} onChange={e => setNewEntry(p => ({ ...p, totalPnl: e.target.value }))} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
            <div><div style={{ fontSize: 10, color: "#475569", marginBottom: 3 }}>winRate (0-100)</div><input style={inpS} value={newEntry.winRate} onChange={e => setNewEntry(p => ({ ...p, winRate: e.target.value }))} /></div>
            <div><div style={{ fontSize: 10, color: "#475569", marginBottom: 3 }}>trades</div><input style={inpS} value={newEntry.trades} onChange={e => setNewEntry(p => ({ ...p, trades: e.target.value }))} /></div>
            <div><div style={{ fontSize: 10, color: "#475569", marginBottom: 3 }}>avatarUrl (optional)</div><input style={inpS} value={newEntry.avatarUrl} onChange={e => setNewEntry(p => ({ ...p, avatarUrl: e.target.value }))} /></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn label="Save" bg="#22C55E" color="#071A0E" onClick={addEntry} loading={saving} />
            <Btn label="Cancel" bg="#334155" color="#94A3B8" onClick={() => setShowAdd(false)} />
          </div>
        </div>
      )}

      <div style={tableWrap}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1fr 2fr", padding: "9px 16px", borderBottom: "1px solid #334155", background: "rgba(255,255,255,0.02)" }}>
          {["Username", "Plan", "PnL", "Win %", "Trades", "Active", "Actions"].map(h => <div key={h} style={thStyle}>{h}</div>)}
        </div>
        {loading ? <div style={{ padding: 32, textAlign: "center", color: "#475569" }}>Loading...</div> :
          entries.length === 0 ? <div style={{ padding: 32, textAlign: "center", color: "#475569" }}>No showcase entries yet</div> :
          entries.map((e, i) => editId === e.id ? (
            <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1fr 2fr", padding: "8px 16px", alignItems: "center", gap: 4, borderBottom: "1px solid #22C55E40", background: "rgba(34,197,94,0.04)" }}>
              <input style={inpS} value={String(editData.username)} onChange={ev => setEditData(d => ({ ...d, username: ev.target.value }))} />
              <select style={inpS} value={String(editData.plan)} onChange={ev => setEditData(d => ({ ...d, plan: ev.target.value }))}>
                <option value="Starter">Starter</option><option value="Pro">Pro</option><option value="Elite">Elite</option>
              </select>
              <input style={inpS} value={String(editData.totalPnl)} onChange={ev => setEditData(d => ({ ...d, totalPnl: Number(ev.target.value) }))} />
              <input style={inpS} value={String(editData.winRate)} onChange={ev => setEditData(d => ({ ...d, winRate: Number(ev.target.value) }))} />
              <input style={inpS} value={String(editData.trades)} onChange={ev => setEditData(d => ({ ...d, trades: Number(ev.target.value) }))} />
              <select style={inpS} value={String(editData.isActive)} onChange={ev => setEditData(d => ({ ...d, isActive: ev.target.value === "true" }))}>
                <option value="true">Yes</option><option value="false">No</option>
              </select>
              <div style={{ display: "flex", gap: 5 }}>
                <Btn label="Save" bg="#22C55E" color="#071A0E" onClick={saveEdit} loading={saving} />
                <Btn label="Cancel" bg="#334155" color="#94A3B8" onClick={() => { setEditId(null); setError(null); }} />
              </div>
            </div>
          ) : (
            <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1fr 2fr", padding: "9px 16px", alignItems: "center", borderBottom: i < entries.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div style={{ ...tdStyle, color: "#F1F5F9", fontWeight: 600 }}>@{e.username}</div>
              <div style={tdStyle}>{e.plan}</div>
              <div style={{ ...tdStyle, color: e.totalPnl >= 0 ? "#22C55E" : "#EF4444", fontWeight: 700 }}>{e.totalPnl >= 0 ? "+" : ""}${e.totalPnl.toLocaleString()}</div>
              <div style={tdStyle}>{e.winRate}%</div>
              <div style={tdStyle}>{e.trades}</div>
              <div style={tdStyle}><Badge label={e.isActive ? "Yes" : "No"} color={e.isActive ? "#22C55E" : "#64748B"} /></div>
              <div style={{ display: "flex", gap: 5, padding: "0 16px" }}>
                <Btn label="Edit" bg="#3B82F6" onClick={() => startEdit(e)} />
                <Btn label={e.isActive ? "Hide" : "Show"} bg="#334155" color="#94A3B8" onClick={() => toggleActive(e)} />
                <Btn label="Delete" bg="#EF4444" color="#FFF" onClick={() => setConfirm({ title: "Delete Entry", message: `Permanently delete @${e.username}?`, onConfirm: () => deleteEntry(e.id) })} />
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}
