CREATE TYPE "ProductDeliveryAssignmentStatus" AS ENUM (
  'ASSIGNED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_FAILED',
  'CANCELLED'
);

CREATE TABLE "ProductDeliveryAssignment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productOrderId" UUID NOT NULL,
  "checkoutId" UUID NOT NULL,
  "dispatchId" UUID NOT NULL,
  "farmerProfileId" UUID NOT NULL,
  "sellerOrganisationId" UUID NOT NULL,
  "deliveryPartnerUserId" UUID NOT NULL,
  "assignmentNumber" TEXT NOT NULL,
  "status" "ProductDeliveryAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
  "serviceablePincode" TEXT NOT NULL,
  "dispatchNumberSnapshot" TEXT NOT NULL,
  "invoiceNumberSnapshot" TEXT NOT NULL,
  "sellerNameSnapshot" TEXT NOT NULL,
  "sellerGstinSnapshot" TEXT,
  "deliveryAddressSnapshot" JSONB NOT NULL,
  "pickupSnapshot" JSONB NOT NULL,
  "itemsSnapshot" JSONB NOT NULL,
  "otpHash" TEXT NOT NULL,
  "otpSalt" TEXT NOT NULL,
  "otpExpiresAt" TIMESTAMPTZ(6) NOT NULL,
  "otpAttemptCount" INTEGER NOT NULL DEFAULT 0,
  "otpVerifiedAt" TIMESTAMPTZ(6),
  "assignedByUserId" UUID,
  "assignedByRole" "PlatformRole",
  "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedByUserId" UUID,
  "startedByRole" "PlatformRole",
  "startedAt" TIMESTAMPTZ(6),
  "completedByUserId" UUID,
  "completedByRole" "PlatformRole",
  "completedAt" TIMESTAMPTZ(6),
  "deliveryProofNote" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "ProductDeliveryAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductDeliveryAssignment_productOrderId_key" ON "ProductDeliveryAssignment"("productOrderId");
CREATE UNIQUE INDEX "ProductDeliveryAssignment_dispatchId_key" ON "ProductDeliveryAssignment"("dispatchId");
CREATE UNIQUE INDEX "ProductDeliveryAssignment_assignmentNumber_key" ON "ProductDeliveryAssignment"("assignmentNumber");
CREATE INDEX "ProductDeliveryAssignment_checkoutId_idx" ON "ProductDeliveryAssignment"("checkoutId");
CREATE INDEX "ProductDeliveryAssignment_farmerProfileId_assignedAt_idx" ON "ProductDeliveryAssignment"("farmerProfileId", "assignedAt");
CREATE INDEX "ProductDeliveryAssignment_sellerOrganisationId_status_idx" ON "ProductDeliveryAssignment"("sellerOrganisationId", "status");
CREATE INDEX "ProductDeliveryAssignment_deliveryPartnerUserId_status_idx" ON "ProductDeliveryAssignment"("deliveryPartnerUserId", "status");
CREATE INDEX "ProductDeliveryAssignment_assignedByUserId_assignedAt_idx" ON "ProductDeliveryAssignment"("assignedByUserId", "assignedAt");
CREATE INDEX "ProductDeliveryAssignment_startedByUserId_startedAt_idx" ON "ProductDeliveryAssignment"("startedByUserId", "startedAt");
CREATE INDEX "ProductDeliveryAssignment_completedByUserId_completedAt_idx" ON "ProductDeliveryAssignment"("completedByUserId", "completedAt");
CREATE INDEX "ProductDeliveryAssignment_status_assignedAt_idx" ON "ProductDeliveryAssignment"("status", "assignedAt");

ALTER TABLE "ProductDeliveryAssignment"
  ADD CONSTRAINT "ProductDeliveryAssignment_productOrderId_fkey"
  FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductDeliveryAssignment"
  ADD CONSTRAINT "ProductDeliveryAssignment_checkoutId_fkey"
  FOREIGN KEY ("checkoutId") REFERENCES "ProductCheckout"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductDeliveryAssignment"
  ADD CONSTRAINT "ProductDeliveryAssignment_dispatchId_fkey"
  FOREIGN KEY ("dispatchId") REFERENCES "ProductDispatch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductDeliveryAssignment"
  ADD CONSTRAINT "ProductDeliveryAssignment_farmerProfileId_fkey"
  FOREIGN KEY ("farmerProfileId") REFERENCES "FarmerProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductDeliveryAssignment"
  ADD CONSTRAINT "ProductDeliveryAssignment_sellerOrganisationId_fkey"
  FOREIGN KEY ("sellerOrganisationId") REFERENCES "Organisation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductDeliveryAssignment"
  ADD CONSTRAINT "ProductDeliveryAssignment_deliveryPartnerUserId_fkey"
  FOREIGN KEY ("deliveryPartnerUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductDeliveryAssignment"
  ADD CONSTRAINT "ProductDeliveryAssignment_assignedByUserId_fkey"
  FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductDeliveryAssignment"
  ADD CONSTRAINT "ProductDeliveryAssignment_startedByUserId_fkey"
  FOREIGN KEY ("startedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductDeliveryAssignment"
  ADD CONSTRAINT "ProductDeliveryAssignment_completedByUserId_fkey"
  FOREIGN KEY ("completedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
