"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
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
        if (data.token) {
          setToken(data.token);
          router.push("/markets");
        } else {
          setError(data.error ?? "Login failed");
        }
      } else {
        if (form.password !== form.confirmPassword) {
          setError("Passwords do not match");
          setLoading(false);
          return;
        }
        const data = await apiFetch<{ token?: string; error?: string }>("/api/register", {
          method: "POST",
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            username: form.username,
            firstName: form.firstName,
            lastName: form.lastName,
            acceptedPayoutRules: form.acceptedPayoutRules,
            acceptedPrivacy: form.acceptedPrivacy,
          }),
        });
        if (data.token) {
          setToken(data.token);
          router.push("/markets");
        } else {
          setError(data.error ?? "Registration failed");
        }
      }
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 8,
    border: "1px solid #334155",
    background: "#0F172A",
    color: "#F8FAFC",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
    marginBottom: 12,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#1E293B", borderRadius: 16, padding: 40, border: "1px solid #334155" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: "#22C55E" }}>FundedForecast</span>
          <p style={{ color: "#64748B", fontSize: 14, marginTop: 8 }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); }}
              style={{
                flex: 1, padding: "10px", borderRadius: 8, border: "1px solid",
                borderColor: mode === m ? "#22C55E" : "#334155",
                background: mode === m ? "#22C55E20" : "transparent",
                color: mode === m ? "#22C55E" : "#64748B",
                fontWeight: 600, fontSize: 13, cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {m === "login" ? "Log In" : "Get Started"}
            </button>
          ))}
        </div>

        {/* Register fields */}
        {mode === "register" && (
          <>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...inputStyle, width: "50%" }} placeholder="First name" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
              <input style={{ ...inputStyle, width: "50%" }} placeholder="Last name" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
            </div>
            <input style={inputStyle} placeholder="Username" value={form.username} onChange={(e) => update("username", e.target.value)} />
          </>
        )}

        {/* Common fields */}
        <input style={inputStyle} type="email" placeholder="Email" value={form.email} onChange={(e) => update("email", e.target.value)} />
        <input style={inputStyle} type="password" placeholder="Password" value={form.password} onChange={(e) => update("password", e.target.value)} />

        {mode === "register" && (
          <>
            <input style={inputStyle} type="password" placeholder="Confirm password" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} />

            {/* Password requirements */}
            <div style={{ background: "#0F172A", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12 }}>
              {[
                { label: "At least 10 characters", ok: form.password.length >= 10 },
                { label: "One uppercase letter", ok: /[A-Z]/.test(form.password) },
                { label: "One lowercase letter", ok: /[a-z]/.test(form.password) },
                { label: "One number", ok: /[0-9]/.test(form.password) },
                { label: "Passwords match", ok: form.password === form.confirmPassword && form.password.length > 0 },
              ].map((r) => (
                <div key={r.label} style={{ color: r.ok ? "#22C55E" : "#64748B", marginBottom: 4 }}>
                  {r.ok ? "✓" : "○"} {r.label}
                </div>
              ))}
            </div>

            {/* Checkboxes */}
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10, cursor: "pointer", fontSize: 13, color: "#94A3B8" }}>
              <input type="checkbox" checked={form.acceptedPayoutRules} onChange={(e) => update("acceptedPayoutRules", e.target.checked)} style={{ marginTop: 2 }} />
              I agree to the FundedForecast Rules & Payouts
            </label>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 20, cursor: "pointer", fontSize: 13, color: "#94A3B8" }}>
              <input type="checkbox" checked={form.acceptedPrivacy} onChange={(e) => update("acceptedPrivacy", e.target.checked)} style={{ marginTop: 2 }} />
              I agree to the Privacy Policy and Terms
            </label>
          </>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: "#EF444420", border: "1px solid #EF444440", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#EF4444", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%", padding: "14px", borderRadius: 10,
            background: loading ? "#334155" : "#22C55E",
            color: loading ? "#64748B" : "#0F172A",
            border: "none", fontSize: 15, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
        </button>
      </div>
    </div>
  );
}
