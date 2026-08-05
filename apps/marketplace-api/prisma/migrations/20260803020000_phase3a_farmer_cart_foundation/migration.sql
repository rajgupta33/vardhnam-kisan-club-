CREATE TYPE "CartStatus" AS ENUM (
  'ACTIVE',
  'ABANDONED'
);

CREATE TABLE "FarmerProfile" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "fullName" TEXT NOT NULL,
  "alternatePhone" TEXT,
  "preferredLocale" TEXT NOT NULL DEFAULT 'en-IN',
  "village" TEXT,
  "district" TEXT,
  "state" TEXT,
  "primaryPincode" TEXT,
  "cropInterests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FarmerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FarmerAddress" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "farmerProfileId" UUID NOT NULL,
  "label" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "addressLine1" TEXT NOT NULL,
  "addressLine2" TEXT,
  "village" TEXT,
  "city" TEXT NOT NULL,
  "district" TEXT,
  "state" TEXT NOT NULL,
  "pincode" TEXT NOT NULL,
  "landmark" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FarmerAddress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Cart" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "farmerProfileId" UUID NOT NULL,
  "deliveryAddressId" UUID,
  "serviceablePincode" TEXT,
  "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CartItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cartId" UUID NOT NULL,
  "offerId" UUID NOT NULL,
  "distributorOrganisationId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "variantId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "batchId" UUID,
  "quantity" INTEGER NOT NULL,
  "priceSnapshotPaise" INTEGER NOT NULL,
  "availableQuantitySnapshot" INTEGER NOT NULL,
  "serviceablePincodeSnapshot" TEXT NOT NULL,
  "productNameSnapshot" TEXT NOT NULL,
  "variantNameSnapshot" TEXT NOT NULL,
  "sellerNameSnapshot" TEXT NOT NULL,
  "warehouseNameSnapshot" TEXT NOT NULL,
  "fulfilmentModeSnapshot" "FulfilmentMode" NOT NULL,
  "deliverySlaDaysSnapshot" INTEGER,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FarmerProfile_userId_key" ON "FarmerProfile"("userId");
CREATE INDEX "FarmerProfile_state_district_idx" ON "FarmerProfile"("state", "district");
CREATE INDEX "FarmerProfile_primaryPincode_idx" ON "FarmerProfile"("primaryPincode");

CREATE INDEX "FarmerAddress_farmerProfileId_isDefault_idx" ON "FarmerAddress"("farmerProfileId", "isDefault");
CREATE INDEX "FarmerAddress_pincode_idx" ON "FarmerAddress"("pincode");

CREATE UNIQUE INDEX "Cart_farmerProfileId_key" ON "Cart"("farmerProfileId");
CREATE INDEX "Cart_farmerProfileId_status_idx" ON "Cart"("farmerProfileId", "status");
CREATE INDEX "Cart_serviceablePincode_idx" ON "Cart"("serviceablePincode");

CREATE UNIQUE INDEX "CartItem_cartId_offerId_key" ON "CartItem"("cartId", "offerId");
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");
CREATE INDEX "CartItem_offerId_idx" ON "CartItem"("offerId");
CREATE INDEX "CartItem_distributorOrganisationId_idx" ON "CartItem"("distributorOrganisationId");
CREATE INDEX "CartItem_productId_variantId_idx" ON "CartItem"("productId", "variantId");
CREATE INDEX "CartItem_batchId_idx" ON "CartItem"("batchId");

ALTER TABLE "FarmerProfile"
ADD CONSTRAINT "FarmerProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FarmerAddress"
ADD CONSTRAINT "FarmerAddress_farmerProfileId_fkey"
FOREIGN KEY ("farmerProfileId") REFERENCES "FarmerProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Cart"
ADD CONSTRAINT "Cart_farmerProfileId_fkey"
FOREIGN KEY ("farmerProfileId") REFERENCES "FarmerProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Cart"
ADD CONSTRAINT "Cart_deliveryAddressId_fkey"
FOREIGN KEY ("deliveryAddressId") REFERENCES "FarmerAddress"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CartItem"
ADD CONSTRAINT "CartItem_cartId_fkey"
FOREIGN KEY ("cartId") REFERENCES "Cart"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CartItem"
ADD CONSTRAINT "CartItem_offerId_fkey"
FOREIGN KEY ("offerId") REFERENCES "DistributorOffer"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CartItem"
ADD CONSTRAINT "CartItem_distributorOrganisationId_fkey"
FOREIGN KEY ("distributorOrganisationId") REFERENCES "Organisation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CartItem"
ADD CONSTRAINT "CartItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "MasterProduct"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CartItem"
ADD CONSTRAINT "CartItem_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CartItem"
ADD CONSTRAINT "CartItem_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CartItem"
ADD CONSTRAINT "CartItem_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
