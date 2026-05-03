"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";

const card: React.CSSProperties = {
  background: "#0d1117",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 12,
  padding: "24px 28px",
  marginBottom: 16,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
};

const METHOD_LABELS: Record<string, string> = {
  usdt_trc20: "USDT (TRC20)",
  usdt_erc20: "USDT (ERC20)",
  usdc_erc20: "USDC (ERC20)",
  usdc_polygon: "USDC (Polygon)",
};

interface WalletData {
  paymentMethod: string | null;
  paymentWallet: string | null;
  walletChangedAt: string | null;
  walletLockUntil: string | null;
  walletRequiresReview: boolean;
  isLocked: boolean;
  supportedMethods: string[];
}

export default function AffiliateSettingsPage() {
  const router = useRouter();
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [method, setMethod] = useState("");
  const [address, setAddress] = useState("");

  const load = useCallback(async () => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<any>("/api/affiliate/wallet");
      if (res.error) {
        setPageError(res.error);
      } else {
        setData(res as WalletData);
        setMethod(res.paymentMethod ?? "");
        setAddress(res.paymentWallet ?? "");
      }
    } catch {
      setPageError("load_failed");
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    const confirmed = window.confirm(
      "After saving, you will not be able to change your wallet for 7 days. Continue?"
    );
    if (!confirmed) return;

    setSaving(true);
    setFormError(null);
    setSuccess(null);

    try {
      const res = await apiFetch<any>("/api/affiliate/wallet", {
        method: "POST",
        body: JSON.stringify({ paymentMethod: method, paymentWallet: address }),
      });

      if (res.error) {
        if (res.error === "wallet_locked") {
          const until = res.until
            ? new Date(res.until).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
            : "unknown date";
          setFormError(`Wallet is locked until ${until}.`);
        } else {
          setFormError(res.error);
        }
      } else if (res.noop) {
        setSuccess("No changes — wallet is already set to these values.");
      } else {
        setSuccess("Wallet saved successfully.");
        await load();
      }
    } catch {
      setFormError("Failed to save wallet.");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#080c14", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>
        Loading...
      </div>
    );
  }

  if (pageError) {
    const msg =
      pageError === "not_an_affiliate" ? "You are not an affiliate." :
      pageError === "affiliate_not_approved" ? "Your affiliate account is not approved." :
      "Failed to load wallet data.";
    return (
      <div style={{ minHeight: "100vh", background: "#080c14", display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", fontSize: 14 }}>
        {msg}
      </div>
    );
  }

  const lockUntilDate = data?.walletLockUntil ? new Date(data.walletLockUntil) : null;
  const isLocked = data?.isLocked ?? false;
  const isDisabled = isLocked || saving;
  const canSave = !isDisabled && !!method && address.trim() !== "";

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#F1F5F9", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "80px 24px 60px" }}>

        <div style={{ marginBottom: 40 }}>
          <a href="/dashboard" style={{ fontSize: 13, color: "#22C55E", textDecoration: "none" }}>← Dashboard</a>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", marginTop: 16, marginBottom: 4 }}>Affiliate Program</h1>
        </div>

        <div style={{ display: "flex", gap: 24, marginBottom: 28 }}>
          <a href="/affiliate" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Overview</a>
          <a href="/affiliate/conversions" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Conversions</a>
          <a href="/affiliate/ledger" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>Ledger</a>
          <a href="/affiliate/settings" style={{ fontSize: 13, fontWeight: 700, color: "#22C55E", textDecoration: "none" }}>Settings</a>
        </div>

        <div style={card}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#F1F5F9", marginBottom: 20 }}>Payout wallet</div>

          {isLocked && lockUntilDate && (
            <div style={{ marginBottom: 20, padding: "12px 16px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, fontSize: 13, color: "#F59E0B" }}>
              Your wallet is locked until {lockUntilDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}. You can change it after the lock period expires.
            </div>
          )}

          {data?.paymentWallet && (
            <div style={{ marginBottom: 20 }}>
              <div style={labelStyle}>Current wallet</div>
              <div style={{ fontSize: 13, color: "#94A3B8", fontFamily: "monospace", background: "#080c14", padding: "8px 12px", borderRadius: 6, border: "1px solid #1E293B", display: "inline-block" }}>
                {METHOD_LABELS[data.paymentMethod ?? ""] ?? data.paymentMethod} · {data.paymentWallet}
              </div>
            </div>
          )}

          {formError && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: 13, color: "#EF4444" }}>
              {formError}
            </div>
          )}

          {success && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, fontSize: 13, color: "#22C55E" }}>
              {success}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Payment method</div>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              disabled={isDisabled}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #1E293B",
                background: "#080c14",
                color: isDisabled ? "#475569" : "#F1F5F9",
                fontSize: 14,
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled ? 0.6 : 1,
              }}
            >
              <option value="">Select method...</option>
              {(data?.supportedMethods ?? []).map((m) => (
                <option key={m} value={m}>{METHOD_LABELS[m] ?? m}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={labelStyle}>Wallet address</div>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isDisabled}
              placeholder="Enter wallet address"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #1E293B",
                background: "#080c14",
                color: isDisabled ? "#475569" : "#F1F5F9",
                fontSize: 14,
                boxSizing: "border-box",
                cursor: isDisabled ? "not-allowed" : "text",
                opacity: isDisabled ? 0.6 : 1,
              }}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              border: "none",
              background: canSave ? "#22C55E" : "#1E293B",
              color: canSave ? "#071A0E" : "#475569",
              fontWeight: 700,
              fontSize: 13,
              cursor: canSave ? "pointer" : "not-allowed",
            }}
          >
            {saving ? "Saving..." : "Save wallet"}
          </button>
        </div>

      </div>
    </div>
  );
}
