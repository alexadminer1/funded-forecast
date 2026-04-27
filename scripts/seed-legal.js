const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const blocks = [
    {
      key: "terms_content",
      value: `TERMS OF USE

1. ACCEPTANCE OF TERMS
By accessing or using FundedForecast ("Platform"), you agree to be bound by these Terms of Use. If you do not agree, do not use the Platform.

2. ELIGIBILITY
You must be at least 18 years old and legally able to enter into contracts in your jurisdiction to use the Platform.

3. PLATFORM DESCRIPTION
FundedForecast is a simulated trading platform where users trade with virtual capital on real prediction market prices. No actual financial instruments are purchased or sold on your behalf.

4. CHALLENGE FEES
Challenge participation fees are non-refundable once the challenge period has begun. Fees cover access to the evaluation platform and simulated capital.

5. PAYOUTS
Traders who successfully complete the evaluation phase may be eligible for profit-sharing payouts. Payout eligibility, amounts, and timing are subject to our Payout Policy, which may be updated at any time.

6. PROHIBITED CONDUCT
You may not attempt to manipulate the platform, use automated bots, share accounts, or engage in any form of cheating. Violations result in immediate account termination without refund.

7. INTELLECTUAL PROPERTY
All content, software, and materials on the Platform are owned by FundedForecast and protected by intellectual property laws.

8. DISCLAIMER OF WARRANTIES
The Platform is provided "as is" without warranties of any kind. We do not guarantee uninterrupted access or specific trading results.

9. LIMITATION OF LIABILITY
FundedForecast shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Platform.

10. MODIFICATIONS
We reserve the right to modify these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the new Terms.

11. GOVERNING LAW
These Terms are governed by applicable law. Any disputes shall be resolved through binding arbitration.

12. CONTACT
For questions about these Terms, contact us at support@fundedforecast.com`,
    },
    {
      key: "privacy_content",
      value: `PRIVACY POLICY

1. INFORMATION WE COLLECT
We collect information you provide directly, including name, email address, and payment information. We also collect usage data, device information, and trading activity within the Platform.

2. HOW WE USE YOUR INFORMATION
We use collected information to:
- Provide and maintain the Platform
- Process payments and payouts
- Send administrative communications
- Improve Platform features
- Comply with legal obligations

3. DATA SHARING
We do not sell your personal information. We may share data with:
- Payment processors (for transaction handling)
- Service providers who assist Platform operations
- Law enforcement when required by law

4. COOKIES
We use cookies and similar technologies to maintain sessions, remember preferences, and analyze usage patterns. You may disable cookies in your browser settings, though some Platform features may not function properly.

5. DATA SECURITY
We implement industry-standard security measures to protect your information. However, no method of transmission over the Internet is 100% secure.

6. DATA RETENTION
We retain your information for as long as your account is active and as required by law. You may request deletion of your account and associated data by contacting us.

7. YOUR RIGHTS
Depending on your jurisdiction, you may have rights to access, correct, or delete your personal data. Contact us at privacy@fundedforecast.com to exercise these rights.

8. CHILDREN'S PRIVACY
The Platform is not directed to individuals under 18. We do not knowingly collect personal information from minors.

9. CHANGES TO THIS POLICY
We may update this Privacy Policy periodically. We will notify you of significant changes via email or Platform notice.

10. CONTACT
For privacy-related inquiries: privacy@fundedforecast.com`,
    },
    {
      key: "risk_content",
      value: `RISK DISCLOSURE

IMPORTANT — PLEASE READ CAREFULLY

1. SIMULATED TRADING
FundedForecast operates a simulated trading environment. All positions are paper trades using virtual capital. No actual financial instruments are purchased or sold.

2. CHALLENGE FEE RISK
The challenge participation fee is the only real money at risk. This fee is non-refundable once the challenge begins. You may not pass the evaluation, in which case your fee is not returned.

3. PREDICTION MARKET VOLATILITY
The simulated markets mirror real Polymarket prediction market prices, which can be highly volatile. Prices can move rapidly and unpredictably based on news events, public sentiment, and other factors outside your control.

4. NO GUARANTEE OF PROFIT
Past performance in the evaluation phase does not guarantee future results or payout eligibility. Trading performance can vary significantly.

5. PAYOUT RISK
Payout eligibility is conditional on meeting all challenge criteria. FundedForecast reserves the right to modify payout terms, caps, and eligibility requirements. Payouts are not guaranteed.

6. PLATFORM RISK
The Platform may experience technical issues, downtime, or errors that could affect your trading activity. We are not liable for losses of challenge progress due to technical failures.

7. REGULATORY RISK
The regulatory environment for prediction markets and prop trading platforms may change. Such changes could affect Platform operations or your ability to participate.

8. NO FINANCIAL ADVICE
Nothing on the Platform constitutes financial, investment, legal, or tax advice. You should consult qualified professionals before making financial decisions.

9. JURISDICTIONAL RESTRICTIONS
The Platform may not be available in all jurisdictions. It is your responsibility to ensure participation is permitted in your location.

10. ACKNOWLEDGMENT
By using the Platform, you acknowledge that you have read, understood, and accept these risks. If you do not accept these risks, do not use the Platform.

For questions: support@fundedforecast.com`,
    },
  ];

  for (const block of blocks) {
    await prisma.contentBlock.upsert({
      where: { key: block.key },
      update: { value: block.value },
      create: { key: block.key, value: block.value },
    });
    console.log(`Seeded: ${block.key}`);
  }

  console.log("Legal content seeded successfully.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
