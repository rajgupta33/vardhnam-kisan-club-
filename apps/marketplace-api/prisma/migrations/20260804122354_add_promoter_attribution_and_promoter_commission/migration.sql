-- CreateEnum
CREATE TYPE "PromoterAttributionStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterEnum
ALTER TYPE "CommissionEntryType" ADD VALUE 'PROMOTER_COMMISSION';

-- AlterTable
ALTER TABLE "CommissionRule" ADD COLUMN     "promoterCommissionBps" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PromoterAttribution" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "promoterUserId" UUID NOT NULL,
    "promoterOrganisationId" UUID NOT NULL,
    "farmerProfileId" UUID NOT NULL,
    "status" "PromoterAttributionStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(6),
    "createdByUserId" UUID,
    "createdByRole" "PlatformRole",
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoterAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromoterAttribution_farmerProfileId_status_idx" ON "PromoterAttribution"("farmerProfileId", "status");

-- CreateIndex
CREATE INDEX "PromoterAttribution_promoterUserId_status_idx" ON "PromoterAttribution"("promoterUserId", "status");

-- AddForeignKey
ALTER TABLE "PromoterAttribution" ADD CONSTRAINT "PromoterAttribution_promoterUserId_fkey" FOREIGN KEY ("promoterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterAttribution" ADD CONSTRAINT "PromoterAttribution_promoterOrganisationId_fkey" FOREIGN KEY ("promoterOrganisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterAttribution" ADD CONSTRAINT "PromoterAttribution_farmerProfileId_fkey" FOREIGN KEY ("farmerProfileId") REFERENCES "FarmerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterAttribution" ADD CONSTRAINT "PromoterAttribution_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
