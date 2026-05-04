import { LEGAL_CONFIG } from "@/lib/legal/company";

export const metadata = {
  title: `Privacy Policy — ${LEGAL_CONFIG.productName}`,
  description: `Privacy Policy for ${LEGAL_CONFIG.productName}.`,
};

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#080c14",
    color: "#F1F5F9",
    padding: "32px 16px 80px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
    lineHeight: 1.65,
  } as const,
  container: {
    maxWidth: 720,
    margin: "0 auto",
  } as const,
  draftBanner: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderLeft: "4px solid #22C55E",
    color: "#86EFAC",
    padding: "12px 16px",
    borderRadius: 6,
    marginBottom: 32,
    fontSize: 14,
    fontWeight: 500,
  } as const,
  h1: {
    fontSize: 32,
    fontWeight: 700,
    margin: "0 0 8px",
    color: "#F8FAFC",
    letterSpacing: "-0.02em",
  } as const,
  effective: {
    fontSize: 14,
    color: "#94A3B8",
    margin: "0 0 32px",
  } as const,
  h2: {
    fontSize: 20,
    fontWeight: 600,
    margin: "32px 0 12px",
    color: "#F8FAFC",
  } as const,
  h3: {
    fontSize: 16,
    fontWeight: 600,
    margin: "20px 0 8px",
    color: "#E2E8F0",
  } as const,
  p: {
    margin: "0 0 12px",
    color: "#CBD5E1",
    fontSize: 15,
  } as const,
  ul: {
    margin: "0 0 12px",
    paddingLeft: 22,
    color: "#CBD5E1",
    fontSize: 15,
  } as const,
  li: {
    marginBottom: 6,
  } as const,
  finalNote: {
    marginTop: 40,
    padding: "16px 20px",
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    border: "1px solid rgba(34, 197, 94, 0.3)",
    borderRadius: 6,
    fontSize: 14,
    color: "#A7F3D0",
  } as const,
};

export default function PrivacyPage() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.h1}>Privacy Policy</h1>
        <p style={styles.effective}>
          Effective: {LEGAL_CONFIG.effectiveDate}
        </p>

        <p style={styles.p}>
          This Privacy Policy describes how {LEGAL_CONFIG.companyName}{" "}
          (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) collects, uses,
          shares, and protects personal data in connection with{" "}
          {LEGAL_CONFIG.productName} (the &quot;Service&quot;), available at{" "}
          {LEGAL_CONFIG.domain}. By using the Service you acknowledge the
          processing described below.
        </p>

        <h2 style={styles.h2}>1. Data We Collect</h2>
        <h3 style={styles.h3}>1.1 Account data</h3>
        <ul style={styles.ul}>
          <li style={styles.li}>Email address.</li>
          <li style={styles.li}>
            Password — stored only as a bcrypt hash; the plaintext value is
            never persisted and is not visible to us.
          </li>
          <li style={styles.li}>Username chosen by the user.</li>
        </ul>

        <h3 style={styles.h3}>1.2 Technical &amp; security data</h3>
        <ul style={styles.ul}>
          <li style={styles.li}>
            IP address — at registration and on referral-click events, the
            raw IP is hashed with SHA-256 before storage; we do not retain
            the plaintext IP.
          </li>
          <li style={styles.li}>User-agent string of the browser/device.</li>
          <li style={styles.li}>
            Approximate country, derived from IP geolocation at the time of
            the event.
          </li>
          <li style={styles.li}>
            Session JWT issued on login, used to authenticate subsequent
            requests.
          </li>
        </ul>

        <h3 style={styles.h3}>1.3 Affiliate &amp; referral data</h3>
        <ul style={styles.ul}>
          <li style={styles.li}>
            Referral cookie ID set when a user lands via /r/&#123;refCode&#125;,
            with a lifetime of 60 days, used to attribute first purchases
            to the referring affiliate.
          </li>
          <li style={styles.li}>
            Click events: hashed IP, user-agent, country, UTM parameters,
            and the resolved referral code.
          </li>
          <li style={styles.li}>
            Crypto wallet address provided by affiliates to receive payouts.
          </li>
          <li style={styles.li}>
            Conversion linkage between a referral click and the resulting
            user account and purchase.
          </li>
        </ul>

        <h3 style={styles.h3}>1.4 Trading and audit data</h3>
        <ul style={styles.ul}>
          <li style={styles.li}>
            Challenge purchases, including amount, currency, NowPayments
            transaction reference, and timestamp.
          </li>
          <li style={styles.li}>
            Trading activity associated with Challenges, including
            positions taken on Polymarket markets and resulting outcomes.
          </li>
          <li style={styles.li}>
            Audit log of administrative actions affecting your account
            (for example, suspension, ban, payout failure, or commission
            adjustment), retained for accountability.
          </li>
        </ul>

        <p style={styles.p}>
          We do not currently perform identity verification (KYC) at the MVP
          stage. Database fields exist that may support KYC in the future
          but are not in active use.
        </p>

        <h2 style={styles.h2}>2. How We Use Your Data</h2>
        <ul style={styles.ul}>
          <li style={styles.li}>To create and operate your account.</li>
          <li style={styles.li}>
            To process Challenge purchases and grant access to the
            Service.
          </li>
          <li style={styles.li}>
            To attribute referrals and calculate, hold, and pay affiliate
            commissions.
          </li>
          <li style={styles.li}>
            To detect and prevent fraud, abuse, and multi-accounting,
            including same-IP correlation between affiliate and referred
            user.
          </li>
          <li style={styles.li}>
            To enforce these Terms and respond to legal requests.
          </li>
          <li style={styles.li}>
            To communicate service-related notices, including security
            alerts and changes to terms.
          </li>
          <li style={styles.li}>
            To maintain audit logs of administrative actions for
            accountability and dispute resolution.
          </li>
        </ul>

        <h2 style={styles.h2}>3. Legal Basis for Processing</h2>
        <p style={styles.p}>
          Where the GDPR or analogous laws apply, we rely on the following
          legal bases:
        </p>
        <ul style={styles.ul}>
          <li style={styles.li}>
            <strong>Contract performance</strong> — to provide the Service
            you have requested, including processing purchases and paying
            commissions.
          </li>
          <li style={styles.li}>
            <strong>Legitimate interests</strong> — to protect the Service
            against fraud, abuse, and unauthorized access; to maintain
            accurate records; to improve reliability and security.
          </li>
          <li style={styles.li}>
            <strong>Legal obligation</strong> — where we are required by
            law to retain or disclose data.
          </li>
          <li style={styles.li}>
            <strong>Consent</strong> — for non-essential cookies or
            optional communications, where applicable; consent can be
            withdrawn at any time.
          </li>
        </ul>

        <h2 style={styles.h2}>4. Data Sharing</h2>
        <p style={styles.p}>
          We share personal data only with service providers that help us
          operate the Service, and only to the extent necessary:
        </p>
        <ul style={styles.ul}>
          <li style={styles.li}>
            <strong>NowPayments</strong> — payment processing for Challenge
            purchases (cryptocurrency).
          </li>
          <li style={styles.li}>
            <strong>Supabase</strong> — managed PostgreSQL database hosting
            for account, referral, and trading records.
          </li>
          <li style={styles.li}>
            <strong>Vercel</strong> — application hosting and edge delivery.
          </li>
          <li style={styles.li}>
            <strong>Upstash Redis</strong> — rate limiting and short-lived
            counters; processes hashed identifiers, not raw account data.
          </li>
          <li style={styles.li}>
            <strong>Polymarket</strong> — execution and resolution of
            prediction-market positions taken within Challenges.
          </li>
        </ul>
        <p style={styles.p}>
          We do not sell personal data. We may disclose data when required
          by law, to enforce our Terms, or to protect the rights, safety,
          and property of users and third parties.
        </p>

        <h2 style={styles.h2}>5. Cookies</h2>
        <ul style={styles.ul}>
          <li style={styles.li}>
            <strong>Referral cookie</strong> — stores a referral code for
            attribution; lifetime 60 days; first-party.
          </li>
          <li style={styles.li}>
            <strong>Session cookie / JWT</strong> — keeps you logged in
            after authentication; first-party; expires per session policy.
          </li>
          <li style={styles.li}>
            <strong>Third-party analytics or advertising cookies</strong>{" "}
            — not currently in use. If we add them, this Policy will be
            updated and, where required, consent will be obtained.
          </li>
        </ul>

        <h2 style={styles.h2}>6. Data Retention</h2>
        <p style={styles.p}>
          The retention periods below are illustrative and pending final
          legal review. They will be confirmed before public production
          launch.
        </p>
        <ul style={styles.ul}>
          <li style={styles.li}>
            <strong>Account data</strong> — retained while your account is
            active and for a defined period thereafter [TBD years] to meet
            tax, accounting, and dispute-resolution obligations.
          </li>
          <li style={styles.li}>
            <strong>Click and referral data</strong> — retained for
            approximately 90 days for fraud detection and attribution
            review, then aggregated or deleted.
          </li>
          <li style={styles.li}>
            <strong>Audit log of admin actions</strong> — retained
            indefinitely for accountability, in line with security best
            practice.
          </li>
          <li style={styles.li}>
            <strong>Payment records</strong> — retained as required by
            applicable financial-record-keeping laws.
          </li>
        </ul>

        <h2 style={styles.h2}>7. Your Rights</h2>
        <p style={styles.p}>
          Depending on your location, you may have the following rights:
        </p>
        <ul style={styles.ul}>
          <li style={styles.li}>
            <strong>Access</strong> — request a copy of personal data we
            hold about you.
          </li>
          <li style={styles.li}>
            <strong>Rectification</strong> — request correction of
            inaccurate or incomplete data.
          </li>
          <li style={styles.li}>
            <strong>Deletion</strong> — request deletion of your data,
            subject to retention obligations and legitimate interests
            (e.g. fraud records, audit log).
          </li>
          <li style={styles.li}>
            <strong>Portability</strong> — request your data in a
            structured, commonly used, machine-readable format.
          </li>
          <li style={styles.li}>
            <strong>Objection / Restriction</strong> — object to or
            restrict processing based on legitimate interests.
          </li>
          <li style={styles.li}>
            <strong>Withdraw consent</strong> — where processing is based
            on consent, withdraw it at any time without affecting prior
            lawful processing.
          </li>
          <li style={styles.li}>
            <strong>Complaint</strong> — lodge a complaint with your local
            data-protection authority.
          </li>
        </ul>
        <p style={styles.p}>
          To exercise any of these rights, write to{" "}
          {LEGAL_CONFIG.legalEmail}. We may need to verify your identity
          before responding.
        </p>

        <h2 style={styles.h2}>8. International Transfers</h2>
        <p style={styles.p}>
          The Service relies on global cloud infrastructure (notably Vercel
          and Supabase). Your data may therefore be processed in countries
          outside your country of residence, including jurisdictions that
          may not provide an equivalent level of data protection. Where
          required, we rely on appropriate safeguards such as standard
          contractual clauses provided by our service providers.
        </p>

        <h2 style={styles.h2}>9. Security</h2>
        <p style={styles.p}>
          We apply technical and organizational measures appropriate to the
          risk, including:
        </p>
        <ul style={styles.ul}>
          <li style={styles.li}>
            Passwords stored as bcrypt hashes only.
          </li>
          <li style={styles.li}>
            IP addresses stored as SHA-256 hashes only; raw IPs are not
            persisted.
          </li>
          <li style={styles.li}>HTTPS for all network traffic.</li>
          <li style={styles.li}>
            Rate limiting on sensitive endpoints to mitigate brute-force
            and abuse.
          </li>
          <li style={styles.li}>
            Audit logging of administrative actions.
          </li>
          <li style={styles.li}>
            Principle of least privilege for internal access to production
            data.
          </li>
        </ul>
        <p style={styles.p}>
          No system is fully secure. In the event of a personal-data breach
          likely to result in risk to your rights and freedoms, we will
          notify you and the relevant authority where required by law.
        </p>

        <h2 style={styles.h2}>10. Children</h2>
        <p style={styles.p}>
          The Service is not intended for and may not be used by anyone
          under 18. The Affiliate Program is restricted to participants
          aged 18 or older. If we learn that we have collected personal
          data from a person under 18, we will delete the data and
          terminate the account.
        </p>

        <h2 style={styles.h2}>11. Changes to this Policy</h2>
        <p style={styles.p}>
          We may update this Policy from time to time. The effective date
          at the top of the document indicates when the latest version
          took effect. Material changes will be communicated through the
          Service or by email where appropriate.
        </p>

        <h2 style={styles.h2}>12. Contact</h2>
        <p style={styles.p}>
          For privacy questions or to exercise your rights, contact us at{" "}
          {LEGAL_CONFIG.legalEmail}. Postal address:{" "}
          {LEGAL_CONFIG.companyAddress}. Company:{" "}
          {LEGAL_CONFIG.companyName}, registration{" "}
          {LEGAL_CONFIG.registrationNumber}.
        </p>

      </div>
    </div>
  );
}
