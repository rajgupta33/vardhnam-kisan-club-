CREATE TYPE "KisanClubProgrammeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED');

CREATE TABLE "KisanClubProductProgramme" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productId" UUID NOT NULL,
  "variantId" UUID,
  "status" "KisanClubProgrammeStatus" NOT NULL DEFAULT 'DRAFT',
  "startsAt" TIMESTAMPTZ(6) NOT NULL,
  "endsAt" TIMESTAMPTZ(6),
  "eligiblePincodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "eligibleDistricts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "displayPriority" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" UUID,
  "createdByRole" "PlatformRole",
  "reason" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "KisanClubProductProgramme_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KisanClubProductProgramme_window_check"
    CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt")
);

CREATE UNIQUE INDEX "KisanClubProductProgramme_productId_variantId_key"
  ON "KisanClubProductProgramme"("productId", "variantId");
CREATE UNIQUE INDEX "KisanClubProductProgramme_product_wide_key"
  ON "KisanClubProductProgramme"("productId") WHERE "variantId" IS NULL;
CREATE INDEX "KisanClubProductProgramme_status_startsAt_endsAt_idx"
  ON "KisanClubProductProgramme"("status", "startsAt", "endsAt");
CREATE INDEX "KisanClubProductProgramme_productId_status_idx"
  ON "KisanClubProductProgramme"("productId", "status");

ALTER TABLE "KisanClubProductProgramme" ADD CONSTRAINT "KisanClubProductProgramme_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "MasterProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KisanClubProductProgramme" ADD CONSTRAINT "KisanClubProductProgramme_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KisanClubProductProgramme" ADD CONSTRAINT "KisanClubProductProgramme_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
