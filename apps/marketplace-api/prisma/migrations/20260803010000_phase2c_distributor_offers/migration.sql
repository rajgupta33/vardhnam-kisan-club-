CREATE TYPE "DistributorOfferStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'PAUSED',
  'ARCHIVED'
);

CREATE TYPE "FulfilmentMode" AS ENUM (
  'DISTRIBUTOR_FULFILLED',
  'VARDHNAM_FULFILLED',
  'PICKUP'
);

CREATE TABLE "DistributorOffer" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "distributorOrganisationId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "variantId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "batchId" UUID,
  "offerCode" TEXT,
  "sellingPricePaise" INTEGER NOT NULL,
  "minimumOrderQuantity" INTEGER NOT NULL DEFAULT 1,
  "maximumOrderQuantity" INTEGER,
  "serviceablePincodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "fulfilmentMode" "FulfilmentMode" NOT NULL,
  "deliverySlaDays" INTEGER,
  "status" "DistributorOfferStatus" NOT NULL DEFAULT 'DRAFT',
  "reviewedAt" TIMESTAMPTZ(6),
  "reviewedByUserId" UUID,
  "reviewReason" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DistributorOffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DistributorOffer_distributorOrganisationId_offerCode_key"
ON "DistributorOffer"("distributorOrganisationId", "offerCode");

CREATE INDEX "DistributorOffer_distributorOrganisationId_status_idx"
ON "DistributorOffer"("distributorOrganisationId", "status");

CREATE INDEX "DistributorOffer_productId_variantId_idx"
ON "DistributorOffer"("productId", "variantId");

CREATE INDEX "DistributorOffer_warehouseId_status_idx"
ON "DistributorOffer"("warehouseId", "status");

CREATE INDEX "DistributorOffer_batchId_idx"
ON "DistributorOffer"("batchId");

CREATE INDEX "DistributorOffer_status_createdAt_idx"
ON "DistributorOffer"("status", "createdAt");

ALTER TABLE "DistributorOffer"
ADD CONSTRAINT "DistributorOffer_distributorOrganisationId_fkey"
FOREIGN KEY ("distributorOrganisationId") REFERENCES "Organisation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DistributorOffer"
ADD CONSTRAINT "DistributorOffer_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "MasterProduct"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DistributorOffer"
ADD CONSTRAINT "DistributorOffer_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DistributorOffer"
ADD CONSTRAINT "DistributorOffer_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DistributorOffer"
ADD CONSTRAINT "DistributorOffer_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DistributorOffer"
ADD CONSTRAINT "DistributorOffer_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
