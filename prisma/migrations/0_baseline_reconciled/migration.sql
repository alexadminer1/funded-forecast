-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('pending', 'approved', 'suspended', 'rejected', 'banned');

-- CreateEnum
CREATE TYPE "AffiliateConversionStatus" AS ENUM ('pending', 'pending_review', 'approved', 'paid', 'rejected', 'clawback', 'frozen');

-- CreateEnum
CREATE TYPE "AffiliatePayoutStatus" AS ENUM ('requested', 'approved', 'processing', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "AffiliateLedgerBucket" AS ENUM ('pending', 'available', 'frozen', 'negative');

-- CreateEnum
CREATE TYPE "AffiliateLedgerType" AS ENUM ('commission_pending', 'commission_approved', 'commission_rejected', 'commission_frozen', 'commission_unfrozen', 'payout_paid', 'clawback', 'negative_offset', 'adjustment_credit', 'adjustment_debit');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('not_required', 'required', 'submitted', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "AffiliatePaymentMethod" AS ENUM ('usdt_trc20', 'usdc_polygon', 'usdt_erc20', 'usdc_erc20');

-- CreateEnum
CREATE TYPE "AffiliateRejectionReason" AS ENUM ('refund', 'chargeback', 'inactivity', 'fraud', 'manual', 'manual_fraud', 'wallet_collision', 'referred_user_banned');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('AWAITING_PAYMENT', 'SEEN_ON_CHAIN', 'CONFIRMING', 'CONFIRMED', 'UNDERPAID', 'EXPIRED', 'EXPIRED_UNDERPAID', 'MANUAL_REVIEW', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('DETECTED', 'MATCHED', 'CONFIRMED', 'IGNORED', 'MANUAL_REVIEW');

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
    "walletAddress" TEXT,
    "walletNetwork" TEXT,
    "referredByAffiliateId" INTEGER,
    "registrationIpHash" TEXT,

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
    "polymarketEventId" TEXT,

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
    "realizedPnl" DECIMAL(20,8),
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
CREATE TABLE "ChallengePlan" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "accountSize" DOUBLE PRECISION NOT NULL,
    "profitTargetPct" DOUBLE PRECISION NOT NULL,
    "maxLossPct" DOUBLE PRECISION NOT NULL,
    "dailyLossPct" DOUBLE PRECISION NOT NULL,
    "maxPositionSizePct" DOUBLE PRECISION NOT NULL,
    "minTradingDays" INTEGER NOT NULL,
    "payoutCap" DOUBLE PRECISION,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "refundableFeeCents" INTEGER NOT NULL DEFAULT 0,
    "maxPayoutCapCents" INTEGER NOT NULL DEFAULT 0,
    "minPayoutCents" INTEGER NOT NULL DEFAULT 5000,
    "profitSharePct" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "challengePeriodDays" INTEGER NOT NULL DEFAULT 30,
    "payoutCooldownDays" INTEGER NOT NULL DEFAULT 14,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "planId" INTEGER,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startBalance" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "realizedBalance" DOUBLE PRECISION NOT NULL,
    "peakBalance" DOUBLE PRECISION NOT NULL,
    "peakEquity" DOUBLE PRECISION,
    "profitTargetPct" DOUBLE PRECISION NOT NULL,
    "maxDailyDdPct" DOUBLE PRECISION NOT NULL,
    "maxTotalDdPct" DOUBLE PRECISION NOT NULL,
    "maxPositionSizePct" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "minTradingDays" INTEGER NOT NULL,
    "tradingDaysCount" INTEGER NOT NULL DEFAULT 0,
    "qualifyingTradingDaysCount" INTEGER NOT NULL DEFAULT 0,
    "profitTargetMet" BOOLEAN NOT NULL DEFAULT false,
    "drawdownViolated" BOOLEAN NOT NULL DEFAULT false,
    "dayStartBalance" DOUBLE PRECISION,
    "dayStartDate" TIMESTAMP(3),
    "lastTradingDay" TIMESTAMP(3),
    "violationReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "payoutCapCents" INTEGER,
    "minPayoutCents" INTEGER,
    "profitSharePct" DOUBLE PRECISION,
    "refundableFeeCents" INTEGER,
    "payoutCooldownDays" INTEGER,
    "refundableFeePaidAt" TIMESTAMP(3),
    "lastApprovedPayoutAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "lastNewPositionAt" TIMESTAMP(3),
    "resolvedPositionsCount" INTEGER NOT NULL DEFAULT 0,
    "uniqueEventsCount" INTEGER NOT NULL DEFAULT 0,

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
    "walletAddress" TEXT,
    "walletNetwork" TEXT,
    "txHash" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USDC',
    "baseAmountCents" INTEGER,
    "refundableFeeBonusCents" INTEGER,
    "finalAmountCents" INTEGER,
    "verificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "manualReview" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifyAttemptAt" TIMESTAMP,

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeDailyPnL" (
    "id" SERIAL NOT NULL,
    "challengeId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "dailyPnl" DECIMAL(20,8) NOT NULL,
    "dailyTrades" INTEGER NOT NULL,
    "isWinningDay" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeDailyPnL_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBlock" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FAQItem" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FAQItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "totalPnl" DOUBLE PRECISION NOT NULL,
    "winRate" INTEGER NOT NULL,
    "trades" INTEGER NOT NULL,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affiliate" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "refCode" TEXT NOT NULL,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'pending',
    "tier" TEXT NOT NULL DEFAULT 'starter',
    "applicationData" JSONB NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "bannedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectionReason" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "suspiciousFlag" BOOLEAN NOT NULL DEFAULT false,
    "suspiciousReason" TEXT,
    "paymentMethod" "AffiliatePaymentMethod",
    "paymentWallet" TEXT,
    "paymentWalletVerifiedAt" TIMESTAMP(3),
    "walletChangedAt" TIMESTAMP(3),
    "walletLockUntil" TIMESTAMP(3),
    "walletRequiresReview" BOOLEAN NOT NULL DEFAULT false,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'not_required',
    "kycVerifiedAt" TIMESTAMP(3),
    "kycCountry" TEXT,
    "kycAdminNote" TEXT,
    "balancePending" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceAvailable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceFrozen" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceNegative" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetimeEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetimePaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetimeClawedBack" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesCount30d" INTEGER NOT NULL DEFAULT 0,
    "parentAffiliateId" INTEGER,
    "customCommissionRate" DOUBLE PRECISION,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "acceptedTermsVersion" TEXT NOT NULL DEFAULT '1.0',
    "acceptedTermsAt" TIMESTAMP(3) NOT NULL,
    "programVersion" TEXT NOT NULL DEFAULT '1.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateClick" (
    "id" SERIAL NOT NULL,
    "affiliateId" INTEGER NOT NULL,
    "refCode" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "ipSalt" TEXT,
    "countryCode" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "landingUrl" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "cookieId" TEXT NOT NULL,
    "convertedToUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateConversion" (
    "id" SERIAL NOT NULL,
    "affiliateId" INTEGER NOT NULL,
    "referredUserId" INTEGER NOT NULL,
    "paymentId" TEXT NOT NULL,
    "planId" INTEGER NOT NULL,
    "clickId" INTEGER,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "processorFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "commissionAmount" DOUBLE PRECISION NOT NULL,
    "status" "AffiliateConversionStatus" NOT NULL DEFAULT 'pending',
    "previousStatus" "AffiliateConversionStatus",
    "pendingUntil" TIMESTAMP(3) NOT NULL,
    "paymentStatusAtCreation" TEXT NOT NULL,
    "paymentStatusLastChecked" TEXT,
    "paymentStatusLastCheckedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" "AffiliateRejectionReason",
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "reviewRequiredAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "payoutId" INTEGER,
    "activityCheckedAt" TIMESTAMP(3),
    "referralActivityDays" INTEGER NOT NULL DEFAULT 0,
    "referralTradesCount" INTEGER NOT NULL DEFAULT 0,
    "frozenFromBucket" "AffiliateLedgerBucket",
    "lastStatusChangeAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateLedger" (
    "id" SERIAL NOT NULL,
    "affiliateId" INTEGER NOT NULL,
    "conversionId" INTEGER,
    "payoutId" INTEGER,
    "type" "AffiliateLedgerType" NOT NULL,
    "bucket" "AffiliateLedgerBucket" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "operationGroupId" TEXT NOT NULL,
    "reason" TEXT,
    "createdByAdmin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliatePayout" (
    "id" SERIAL NOT NULL,
    "affiliateId" INTEGER NOT NULL,
    "status" "AffiliatePayoutStatus" NOT NULL DEFAULT 'requested',
    "amount" DOUBLE PRECISION NOT NULL,
    "networkFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountAfterFee" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "AffiliatePaymentMethod" NOT NULL,
    "paymentWallet" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "includedConversionIds" JSONB NOT NULL,
    "transactionHash" TEXT,
    "nowpaymentsBatchId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliatePayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "challengeId" INTEGER,
    "planId" INTEGER,
    "status" "PaymentStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "chainId" INTEGER NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "tokenDecimals" INTEGER NOT NULL,
    "receiverAddress" TEXT NOT NULL,
    "planAmountUsd" DECIMAL(18,2) NOT NULL,
    "expectedAmountUnits" BIGINT NOT NULL,
    "actualAmountUnits" BIGINT,
    "confirmationsRequired" INTEGER NOT NULL DEFAULT 6,
    "confirmationsSeen" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "seenAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "primaryTxHash" TEXT,
    "primaryLogIndex" INTEGER,
    "primaryBlockNumber" BIGINT,
    "flagReason" TEXT,
    "createdByIp" TEXT,
    "createdUserAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockTimestamp" TIMESTAMP(3) NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "receiverAddress" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "amountUnits" BIGINT NOT NULL,
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'DETECTED',
    "matchReason" TEXT,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWatcherState" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "receiverAddress" TEXT NOT NULL,
    "lastProcessedBlock" BIGINT NOT NULL,
    "latestSeenBlock" BIGINT,
    "lastHealthyAt" TIMESTAMP(3),
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentWatcherState_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "Market_polymarketEventId_idx" ON "Market"("polymarketEventId");

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
CREATE UNIQUE INDEX "PayoutRequest_txHash_key" ON "PayoutRequest"("txHash");

-- CreateIndex
CREATE INDEX "PayoutRequest_userId_status_idx" ON "PayoutRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "PayoutRequest_challengeId_status_idx" ON "PayoutRequest"("challengeId", "status");

-- CreateIndex
CREATE INDEX "ChallengeDailyPnL_challengeId_idx" ON "ChallengeDailyPnL"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeDailyPnL_challengeId_date_key" ON "ChallengeDailyPnL"("challengeId", "date");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_category_idx" ON "AuditLog"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ContentBlock_key_key" ON "ContentBlock"("key");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_username_key" ON "LeaderboardEntry"("username");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_isActive_idx" ON "LeaderboardEntry"("isActive");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_totalPnl_idx" ON "LeaderboardEntry"("totalPnl");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_userId_key" ON "Affiliate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_refCode_key" ON "Affiliate"("refCode");

-- CreateIndex
CREATE INDEX "Affiliate_status_idx" ON "Affiliate"("status");

-- CreateIndex
CREATE INDEX "Affiliate_tier_idx" ON "Affiliate"("tier");

-- CreateIndex
CREATE INDEX "Affiliate_suspiciousFlag_idx" ON "Affiliate"("suspiciousFlag");

-- CreateIndex
CREATE INDEX "Affiliate_createdAt_idx" ON "Affiliate"("createdAt");

-- CreateIndex
CREATE INDEX "AffiliateClick_expiresAt_idx" ON "AffiliateClick"("expiresAt");

-- CreateIndex
CREATE INDEX "AffiliateClick_cookieId_idx" ON "AffiliateClick"("cookieId");

-- CreateIndex
CREATE INDEX "AffiliateClick_convertedToUserId_createdAt_idx" ON "AffiliateClick"("convertedToUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliateClick_affiliateId_createdAt_idx" ON "AffiliateClick"("affiliateId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateConversion_paymentId_key" ON "AffiliateConversion"("paymentId");

-- CreateIndex
CREATE INDEX "AffiliateConversion_affiliateId_status_idx" ON "AffiliateConversion"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "AffiliateConversion_referredUserId_idx" ON "AffiliateConversion"("referredUserId");

-- CreateIndex
CREATE INDEX "AffiliateConversion_status_pendingUntil_idx" ON "AffiliateConversion"("status", "pendingUntil");

-- CreateIndex
CREATE INDEX "AffiliateConversion_reviewRequiredAt_idx" ON "AffiliateConversion"("reviewRequiredAt");

-- CreateIndex
CREATE INDEX "AffiliateConversion_payoutId_idx" ON "AffiliateConversion"("payoutId");

-- CreateIndex
CREATE INDEX "AffiliateLedger_affiliateId_bucket_idx" ON "AffiliateLedger"("affiliateId", "bucket");

-- CreateIndex
CREATE INDEX "AffiliateLedger_operationGroupId_idx" ON "AffiliateLedger"("operationGroupId");

-- CreateIndex
CREATE INDEX "AffiliateLedger_createdAt_idx" ON "AffiliateLedger"("createdAt");

-- CreateIndex
CREATE INDEX "AffiliateLedger_conversionId_idx" ON "AffiliateLedger"("conversionId");

-- CreateIndex
CREATE INDEX "AffiliateLedger_payoutId_idx" ON "AffiliateLedger"("payoutId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliatePayout_transactionHash_key" ON "AffiliatePayout"("transactionHash");

-- CreateIndex
CREATE INDEX "AffiliatePayout_affiliateId_status_idx" ON "AffiliatePayout"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "AffiliatePayout_status_idx" ON "AffiliatePayout"("status");

-- CreateIndex
CREATE INDEX "AffiliatePayout_requestedAt_idx" ON "AffiliatePayout"("requestedAt");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_challengeId_idx" ON "Payment"("challengeId");

-- CreateIndex
CREATE INDEX "Payment_status_expiresAt_idx" ON "Payment"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Payment_chainId_tokenAddress_receiverAddress_status_idx" ON "Payment"("chainId", "tokenAddress", "receiverAddress", "status");

-- CreateIndex
CREATE INDEX "Payment_chainId_primaryTxHash_idx" ON "Payment"("chainId", "primaryTxHash");

-- CreateIndex
CREATE INDEX "PaymentTransaction_paymentId_idx" ON "PaymentTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_chainId_blockNumber_idx" ON "PaymentTransaction"("chainId", "blockNumber");

-- CreateIndex
CREATE INDEX "PaymentTransaction_receiverAddress_blockTimestamp_idx" ON "PaymentTransaction"("receiverAddress", "blockTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_chainId_txHash_logIndex_key" ON "PaymentTransaction"("chainId", "txHash", "logIndex");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWatcherState_chainId_tokenAddress_receiverAddress_key" ON "PaymentWatcherState"("chainId", "tokenAddress", "receiverAddress");

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
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ChallengePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeDailyPnL" ADD CONSTRAINT "ChallengeDailyPnL_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_parentAffiliateId_fkey" FOREIGN KEY ("parentAffiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateConversion" ADD CONSTRAINT "AffiliateConversion_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateConversion" ADD CONSTRAINT "AffiliateConversion_clickId_fkey" FOREIGN KEY ("clickId") REFERENCES "AffiliateClick"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateConversion" ADD CONSTRAINT "AffiliateConversion_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "AffiliatePayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateLedger" ADD CONSTRAINT "AffiliateLedger_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateLedger" ADD CONSTRAINT "AffiliateLedger_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "AffiliateConversion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateLedger" ADD CONSTRAINT "AffiliateLedger_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "AffiliatePayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "AffiliatePayout_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ChallengePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

