CREATE TYPE "DeliveryFailureReasonCode" AS ENUM (
  'FARMER_UNAVAILABLE',
  'FARMER_REFUSED',
  'ADDRESS_NOT_FOUND',
  'ACCESS_RESTRICTED',
  'VEHICLE_BREAKDOWN',
  'WEATHER_OR_ROUTE_BLOCKED',
  'PACKAGE_DAMAGED',
  'OTHER'
);

ALTER TABLE "ProductDeliveryAssignment"
  ADD COLUMN "failureAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastFailureReasonCode" "DeliveryFailureReasonCode",
  ADD COLUMN "lastFailureNote" TEXT,
  ADD COLUMN "lastFailedAt" TIMESTAMPTZ(6),
  ADD COLUMN "lastFailedByUserId" UUID,
  ADD COLUMN "lastFailedByRole" "PlatformRole",
  ADD COLUMN "retryScheduledAt" TIMESTAMPTZ(6);

ALTER TABLE "ProductDeliveryAssignment"
  ADD CONSTRAINT "ProductDeliveryAssignment_lastFailedByUserId_fkey"
  FOREIGN KEY ("lastFailedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ProductDeliveryAssignment_lastFailedByUserId_lastFailedAt_idx"
  ON "ProductDeliveryAssignment"("lastFailedByUserId", "lastFailedAt");

CREATE INDEX "ProductDeliveryAssignment_status_retryScheduledAt_idx"
  ON "ProductDeliveryAssignment"("status", "retryScheduledAt");
