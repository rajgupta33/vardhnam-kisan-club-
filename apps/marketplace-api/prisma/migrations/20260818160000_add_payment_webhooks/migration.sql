-- WP-07: payment provider webhooks, provider modes and reconciliation columns.

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED');

-- AlterEnum
ALTER TYPE "PaymentEventType" ADD VALUE 'WEBHOOK_RECEIVED';
ALTER TYPE "PaymentEventType" ADD VALUE 'STATUS_FETCHED';
ALTER TYPE "PaymentEventType" ADD VALUE 'RECONCILIATION_MISMATCH';

-- AlterEnum
ALTER TYPE "PaymentProviderMode" ADD VALUE 'SANDBOX';
ALTER TYPE "PaymentProviderMode" ADD VALUE 'LIVE';

-- AlterTable
ALTER TABLE "PaymentIntent" ADD COLUMN     "lastProviderSyncAt" TIMESTAMPTZ(6),
ADD COLUMN     "providerPaymentReference" TEXT,
ADD COLUMN     "providerStatus" TEXT;

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "rawPayload" TEXT NOT NULL,
    "payloadDigest" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "paymentIntentId" UUID,
    "status" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "requestId" TEXT,
    "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookEvent_status_receivedAt_idx" ON "WebhookEvent"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_paymentIntentId_receivedAt_idx" ON "WebhookEvent"("paymentIntentId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_providerEventId_key" ON "WebhookEvent"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_providerPaymentReference_key" ON "PaymentIntent"("providerPaymentReference");

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
