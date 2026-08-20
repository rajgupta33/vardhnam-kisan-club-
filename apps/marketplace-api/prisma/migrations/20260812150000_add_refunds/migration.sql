CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "RefundMethod" AS ENUM ('ORIGINAL_PAYMENT_METHOD', 'MANUAL_BANK_TRANSFER', 'ADJUSTMENT');
CREATE TYPE "RefundEventType" AS ENUM ('REFUND_CREATED', 'PROCESSING_STARTED', 'REFUND_SUCCEEDED', 'REFUND_FAILED');

CREATE TABLE "Refund" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "productOrderId" UUID NOT NULL,
    "returnRequestId" UUID,
    "paymentIntentId" UUID,
    "farmerUserId" UUID NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "method" "RefundMethod" NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "providerRefundReference" TEXT,
    "providerMode" "PaymentProviderMode" NOT NULL,
    "failureReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "initiatedByUserId" UUID NOT NULL,
    "initiatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Refund_amountPaise_check" CHECK ("amountPaise" > 0)
);

CREATE TABLE "RefundEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "refundId" UUID NOT NULL,
    "eventType" "RefundEventType" NOT NULL,
    "status" "RefundStatus" NOT NULL,
    "providerReference" TEXT,
    "payload" JSONB,
    "actorUserId" UUID,
    "actorRole" "PlatformRole",
    "requestId" TEXT,
    "idempotencyKey" TEXT,
    "requestHash" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FinancialLedgerEntry" ADD COLUMN "refundId" UUID;

CREATE UNIQUE INDEX "Refund_returnRequestId_key" ON "Refund"("returnRequestId");
CREATE UNIQUE INDEX "Refund_providerRefundReference_key" ON "Refund"("providerRefundReference");
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");
CREATE INDEX "Refund_productOrderId_createdAt_idx" ON "Refund"("productOrderId", "createdAt");
CREATE INDEX "Refund_farmerUserId_createdAt_idx" ON "Refund"("farmerUserId", "createdAt");
CREATE INDEX "Refund_status_createdAt_idx" ON "Refund"("status", "createdAt");
CREATE INDEX "Refund_paymentIntentId_idx" ON "Refund"("paymentIntentId");
CREATE INDEX "RefundEvent_refundId_createdAt_idx" ON "RefundEvent"("refundId", "createdAt");
CREATE INDEX "RefundEvent_eventType_createdAt_idx" ON "RefundEvent"("eventType", "createdAt");
CREATE INDEX "RefundEvent_actorUserId_createdAt_idx" ON "RefundEvent"("actorUserId", "createdAt");
CREATE INDEX "RefundEvent_providerReference_idx" ON "RefundEvent"("providerReference");
CREATE UNIQUE INDEX "RefundEvent_idempotencyKey_key" ON "RefundEvent"("idempotencyKey");
CREATE INDEX "FinancialLedgerEntry_refundId_idx" ON "FinancialLedgerEntry"("refundId");

ALTER TABLE "Refund" ADD CONSTRAINT "Refund_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_farmerUserId_fkey" FOREIGN KEY ("farmerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundEvent" ADD CONSTRAINT "RefundEvent_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundEvent" ADD CONSTRAINT "RefundEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;
