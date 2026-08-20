CREATE TYPE "KisanClubBenefitTokenStatus" AS ENUM ('ISSUED', 'REDEEMED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "KisanClubBenefitToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tokenReference" TEXT NOT NULL,
    "membershipId" UUID NOT NULL,
    "benefitRuleId" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "promoterUserId" UUID,
    "quantity" INTEGER NOT NULL,
    "quotedUnitPricePaise" INTEGER NOT NULL,
    "quotedBenefitPaise" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenSalt" TEXT NOT NULL,
    "status" "KisanClubBenefitTokenStatus" NOT NULL DEFAULT 'ISSUED',
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMPTZ(6),
    "consumedByUserId" UUID,
    "productOrderId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "KisanClubBenefitToken_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "KisanClubBenefitRedemption" ADD COLUMN "benefitTokenId" UUID;

CREATE UNIQUE INDEX "KisanClubBenefitToken_tokenReference_key" ON "KisanClubBenefitToken"("tokenReference");
CREATE UNIQUE INDEX "KisanClubBenefitToken_tokenHash_key" ON "KisanClubBenefitToken"("tokenHash");
CREATE UNIQUE INDEX "KisanClubBenefitToken_productOrderId_key" ON "KisanClubBenefitToken"("productOrderId");
CREATE INDEX "KisanClubBenefitToken_membershipId_status_idx" ON "KisanClubBenefitToken"("membershipId", "status");
CREATE INDEX "KisanClubBenefitToken_status_expiresAt_idx" ON "KisanClubBenefitToken"("status", "expiresAt");
CREATE INDEX "KisanClubBenefitToken_promoterUserId_status_idx" ON "KisanClubBenefitToken"("promoterUserId", "status");
CREATE UNIQUE INDEX "KisanClubBenefitRedemption_benefitTokenId_key" ON "KisanClubBenefitRedemption"("benefitTokenId");

ALTER TABLE "KisanClubBenefitToken" ADD CONSTRAINT "KisanClubBenefitToken_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "KisanClubMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KisanClubBenefitToken" ADD CONSTRAINT "KisanClubBenefitToken_benefitRuleId_fkey" FOREIGN KEY ("benefitRuleId") REFERENCES "KisanClubBenefitRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KisanClubBenefitToken" ADD CONSTRAINT "KisanClubBenefitToken_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "DistributorOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KisanClubBenefitToken" ADD CONSTRAINT "KisanClubBenefitToken_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KisanClubBenefitRedemption" ADD CONSTRAINT "KisanClubBenefitRedemption_benefitTokenId_fkey" FOREIGN KEY ("benefitTokenId") REFERENCES "KisanClubBenefitToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
