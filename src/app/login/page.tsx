"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");

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

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        const data = await apiFetch<{ token?: string; error?: string }>("/api/login", {
          method: "POST",
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        if (data.token) { setToken(data.token); router.push("/markets"); }
        else setError(data.error ?? "Login failed");
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
        if (data.token) { setToken(data.token); router.push("/markets"); }
        else setError(data.error ?? "Registration failed");
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

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-page)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      {/* Subtle bg glow */}
      <div style={{
        position: "fixed",
        top: "30%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 600,
        height: 400,
        background: "radial-gradient(ellipse, rgba(34,197,94,0.05) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "linear-gradient(160deg, var(--bg-surface) 0%, var(--bg-page) 100%)",
        borderRadius: 16,
        padding: "36px 32px",
        border: "1px solid var(--border)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
        position: "relative",
        animation: "fadeIn 0.3s ease",
      }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "linear-gradient(135deg, #22C55E, #16A34A)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            fontWeight: 800,
            color: "#0a1a0e",
            boxShadow: "0 0 20px rgba(34,197,94,0.3)",
            margin: "0 auto 14px",
          }}>F</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            FundedForecast
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
            {mode === "login" ? "Sign in to your account" : "Create your account"}
          </div>
        </div>

        {/* Toggle */}
        <div style={{
          display: "flex",
          background: "var(--bg-input)",
          borderRadius: 9,
          padding: 3,
          marginBottom: 24,
          border: "1px solid var(--border-subtle)",
        }}>
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); }}
              style={{
                flex: 1,
                padding: "7px 0",
                borderRadius: 7,
                border: "none",
                background: mode === m ? "var(--bg-elevated)" : "transparent",
                color: mode === m ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: mode === m ? 600 : 400,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.15s",
                boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
              }}
            >
              {m === "login" ? "Sign In" : "Get Started"}
            </button>
          ))}
        </div>

        {/* Register fields */}
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
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 14,
            color: "#EF4444",
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: 9,
            background: loading ? "var(--bg-elevated)" : "#22C55E",
            color: loading ? "var(--text-muted)" : "#071A0E",
            border: "none",
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: "-0.01em",
            boxShadow: loading ? "none" : "0 0 20px rgba(34,197,94,0.25)",
            transition: "box-shadow 0.15s, background 0.15s",
          }}
        >
          {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>

        <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
          {mode === "login" ? (
            <>Don&apos;t have an account? <button onClick={() => setMode("register")} style={{ background: "none", border: "none", color: "#22C55E", fontWeight: 600, fontSize: 13, cursor: "pointer", padding: 0 }}>Get started</button></>
          ) : (
            <>Already have an account? <button onClick={() => setMode("login")} style={{ background: "none", border: "none", color: "#22C55E", fontWeight: 600, fontSize: 13, cursor: "pointer", padding: 0 }}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
