CREATE TYPE "KisanClubFulfilmentStatus" AS ENUM (
  'ASSIGNED',
  'PROMOTER_ACCEPTED',
  'PROMOTER_DECLINED',
  'PRODUCT_READY',
  'FARMER_CONTACTED',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'COMPLETED',
  'FAILED',
  'REASSIGNED',
  'CANCELLED'
);

CREATE TYPE "KisanClubFulfilmentMode" AS ENUM (
  'CLUB_HOME_DELIVERY',
  'PROMOTER_PICKUP',
  'ASSISTED_PURCHASE'
);

CREATE TABLE "KisanClubFulfilmentAssignment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productOrderId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "promoterUserId" UUID NOT NULL,
  "mode" "KisanClubFulfilmentMode" NOT NULL,
  "status" "KisanClubFulfilmentStatus" NOT NULL DEFAULT 'ASSIGNED',
  "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMPTZ(6),
  "completedAt" TIMESTAMPTZ(6),
  "failureReason" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "KisanClubFulfilmentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KisanClubFulfilmentStatusHistory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "assignmentId" UUID NOT NULL,
  "fromStatus" "KisanClubFulfilmentStatus",
  "toStatus" "KisanClubFulfilmentStatus" NOT NULL,
  "changedByUserId" UUID,
  "changedByRole" "PlatformRole",
  "reason" TEXT,
  "requestId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KisanClubFulfilmentStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KisanClubFulfilmentAssignment_productOrderId_key" ON "KisanClubFulfilmentAssignment"("productOrderId");
CREATE INDEX "KisanClubFulfilmentAssignment_promoterUserId_status_idx" ON "KisanClubFulfilmentAssignment"("promoterUserId", "status");
CREATE INDEX "KisanClubFulfilmentAssignment_membershipId_status_idx" ON "KisanClubFulfilmentAssignment"("membershipId", "status");
CREATE INDEX "KisanClubFulfilmentAssignment_status_assignedAt_idx" ON "KisanClubFulfilmentAssignment"("status", "assignedAt");
CREATE INDEX "KisanClubFulfilmentStatusHistory_assignmentId_createdAt_idx" ON "KisanClubFulfilmentStatusHistory"("assignmentId", "createdAt");
CREATE INDEX "KisanClubFulfilmentStatusHistory_changedByUserId_createdAt_idx" ON "KisanClubFulfilmentStatusHistory"("changedByUserId", "createdAt");

ALTER TABLE "KisanClubFulfilmentAssignment" ADD CONSTRAINT "KisanClubFulfilmentAssignment_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KisanClubFulfilmentAssignment" ADD CONSTRAINT "KisanClubFulfilmentAssignment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "KisanClubMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KisanClubFulfilmentAssignment" ADD CONSTRAINT "KisanClubFulfilmentAssignment_promoterUserId_fkey" FOREIGN KEY ("promoterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KisanClubFulfilmentStatusHistory" ADD CONSTRAINT "KisanClubFulfilmentStatusHistory_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "KisanClubFulfilmentAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KisanClubFulfilmentStatusHistory" ADD CONSTRAINT "KisanClubFulfilmentStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
