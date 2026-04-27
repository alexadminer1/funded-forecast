const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const items = [
    { category: "platform", question: "What is FundedForecast?", answer: "We are a prop trading platform where you prove your forecasting skills on real Polymarket prediction markets and earn real payouts.", order: 1 },
    { category: "platform", question: "How does paper trading work?", answer: "You trade with $10,000–$50,000 in virtual capital on real market prices. No real money is at risk during the challenge.", order: 2 },
    { category: "platform", question: "What markets can I trade?", answer: "All active markets from Polymarket — politics, crypto, sports, economics and more.", order: 3 },
    { category: "platform", question: "Is my money at risk?", answer: "No. During the challenge you trade with paper capital. Only the challenge fee is a real payment.", order: 4 },
    { category: "platform", question: "How do I withdraw profits?", answer: "After passing the evaluation, you become eligible for payouts. We pay 80% of your generated profits.", order: 5 },
    { category: "rules", question: "What is the profit target?", answer: "You need to grow your account by 10% within the challenge period with minimum 10 trading days.", order: 1 },
    { category: "rules", question: "What happens if I exceed the loss limit?", answer: "If you lose more than the max loss limit (8–10% depending on plan), your challenge is automatically failed.", order: 2 },
    { category: "rules", question: "Can I trade any position size?", answer: "Maximum position size is 2–5% of your account balance per trade depending on your plan.", order: 3 },
    { category: "rules", question: "How many days do I need to trade?", answer: "Minimum 10 calendar days with at least one trade per day.", order: 4 },
    { category: "rules", question: "What happens after I pass?", answer: "You become a funded trader and receive 80% of all profits you generate going forward.", order: 5 },
  ];

  for (const item of items) {
    await prisma.fAQItem.upsert({
      where: { id: (await prisma.fAQItem.findFirst({ where: { question: item.question } }))?.id ?? 0 },
      update: item,
      create: item,
    });
  }
  console.log("FAQ seeded");
}

main().catch(console.error).finally(() => prisma.$disconnect());
