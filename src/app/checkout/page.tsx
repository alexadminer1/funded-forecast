"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { apiFetch, getToken } from "@/lib/api";

/* =====================================================================
   Types
====================================================================== */

interface Plan {
  id: number;
  name: string;
  price: number;
  accountSize: number;
  profitTargetPct: number;
  maxLossPct: number;
  dailyLossPct: number;
  minTradingDays: number;
  profitSharePct: number;
}

interface Invoice {
  paymentId: string;
  status: string;
  isExpired?: boolean;
  address: string;
  planAmountUsd: string;
  amountUsd: string;
  amountUsdc: string;
  expectedAmountUnits: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  expiresAt: string;
  confirmationsSeen?: number;
  confirmationsRequired: number;
  primaryTxHash?: string | null;
}

const NETWORK_NAMES: Record<number, string> = {
  84532: "Base Sepolia (Testnet)",
  8453: "Base Mainnet",
};

const ACTIVE_STATUSES = new Set(["AWAITING_PAYMENT", "SEEN_ON_CHAIN", "CONFIRMING", "UNDERPAID"]);

/* =====================================================================
   Page wrapper
====================================================================== */

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", background: "#080c14", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>
          Loading...
        </div>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}

/* =====================================================================
   Main component
====================================================================== */

function CheckoutInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = parseInt(searchParams.get("planId") ?? "0");

  const [plan, setPlan] = useState<Plan | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Ref flags to prevent re-trigger of effects on state changes.
  // Without these, setState inside useEffect would re-run the effect.
  const invoiceAttemptRef = useRef<boolean>(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ----- Effect: load plan + auth check (runs once on mount) ----- */
  useEffect(() => {
    if (!getToken()) {
      router.push(`/login?mode=login&redirect=/checkout?planId=${planId}`);
      return;
    }
    if (!planId) {
      router.push("/account/plans");
      return;
    }

    let cancelled = false;
    apiFetch<{ success: boolean; plan: Plan }>(`/api/plans/${planId}`)
      .then((d) => {
        if (cancelled) return;
        if (d.success) setPlan(d.plan);
        else router.push("/account/plans");
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load plan.");
      })
      .finally(() => {
        if (!cancelled) setLoadingPlan(false);
      });

    return () => { cancelled = true; };
  }, [planId, router]);

  /* ----- Effect: create invoice ONCE when plan is loaded -----
     Uses ref flag to prevent re-trigger on state changes.
     Without ref, the effect would re-run on every setState below.
  */
  useEffect(() => {
    if (!plan) return;
    if (invoiceAttemptRef.current) return;
    invoiceAttemptRef.current = true;

    setLoadingInvoice(true);
    setError(null);

    let cancelled = false;
    apiFetch<Invoice & { success: boolean; error?: string }>("/api/payments/create", {
      method: "POST",
      body: JSON.stringify({ planId: plan.id }),
    })
      .then((d) => {
        if (cancelled) return;
        if (d.success) {
          setInvoice(d);
        } else {
          setError(d.error ?? "Failed to create invoice.");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        // Detect rate limit (429). apiFetch usually surfaces error.message
        // containing the response body or status info.
        if (message.includes("429") || message.toLowerCase().includes("too many")) {
          setError("Too many requests. Please wait a minute and refresh the page.");
        } else if (message.includes("401")) {
          setError("Session expired. Please log in again.");
        } else {
          setError("Failed to create invoice. Please refresh the page.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingInvoice(false);
      });

    return () => { cancelled = true; };
  }, [plan]);

  /* ----- Effect: status polling every 5 sec ----- */
  useEffect(() => {
    if (!invoice) return;
    if (!ACTIVE_STATUSES.has(invoice.status)) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const data = await apiFetch<Invoice & { success: boolean }>(`/api/payments/${invoice.paymentId}/status`);
        if (data.success) {
          setInvoice((prev) => (prev ? { ...prev, ...data } : data));
        }
      } catch {
        // Silent fail on polling errors — keep last good state.
        // If polling 429s repeatedly, user can refresh; we don't spam UI.
      }
    }, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [invoice?.paymentId, invoice?.status]);

  /* ----- Effect: countdown tick every 1 sec ----- */
  useEffect(() => {
    if (!invoice) return;
    const expiresMs = new Date(invoice.expiresAt).getTime();

    const update = () => {
      const left = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    update();

    tickIntervalRef.current = setInterval(update, 1000);
    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [invoice?.expiresAt]);

  /* ----- Helpers ----- */
  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 1500);
      })
      .catch(() => {});
  }

  function formatTime(s: number): string {
    const mm = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function handleCreateNew() {
    // Manual user action: reset and try again.
    // Reset both state and ref so the create effect can run once more.
    invoiceAttemptRef.current = false;
    setInvoice(null);
    setError(null);
  }

  /* ----- Cancel handler -----
     Confirm with user, call cancel endpoint, redirect to /account/plans on success.
     On failure show banner; user can retry or close window.
  */
  async function handleCancel() {
    if (!invoice) return;
    if (cancelling) return;
    if (!confirm("Cancel this invoice and choose another plan?")) return;

    setCancelling(true);
    setCancelError(null);

    try {
      await apiFetch<{ success: boolean }>(`/api/payments/${invoice.paymentId}/cancel`, {
        method: "POST",
      });
      // Success — go back to plans page.
      router.push("/account/plans");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Endpoint can return 409 if status not cancellable (race with watcher),
      // 404 if not found (race with cron expiring it), or other.
      if (message.includes("409")) {
        setCancelError("Cannot cancel — payment is already in progress. Please refresh.");
      } else {
        setCancelError("Failed to cancel. Please try again.");
      }
      setCancelling(false);
    }
  }

  /* ----- Render ----- */

  if (loadingPlan) {
    return <Centered>Loading plan...</Centered>;
  }

  if (!plan) return null;

  // Error state (shown when no invoice could be created).
  // No automatic retry — user must refresh or click button.
  if (error && !invoice) {
    const isRateLimit = error.includes("Too many");
    return (
      <Layout>
        <BackLink />
        <Banner kind="error">
          <div style={{ marginBottom: 8 }}>{error}</div>
          {!isRateLimit && (
            <button onClick={handleCreateNew} style={btnInlineRetry}>
              Try again
            </button>
          )}
        </Banner>
      </Layout>
    );
  }

  if (loadingInvoice || !invoice) {
    return <Centered>Generating invoice...</Centered>;
  }

  const networkName = NETWORK_NAMES[invoice.chainId] ?? `Chain ${invoice.chainId}`;
  const isExpired =
    invoice.isExpired ||
    invoice.status === "EXPIRED" ||
    invoice.status === "EXPIRED_UNDERPAID" ||
    (secondsLeft <= 0 && invoice.status === "AWAITING_PAYMENT");

  // CONFIRMED
  if (invoice.status === "CONFIRMED") {
    return (
      <Layout>
        <BackLink />
        <PlanCard plan={plan} />
        <div style={confirmedBox}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#22C55E", marginBottom: 8 }}>
            Payment confirmed
          </div>
          <div style={{ fontSize: 13, color: "#94A3B8" }}>
            Activating your challenge...
          </div>
        </div>
      </Layout>
    );
  }

  // EXPIRED
  if (isExpired) {
    return (
      <Layout>
        <BackLink />
        <PlanCard plan={plan} />
        <Banner kind="warning">
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Invoice expired</div>
          <div style={{ fontSize: 12, color: "#94A3B8" }}>
            This invoice has expired. Create a new one to continue.
          </div>
        </Banner>
        <button onClick={handleCreateNew} style={btnPrimary}>
          Create new invoice
        </button>
      </Layout>
    );
  }

  // CONFIRMING / SEEN_ON_CHAIN
  if (invoice.status === "CONFIRMING" || invoice.status === "SEEN_ON_CHAIN") {
    return (
      <Layout>
        <BackLink />
        <PlanCard plan={plan} />
        <div style={confirmingBox}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#22C55E", marginBottom: 8 }}>
            ✓ Transaction detected
          </div>
          <div style={{ fontSize: 14, color: "#F1F5F9", marginBottom: 16 }}>
            Confirmations: {invoice.confirmationsSeen ?? 0} / {invoice.confirmationsRequired}
          </div>
          <div style={progressTrack}>
            <div
              style={{
                ...progressBar,
                width: `${Math.min(100, ((invoice.confirmationsSeen ?? 0) / invoice.confirmationsRequired) * 100)}%`,
              }}
            />
          </div>
          {invoice.primaryTxHash && (
            <div style={{ fontSize: 11, color: "#475569", marginTop: 12, fontFamily: "ui-monospace,monospace", wordBreak: "break-all" }}>
              tx: {invoice.primaryTxHash}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // UNDERPAID
  if (invoice.status === "UNDERPAID") {
    return (
      <Layout>
        <BackLink />
        <PlanCard plan={plan} />
        <Banner kind="warning">
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Underpaid</div>
          <div style={{ fontSize: 12, color: "#94A3B8" }}>
            Received less than expected. Send the remaining amount before the invoice expires.
          </div>
        </Banner>
        <PaymentDetails invoice={invoice} networkName={networkName} secondsLeft={secondsLeft} formatTime={formatTime} copy={copy} copiedKey={copiedKey} onCancel={handleCancel} cancelling={cancelling} cancelError={cancelError} />
      </Layout>
    );
  }

  // AWAITING_PAYMENT (default)
  return (
    <Layout>
      <BackLink />
      <PlanCard plan={plan} />
      <PaymentDetails invoice={invoice} networkName={networkName} secondsLeft={secondsLeft} formatTime={formatTime} copy={copy} copiedKey={copiedKey} onCancel={handleCancel} cancelling={cancelling} cancelError={cancelError} />
    </Layout>
  );
}

/* =====================================================================
   Subcomponents
====================================================================== */

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#F1F5F9", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "80px 24px" }}>{children}</div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#080c14", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>
      {children}
    </div>
  );
}

function BackLink() {
  return (
    <a href="/account/plans" style={{ fontSize: 13, color: "#22C55E", textDecoration: "none", display: "inline-block", marginBottom: 40 }}>
      ← Back to plans
    </a>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#22C55E", letterSpacing: "0.1em", marginBottom: 8 }}>CHECKOUT</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4, marginTop: 0 }}>{plan.name} Challenge</h1>
      <p style={{ fontSize: 13, color: "#475569", marginBottom: 32 }}>${plan.accountSize.toLocaleString()} paper capital · {plan.profitSharePct}% profit share</p>
    </>
  );
}

interface PaymentDetailsProps {
  invoice: Invoice;
  networkName: string;
  secondsLeft: number;
  formatTime: (s: number) => string;
  copy: (text: string, key: string) => void;
  copiedKey: string | null;
  onCancel: () => void;
  cancelling: boolean;
  cancelError: string | null;
}

function PaymentDetails({ invoice, networkName, secondsLeft, formatTime, copy, copiedKey, onCancel, cancelling, cancelError }: PaymentDetailsProps) {
  return (
    <>
      <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 24, marginBottom: 16, textAlign: "center" }}>
        <div style={{ background: "#fff", padding: 16, borderRadius: 8, display: "inline-block", marginBottom: 16 }}>
          <QRCodeSVG value={invoice.address} size={220} level="M" />
        </div>
        <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          scan to copy address
        </div>
      </div>

      <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <Row label="Network">{networkName}</Row>
        <Row label="Token">{invoice.tokenSymbol}</Row>
        <Row label="Amount">
          <span style={{ color: "#22C55E", fontWeight: 700 }}>{invoice.amountUsdc} {invoice.tokenSymbol}</span>
          <button onClick={() => copy(invoice.amountUsdc, "amount")} style={btnCopySmall}>{copiedKey === "amount" ? "Copied ✓" : "Copy"}</button>
        </Row>
        <Row label="Expires in">
          <span style={{ fontFamily: "ui-monospace,monospace", color: secondsLeft < 60 ? "#EF4444" : "#F1F5F9" }}>
            {formatTime(secondsLeft)}
          </span>
        </Row>
      </div>

      <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#64748B", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
          Receiver address
        </div>
        <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, color: "#F1F5F9", wordBreak: "break-all", marginBottom: 12 }}>
          {invoice.address}
        </div>
        <button onClick={() => copy(invoice.address, "address")} style={btnSecondary}>
          {copiedKey === "address" ? "Copied ✓" : "Copy address"}
        </button>
      </div>

      <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, padding: "14px 16px", marginBottom: 24, fontSize: 12, color: "#FCA5A5", lineHeight: 1.6 }}>
        Send <strong style={{ color: "#FECACA" }}>exactly {invoice.amountUsdc} {invoice.tokenSymbol}</strong> to this address on <strong style={{ color: "#FECACA" }}>{networkName}</strong>. Sending another token, another network, or a different amount may not be detected automatically.
      </div>

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10, padding: "14px 16px", marginBottom: 16, opacity: 0.5 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Credit / Debit Card</div>
        <div style={{ fontSize: 12, color: "#334155" }}>Coming soon</div>
      </div>

      {cancelError && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#EF4444" }}>
          {cancelError}
        </div>
      )}

      <button
        onClick={onCancel}
        disabled={cancelling}
        style={{
          width: "100%",
          padding: "11px",
          borderRadius: 8,
          background: "transparent",
          color: cancelling ? "#475569" : "#94A3B8",
          border: "1px solid rgba(148,163,184,0.2)",
          fontSize: 12,
          fontWeight: 600,
          cursor: cancelling ? "default" : "pointer",
          opacity: cancelling ? 0.6 : 1,
        }}
      >
        {cancelling ? "Cancelling..." : "Cancel and choose another plan"}
      </button>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize: 13, color: "#64748B" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#F1F5F9", display: "flex", alignItems: "center", gap: 8 }}>{children}</span>
    </div>
  );
}

function Banner({ kind, children }: { kind: "error" | "warning"; children: React.ReactNode }) {
  const colors = kind === "error"
    ? { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", text: "#EF4444" }
    : { bg: "rgba(251,191,36,0.06)", border: "rgba(251,191,36,0.2)", text: "#FCD34D" };

  return (
    <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: colors.text }}>
      {children}
    </div>
  );
}

/* =====================================================================
   Inline styles
====================================================================== */

const btnPrimary: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 10,
  border: "none",
  background: "#22C55E",
  color: "#071A0E",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 0 24px rgba(34,197,94,0.3)",
};

const btnSecondary: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid rgba(34,197,94,0.4)",
  background: "transparent",
  color: "#22C55E",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnCopySmall: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#22C55E",
  background: "rgba(34,197,94,0.1)",
  border: "1px solid rgba(34,197,94,0.2)",
  borderRadius: 6,
  padding: "3px 8px",
  cursor: "pointer",
  marginLeft: 4,
};

const btnInlineRetry: React.CSSProperties = {
  fontSize: 12,
  color: "#EF4444",
  background: "transparent",
  border: "1px solid rgba(239,68,68,0.3)",
  borderRadius: 6,
  padding: "4px 10px",
  cursor: "pointer",
};

const confirmedBox: React.CSSProperties = {
  background: "rgba(34,197,94,0.08)",
  border: "1px solid rgba(34,197,94,0.25)",
  borderRadius: 14,
  padding: 32,
  textAlign: "center",
  marginBottom: 16,
};

const confirmingBox: React.CSSProperties = {
  background: "#0d1117",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
  padding: 24,
  marginBottom: 16,
};

const progressTrack: React.CSSProperties = {
  width: "100%",
  height: 6,
  background: "rgba(255,255,255,0.05)",
  borderRadius: 3,
  overflow: "hidden",
};

const progressBar: React.CSSProperties = {
  height: "100%",
  background: "#22C55E",
  transition: "width 0.5s ease-out",
};
