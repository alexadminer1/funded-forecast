"use client";

import { useState } from "react";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      setStatus("sent");
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to send");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#0d1117",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    padding: "12px 14px",
    color: "#F1F5F9",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.15s",
    boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#F1F5F9", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "64px 24px 96px" }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 12, textAlign: "center" }}>
          Get in Touch
        </h1>
        <p style={{ fontSize: 15, color: "#94A3B8", lineHeight: 1.7, marginBottom: 40, textAlign: "center" }}>
          Questions about challenges, payouts, or the affiliate program? Send us a message and we&apos;ll respond within 24 hours.
        </p>

        {status === "sent" ? (
          <div style={{
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.3)",
            borderRadius: 12,
            padding: "32px 24px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#86EFAC" }}>Message sent</h2>
            <p style={{ fontSize: 14, color: "#94A3B8", marginBottom: 24 }}>
              Thanks for reaching out. We&apos;ll get back to you as soon as possible.
            </p>
            <button
              onClick={() => setStatus("idle")}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                padding: "8px 20px",
                color: "#F1F5F9",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Send another
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, color: "#94A3B8", marginBottom: 6 }}>Name</label>
              <input
                type="text"
                required
                maxLength={100}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={inputStyle}
                disabled={status === "sending"}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, color: "#94A3B8", marginBottom: 6 }}>Email</label>
              <input
                type="email"
                required
                maxLength={200}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={inputStyle}
                disabled={status === "sending"}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, color: "#94A3B8", marginBottom: 6 }}>Subject</label>
              <input
                type="text"
                required
                maxLength={200}
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                style={inputStyle}
                disabled={status === "sending"}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, color: "#94A3B8", marginBottom: 6 }}>Message</label>
              <textarea
                required
                maxLength={5000}
                rows={6}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                style={{ ...inputStyle, resize: "vertical", minHeight: 140 }}
                disabled={status === "sending"}
              />
            </div>

            {status === "error" && (
              <div style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                color: "#FCA5A5",
              }}>
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              style={{
                background: status === "sending" ? "#16A34A" : "#22C55E",
                color: "#071A0E",
                border: "none",
                borderRadius: 8,
                padding: "14px 24px",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                cursor: status === "sending" ? "wait" : "pointer",
                marginTop: 8,
                boxShadow: "0 0 16px rgba(34,197,94,0.25)",
                transition: "box-shadow 0.15s",
              }}
            >
              {status === "sending" ? "Sending..." : "Send message"}
            </button>
          </form>
        )}

        <p style={{ fontSize: 13, color: "#475569", marginTop: 32, textAlign: "center" }}>
          Or email us directly at <a href="mailto:support@fundedforecast.com" style={{ color: "#22C55E", textDecoration: "none" }}>support@fundedforecast.com</a>
        </p>
      </div>
    </div>
  );
}
