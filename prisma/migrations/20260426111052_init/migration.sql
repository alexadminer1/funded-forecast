-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "password" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'email',
    "membershipStatus" TEXT NOT NULL DEFAULT 'free',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionPlan" TEXT,
    "subscriptionEndsAt" TIMESTAMP(3),
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "lastTradeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConsent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "acceptedPayoutRules" BOOLEAN NOT NULL DEFAULT false,
    "acceptedPrivacy" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,

    CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "imageUrl" TEXT,
    "yesPrice" DOUBLE PRECISION NOT NULL,
    "noPrice" DOUBLE PRECISION NOT NULL,
    "volume24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'live',
    "winningOutcome" TEXT,
    "negRisk" BOOLEAN NOT NULL DEFAULT false,
    "isRestricted" BOOLEAN NOT NULL DEFAULT false,
    "resolutionSource" TEXT,
    "resolvedExternalAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "marketId" TEXT NOT NULL,
    "challengeId" INTEGER,
    "side" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "marketYesPriceAtExecution" DOUBLE PRECISION NOT NULL,
    "marketNoPriceAtExecution" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "marketId" TEXT NOT NULL,
    "challengeId" INTEGER,
    "side" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "shares" INTEGER NOT NULL DEFAULT 0,
    "avgPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costBasis" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "realizedPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tradeId" INTEGER,
    "challengeId" INTEGER,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceBefore" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "runningBalance" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startBalance" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "realizedBalance" DOUBLE PRECISION NOT NULL,
    "peakBalance" DOUBLE PRECISION NOT NULL,
    "profitTargetPct" DOUBLE PRECISION NOT NULL,
    "maxDailyDdPct" DOUBLE PRECISION NOT NULL,
    "maxTotalDdPct" DOUBLE PRECISION NOT NULL,
    "maxPositionSizePct" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "minTradingDays" INTEGER NOT NULL,
    "tradingDaysCount" INTEGER NOT NULL DEFAULT 0,
    "profitTargetMet" BOOLEAN NOT NULL DEFAULT false,
    "drawdownViolated" BOOLEAN NOT NULL DEFAULT false,
    "violationReason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedStripeEvent" (
    "eventId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "PayoutRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "challengeId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "maxPayoutAmount" DOUBLE PRECISION NOT NULL,
    "feePct" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "platformFee" DOUBLE PRECISION NOT NULL,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER,
    "targetType" TEXT NOT NULL,
    "targetId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "User_isBlocked_idx" ON "User"("isBlocked");

-- CreateIndex
CREATE INDEX "User_stripeCustomerId_idx" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserConsent_userId_key" ON "UserConsent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Market_conditionId_key" ON "Market"("conditionId");

-- CreateIndex
CREATE INDEX "Market_status_idx" ON "Market"("status");

-- CreateIndex
CREATE INDEX "Market_status_negRisk_idx" ON "Market"("status", "negRisk");

-- CreateIndex
CREATE INDEX "Market_endDate_idx" ON "Market"("endDate");

-- CreateIndex
CREATE INDEX "Trade_userId_createdAt_idx" ON "Trade"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Trade_marketId_action_idx" ON "Trade"("marketId", "action");

-- CreateIndex
CREATE INDEX "Trade_challengeId_idx" ON "Trade"("challengeId");

-- CreateIndex
CREATE INDEX "Trade_userId_marketId_idx" ON "Trade"("userId", "marketId");

-- CreateIndex
CREATE INDEX "Position_userId_status_idx" ON "Position"("userId", "status");

-- CreateIndex
CREATE INDEX "Position_marketId_status_idx" ON "Position"("marketId", "status");

-- CreateIndex
CREATE INDEX "Position_challengeId_idx" ON "Position"("challengeId");

-- CreateIndex
CREATE INDEX "BalanceLog_userId_createdAt_idx" ON "BalanceLog"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BalanceLog_tradeId_idx" ON "BalanceLog"("tradeId");

-- CreateIndex
CREATE INDEX "BalanceLog_challengeId_createdAt_idx" ON "BalanceLog"("challengeId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Challenge_userId_status_idx" ON "Challenge"("userId", "status");

-- CreateIndex
CREATE INDEX "Challenge_status_idx" ON "Challenge"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "PayoutRequest_userId_status_idx" ON "PayoutRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "PayoutRequest_challengeId_status_idx" ON "PayoutRequest"("challengeId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_category_idx" ON "AuditLog"("category");

-- AddForeignKey
ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceLog" ADD CONSTRAINT "BalanceLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceLog" ADD CONSTRAINT "BalanceLog_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceLog" ADD CONSTRAINT "BalanceLog_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
