"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";

const card: React.CSSProperties = { background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "24px 28px", marginBottom: 16 };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #1E293B", background: "#080c14", color: "#F1F5F9", fontSize: 14, boxSizing: "border-box", outline: "none" };
const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: 90, resize: "vertical" as const };
const btn: React.CSSProperties = { padding: "10px 24px", borderRadius: 8, border: "none", background: "#22C55E", color: "#071A0E", fontWeight: 700, fontSize: 13, cursor: "pointer" };

export default function AffiliateApplyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    refCode: "",
    promoChannels: "",
    audience: "",
    experience: "",
    country: "",
    websiteOrSocial: "",
    acceptedTerms: false,
  });

  const load = useCallback(async () => {
    if (!getToken()) { router.push("/login"); return; }
    const res = await apiFetch<any>("/api/affiliate/me");
    setExisting(res.affiliate ?? null);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit() {
    setMsg("");
    if (!form.refCode.trim() || !form.promoChannels.trim() || !form.audience.trim()) {
      setMsg("refCode, promo channels and audience are required");
      return;
    }
    if (!form.acceptedTerms) {
      setMsg("You must accept the affiliate terms");
      return;
    }

    setSubmitting(true);
    const body = {
      refCode: form.refCode.trim(),
      applicationData: {
        promoChannels: form.promoChannels.trim(),
        audience: form.audience.trim(),
        ...(form.experience.trim() && { experience: form.experience.trim() }),
        ...(form.country.trim() && { country: form.country.trim() }),
        ...(form.websiteOrSocial.trim() && { websiteOrSocial: form.websiteOrSocial.trim() }),
      },
    };

    const res = await apiFetch<any>("/api/affiliate/apply", { method: "POST", body: JSON.stringify(body) });
    setSubmitting(false);

    if (res.affiliate) {
      router.push("/affiliate");
    } else {
      setMsg(res.message ?? res.error ?? "Submission failed");
    }
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#080c14", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>
      Loading...
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#F1F5F9", fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "80px 24px 60px" }}>

        <div style={{ marginBottom: 40 }}>
          <a href="/affiliate" style={{ fontSize: 13, color: "#22C55E", textDecoration: "none" }}>← Affiliate</a>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 16, marginBottom: 4 }}>Apply to the Affiliate Program</h1>
          <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>Your application will be reviewed within 1–3 business days.</p>
        </div>

        {existing !== null ? (
          <div style={card}>
            <div style={{ fontSize: 14, color: "#94A3B8", marginBottom: 16 }}>You already have an application on file.</div>
            <a href="/affiliate" style={{ fontSize: 13, fontWeight: 700, color: "#22C55E", textDecoration: "none" }}>View application status →</a>
          </div>
        ) : (
          <div style={card}>

            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Referral code <span style={{ color: "#EF4444" }}>*</span></div>
              <input
                style={inputStyle}
                placeholder="4-20 chars, a-z 0-9 _ -"
                value={form.refCode}
                onChange={e => setForm({ ...form, refCode: e.target.value })}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Promo channels <span style={{ color: "#EF4444" }}>*</span></div>
              <textarea
                style={textareaStyle}
                placeholder="Describe how you plan to promote (YouTube, Telegram, blog, etc.)"
                value={form.promoChannels}
                onChange={e => setForm({ ...form, promoChannels: e.target.value })}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Audience <span style={{ color: "#EF4444" }}>*</span></div>
              <textarea
                style={textareaStyle}
                placeholder="Describe your audience (size, interests, geography)"
                value={form.audience}
                onChange={e => setForm({ ...form, audience: e.target.value })}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Experience <span style={{ fontSize: 10, fontWeight: 400, color: "#475569", textTransform: "none", letterSpacing: 0 }}>optional</span></div>
              <input
                style={inputStyle}
                placeholder="Your experience in affiliate / trading"
                value={form.experience}
                onChange={e => setForm({ ...form, experience: e.target.value })}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Country <span style={{ fontSize: 10, fontWeight: 400, color: "#475569", textTransform: "none", letterSpacing: 0 }}>optional</span></div>
              <input
                style={inputStyle}
                placeholder="Your country"
                value={form.country}
                onChange={e => setForm({ ...form, country: e.target.value })}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={labelStyle}>Website or social <span style={{ fontSize: 10, fontWeight: 400, color: "#475569", textTransform: "none", letterSpacing: 0 }}>optional</span></div>
              <input
                style={inputStyle}
                placeholder="https://..."
                value={form.websiteOrSocial}
                onChange={e => setForm({ ...form, websiteOrSocial: e.target.value })}
              />
            </div>

            <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <input
                type="checkbox"
                id="acceptedTerms"
                checked={form.acceptedTerms}
                onChange={e => setForm({ ...form, acceptedTerms: e.target.checked })}
                style={{ marginTop: 2, cursor: "pointer", accentColor: "#22C55E", width: 16, height: 16, flexShrink: 0 }}
              />
              <label htmlFor="acceptedTerms" style={{ fontSize: 13, color: "#94A3B8", cursor: "pointer", lineHeight: 1.5 }}>
                I agree to the affiliate program terms and conditions
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                style={{ ...btn, opacity: (!form.acceptedTerms || submitting) ? 0.5 : 1, cursor: (!form.acceptedTerms || submitting) ? "not-allowed" : "pointer" }}
                onClick={handleSubmit}
                disabled={!form.acceptedTerms || submitting}
              >
                {submitting ? "Submitting..." : "Submit application"}
              </button>
              {msg && <span style={{ fontSize: 13, color: "#EF4444" }}>{msg}</span>}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
