CREATE TYPE "FarmOwnershipType" AS ENUM ('OWNED', 'LEASED', 'SHARECROPPED', 'OTHER');
CREATE TYPE "IrrigationSource" AS ENUM ('TUBE_WELL', 'CANAL', 'RAIN_FED', 'POND', 'DRIP', 'SPRINKLER', 'OTHER');
CREATE TYPE "CropCycleStatus" AS ENUM ('PLANNED', 'ACTIVE', 'HARVESTED', 'ABANDONED');
CREATE TYPE "FarmActivityType" AS ENUM (
  'SOWING', 'IRRIGATION', 'FERTILIZER_APPLIED', 'CROP_PROTECTION_APPLIED',
  'PEST_OBSERVED', 'DISEASE_OBSERVED', 'WEEDING', 'CROP_DAMAGE', 'HARVEST', 'OTHER'
);
CREATE TYPE "FarmActivitySource" AS ENUM ('FARMER', 'PROMOTER', 'SYSTEM');

CREATE TABLE "Crop" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "nameHi" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "Crop_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Farm" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "membershipId" UUID NOT NULL,
  "farmerProfileId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "village" TEXT,
  "district" TEXT,
  "state" TEXT,
  "pincode" TEXT NOT NULL,
  "areaAcres" DECIMAL(10,3) NOT NULL,
  "ownershipType" "FarmOwnershipType" NOT NULL,
  "irrigationSource" "IrrigationSource",
  "soilType" TEXT,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "locationCapturedAt" TIMESTAMPTZ(6),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FarmCropCycle" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "farmId" UUID NOT NULL,
  "cropId" UUID NOT NULL,
  "varietyName" TEXT,
  "varietyProductId" UUID,
  "areaAcres" DECIMAL(10,3) NOT NULL,
  "season" TEXT NOT NULL,
  "sowingDate" DATE,
  "expectedHarvestDate" DATE,
  "actualHarvestDate" DATE,
  "status" "CropCycleStatus" NOT NULL DEFAULT 'ACTIVE',
  "yieldQuintals" DECIMAL(10,3),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "FarmCropCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FarmActivity" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cropCycleId" UUID NOT NULL,
  "activityType" "FarmActivityType" NOT NULL,
  "occurredOn" DATE NOT NULL,
  "notes" TEXT,
  "productOrderId" UUID,
  "recordedSource" "FarmActivitySource" NOT NULL,
  "recordedByUserId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FarmActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Crop_code_key" ON "Crop"("code");
CREATE INDEX "Crop_isActive_nameEn_idx" ON "Crop"("isActive", "nameEn");
CREATE INDEX "Farm_membershipId_isActive_idx" ON "Farm"("membershipId", "isActive");
CREATE INDEX "Farm_farmerProfileId_isActive_idx" ON "Farm"("farmerProfileId", "isActive");
CREATE INDEX "Farm_pincode_idx" ON "Farm"("pincode");
CREATE INDEX "Farm_district_state_idx" ON "Farm"("district", "state");
CREATE INDEX "FarmCropCycle_farmId_status_idx" ON "FarmCropCycle"("farmId", "status");
CREATE INDEX "FarmCropCycle_cropId_season_status_idx" ON "FarmCropCycle"("cropId", "season", "status");
CREATE INDEX "FarmCropCycle_status_sowingDate_idx" ON "FarmCropCycle"("status", "sowingDate");
CREATE INDEX "FarmActivity_cropCycleId_occurredOn_idx" ON "FarmActivity"("cropCycleId", "occurredOn");
CREATE INDEX "FarmActivity_activityType_occurredOn_idx" ON "FarmActivity"("activityType", "occurredOn");
CREATE INDEX "FarmActivity_productOrderId_idx" ON "FarmActivity"("productOrderId");

ALTER TABLE "Farm" ADD CONSTRAINT "Farm_membershipId_fkey"
  FOREIGN KEY ("membershipId") REFERENCES "KisanClubMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_farmerProfileId_fkey"
  FOREIGN KEY ("farmerProfileId") REFERENCES "FarmerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FarmCropCycle" ADD CONSTRAINT "FarmCropCycle_farmId_fkey"
  FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FarmCropCycle" ADD CONSTRAINT "FarmCropCycle_cropId_fkey"
  FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FarmCropCycle" ADD CONSTRAINT "FarmCropCycle_varietyProductId_fkey"
  FOREIGN KEY ("varietyProductId") REFERENCES "MasterProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FarmActivity" ADD CONSTRAINT "FarmActivity_cropCycleId_fkey"
  FOREIGN KEY ("cropCycleId") REFERENCES "FarmCropCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FarmActivity" ADD CONSTRAINT "FarmActivity_productOrderId_fkey"
  FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FarmActivity" ADD CONSTRAINT "FarmActivity_recordedByUserId_fkey"
  FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Crop" ("code", "nameEn", "nameHi", "updatedAt") VALUES
  ('WHEAT', 'Wheat', 'गेहूँ', CURRENT_TIMESTAMP),
  ('RICE', 'Rice', 'धान', CURRENT_TIMESTAMP),
  ('MUSTARD', 'Mustard', 'सरसों', CURRENT_TIMESTAMP),
  ('POTATO', 'Potato', 'आलू', CURRENT_TIMESTAMP),
  ('SUGARCANE', 'Sugarcane', 'गन्ना', CURRENT_TIMESTAMP),
  ('MAIZE', 'Maize', 'मक्का', CURRENT_TIMESTAMP);
