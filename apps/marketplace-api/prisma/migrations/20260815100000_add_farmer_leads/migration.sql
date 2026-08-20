CREATE TYPE "FarmerLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'LOST');
CREATE TYPE "FarmerLeadSource" AS ENUM ('FIELD_VISIT', 'REFERRAL', 'CAMPAIGN', 'INBOUND', 'OTHER');

CREATE TABLE "FarmerLead" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "promoterUserId" UUID NOT NULL,
    "promoterOrganisationId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "source" "FarmerLeadSource" NOT NULL,
    "status" "FarmerLeadStatus" NOT NULL DEFAULT 'NEW',
    "village" TEXT,
    "district" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "cropInterests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "statusReason" TEXT,
    "contactedAt" TIMESTAMPTZ(6),
    "convertedAt" TIMESTAMPTZ(6),
    "lostAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "FarmerLead_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FarmerLead_status_metadata_check" CHECK (
        ("status" = 'NEW' AND "contactedAt" IS NULL AND "convertedAt" IS NULL AND "lostAt" IS NULL AND "statusReason" IS NULL)
        OR ("status" = 'CONTACTED' AND "contactedAt" IS NOT NULL AND "convertedAt" IS NULL AND "lostAt" IS NULL)
        OR ("status" = 'CONVERTED' AND "contactedAt" IS NOT NULL AND "convertedAt" IS NOT NULL AND "lostAt" IS NULL)
        OR ("status" = 'LOST' AND "contactedAt" IS NOT NULL AND "convertedAt" IS NULL AND "lostAt" IS NOT NULL AND LENGTH(TRIM("statusReason")) > 0)
    )
);

CREATE INDEX "FarmerLead_promoterUserId_status_updatedAt_idx"
ON "FarmerLead"("promoterUserId", "status", "updatedAt");
CREATE INDEX "FarmerLead_promoterOrganisationId_status_updatedAt_idx"
ON "FarmerLead"("promoterOrganisationId", "status", "updatedAt");
CREATE INDEX "FarmerLead_phone_idx" ON "FarmerLead"("phone");

ALTER TABLE "FarmerLead"
ADD CONSTRAINT "FarmerLead_promoterUserId_fkey"
FOREIGN KEY ("promoterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FarmerLead"
ADD CONSTRAINT "FarmerLead_promoterOrganisationId_fkey"
FOREIGN KEY ("promoterOrganisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
