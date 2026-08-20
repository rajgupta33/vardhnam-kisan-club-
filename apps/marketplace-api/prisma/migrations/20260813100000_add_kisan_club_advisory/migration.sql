ALTER TYPE "PlatformRole" ADD VALUE IF NOT EXISTS 'AGRONOMIST';

CREATE TYPE "AdvisoryCategory" AS ENUM ('CROP_STAGE', 'IRRIGATION', 'NUTRITION', 'PEST_MONITORING', 'DISEASE_RISK', 'HARVEST', 'GENERAL_PRACTICE');
CREATE TYPE "AdvisoryRuleStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');
CREATE TYPE "AdvisoryEventStatus" AS ENUM ('PENDING', 'DELIVERED', 'READ', 'DISMISSED');

CREATE TABLE "AdvisoryRule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cropName" TEXT NOT NULL,
  "varietyName" TEXT,
  "category" "AdvisoryCategory" NOT NULL,
  "minDaysAfterSowing" INTEGER NOT NULL,
  "maxDaysAfterSowing" INTEGER NOT NULL,
  "eligibleStates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "eligibleDistricts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "seasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "titleEn" TEXT NOT NULL,
  "bodyEn" TEXT NOT NULL,
  "titleHi" TEXT NOT NULL,
  "bodyHi" TEXT NOT NULL,
  "status" "AdvisoryRuleStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "authoredByUserId" UUID,
  "reviewedByUserId" UUID,
  "reviewedAt" TIMESTAMPTZ(6),
  "reviewReason" TEXT,
  "sourceReference" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "AdvisoryRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdvisoryEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cropCycleId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "advisoryRuleId" UUID NOT NULL,
  "ruleVersion" INTEGER NOT NULL,
  "status" "AdvisoryEventStatus" NOT NULL DEFAULT 'PENDING',
  "dueOn" DATE NOT NULL,
  "notificationId" UUID,
  "readAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdvisoryEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdvisoryRule_cropName_status_minDaysAfterSowing_idx" ON "AdvisoryRule"("cropName", "status", "minDaysAfterSowing");
CREATE INDEX "AdvisoryRule_status_category_idx" ON "AdvisoryRule"("status", "category");
CREATE UNIQUE INDEX "AdvisoryEvent_cropCycleId_advisoryRuleId_ruleVersion_key" ON "AdvisoryEvent"("cropCycleId", "advisoryRuleId", "ruleVersion");
CREATE INDEX "AdvisoryEvent_membershipId_status_dueOn_idx" ON "AdvisoryEvent"("membershipId", "status", "dueOn");
ALTER TABLE "AdvisoryEvent" ADD CONSTRAINT "AdvisoryEvent_cropCycleId_fkey" FOREIGN KEY ("cropCycleId") REFERENCES "FarmCropCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvisoryEvent" ADD CONSTRAINT "AdvisoryEvent_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "KisanClubMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvisoryEvent" ADD CONSTRAINT "AdvisoryEvent_advisoryRuleId_fkey" FOREIGN KEY ("advisoryRuleId") REFERENCES "AdvisoryRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
