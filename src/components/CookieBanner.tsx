"use client";
import { useState, useEffect } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem("cookie_consent", "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem("cookie_consent", "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 1000, width: "calc(100% - 48px)", maxWidth: 620,
      background: "rgba(13,17,23,0.95)", backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14,
      padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 16, fontFamily: "'Inter',-apple-system,sans-serif",
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    }}>
      <p style={{ fontSize: 13, color: "#94A3B8", margin: 0, lineHeight: 1.5, flex: 1 }}>
        We use cookies to improve your experience.{" "}
        <a href="/privacy-policy" style={{ color: "#22C55E", textDecoration: "none" }}>Privacy Policy</a>
      </p>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button onClick={decline} style={{
          padding: "7px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
          background: "transparent", color: "#64748B", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>Decline</button>
        <button onClick={accept} style={{
          padding: "7px 16px", borderRadius: 8, border: "none",
          background: "#22C55E", color: "#071A0E", fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}>Accept</button>
      </div>
    </div>
  );
}
