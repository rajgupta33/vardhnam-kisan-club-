CREATE TYPE "KisanClubMembershipStatus" AS ENUM (
  'PENDING_PROFILE',
  'AWAITING_PROMOTER',
  'ACTIVE',
  'SUSPENDED',
  'INACTIVE',
  'CLOSED'
);

CREATE TABLE "KisanClubMembership" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "farmerProfileId" UUID NOT NULL,
  "memberNumber" TEXT NOT NULL,
  "status" "KisanClubMembershipStatus" NOT NULL DEFAULT 'PENDING_PROFILE',
  "homePincode" TEXT NOT NULL,
  "homeVillage" TEXT,
  "homeDistrict" TEXT,
  "homeState" TEXT,
  "joinedAt" TIMESTAMPTZ(6) NOT NULL,
  "termsVersion" TEXT NOT NULL,
  "termsAcceptedAt" TIMESTAMPTZ(6) NOT NULL,
  "advisoryConsent" BOOLEAN NOT NULL DEFAULT false,
  "advisoryConsentAt" TIMESTAMPTZ(6),
  "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
  "marketingConsentAt" TIMESTAMPTZ(6),
  "preciseLocationConsent" BOOLEAN NOT NULL DEFAULT false,
  "preciseLocationConsentAt" TIMESTAMPTZ(6),
  "referredByMembershipId" UUID,
  "suspendedReason" TEXT,
  "closedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "KisanClubMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KisanClubMembership_farmerProfileId_key"
  ON "KisanClubMembership"("farmerProfileId");
CREATE UNIQUE INDEX "KisanClubMembership_memberNumber_key"
  ON "KisanClubMembership"("memberNumber");
CREATE INDEX "KisanClubMembership_status_homePincode_idx"
  ON "KisanClubMembership"("status", "homePincode");
CREATE INDEX "KisanClubMembership_homeDistrict_status_idx"
  ON "KisanClubMembership"("homeDistrict", "status");

ALTER TABLE "KisanClubMembership"
  ADD CONSTRAINT "KisanClubMembership_farmerProfileId_fkey"
  FOREIGN KEY ("farmerProfileId") REFERENCES "FarmerProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KisanClubMembership"
  ADD CONSTRAINT "KisanClubMembership_referredByMembershipId_fkey"
  FOREIGN KEY ("referredByMembershipId") REFERENCES "KisanClubMembership"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
