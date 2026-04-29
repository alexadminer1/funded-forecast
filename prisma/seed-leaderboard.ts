import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ENTRIES = [
  { username: "alpha_trader",   plan: "Elite",   totalPnl: 18420.50, winRate: 78, trades: 142 },
  { username: "swiftcapital",   plan: "Elite",   totalPnl: 15230.10, winRate: 71, trades: 118 },
  { username: "mr_polymarket",  plan: "Pro",     totalPnl: 12890.75, winRate: 69, trades: 96 },
  { username: "nova_trades",    plan: "Elite",   totalPnl: 11540.30, winRate: 74, trades: 87 },
  { username: "edge_seeker",    plan: "Pro",     totalPnl: 9820.20,  winRate: 67, trades: 102 },
  { username: "kappa_quant",    plan: "Pro",     totalPnl: 8450.00,  winRate: 65, trades: 78 },
  { username: "vega_runner",    plan: "Starter", totalPnl: 7320.45,  winRate: 70, trades: 64 },
  { username: "delta_force",    plan: "Pro",     totalPnl: 6890.10,  winRate: 62, trades: 89 },
  { username: "theta_decay",    plan: "Elite",   totalPnl: 6210.80,  winRate: 73, trades: 55 },
  { username: "sigma_pro",      plan: "Pro",     totalPnl: 5640.30,  winRate: 64, trades: 71 },
  { username: "omega_invest",   plan: "Starter", totalPnl: 4920.50,  winRate: 68, trades: 48 },
  { username: "gamma_hedge",    plan: "Pro",     totalPnl: 4380.90,  winRate: 60, trades: 82 },
  { username: "zeta_signal",    plan: "Starter", totalPnl: 3870.25,  winRate: 66, trades: 53 },
  { username: "lambda_long",    plan: "Pro",     totalPnl: 3420.10,  winRate: 58, trades: 76 },
  { username: "rho_market",     plan: "Starter", totalPnl: 2980.40,  winRate: 63, trades: 44 },
  { username: "psi_strat",      plan: "Pro",     totalPnl: 2510.75,  winRate: 61, trades: 67 },
  { username: "iota_invest",    plan: "Starter", totalPnl: 2080.20,  winRate: 65, trades: 38 },
  { username: "tau_trader",     plan: "Starter", totalPnl: 1620.55,  winRate: 59, trades: 41 },
  { username: "phi_finance",    plan: "Starter", totalPnl: 1180.30,  winRate: 56, trades: 35 },
  { username: "chi_capital",    plan: "Starter", totalPnl: 820.45,   winRate: 54, trades: 28 },
];

async function main() {
  for (const e of ENTRIES) {
    await prisma.leaderboardEntry.upsert({
      where: { username: e.username },
      update: {},
      create: { ...e, isActive: true },
    });
    console.log(`✓ ${e.username}`);
  }
  console.log(`\nDone. Seeded ${ENTRIES.length} showcase entries.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
