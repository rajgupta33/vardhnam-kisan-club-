ALTER TABLE "ProductDispatch"
ADD COLUMN "packageQrHash" TEXT,
ADD COLUMN "packageQrIssuedAt" TIMESTAMPTZ(6),
ADD COLUMN "packageQrIssuedByUserId" UUID;

ALTER TABLE "ProductDeliveryAssignment"
ADD COLUMN "pickupVerificationAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pickupVerifiedAt" TIMESTAMPTZ(6),
ADD COLUMN "pickupVerifiedByUserId" UUID,
ADD COLUMN "pickupVerifiedByRole" "PlatformRole";

ALTER TABLE "ProductDispatch"
ADD CONSTRAINT "ProductDispatch_packageQrIssuedByUserId_fkey"
FOREIGN KEY ("packageQrIssuedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductDeliveryAssignment"
ADD CONSTRAINT "ProductDeliveryAssignment_pickupVerifiedByUserId_fkey"
FOREIGN KEY ("pickupVerifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ProductDeliveryAssignment_pickupVerifiedByUserId_pickupVerifiedAt_idx"
ON "ProductDeliveryAssignment"("pickupVerifiedByUserId", "pickupVerifiedAt");
