"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, setToken } from "@/lib/api";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const planId = searchParams.get("planId");
  const next = searchParams.get("next");

  useEffect(() => {
    if (searchParams.get("mode") === "register") setMode("register");
  }, [searchParams]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    username: "",
    firstName: "",
    lastName: "",
    confirmPassword: "",
    acceptedPayoutRules: false,
    acceptedPrivacy: false,
  });

  function update(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  async function startChallengeIfNeeded(token: string) {
    if (!planId) return;
    try {
      await apiFetch("/api/user/start-challenge", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId: Number(planId) }),
      });
    } catch { /* ignore */ }
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        const data = await apiFetch<{ token?: string; error?: string }>("/api/login", {
          method: "POST",
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        if (data.token) {
          setToken(data.token);
          await startChallengeIfNeeded(data.token);
          router.push(next ?? (planId ? `/checkout?planId=${planId}` : "/dashboard"));
        } else setError(data.error ?? "Login failed");
      } else {
        if (form.password !== form.confirmPassword) { setError("Passwords do not match"); setLoading(false); return; }
        const data = await apiFetch<{ token?: string; error?: string }>("/api/register", {
          method: "POST",
          body: JSON.stringify({
            email: form.email, password: form.password,
            username: form.username, firstName: form.firstName, lastName: form.lastName,
            acceptedPayoutRules: form.acceptedPayoutRules, acceptedPrivacy: form.acceptedPrivacy,
          }),
        });
        if (data.token) {
          setToken(data.token);
          router.push(next ?? (planId ? `/checkout?planId=${planId}` : "/dashboard"));
        } else setError(data.error ?? "Registration failed");
      }
    } catch { setError("Request failed"); }
    finally { setLoading(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: "var(--radius-input)",
    border: "1px solid var(--border)",
    background: "var(--bg-input)",
    color: "var(--text-primary)",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 10,
    transition: "border-color 0.15s",
  };

  const passwordChecks = [
    { label: "At least 10 characters", ok: form.password.length >= 10 },
    { label: "One uppercase letter", ok: /[A-Z]/.test(form.password) },
    { label: "One lowercase letter", ok: /[a-z]/.test(form.password) },
    { label: "One number", ok: /[0-9]/.test(form.password) },
    { label: "Passwords match", ok: form.password === form.confirmPassword && form.password.length > 0 },
  ];

  const perks = [
    "$10,000 paper capital — no deposit needed",
    "Real Polymarket prices — live data",
    "Pass evaluation — earn real payouts up to 80%",
  ];

  const sideStats = [
    { value: "2,400+", label: "Traders" },
    { value: "100+", label: "Live markets" },
    { value: "80%", label: "Profit share" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* LEFT — form */}
      <div style={{
        flex: 1,
        background: "var(--bg-page)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 48,
        position: "relative",
      }}>
        {/* Glow */}
        <div style={{
          position: "absolute", top: "20%", left: "50%",
          transform: "translateX(-50%)",
          width: 400, height: 300,
          background: "radial-gradient(ellipse, rgba(34,197,94,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Form card */}
        <div style={{ width: "100%", maxWidth: 400, position: "relative" }}>

        {/* Logo */}
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 9, marginBottom: 40 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #22C55E, #16A34A)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, fontWeight: 800, color: "#071A0E",
            boxShadow: "0 0 16px rgba(34,197,94,0.3)",
          }}>F</div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>FundedForecast</span>
        </a>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 4 }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            {mode === "login" ? "Sign in to your account" : "Start your funded trading journey"}
          </p>
        </div>

        {/* Toggle */}
        <div style={{
          display: "flex", background: "var(--bg-input)", borderRadius: 9,
          padding: 3, marginBottom: 22, border: "1px solid var(--border-subtle)",
        }}>
          {(["login", "register"] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(null); }} style={{
              flex: 1, padding: "7px 0", borderRadius: 7, border: "none",
              background: mode === m ? "var(--bg-elevated)" : "transparent",
              color: mode === m ? "var(--text-primary)" : "var(--text-muted)",
              fontWeight: mode === m ? 600 : 400, fontSize: 13, cursor: "pointer",
              transition: "all 0.15s", boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
            }}>
              {m === "login" ? "Sign In" : "Get Started"}
            </button>
          ))}
        </div>

        {/* Register-only fields */}
        {mode === "register" && (
          <>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...inputStyle, width: "50%" }} placeholder="First name" value={form.firstName} onChange={(e) => update("firstName", e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = "rgba(34,197,94,0.4)")} onBlur={(e) => (e.target.style.borderColor = "var(--border)")} />
              <input style={{ ...inputStyle, width: "50%" }} placeholder="Last name" value={form.lastName} onChange={(e) => update("lastName", e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = "rgba(34,197,94,0.4)")} onBlur={(e) => (e.target.style.borderColor = "var(--border)")} />
            </div>
            <input style={inputStyle} placeholder="Username" value={form.username} onChange={(e) => update("username", e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = "rgba(34,197,94,0.4)")} onBlur={(e) => (e.target.style.borderColor = "var(--border)")} />
          </>
        )}

        <input style={inputStyle} type="email" placeholder="Email address" value={form.email} onChange={(e) => update("email", e.target.value)}
          onFocus={(e) => (e.target.style.borderColor = "rgba(34,197,94,0.4)")} onBlur={(e) => (e.target.style.borderColor = "var(--border)")} />
        <input style={inputStyle} type="password" placeholder="Password" value={form.password} onChange={(e) => update("password", e.target.value)}
          onFocus={(e) => (e.target.style.borderColor = "rgba(34,197,94,0.4)")} onBlur={(e) => (e.target.style.borderColor = "var(--border)")} />

        {mode === "register" && (
          <>
            <input style={inputStyle} type="password" placeholder="Confirm password" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = "rgba(34,197,94,0.4)")} onBlur={(e) => (e.target.style.borderColor = "var(--border)")} />

            <div style={{ background: "var(--bg-input)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, border: "1px solid var(--border-subtle)" }}>
              {passwordChecks.map((r) => (
                <div key={r.label} style={{ color: r.ok ? "#22C55E" : "var(--text-muted)", fontSize: 12, marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10 }}>{r.ok ? "✓" : "○"}</span> {r.label}
                </div>
              ))}
            </div>

            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8, cursor: "pointer", fontSize: 12.5, color: "var(--text-muted)" }}>
              <input type="checkbox" checked={form.acceptedPayoutRules} onChange={(e) => update("acceptedPayoutRules", e.target.checked)} style={{ marginTop: 2 }} />
              I agree to the FundedForecast Rules & Payouts
            </label>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 18, cursor: "pointer", fontSize: 12.5, color: "var(--text-muted)" }}>
              <input type="checkbox" checked={form.acceptedPrivacy} onChange={(e) => update("acceptedPrivacy", e.target.checked)} style={{ marginTop: 2 }} />
              I agree to the Privacy Policy and Terms
            </label>
          </>
        )}

        {error && (
          <div style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: "#EF4444", fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading} style={{
          width: "100%", padding: "12px", borderRadius: 9,
          background: loading ? "var(--bg-elevated)" : "#22C55E",
          color: loading ? "var(--text-muted)" : "#071A0E",
          border: "none", fontSize: 14, fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer", letterSpacing: "-0.01em",
          boxShadow: loading ? "none" : "0 0 20px rgba(34,197,94,0.25)",
          transition: "box-shadow 0.15s, background 0.15s",
        }}>
          {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>

        <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
          {mode === "login" ? (
            <>Don&apos;t have an account?{" "}
              <button onClick={() => setMode("register")} style={{ background: "none", border: "none", color: "#22C55E", fontWeight: 600, fontSize: 13, cursor: "pointer", padding: 0 }}>Get started</button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button onClick={() => setMode("login")} style={{ background: "none", border: "none", color: "#22C55E", fontWeight: 600, fontSize: 13, cursor: "pointer", padding: 0 }}>Sign in</button>
            </>
          )}
        </div>
        </div>{/* /form card */}
      </div>

      {/* RIGHT — marketing panel (hidden on mobile) */}
      <div className="login-right-panel" style={{
        flex: 1,
        background: "#0a1f0f",
        borderLeft: "1px solid rgba(34,197,94,0.08)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 48,
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Glow */}
        <div style={{
          position: "absolute", top: -100, right: -100,
          width: 500, height: 500,
          background: "radial-gradient(ellipse, rgba(34,197,94,0.1) 0%, transparent 65%)",
          pointerEvents: "none",
        }} />

        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
          borderRadius: 20, padding: "5px 14px",
          fontSize: 11, fontWeight: 600, color: "#22C55E",
          letterSpacing: "0.05em", marginBottom: 28, width: "fit-content",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 6px rgba(34,197,94,0.8)", display: "inline-block" }} />
          PAPER TRADING PLATFORM
        </div>

        <h2 style={{
          fontSize: 32, fontWeight: 800, letterSpacing: "-0.04em",
          lineHeight: 1.15, marginBottom: 36, color: "#F1F5F9",
          background: "linear-gradient(180deg, #F1F5F9 0%, #94A3B8 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        }}>
          Start trading<br />in minutes
        </h2>

        {/* Perks */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 48 }}>
          {perks.map((perk) => (
            <div key={perk} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: "#22C55E", fontWeight: 700,
              }}>✓</div>
              <span style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.5 }}>{perk}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{
          display: "flex", gap: 0,
          borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden", background: "rgba(7,13,25,0.6)",
        }}>
          {sideStats.map(({ value, label }, i) => (
            <div key={label} style={{
              flex: 1, padding: "16px 20px", textAlign: "center",
              borderRight: i < sideStats.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#22C55E", letterSpacing: "-0.03em", marginBottom: 2 }}>{value}</div>
              <div style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>
        </div>{/* /inner */}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .login-right-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
}
