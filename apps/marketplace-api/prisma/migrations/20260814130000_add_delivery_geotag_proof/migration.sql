CREATE TYPE "DeliveryProofLocationStatus" AS ENUM ('GRANTED', 'DENIED', 'UNAVAILABLE');

ALTER TABLE "ProductDeliveryAssignment"
ADD COLUMN "proofLocationStatus" "DeliveryProofLocationStatus",
ADD COLUMN "proofLatitude" DOUBLE PRECISION,
ADD COLUMN "proofLongitude" DOUBLE PRECISION,
ADD COLUMN "proofAccuracyMetres" DOUBLE PRECISION,
ADD COLUMN "proofLocationCapturedAt" TIMESTAMPTZ(6);

ALTER TABLE "ProductDeliveryAssignment"
ADD CONSTRAINT "ProductDeliveryAssignment_location_proof_consistency" CHECK (
  (
    "proofLocationStatus" = 'GRANTED'
    AND "proofLatitude" IS NOT NULL
    AND "proofLongitude" IS NOT NULL
    AND "proofAccuracyMetres" IS NOT NULL
    AND "proofLocationCapturedAt" IS NOT NULL
  )
  OR (
    "proofLocationStatus" IN ('DENIED', 'UNAVAILABLE')
    AND "proofLatitude" IS NULL
    AND "proofLongitude" IS NULL
    AND "proofAccuracyMetres" IS NULL
    AND "proofLocationCapturedAt" IS NULL
  )
  OR (
    "proofLocationStatus" IS NULL
    AND "proofLatitude" IS NULL
    AND "proofLongitude" IS NULL
    AND "proofAccuracyMetres" IS NULL
    AND "proofLocationCapturedAt" IS NULL
  )
);
