"use client";

import { useState, useRef, useEffect, useId, useCallback } from "react";

// Lightweight info tooltip (no library). Click to open; click outside or Escape to close.
export function InfoTooltip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const popoverId = useId();

  // Click-only toggle. Compute placement (flip up near the viewport bottom) on open.
  const onIconClick = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    setPlacement(rect && rect.bottom + 100 > window.innerHeight ? "top" : "bottom");
    setOpen((o) => !o);
  }, []);

  // Outside-click (pointerdown covers mouse + touch) + Escape, only while open.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
    >
      <button
        type="button"
        aria-label={`Information about ${label}`}
        aria-expanded={open}
        aria-describedby={open ? popoverId : undefined}
        onClick={onIconClick}
        style={{
          background: "transparent",
          border: "none",
          padding: "2px",
          margin: 0,
          marginLeft: "6px",
          cursor: "help",
          color: "var(--text-muted)",
          verticalAlign: "middle",
          display: "inline-flex",
          alignItems: "center",
        }}
        onMouseOver={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
        onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>
      {open && (
        <div
          id={popoverId}
          role="tooltip"
          style={{
            position: "absolute",
            [placement === "top" ? "bottom" : "top"]: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: "300px",
            minWidth: "200px",
            padding: "12px 14px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            color: "var(--text-primary)",
            fontSize: "10px",
            lineHeight: 1.5,
            whiteSpace: "pre-line",
            textTransform: "none",
            letterSpacing: "normal",
            fontWeight: 400,
            zIndex: 200,
            animation: "fadeIn 0.15s ease-out",
            pointerEvents: "auto",
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
}
