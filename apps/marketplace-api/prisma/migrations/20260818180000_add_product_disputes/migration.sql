CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'AWAITING_FARMER', 'AWAITING_DISTRIBUTOR', 'RESOLVED_FOR_FARMER', 'RESOLVED_FOR_DISTRIBUTOR', 'RESOLVED_SPLIT', 'CLOSED');
CREATE TYPE "DisputeCategory" AS ENUM ('PRODUCT_QUALITY', 'DELIVERY', 'RETURN_DECISION', 'REFUND_AMOUNT', 'PAYMENT', 'OTHER');
CREATE TYPE "DisputeResolutionOutcome" AS ENUM ('FARMER', 'DISTRIBUTOR', 'SPLIT');
CREATE TYPE "DisputeEventType" AS ENUM ('CREATED', 'ASSIGNED', 'NOTE_ADDED', 'INFO_REQUESTED_FROM_FARMER', 'INFO_REQUESTED_FROM_DISTRIBUTOR', 'RESOLVED', 'CLOSED');

ALTER TYPE "FinancialLedgerEntryType" ADD VALUE 'ADJUSTMENT';

CREATE TABLE "Dispute" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productOrderId" UUID NOT NULL,
  "returnRequestId" UUID,
  "farmerUserId" UUID NOT NULL,
  "distributorOrganisationId" UUID NOT NULL,
  "raisedByUserId" UUID NOT NULL,
  "raisedByRole" "PlatformRole" NOT NULL,
  "againstOrganisationId" UUID,
  "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "category" "DisputeCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "orderStatusBeforeDispute" "ProductOrderStatus" NOT NULL,
  "assignedToUserId" UUID,
  "resolutionOutcome" "DisputeResolutionOutcome",
  "resolutionNote" TEXT,
  "resolutionAmountPaise" INTEGER,
  "resolvedAt" TIMESTAMPTZ(6),
  "closedAt" TIMESTAMPTZ(6),
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Dispute_description_length_check" CHECK (char_length("description") BETWEEN 10 AND 2000),
  CONSTRAINT "Dispute_resolution_amount_check" CHECK ("resolutionAmountPaise" IS NULL OR "resolutionAmountPaise" >= 0),
  CONSTRAINT "Dispute_idempotency_key_length_check" CHECK (char_length("idempotencyKey") BETWEEN 1 AND 120)
);

CREATE TABLE "DisputeEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "disputeId" UUID NOT NULL,
  "eventType" "DisputeEventType" NOT NULL,
  "fromStatus" "DisputeStatus",
  "toStatus" "DisputeStatus" NOT NULL,
  "actorUserId" UUID NOT NULL,
  "actorRole" "PlatformRole" NOT NULL,
  "note" TEXT,
  "requestId" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DisputeEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DisputeEvent_note_length_check" CHECK ("note" IS NULL OR char_length("note") BETWEEN 1 AND 2000)
);

ALTER TABLE "FinancialLedgerEntry" ADD COLUMN "disputeId" UUID;

CREATE UNIQUE INDEX "Dispute_raisedByUserId_idempotencyKey_key" ON "Dispute"("raisedByUserId", "idempotencyKey");
CREATE UNIQUE INDEX "Dispute_productOrderId_active_key" ON "Dispute"("productOrderId") WHERE "status" <> 'CLOSED';
CREATE INDEX "Dispute_farmerUserId_status_idx" ON "Dispute"("farmerUserId", "status");
CREATE INDEX "Dispute_distributorOrganisationId_status_idx" ON "Dispute"("distributorOrganisationId", "status");
CREATE INDEX "Dispute_assignedToUserId_status_idx" ON "Dispute"("assignedToUserId", "status");
CREATE INDEX "Dispute_status_createdAt_idx" ON "Dispute"("status", "createdAt");
CREATE INDEX "Dispute_returnRequestId_idx" ON "Dispute"("returnRequestId");
CREATE UNIQUE INDEX "DisputeEvent_actorUserId_idempotencyKey_key" ON "DisputeEvent"("actorUserId", "idempotencyKey");
CREATE INDEX "DisputeEvent_disputeId_createdAt_idx" ON "DisputeEvent"("disputeId", "createdAt");
CREATE INDEX "DisputeEvent_actorUserId_createdAt_idx" ON "DisputeEvent"("actorUserId", "createdAt");
CREATE INDEX "FinancialLedgerEntry_disputeId_idx" ON "FinancialLedgerEntry"("disputeId");

ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_farmerUserId_fkey" FOREIGN KEY ("farmerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_distributorOrganisationId_fkey" FOREIGN KEY ("distributorOrganisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_againstOrganisationId_fkey" FOREIGN KEY ("againstOrganisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisputeEvent" ADD CONSTRAINT "DisputeEvent_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DisputeEvent" ADD CONSTRAINT "DisputeEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
