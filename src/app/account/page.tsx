"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";

const card: React.CSSProperties = { background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "24px 28px", marginBottom: 16 };
const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #1E293B", background: "#080c14", color: "#F1F5F9", fontSize: 14, boxSizing: "border-box", outline: "none" };
const btn: React.CSSProperties = { padding: "9px 22px", borderRadius: 8, border: "none", background: "#22C55E", color: "#071A0E", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const btnGhost: React.CSSProperties = { ...btn, background: "transparent", border: "1px solid #334155", color: "#94A3B8" };

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [consent, setConsent] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({ username: "", firstName: "", lastName: "", walletAddress: "", walletNetwork: "USDT TRC20" });
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");

  const load = useCallback(async () => {
    if (!getToken()) { router.push("/login"); return; }
    const [p, s] = await Promise.all([
      apiFetch<any>("/api/user/profile"),
      apiFetch<any>("/api/user/stats"),
    ]);
    if (p.success) {
      setProfile(p.user);
      setConsent(p.consent);
      setForm({ username: p.user.username ?? "", firstName: p.user.firstName ?? "", lastName: p.user.lastName ?? "", walletAddress: p.user.walletAddress ?? "", walletNetwork: p.user.walletNetwork ?? "USDT TRC20" });
    }
    if (s.success) { setStats(s.stats); setHistory(s.challengeHistory); }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function saveProfile() {
    setSaving(true); setMsg("");
    const res = await apiFetch<any>("/api/user/profile", { method: "PUT", body: JSON.stringify(form) });
    setSaving(false);
    setMsg(res.success ? "Saved successfully" : res.error ?? "Error");
  }

  async function changePassword() {
    setPwMsg("");
    if (pwForm.next !== pwForm.confirm) { setPwMsg("Passwords don't match"); return; }
    if (pwForm.next.length < 8) { setPwMsg("Min 8 characters"); return; }
    const res = await apiFetch<any>("/api/user/profile", { method: "PUT", body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }) });
    setPwMsg(res.success ? "Password changed" : res.error ?? "Error");
    if (res.success) setPwForm({ current: "", next: "", confirm: "" });
  }

  if (loading) return <div style={{ minHeight: "100vh", background: "#080c14", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>Loading...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#F1F5F9", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "80px 24px 60px" }}>
        <div style={{ marginBottom: 40 }}>
          <a href="/dashboard" style={{ fontSize: 13, color: "#22C55E", textDecoration: "none" }}>← Dashboard</a>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 16, marginBottom: 4 }}>My Account</h1>
          <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>{profile?.email}</p>
        </div>

        {/* Profile */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 20 }}>Profile</div>
          <div style={{ marginBottom: 12 }}>
            <div style={label}>Email</div>
            <div style={{ ...inputStyle, color: "#475569", background: "#0a0f18" }}>{profile?.email}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={label}>First Name</div>
              <input style={inputStyle} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <div style={label}>Last Name</div>
              <input style={inputStyle} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={label}>Username</div>
            <input style={inputStyle} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button style={btn} onClick={saveProfile} disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
            {msg && <span style={{ fontSize: 13, color: msg.includes("success") ? "#22C55E" : "#EF4444" }}>{msg}</span>}
          </div>
        </div>

        {/* Change Password */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 20 }}>Change Password</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            <div>
              <div style={label}>Current Password</div>
              <input type="password" style={inputStyle} value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} />
            </div>
            <div>
              <div style={label}>New Password (min 8 chars)</div>
              <input type="password" style={inputStyle} value={pwForm.next} onChange={e => setPwForm({ ...pwForm, next: e.target.value })} />
            </div>
            <div>
              <div style={label}>Confirm New Password</div>
              <input type="password" style={inputStyle} value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button style={btn} onClick={changePassword}>Change Password</button>
            {pwMsg && <span style={{ fontSize: 13, color: pwMsg.includes("changed") ? "#22C55E" : "#EF4444" }}>{pwMsg}</span>}
          </div>
        </div>

        {/* Payout */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 4 }}>Payout Settings</div>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 20 }}>Your wallet details for future payouts</div>
          <div style={{ marginBottom: 12 }}>
            <div style={label}>Network</div>
            <select style={{ ...inputStyle }} value={form.walletNetwork} onChange={e => setForm({ ...form, walletNetwork: e.target.value })}>
              <option>USDT TRC20</option>
              <option>USDT ERC20</option>
              <option>USDT BEP20</option>
              <option>USDC ERC20</option>
            </select>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={label}>Wallet Address</div>
            <input style={inputStyle} placeholder="Enter your wallet address" value={form.walletAddress} onChange={e => setForm({ ...form, walletAddress: e.target.value })} />
          </div>
          <button style={btn} onClick={saveProfile}>Save Payout Info</button>
        </div>

        {/* Stats */}
        {stats && (
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 20 }}>Trading Stats</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                { label: "Total Trades", value: stats.totalTrades },
                { label: "Win Rate", value: `${stats.winRate}%` },
                { label: "Total PnL", value: `$${stats.totalPnl}` },
                { label: "Best Trade", value: `$${stats.bestTrade}` },
              ].map(({ label: l, value }) => (
                <div key={l}>
                  <div style={label}>{l}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#22C55E" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Challenge History */}
        {history.length > 0 && (
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 16 }}>Challenge History</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.map(c => {
                const pnl = c.realizedBalance - c.startBalance;
                return (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#F1F5F9" }}>Challenge #{c.id}</div>
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{new Date(c.startedAt).toLocaleDateString()} · Target {c.profitTargetPct}% · Max DD {c.maxTotalDdPct}%</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: pnl >= 0 ? "#22C55E" : "#EF4444" }}>{pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 4, background: c.status === "passed" ? "rgba(34,197,94,0.1)" : c.status === "active" ? "rgba(59,130,246,0.1)" : "rgba(239,68,68,0.1)", color: c.status === "passed" ? "#22C55E" : c.status === "active" ? "#3B82F6" : "#EF4444" }}>{c.status.toUpperCase()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Documents */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 16 }}>Documents & Agreements</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#94A3B8" }}>Terms of Use</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {consent?.acceptedAt && <span style={{ fontSize: 11, color: "#22C55E" }}>✓ Accepted {new Date(consent.acceptedAt).toLocaleDateString()}</span>}
                <a href="/terms-of-use" style={{ fontSize: 12, color: "#475569", textDecoration: "none" }}>View →</a>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#94A3B8" }}>Privacy Policy</span>
              <a href="/privacy-policy" style={{ fontSize: 12, color: "#475569", textDecoration: "none" }}>View →</a>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#94A3B8" }}>Risk Disclosure</span>
              <a href="/risk-disclosure" style={{ fontSize: 12, color: "#475569", textDecoration: "none" }}>View →</a>
            </div>
          </div>
        </div>

        {/* Security */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 16 }}>Security</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: "#94A3B8" }}>Member since</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#F1F5F9", marginTop: 2 }}>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—"}</div>
            </div>
            <button style={btnGhost} onClick={() => { localStorage.clear(); router.push("/login"); }}>Sign out all sessions</button>
          </div>
        </div>

      </div>
    </div>
  );
}
