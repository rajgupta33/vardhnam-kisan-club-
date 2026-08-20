CREATE TYPE "ReturnRequestStatus" AS ENUM (
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'IN_TRANSIT',
  'RECEIVED',
  'INSPECTED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "ReturnReasonCode" AS ENUM (
  'DAMAGED_IN_TRANSIT',
  'WRONG_ITEM',
  'EXPIRED_OR_NEAR_EXPIRY',
  'QUALITY_ISSUE',
  'NOT_AS_DESCRIBED',
  'ORDERED_BY_MISTAKE',
  'OTHER'
);

CREATE TABLE "ReturnRequest" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productOrderId" UUID NOT NULL,
  "farmerProfileId" UUID NOT NULL,
  "farmerUserId" UUID NOT NULL,
  "distributorOrganisationId" UUID NOT NULL,
  "status" "ReturnRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "reasonCode" "ReturnReasonCode" NOT NULL,
  "reasonNote" TEXT,
  "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "windowExpiresAt" TIMESTAMPTZ(6) NOT NULL,
  "refundableAmountPaise" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReturnRequestItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "returnRequestId" UUID NOT NULL,
  "productOrderItemId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPricePaise" INTEGER NOT NULL,
  "lineRefundPaise" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnRequestItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReturnRequestStatusHistory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "returnRequestId" UUID NOT NULL,
  "fromStatus" "ReturnRequestStatus",
  "toStatus" "ReturnRequestStatus" NOT NULL,
  "actorUserId" UUID,
  "actorRole" "PlatformRole",
  "reason" TEXT,
  "requestId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnRequestStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReturnRequest_productOrderId_key" ON "ReturnRequest"("productOrderId");
CREATE INDEX "ReturnRequest_farmerProfileId_createdAt_idx" ON "ReturnRequest"("farmerProfileId", "createdAt");
CREATE INDEX "ReturnRequest_farmerUserId_createdAt_idx" ON "ReturnRequest"("farmerUserId", "createdAt");
CREATE INDEX "ReturnRequest_distributorOrganisationId_status_idx" ON "ReturnRequest"("distributorOrganisationId", "status");
CREATE INDEX "ReturnRequest_status_createdAt_idx" ON "ReturnRequest"("status", "createdAt");
CREATE UNIQUE INDEX "ReturnRequestItem_returnRequestId_productOrderItemId_key" ON "ReturnRequestItem"("returnRequestId", "productOrderItemId");
CREATE INDEX "ReturnRequestItem_productOrderItemId_idx" ON "ReturnRequestItem"("productOrderItemId");
CREATE INDEX "ReturnRequestStatusHistory_returnRequestId_createdAt_idx" ON "ReturnRequestStatusHistory"("returnRequestId", "createdAt");
CREATE INDEX "ReturnRequestStatusHistory_toStatus_createdAt_idx" ON "ReturnRequestStatusHistory"("toStatus", "createdAt");
CREATE INDEX "ReturnRequestStatusHistory_actorUserId_createdAt_idx" ON "ReturnRequestStatusHistory"("actorUserId", "createdAt");

ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_farmerProfileId_fkey" FOREIGN KEY ("farmerProfileId") REFERENCES "FarmerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_farmerUserId_fkey" FOREIGN KEY ("farmerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_distributorOrganisationId_fkey" FOREIGN KEY ("distributorOrganisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnRequestItem" ADD CONSTRAINT "ReturnRequestItem_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnRequestItem" ADD CONSTRAINT "ReturnRequestItem_productOrderItemId_fkey" FOREIGN KEY ("productOrderItemId") REFERENCES "ProductOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnRequestStatusHistory" ADD CONSTRAINT "ReturnRequestStatusHistory_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnRequestStatusHistory" ADD CONSTRAINT "ReturnRequestStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
