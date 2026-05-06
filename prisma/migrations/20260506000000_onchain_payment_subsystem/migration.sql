-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('AWAITING_PAYMENT', 'SEEN_ON_CHAIN', 'CONFIRMING', 'CONFIRMED', 'UNDERPAID', 'EXPIRED', 'EXPIRED_UNDERPAID', 'MANUAL_REVIEW', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('DETECTED', 'MATCHED', 'CONFIRMED', 'IGNORED', 'MANUAL_REVIEW');

-- DropIndex
DROP INDEX "Payment_nowPaymentId_key";

-- DropIndex
DROP INDEX "Payment_orderId_key";

-- DropIndex
DROP INDEX "Payment_orderId_idx";

-- AlterTable
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_pkey",
DROP COLUMN "amount",
DROP COLUMN "currency",
DROP COLUMN "nowPaymentId",
DROP COLUMN "orderId",
DROP COLUMN "payAmount",
DROP COLUMN "payCurrency",
DROP COLUMN "paymentUrl",
ADD COLUMN     "actualAmountUnits" BIGINT,
ADD COLUMN     "chainId" INTEGER NOT NULL,
ADD COLUMN     "challengeId" INTEGER,
ADD COLUMN     "confirmationsRequired" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "confirmationsSeen" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "createdByIp" TEXT,
ADD COLUMN     "createdUserAgent" TEXT,
ADD COLUMN     "expectedAmountUnits" BIGINT NOT NULL,
ADD COLUMN     "expiredAt" TIMESTAMP(3),
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "flagReason" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "planAmountUsd" DECIMAL(18,2) NOT NULL,
ADD COLUMN     "primaryBlockNumber" BIGINT,
ADD COLUMN     "primaryLogIndex" INTEGER,
ADD COLUMN     "primaryTxHash" TEXT,
ADD COLUMN     "receiverAddress" TEXT NOT NULL,
ADD COLUMN     "seenAt" TIMESTAMP(3),
ADD COLUMN     "tokenAddress" TEXT NOT NULL,
ADD COLUMN     "tokenDecimals" INTEGER NOT NULL,
ADD COLUMN     "tokenSymbol" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
ADD CONSTRAINT "Payment_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "AffiliateConversion" ALTER COLUMN "paymentId" SET DATA TYPE TEXT;

-- DropTable
DROP TABLE "ProcessedStripeEvent";

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
CREATE INDEX "PaymentTransaction_paymentId_idx" ON "PaymentTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_chainId_blockNumber_idx" ON "PaymentTransaction"("chainId", "blockNumber");

-- CreateIndex
CREATE INDEX "PaymentTransaction_receiverAddress_blockTimestamp_idx" ON "PaymentTransaction"("receiverAddress", "blockTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_chainId_txHash_logIndex_key" ON "PaymentTransaction"("chainId", "txHash", "logIndex");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWatcherState_chainId_tokenAddress_receiverAddress_key" ON "PaymentWatcherState"("chainId", "tokenAddress", "receiverAddress");

-- CreateIndex
CREATE INDEX "Payment_challengeId_idx" ON "Payment"("challengeId");

-- CreateIndex
CREATE INDEX "Payment_status_expiresAt_idx" ON "Payment"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Payment_chainId_tokenAddress_receiverAddress_status_idx" ON "Payment"("chainId", "tokenAddress", "receiverAddress", "status");

-- CreateIndex
CREATE INDEX "Payment_chainId_primaryTxHash_idx" ON "Payment"("chainId", "primaryTxHash");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique index for active payment slots
-- Prevents duplicate expectedAmountUnits among active payments on same receiver.
-- UNDERPAID is included because payment can still be topped up within window.
CREATE UNIQUE INDEX "Payment_active_amount_unique"
ON "Payment" ("chainId", "tokenAddress", "receiverAddress", "expectedAmountUnits")
WHERE status IN ('AWAITING_PAYMENT', 'SEEN_ON_CHAIN', 'CONFIRMING', 'UNDERPAID');
