const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const reviews = [
    { name: "Michael R.", role: "Crypto Trader", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael", text: "Passed the Pro challenge in 8 days. The markets are real Polymarket data so you actually have to think. Best prop firm I've tried.", rating: 5, order: 1 },
    { name: "Sarah K.", role: "Prediction Markets Analyst", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah", text: "Transparent rules, no hidden tricks. Got funded after second attempt and received my first payout within a week.", rating: 5, order: 2 },
    { name: "James T.", role: "Full-time Trader", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=James", text: "Finally a prop firm using prediction markets. Much more interesting than forex. The 80% profit split is genuinely competitive.", rating: 5, order: 3 },
    { name: "Elena V.", role: "Part-time Trader", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Elena", text: "Clean interface, fair evaluation. I like that I can see real Polymarket prices. Failed once but the retry fee was refunded as promised.", rating: 4, order: 4 },
    { name: "David M.", role: "Sports Markets Specialist", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=David", text: "The sports prediction markets are where I make most of my profit. Dashboard is clear and the admin team is responsive.", rating: 5, order: 5 },
    { name: "Anna P.", role: "Beginner Trader", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Anna", text: "Started with the Starter plan to learn. Rules are clear and the platform is stable. Working towards my first funded account.", rating: 4, order: 6 },
  ];

  for (const r of reviews) {
    await prisma.review.create({ data: r });
  }
  console.log("Reviews seeded");
}

main().catch(console.error).finally(() => prisma.$disconnect());
