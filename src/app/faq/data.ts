export type FAQItem = { q: string; a: string };
export type FAQCategory = { id: string; title: string; description: string; items: FAQItem[] };

export const faqData: FAQCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Getting started with FundedForecast",
    items: [
      { q: "What is FundedForecast?", a: "FundedForecast is a skill-based evaluation platform where you trade on real Polymarket prediction market data using virtual capital. Traders who pass our evaluation challenges become eligible for profit-sharing payouts." },
      { q: "How does FundedForecast work?", a: "You purchase a challenge, receive a virtual trading account, and trade on real Polymarket prediction market prices. If you meet the profit target without violating the risk rules, you pass the evaluation and become eligible for payouts." },
      { q: "Do I trade with real money?", a: "No. All trading on FundedForecast is simulated using virtual capital. Your challenge fee is the only real financial transaction. You trade on real market prices, but no real money is deployed into markets." },
      { q: "What is a forecasting challenge?", a: "A forecasting challenge is a structured evaluation period where you must reach a profit target (e.g. 10%) within the challenge rules, including maximum drawdown limits and minimum trading days." },
      { q: "What markets can I trade?", a: "You can trade all active markets available on Polymarket — including politics, crypto, sports, economics, and culture. Prices are sourced directly from Polymarket in real time." },
      { q: "Do I need previous trading experience?", a: "No prior experience is required. However, understanding prediction markets and probability will significantly improve your performance in challenges." },
      { q: "Is FundedForecast connected to Polymarket?", a: "FundedForecast sources real-time market prices and data from Polymarket. We do not execute real trades on Polymarket — all activity on our platform is simulated." },
    ],
  },
  {
    id: "challenge-rules",
    title: "Challenge Rules",
    description: "Evaluation rules and challenge requirements",
    items: [
      { q: "What is a challenge?", a: "A challenge is a paid evaluation where you trade with virtual capital under specific rules. Pass the evaluation to become eligible for funded status and profit payouts." },
      { q: "What is the virtual balance?", a: "Depending on your plan, you start with $10,000, $25,000, or $50,000 in virtual capital. This balance is used for simulated trading only." },
      { q: "What is the profit target?", a: "You must grow your virtual account by a set percentage (typically 10%) within the challenge period to pass the evaluation." },
      { q: "What is the maximum drawdown?", a: "The maximum drawdown is the maximum loss allowed from your starting balance. Exceeding this limit will automatically fail your challenge." },
      { q: "Are there daily loss limits?", a: "Yes. Depending on your plan, there may be a daily loss limit in addition to the overall maximum drawdown. Exceeding either limit fails the challenge." },
      { q: "Can I reset a failed challenge?", a: "Yes. Failed challenges can be restarted by purchasing a new challenge. Some plans include a refundable fee that is returned upon passing." },
      { q: "What happens if I break the rules?", a: "Violating any challenge rule (drawdown, daily loss, or other restrictions) will automatically terminate the challenge. No partial credit is given." },
      { q: "Can I have multiple challenges?", a: "Yes. You can run multiple challenges simultaneously using separate accounts." },
      { q: "How long does a challenge last?", a: "There is no fixed time limit on challenges, but you must trade on a minimum number of calendar days (typically 10) to be eligible to pass." },
      { q: "What happens after I pass?", a: "After passing the evaluation, you become eligible for funded trader status and can request payouts on profits generated." },
    ],
  },
  {
    id: "funded-phase",
    title: "Funded Phase Rules",
    description: "Rules after successfully passing a challenge",
    items: [
      { q: "What happens after I pass the challenge?", a: "You receive funded trader status and continue trading under the same simulated environment, now with profit-sharing eligibility." },
      { q: "Do I receive real capital?", a: "No. The funded phase is also simulated. You continue trading with virtual capital, but your profits become eligible for real payouts based on your performance." },
      { q: "How is funded phase trading simulated?", a: "Funded phase trading uses the same real Polymarket price data as the evaluation. All positions are virtual — no real capital is deployed." },
      { q: "What rules continue to apply?", a: "The same risk rules (drawdown limits, daily loss limits) continue to apply in the funded phase. Violating them may result in loss of funded status." },
      { q: "Can I lose funded status?", a: "Yes. Violating risk rules or engaging in prohibited activities will result in termination of your funded account." },
      { q: "How is performance reviewed?", a: "All trading activity is reviewed before payouts are processed. We verify compliance with all rules and check for any prohibited trading patterns." },
    ],
  },
  {
    id: "payouts",
    title: "Payout Information",
    description: "Payout policy, eligibility, and methods",
    items: [
      { q: "When can I request a payout?", a: "You can request a payout after reaching funded status and generating profits. Minimum payout thresholds and review periods apply." },
      { q: "Are payouts guaranteed?", a: "No. Payouts are subject to eligibility review, compliance checks, and verification of trading activity. We do not guarantee payouts." },
      { q: "What payout methods are supported?", a: "We currently support crypto payouts (USDT on TRC20, ERC20, and BEP20 networks). Additional methods may be added in the future." },
      { q: "Is KYC required before payout?", a: "KYC or identity verification may be required before processing payouts, depending on applicable regulations and compliance requirements." },
      { q: "How long does payout review take?", a: "Payout review typically takes several business days. Complex cases may take longer if additional verification is required." },
      { q: "Can a payout be rejected?", a: "Yes. Payouts can be rejected if trading activity does not comply with our rules, if prohibited patterns are detected, or if compliance requirements are not met." },
    ],
  },
  {
    id: "account",
    title: "Account Management",
    description: "Account, profile, balance, and access",
    items: [
      { q: "How do I create an account?", a: "Click 'Get Started' on the homepage, enter your details, and complete registration. No credit card is required to create an account." },
      { q: "Can I change my email or username?", a: "Username can be changed from your Account page. Email changes require contacting support for verification." },
      { q: "What should I do if I forget my password?", a: "Use the password reset option on the login page, or contact support at support@fundedforecast.com." },
      { q: "Where can I see my challenge history?", a: "Your full challenge history is available on your Account page under the Challenge History section." },
      { q: "Why is my account restricted?", a: "Accounts may be restricted due to rule violations, suspicious activity, or compliance requirements. Contact support for details." },
    ],
  },
  {
    id: "trading",
    title: "Trading Information",
    description: "Markets, positions, orders, and PnL",
    items: [
      { q: "How are market prices displayed?", a: "Prices are displayed in cents (¢) representing the probability of an outcome. A YES price of 60¢ means the market assigns ~60% probability to that outcome." },
      { q: "How is PnL calculated?", a: "PnL is calculated based on the difference between your entry price and the current or settlement price, multiplied by your position size." },
      { q: "Can I close a position early?", a: "Yes. You can close any open position at the current market price at any time before market settlement." },
      { q: "What happens when a market settles?", a: "When a market resolves, all open positions are settled at the final outcome price (100¢ for correct outcome, 0¢ for incorrect). Your balance is updated accordingly." },
      { q: "Why did my balance change?", a: "Balance changes occur when positions are closed or settled, or when trading fees are applied. Check your balance log for a full breakdown." },
    ],
  },
  {
    id: "technical",
    title: "Technical & Support",
    description: "Platform access and support questions",
    items: [
      { q: "Which browser should I use?", a: "FundedForecast works best on modern browsers: Chrome, Firefox, Safari, or Edge. Keep your browser updated for the best experience." },
      { q: "What should I do if something does not load?", a: "Try refreshing the page, clearing your browser cache, or using a different browser. If the problem persists, contact support." },
      { q: "How can I contact support?", a: "Email us at support@fundedforecast.com. We typically respond within 24 hours." },
    ],
  },
  {
    id: "legal",
    title: "Legal & Compliance",
    description: "Important legal, risk, and compliance information",
    items: [
      { q: "Is FundedForecast a broker or exchange?", a: "No. FundedForecast is not a broker, exchange, or financial institution. We are a simulated trading evaluation platform. No real financial instruments are traded." },
      { q: "Is this financial advice?", a: "No. Nothing on FundedForecast constitutes financial advice, investment advice, or trading recommendations. All decisions are made solely by the user." },
      { q: "What are the risks?", a: "The main financial risk is the challenge fee, which is non-refundable if you fail (except on refundable plans). Simulated trading performance does not guarantee real-world results." },
      { q: "Why may KYC or AML checks be required?", a: "We are committed to compliance with applicable anti-money laundering and know-your-customer regulations. KYC checks may be required before processing payouts." },
    ],
  },
];
