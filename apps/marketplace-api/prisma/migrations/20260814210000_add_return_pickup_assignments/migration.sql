CREATE TYPE "ReturnPickupAssignmentStatus" AS ENUM (
  'ASSIGNED',
  'ACCEPTED',
  'REJECTED',
  'COLLECTED',
  'CANCELLED'
);

CREATE TABLE "ReturnPickupAssignment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "returnRequestId" UUID NOT NULL,
  "productOrderId" UUID NOT NULL,
  "distributorOrganisationId" UUID NOT NULL,
  "farmerUserId" UUID NOT NULL,
  "deliveryPartnerUserId" UUID NOT NULL,
  "assignmentNumber" TEXT NOT NULL,
  "status" "ReturnPickupAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
  "orderNumberSnapshot" TEXT NOT NULL,
  "sellerNameSnapshot" TEXT NOT NULL,
  "pickupAddressSnapshot" JSONB NOT NULL,
  "itemsSnapshot" JSONB NOT NULL,
  "assignedByUserId" UUID,
  "assignedByRole" "PlatformRole",
  "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedByUserId" UUID,
  "respondedByRole" "PlatformRole",
  "respondedAt" TIMESTAMPTZ(6),
  "rejectionReason" TEXT,
  "collectedByUserId" UUID,
  "collectedByRole" "PlatformRole",
  "collectedAt" TIMESTAMPTZ(6),
  "collectionNote" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "ReturnPickupAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReturnPickupAssignment_returnRequestId_key" ON "ReturnPickupAssignment"("returnRequestId");
CREATE UNIQUE INDEX "ReturnPickupAssignment_productOrderId_key" ON "ReturnPickupAssignment"("productOrderId");
CREATE UNIQUE INDEX "ReturnPickupAssignment_assignmentNumber_key" ON "ReturnPickupAssignment"("assignmentNumber");
CREATE INDEX "ReturnPickupAssignment_distributorOrganisationId_status_idx" ON "ReturnPickupAssignment"("distributorOrganisationId", "status");
CREATE INDEX "ReturnPickupAssignment_deliveryPartnerUserId_status_idx" ON "ReturnPickupAssignment"("deliveryPartnerUserId", "status");
CREATE INDEX "ReturnPickupAssignment_status_assignedAt_idx" ON "ReturnPickupAssignment"("status", "assignedAt");

ALTER TABLE "ReturnPickupAssignment" ADD CONSTRAINT "ReturnPickupAssignment_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnPickupAssignment" ADD CONSTRAINT "ReturnPickupAssignment_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnPickupAssignment" ADD CONSTRAINT "ReturnPickupAssignment_distributorOrganisationId_fkey" FOREIGN KEY ("distributorOrganisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnPickupAssignment" ADD CONSTRAINT "ReturnPickupAssignment_farmerUserId_fkey" FOREIGN KEY ("farmerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnPickupAssignment" ADD CONSTRAINT "ReturnPickupAssignment_deliveryPartnerUserId_fkey" FOREIGN KEY ("deliveryPartnerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnPickupAssignment" ADD CONSTRAINT "ReturnPickupAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReturnPickupAssignment" ADD CONSTRAINT "ReturnPickupAssignment_respondedByUserId_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReturnPickupAssignment" ADD CONSTRAINT "ReturnPickupAssignment_collectedByUserId_fkey" FOREIGN KEY ("collectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
