import { LEGAL_CONFIG } from "@/lib/legal/company";

export const metadata = {
  title: `Terms of Service — ${LEGAL_CONFIG.productName}`,
  description: `Terms of Service for ${LEGAL_CONFIG.productName}.`,
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

export default function TermsPage() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.draftBanner}>
          DRAFT — pending legal review before production launch.
        </div>

        <h1 style={styles.h1}>Terms of Service</h1>
        <p style={styles.effective}>
          Effective: {LEGAL_CONFIG.effectiveDate}
        </p>

        <h2 style={styles.h2}>1. Acceptance of Terms</h2>
        <p style={styles.p}>
          These Terms of Service (the &quot;Terms&quot;) govern your access to
          and use of {LEGAL_CONFIG.productName} (the &quot;Service&quot;),
          operated by {LEGAL_CONFIG.companyName} (&quot;we&quot;,
          &quot;us&quot;, or &quot;our&quot;). By creating an account,
          purchasing a challenge, or otherwise using the Service, you confirm
          that you have read, understood, and agreed to be bound by these
          Terms. If you do not agree, you must not use the Service.
        </p>

        <h2 style={styles.h2}>2. Eligibility</h2>
        <p style={styles.p}>
          To use the Service you must be at least 18 years old and legally
          capable of entering into a binding contract in your jurisdiction.
          The Service is not available to residents of jurisdictions where
          prediction markets, derivatives, or related financial activities
          are restricted or prohibited. A list of restricted jurisdictions
          is [TBD] and will be published prior to public launch. You are
          solely responsible for verifying that your use of the Service is
          lawful where you reside.
        </p>

        <h2 style={styles.h2}>3. Account Registration &amp; Security</h2>
        <p style={styles.p}>
          You must register an account using a valid email address and a
          password of sufficient strength. Passwords are stored only in
          hashed form (bcrypt) and we never see your plaintext password.
          You are responsible for maintaining the confidentiality of your
          credentials and for all activity occurring under your account.
          You agree to notify us immediately at {LEGAL_CONFIG.supportEmail}{" "}
          if you suspect unauthorized access. We may suspend or terminate
          accounts that show signs of compromise, abuse, or violation of
          these Terms.
        </p>
        <p style={styles.p}>
          One person may hold only one account. Creating multiple accounts,
          sharing accounts, or registering on behalf of another person is
          prohibited.
        </p>

        <h2 style={styles.h2}>4. Description of Service</h2>
        <p style={styles.p}>
          {LEGAL_CONFIG.productName} offers paid evaluation programs
          (&quot;Challenges&quot;) in which users take simulated or real
          positions on event outcomes sourced from Polymarket prediction
          markets. Users who meet defined performance thresholds within a
          Challenge may qualify for a funded account on terms published
          separately. The Service is provided through the website at{" "}
          {LEGAL_CONFIG.domain} and any associated subdomains.
        </p>
        <p style={styles.p}>
          We do not act as a broker, dealer, exchange, or investment adviser.
          Trade execution against prediction-market outcomes is performed
          through Polymarket; we do not custody user funds for trading and
          do not guarantee the availability, pricing, or settlement of any
          Polymarket market.
        </p>

        <h2 style={styles.h2}>5. Risk Disclosure</h2>
        <p style={styles.p}>
          Trading on prediction markets carries substantial risk, including
          the risk of losing the entire amount you paid for a Challenge.
          Outcomes of prediction markets are uncertain by nature and may
          resolve in ways that are unfavorable to your positions. Past
          performance — yours or anyone else&apos;s — does not predict
          future results.
        </p>
        <p style={styles.p}>
          The Service does not provide investment, financial, legal, or tax
          advice. Nothing on the platform constitutes a recommendation to
          buy, sell, or hold any asset or take any position. You are
          responsible for your own decisions and should consult qualified
          professionals before participating.
        </p>
        <p style={styles.p}>
          Crypto payments and crypto-denominated payouts are subject to
          additional risks including price volatility, network congestion,
          irreversible transactions, and the risk of sending funds to an
          incorrect address.
        </p>

        <h2 style={styles.h2}>6. Payments</h2>
        <p style={styles.p}>
          Challenge purchases are processed exclusively through NowPayments
          in supported cryptocurrencies. We do not accept fiat payments at
          this time. Prices may be displayed in USD for reference but are
          settled in crypto at the rate quoted at checkout.
        </p>
        <p style={styles.p}>
          You are responsible for any network fees, exchange spreads, or
          third-party charges incurred when funding a payment. A purchase
          is considered complete only when the corresponding on-chain
          transaction has reached the confirmation threshold required by
          NowPayments.
        </p>

        <h2 style={styles.h2}>7. Refund Policy</h2>
        <p style={styles.p}>
          Challenge purchases are generally non-refundable once the
          Challenge has been activated, given that activation provides
          immediate access to a digital service. Refunds may be granted
          on a case-by-case basis where (a) the Challenge has not been
          activated, (b) a duplicate or technical-error charge occurred,
          or (c) we are required by applicable law to issue a refund.
        </p>
        <p style={styles.p}>
          Where a refund is issued in crypto, the amount refunded will be
          based on the original crypto amount received, not on subsequent
          fiat-equivalent value. We do not bear responsibility for
          fluctuations between the time of purchase and the time of refund.
        </p>

        <h2 style={styles.h2}>8. Affiliate Program</h2>
        <h3 style={styles.h3}>8.1 Participation</h3>
        <p style={styles.p}>
          Eligible users may apply to the Affiliate Program. Acceptance is
          at our sole discretion. Affiliates receive a unique referral link
          of the form {LEGAL_CONFIG.domain}/r/&#123;refCode&#125; and earn a
          commission on the first qualifying purchase by each referred
          user.
        </p>
        <h3 style={styles.h3}>8.2 Commissions and Holds</h3>
        <p style={styles.p}>
          Commission rates range between 10% and 25% of the first qualifying
          purchase, depending on tier and program parameters published in
          the affiliate cabinet. Earned commissions are subject to a default
          hold period of 30 days from the referred purchase before becoming
          eligible for payout. We may extend hold periods in cases of
          suspected fraud, chargeback risk, or pending review.
        </p>
        <h3 style={styles.h3}>8.3 Payouts</h3>
        <p style={styles.p}>
          Payouts are made in supported cryptocurrencies (currently USDT on
          TRC20/ERC20 and USDC on ERC20/Polygon) to a wallet address
          provided by the affiliate. The affiliate is solely responsible
          for the accuracy of the wallet address. Payouts sent to an
          incorrect address cannot be recovered.
        </p>
        <h3 style={styles.h3}>8.4 Suspension, Forfeiture, Clawback</h3>
        <p style={styles.p}>
          We may suspend, ban, reject, fail, or claw back commissions, in
          whole or in part, including but not limited to the following
          cases: self-referral; same-IP correlation between affiliate and
          referred user; fake or incentivized traffic; coordinated
          multi-accounting; chargebacks or refunds on the underlying
          purchase; violation of these Terms; or any conduct we reasonably
          believe to be fraudulent or abusive. If a referred purchase is
          refunded after the corresponding commission was paid, we reserve
          the right to recover the paid amount by deducting it from future
          commissions or by direct invoice.
        </p>

        <h2 style={styles.h2}>9. Prohibited Conduct</h2>
        <p style={styles.p}>You agree not to:</p>
        <ul style={styles.ul}>
          <li style={styles.li}>
            Use the Service in violation of any applicable law or regulation.
          </li>
          <li style={styles.li}>
            Create more than one account, or use proxies, VPNs, or
            automation to circumvent restrictions or detection.
          </li>
          <li style={styles.li}>
            Generate fake referrals, self-refer, or solicit referrals using
            misleading claims.
          </li>
          <li style={styles.li}>
            Attempt to manipulate Polymarket markets, exploit pricing
            errors, or collude with other users.
          </li>
          <li style={styles.li}>
            Reverse-engineer, scrape, or interfere with the Service or its
            infrastructure.
          </li>
          <li style={styles.li}>
            Submit false information, including identity, country of
            residence, or wallet ownership.
          </li>
        </ul>

        <h2 style={styles.h2}>10. Intellectual Property</h2>
        <p style={styles.p}>
          All content, software, designs, trademarks, and other materials
          comprising the Service are owned by {LEGAL_CONFIG.companyName} or
          its licensors and are protected by intellectual property laws.
          We grant you a limited, non-exclusive, non-transferable,
          revocable license to access and use the Service for its intended
          purpose. You may not copy, modify, distribute, or create
          derivative works from any part of the Service without our prior
          written consent.
        </p>

        <h2 style={styles.h2}>11. Termination</h2>
        <p style={styles.p}>
          We may suspend or terminate your access to the Service at any
          time, with or without notice, for any breach of these Terms,
          suspected fraud, legal compliance reasons, or operational
          necessity. You may terminate your account at any time by
          contacting {LEGAL_CONFIG.supportEmail}. Provisions that by their
          nature should survive termination — including risk disclosures,
          intellectual property, disclaimers, limitation of liability,
          indemnification, and governing law — will survive.
        </p>

        <h2 style={styles.h2}>12. Disclaimer of Warranties</h2>
        <p style={styles.p}>
          The Service is provided &quot;as is&quot; and &quot;as
          available&quot;, without warranties of any kind, express or
          implied, including merchantability, fitness for a particular
          purpose, non-infringement, accuracy, uninterrupted availability,
          or freedom from errors. We do not warrant that any Challenge can
          be passed, that markets will be available, or that outcomes will
          match expectations.
        </p>

        <h2 style={styles.h2}>13. Limitation of Liability</h2>
        <p style={styles.p}>
          To the maximum extent permitted by law, {LEGAL_CONFIG.companyName},
          its affiliates, officers, employees, and agents will not be
          liable for any indirect, incidental, special, consequential,
          punitive, or exemplary damages, including loss of profits, data,
          or goodwill, arising out of or in connection with the Service.
          Our aggregate liability to you for any claim arising from these
          Terms or the Service will not exceed the total amount you paid
          to us in the 12 months preceding the event giving rise to the
          claim.
        </p>

        <h2 style={styles.h2}>14. Indemnification</h2>
        <p style={styles.p}>
          You agree to indemnify and hold harmless{" "}
          {LEGAL_CONFIG.companyName} and its affiliates from any claims,
          damages, liabilities, costs, and expenses (including reasonable
          legal fees) arising from your use of the Service, your breach of
          these Terms, or your violation of any law or third-party right.
        </p>

        <h2 style={styles.h2}>15. Changes to Terms</h2>
        <p style={styles.p}>
          We may update these Terms from time to time. Material changes
          will be communicated via the Service or by email. The updated
          Terms take effect on the date stated at the top of the document.
          Continued use of the Service after the effective date constitutes
          acceptance of the revised Terms.
        </p>

        <h2 style={styles.h2}>16. Governing Law</h2>
        <p style={styles.p}>
          These Terms are governed by and construed in accordance with the
          laws of {LEGAL_CONFIG.jurisdiction}, without regard to its
          conflict-of-laws principles. Any dispute arising under or in
          connection with these Terms will be subject to the exclusive
          jurisdiction of the competent courts of{" "}
          {LEGAL_CONFIG.jurisdiction}, unless mandatory consumer-protection
          rules of your country of residence provide otherwise.
        </p>

        <h2 style={styles.h2}>17. Contact</h2>
        <p style={styles.p}>
          For questions about these Terms, write to{" "}
          {LEGAL_CONFIG.legalEmail}. For general support inquiries, write
          to {LEGAL_CONFIG.supportEmail}. Postal address:{" "}
          {LEGAL_CONFIG.companyAddress}. Company registration:{" "}
          {LEGAL_CONFIG.registrationNumber}.
        </p>

        <div style={styles.finalNote}>
          Reminder: this document is a draft prepared for closed-test use
          only. It has not yet been reviewed by qualified legal counsel and
          must not be treated as final or binding before such review is
          completed and the page is approved for production launch.
        </div>
      </div>
    </div>
  );
}
