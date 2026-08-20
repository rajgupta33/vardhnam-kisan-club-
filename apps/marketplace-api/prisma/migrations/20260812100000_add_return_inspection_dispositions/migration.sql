ALTER TYPE "InventoryMovementType" ADD VALUE 'RETURN_QUARANTINED';
ALTER TYPE "InventoryMovementType" ADD VALUE 'RETURN_RESTOCKED';

CREATE TYPE "ReturnInspectionOutcome" AS ENUM (
  'RESTOCKABLE',
  'DAMAGED_WRITE_OFF',
  'QUARANTINED',
  'REJECTED_RETURN'
);

ALTER TABLE "ReturnRequest"
  ADD COLUMN "inspectedByUserId" UUID,
  ADD COLUMN "inspectedAt" TIMESTAMPTZ(6),
  ADD COLUMN "inspectionNote" TEXT,
  ADD COLUMN "approvedRefundAmountPaise" INTEGER;

CREATE TABLE "ReturnInspectionDisposition" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "returnRequestId" UUID NOT NULL,
  "returnRequestItemId" UUID NOT NULL,
  "reservationId" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "outcome" "ReturnInspectionOutcome" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "inventoryMovementId" UUID,
  "inspectedByUserId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnInspectionDisposition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnInspectionDisposition_quantity_check" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "ReturnInspectionDisposition_inventoryMovementId_key" ON "ReturnInspectionDisposition"("inventoryMovementId");
CREATE UNIQUE INDEX "ReturnInspectionDisposition_returnRequestId_returnRequestItemId_reservationId_outcome_key" ON "ReturnInspectionDisposition"("returnRequestId", "returnRequestItemId", "reservationId", "outcome");
CREATE INDEX "ReturnInspectionDisposition_returnRequestId_createdAt_idx" ON "ReturnInspectionDisposition"("returnRequestId", "createdAt");
CREATE INDEX "ReturnInspectionDisposition_returnRequestItemId_idx" ON "ReturnInspectionDisposition"("returnRequestItemId");
CREATE INDEX "ReturnInspectionDisposition_reservationId_idx" ON "ReturnInspectionDisposition"("reservationId");
CREATE INDEX "ReturnInspectionDisposition_batchId_outcome_idx" ON "ReturnInspectionDisposition"("batchId", "outcome");
CREATE INDEX "ReturnInspectionDisposition_inspectedByUserId_createdAt_idx" ON "ReturnInspectionDisposition"("inspectedByUserId", "createdAt");

ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_inspectedByUserId_fkey" FOREIGN KEY ("inspectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReturnInspectionDisposition" ADD CONSTRAINT "ReturnInspectionDisposition_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnInspectionDisposition" ADD CONSTRAINT "ReturnInspectionDisposition_returnRequestItemId_fkey" FOREIGN KEY ("returnRequestItemId") REFERENCES "ReturnRequestItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnInspectionDisposition" ADD CONSTRAINT "ReturnInspectionDisposition_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "ProductOrderItemReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnInspectionDisposition" ADD CONSTRAINT "ReturnInspectionDisposition_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnInspectionDisposition" ADD CONSTRAINT "ReturnInspectionDisposition_inventoryMovementId_fkey" FOREIGN KEY ("inventoryMovementId") REFERENCES "InventoryMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnInspectionDisposition" ADD CONSTRAINT "ReturnInspectionDisposition_inspectedByUserId_fkey" FOREIGN KEY ("inspectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
