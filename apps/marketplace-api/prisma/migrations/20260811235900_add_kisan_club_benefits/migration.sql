CREATE TYPE "KisanClubBenefitType" AS ENUM ('FLAT_AMOUNT_OFF', 'PERCENT_OFF', 'QUANTITY_THRESHOLD');
CREATE TYPE "KisanClubBenefitStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED');

ALTER TYPE "FinancialLedgerEntryType" ADD VALUE 'CLUB_BENEFIT_SUBSIDY';

ALTER TABLE "Cart" ADD COLUMN "kisanClubContext" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CartItem" ADD COLUMN "clubBenefitSnapshotPaise" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ProductCheckout"
  ADD COLUMN "clubBenefitPaise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "farmerPayablePaise" INTEGER;
UPDATE "ProductCheckout" SET "farmerPayablePaise" = "subtotalPaise";
ALTER TABLE "ProductCheckout" ALTER COLUMN "farmerPayablePaise" SET NOT NULL;

ALTER TABLE "ProductOrder"
  ADD COLUMN "clubBenefitPaise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "farmerPayablePaise" INTEGER,
  ADD COLUMN "isKisanClubOrder" BOOLEAN NOT NULL DEFAULT false;
UPDATE "ProductOrder" SET "farmerPayablePaise" = "subtotalPaise";
ALTER TABLE "ProductOrder" ALTER COLUMN "farmerPayablePaise" SET NOT NULL;

CREATE TABLE "KisanClubBenefitRule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "programmeId" UUID NOT NULL,
  "benefitType" "KisanClubBenefitType" NOT NULL,
  "flatAmountPaise" INTEGER,
  "percentBps" INTEGER,
  "maxBenefitPaise" INTEGER,
  "minimumQuantity" INTEGER NOT NULL DEFAULT 1,
  "eligiblePincodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "eligibleCropIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "status" "KisanClubBenefitStatus" NOT NULL DEFAULT 'DRAFT',
  "startsAt" TIMESTAMPTZ(6) NOT NULL,
  "endsAt" TIMESTAMPTZ(6),
  "totalUsageLimit" INTEGER,
  "perMemberUsageLimit" INTEGER,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" UUID,
  "createdByRole" "PlatformRole",
  "reason" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "KisanClubBenefitRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KisanClubBenefitRule_amount_shape_check" CHECK (
    ("benefitType" IN ('FLAT_AMOUNT_OFF', 'QUANTITY_THRESHOLD') AND "flatAmountPaise" IS NOT NULL AND "flatAmountPaise" > 0 AND "percentBps" IS NULL)
    OR ("benefitType" = 'PERCENT_OFF' AND "percentBps" IS NOT NULL AND "percentBps" BETWEEN 1 AND 10000 AND "flatAmountPaise" IS NULL)
  ),
  CONSTRAINT "KisanClubBenefitRule_limits_check" CHECK (
    "minimumQuantity" > 0
    AND ("maxBenefitPaise" IS NULL OR "maxBenefitPaise" > 0)
    AND ("totalUsageLimit" IS NULL OR "totalUsageLimit" > 0)
    AND ("perMemberUsageLimit" IS NULL OR "perMemberUsageLimit" > 0)
    AND "usageCount" >= 0
    AND ("endsAt" IS NULL OR "endsAt" > "startsAt")
  )
);

ALTER TABLE "ProductOrderItem"
  ADD COLUMN "clubBenefitRuleId" UUID,
  ADD COLUMN "clubBenefitPaise" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ReturnRequestItem" ADD COLUMN "clubBenefitPaise" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "KisanClubBenefitRedemption" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ruleId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "productOrderId" UUID NOT NULL,
  "productOrderItemId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "perUnitBenefitPaise" INTEGER NOT NULL,
  "totalBenefitPaise" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KisanClubBenefitRedemption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KisanClubBenefitRedemption_values_check" CHECK (
    "quantity" > 0 AND "perUnitBenefitPaise" >= 0 AND "totalBenefitPaise" > 0
  )
);

CREATE INDEX "KisanClubBenefitRule_programmeId_status_startsAt_endsAt_idx" ON "KisanClubBenefitRule"("programmeId", "status", "startsAt", "endsAt");
CREATE INDEX "KisanClubBenefitRule_status_startsAt_endsAt_idx" ON "KisanClubBenefitRule"("status", "startsAt", "endsAt");
CREATE INDEX "ProductOrderItem_clubBenefitRuleId_idx" ON "ProductOrderItem"("clubBenefitRuleId");
CREATE UNIQUE INDEX "KisanClubBenefitRedemption_productOrderItemId_key" ON "KisanClubBenefitRedemption"("productOrderItemId");
CREATE INDEX "KisanClubBenefitRedemption_ruleId_createdAt_idx" ON "KisanClubBenefitRedemption"("ruleId", "createdAt");
CREATE INDEX "KisanClubBenefitRedemption_membershipId_ruleId_idx" ON "KisanClubBenefitRedemption"("membershipId", "ruleId");
CREATE INDEX "KisanClubBenefitRedemption_productOrderId_idx" ON "KisanClubBenefitRedemption"("productOrderId");

ALTER TABLE "KisanClubBenefitRule" ADD CONSTRAINT "KisanClubBenefitRule_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "KisanClubProductProgramme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KisanClubBenefitRule" ADD CONSTRAINT "KisanClubBenefitRule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductOrderItem" ADD CONSTRAINT "ProductOrderItem_clubBenefitRuleId_fkey" FOREIGN KEY ("clubBenefitRuleId") REFERENCES "KisanClubBenefitRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KisanClubBenefitRedemption" ADD CONSTRAINT "KisanClubBenefitRedemption_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "KisanClubBenefitRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KisanClubBenefitRedemption" ADD CONSTRAINT "KisanClubBenefitRedemption_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "KisanClubMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KisanClubBenefitRedemption" ADD CONSTRAINT "KisanClubBenefitRedemption_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KisanClubBenefitRedemption" ADD CONSTRAINT "KisanClubBenefitRedemption_productOrderItemId_fkey" FOREIGN KEY ("productOrderItemId") REFERENCES "ProductOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_clubBenefitSnapshotPaise_check" CHECK ("clubBenefitSnapshotPaise" >= 0);
ALTER TABLE "ProductCheckout" ADD CONSTRAINT "ProductCheckout_club_amounts_check" CHECK ("clubBenefitPaise" >= 0 AND "farmerPayablePaise" >= 0 AND "farmerPayablePaise" + "clubBenefitPaise" = "subtotalPaise");
ALTER TABLE "ProductOrder" ADD CONSTRAINT "ProductOrder_club_amounts_check" CHECK ("clubBenefitPaise" >= 0 AND "farmerPayablePaise" >= 0 AND "farmerPayablePaise" + "clubBenefitPaise" = "subtotalPaise");
ALTER TABLE "ProductOrderItem" ADD CONSTRAINT "ProductOrderItem_club_benefit_check" CHECK ("clubBenefitPaise" >= 0 AND "clubBenefitPaise" <= "lineTotalPaise");
ALTER TABLE "ReturnRequestItem" ADD CONSTRAINT "ReturnRequestItem_club_benefit_check" CHECK ("clubBenefitPaise" >= 0 AND "clubBenefitPaise" <= "unitPricePaise" * "quantity" AND "lineRefundPaise" + "clubBenefitPaise" = "unitPricePaise" * "quantity");
