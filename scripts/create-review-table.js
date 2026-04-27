const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Review" (
      id        SERIAL PRIMARY KEY,
      name      TEXT NOT NULL,
      role      TEXT NOT NULL,
      avatar    TEXT NOT NULL DEFAULT '',
      text      TEXT NOT NULL,
      rating    INTEGER NOT NULL DEFAULT 5,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "order"   INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("Review table created");
}

main().catch(console.error).finally(() => prisma.$disconnect());
