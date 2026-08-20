CREATE TYPE "PromoterTerritoryStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "KisanClubAssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');
CREATE TYPE "KisanClubAssignmentReason" AS ENUM (
  'AUTO_MATCHED', 'MANUAL_OPS', 'PROMOTER_EXITED', 'TERRITORY_CHANGED',
  'FARMER_REQUEST', 'SERVICE_QUALITY', 'CAPACITY', 'INACTIVITY'
);

CREATE TABLE "PromoterTerritory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "blocks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "pincodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "villages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "PromoterTerritoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "PromoterTerritory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KisanClubPromoterProfile" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "promoterUserId" UUID NOT NULL,
  "promoterOrganisationId" UUID NOT NULL,
  "territoryId" UUID,
  "homeVillage" TEXT,
  "homePincode" TEXT,
  "clubEnabled" BOOLEAN NOT NULL DEFAULT false,
  "acceptingNewFarmers" BOOLEAN NOT NULL DEFAULT true,
  "maxActiveFarmers" INTEGER NOT NULL DEFAULT 150,
  "activeFarmerCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "KisanClubPromoterProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KisanClubPromoterProfile_capacity_check"
    CHECK ("maxActiveFarmers" > 0 AND "activeFarmerCount" >= 0 AND "activeFarmerCount" <= "maxActiveFarmers")
);

CREATE TABLE "KisanClubPromoterAssignment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "membershipId" UUID NOT NULL,
  "promoterUserId" UUID NOT NULL,
  "territoryId" UUID,
  "status" "KisanClubAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMPTZ(6),
  "assignmentReason" "KisanClubAssignmentReason" NOT NULL,
  "matchScore" JSONB,
  "assignedByUserId" UUID,
  "assignedByRole" "PlatformRole",
  "reason" TEXT,
  "promoterAttributionId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KisanClubPromoterAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromoterTerritory_state_district_status_idx"
  ON "PromoterTerritory"("state", "district", "status");
CREATE UNIQUE INDEX "KisanClubPromoterProfile_promoterUserId_key"
  ON "KisanClubPromoterProfile"("promoterUserId");
CREATE INDEX "KisanClubPromoterProfile_territoryId_clubEnabled_acceptingNewFarmers_idx"
  ON "KisanClubPromoterProfile"("territoryId", "clubEnabled", "acceptingNewFarmers");
CREATE INDEX "KisanClubPromoterProfile_homePincode_clubEnabled_idx"
  ON "KisanClubPromoterProfile"("homePincode", "clubEnabled");
CREATE UNIQUE INDEX "KisanClubPromoterAssignment_promoterAttributionId_key"
  ON "KisanClubPromoterAssignment"("promoterAttributionId");
CREATE UNIQUE INDEX "KisanClubPromoterAssignment_one_active_membership_key"
  ON "KisanClubPromoterAssignment"("membershipId") WHERE "status" = 'ACTIVE';
CREATE INDEX "KisanClubPromoterAssignment_membershipId_status_idx"
  ON "KisanClubPromoterAssignment"("membershipId", "status");
CREATE INDEX "KisanClubPromoterAssignment_promoterUserId_status_idx"
  ON "KisanClubPromoterAssignment"("promoterUserId", "status");

ALTER TABLE "KisanClubPromoterProfile" ADD CONSTRAINT "KisanClubPromoterProfile_promoterUserId_fkey"
  FOREIGN KEY ("promoterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KisanClubPromoterProfile" ADD CONSTRAINT "KisanClubPromoterProfile_promoterOrganisationId_fkey"
  FOREIGN KEY ("promoterOrganisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KisanClubPromoterProfile" ADD CONSTRAINT "KisanClubPromoterProfile_territoryId_fkey"
  FOREIGN KEY ("territoryId") REFERENCES "PromoterTerritory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KisanClubPromoterAssignment" ADD CONSTRAINT "KisanClubPromoterAssignment_membershipId_fkey"
  FOREIGN KEY ("membershipId") REFERENCES "KisanClubMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KisanClubPromoterAssignment" ADD CONSTRAINT "KisanClubPromoterAssignment_promoterUserId_fkey"
  FOREIGN KEY ("promoterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KisanClubPromoterAssignment" ADD CONSTRAINT "KisanClubPromoterAssignment_territoryId_fkey"
  FOREIGN KEY ("territoryId") REFERENCES "PromoterTerritory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KisanClubPromoterAssignment" ADD CONSTRAINT "KisanClubPromoterAssignment_assignedByUserId_fkey"
  FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KisanClubPromoterAssignment" ADD CONSTRAINT "KisanClubPromoterAssignment_promoterAttributionId_fkey"
  FOREIGN KEY ("promoterAttributionId") REFERENCES "PromoterAttribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
