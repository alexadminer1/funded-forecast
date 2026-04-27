"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, apiFetch, setToken } from "@/lib/api";

export default function LoginForm({ ctaText }: { ctaText: string }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) { setChecked(true); return; }
    apiFetch<{ success: boolean }>("/api/user/me")
      .then((d) => { if (d.success) router.replace("/markets"); else setChecked(true); })
      .catch(() => setChecked(true));
  }, [router]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ success: boolean; token?: string; error?: string }>("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (data.success && data.token) {
        setToken(data.token);
        router.replace("/markets");
      } else {
        setError(data.error ?? "Invalid credentials");
      }
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  if (!checked) return <div style={{ height: 220 }} />;

  return (
    <div style={{
      width: "100%", maxWidth: 400,
      background: "linear-gradient(160deg, #0D1521 0%, #080c14 100%)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 18, padding: "28px 28px 24px",
      boxShadow: "0 32px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
      marginBottom: 56,
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", marginBottom: 6, letterSpacing: "-0.02em" }}>
        Sign in to your account
      </div>
      <div style={{ fontSize: 13, color: "#475569", marginBottom: 22 }}>No credit card required.</div>

      <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          type="email" placeholder="Email address" value={email}
          onChange={(e) => setEmail(e.target.value)} required
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 9,
            border: "1px solid rgba(255,255,255,0.08)", background: "#060C16",
            color: "#F1F5F9", fontSize: 14, outline: "none", boxSizing: "border-box",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "rgba(34,197,94,0.4)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
        />
        <input
          type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} required
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 9,
            border: "1px solid rgba(255,255,255,0.08)", background: "#060C16",
            color: "#F1F5F9", fontSize: 14, outline: "none", boxSizing: "border-box",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "rgba(34,197,94,0.4)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
        />

        {error && (
          <div style={{ fontSize: 13, color: "#EF4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "9px 12px", textAlign: "left" }}>
            {error}
          </div>
        )}

        <button
          type="submit" disabled={loading}
          style={{
            width: "100%", padding: "12px", borderRadius: 9,
            background: loading ? "#16532d" : "#22C55E",
            color: "#071A0E", border: "none", fontSize: 14, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", letterSpacing: "-0.01em",
            boxShadow: loading ? "none" : "0 0 24px rgba(34,197,94,0.25)",
            marginTop: 2, transition: "box-shadow 0.15s",
          }}
        >
          {loading ? "Signing in..." : ctaText || "Sign In"}
        </button>
      </form>

      <div style={{ marginTop: 12, fontSize: 13, color: "#475569" }}>
        Don&apos;t have an account?{" "}
        <a href="/login?mode=register" style={{ color: "#22C55E", textDecoration: "none", fontWeight: 600 }}>Get started</a>
      </div>
    </div>
  );
}
