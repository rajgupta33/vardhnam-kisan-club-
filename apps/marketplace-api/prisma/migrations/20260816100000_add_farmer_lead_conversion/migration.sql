ALTER TABLE "FarmerLead"
ADD COLUMN "convertedFarmerProfileId" UUID;

CREATE INDEX "FarmerLead_convertedFarmerProfileId_idx"
ON "FarmerLead"("convertedFarmerProfileId");

ALTER TABLE "FarmerLead"
ADD CONSTRAINT "FarmerLead_convertedFarmerProfileId_fkey"
FOREIGN KEY ("convertedFarmerProfileId") REFERENCES "FarmerProfile"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FarmerLead"
DROP CONSTRAINT "FarmerLead_status_metadata_check";

ALTER TABLE "FarmerLead"
ADD CONSTRAINT "FarmerLead_status_metadata_check" CHECK (
    ("status" = 'NEW' AND "contactedAt" IS NULL AND "convertedAt" IS NULL AND "lostAt" IS NULL AND "statusReason" IS NULL AND "convertedFarmerProfileId" IS NULL)
    OR ("status" = 'CONTACTED' AND "contactedAt" IS NOT NULL AND "convertedAt" IS NULL AND "lostAt" IS NULL AND "convertedFarmerProfileId" IS NULL)
    OR ("status" = 'CONVERTED' AND "contactedAt" IS NOT NULL AND "convertedAt" IS NOT NULL AND "lostAt" IS NULL AND "convertedFarmerProfileId" IS NOT NULL)
    OR ("status" = 'LOST' AND "contactedAt" IS NOT NULL AND "convertedAt" IS NULL AND "lostAt" IS NOT NULL AND LENGTH(TRIM("statusReason")) > 0 AND "convertedFarmerProfileId" IS NULL)
);
