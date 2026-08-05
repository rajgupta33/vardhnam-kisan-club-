CREATE TYPE "WarehouseStatus" AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'BLOCKED'
);

CREATE TYPE "InventoryBatchStatus" AS ENUM (
  'ACTIVE',
  'BLOCKED',
  'EXPIRED'
);

CREATE TYPE "InventoryMovementType" AS ENUM (
  'OPENING_STOCK',
  'STOCK_RECEIVED',
  'MANUAL_INCREASE',
  'MANUAL_DECREASE',
  'DAMAGE_WRITE_OFF'
);

CREATE TABLE "Warehouse" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "distributorOrganisationId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "addressLine1" TEXT NOT NULL,
  "addressLine2" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "pincode" TEXT NOT NULL,
  "contactName" TEXT,
  "contactPhone" TEXT,
  "status" "WarehouseStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryBatch" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "distributorOrganisationId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "variantId" UUID NOT NULL,
  "batchNumber" TEXT NOT NULL,
  "manufacturingDate" DATE,
  "expiryDate" DATE,
  "germinationPercentage" DECIMAL(5,2),
  "status" "InventoryBatchStatus" NOT NULL DEFAULT 'ACTIVE',
  "blockedReason" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryMovement" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "distributorOrganisationId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "variantId" UUID NOT NULL,
  "movementType" "InventoryMovementType" NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "createdByUserId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Warehouse_distributorOrganisationId_code_key" ON "Warehouse"("distributorOrganisationId", "code");
CREATE INDEX "Warehouse_distributorOrganisationId_status_idx" ON "Warehouse"("distributorOrganisationId", "status");
CREATE INDEX "Warehouse_state_city_idx" ON "Warehouse"("state", "city");

CREATE UNIQUE INDEX "InventoryBatch_warehouseId_variantId_batchNumber_key" ON "InventoryBatch"("warehouseId", "variantId", "batchNumber");
CREATE INDEX "InventoryBatch_distributorOrganisationId_status_idx" ON "InventoryBatch"("distributorOrganisationId", "status");
CREATE INDEX "InventoryBatch_warehouseId_status_idx" ON "InventoryBatch"("warehouseId", "status");
CREATE INDEX "InventoryBatch_productId_variantId_idx" ON "InventoryBatch"("productId", "variantId");
CREATE INDEX "InventoryBatch_expiryDate_status_idx" ON "InventoryBatch"("expiryDate", "status");

CREATE INDEX "InventoryMovement_batchId_createdAt_idx" ON "InventoryMovement"("batchId", "createdAt");
CREATE INDEX "InventoryMovement_warehouseId_createdAt_idx" ON "InventoryMovement"("warehouseId", "createdAt");
CREATE INDEX "InventoryMovement_distributorOrganisationId_createdAt_idx" ON "InventoryMovement"("distributorOrganisationId", "createdAt");
CREATE INDEX "InventoryMovement_productId_variantId_idx" ON "InventoryMovement"("productId", "variantId");
CREATE INDEX "InventoryMovement_movementType_createdAt_idx" ON "InventoryMovement"("movementType", "createdAt");

ALTER TABLE "Warehouse"
ADD CONSTRAINT "Warehouse_distributorOrganisationId_fkey"
FOREIGN KEY ("distributorOrganisationId") REFERENCES "Organisation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryBatch"
ADD CONSTRAINT "InventoryBatch_distributorOrganisationId_fkey"
FOREIGN KEY ("distributorOrganisationId") REFERENCES "Organisation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryBatch"
ADD CONSTRAINT "InventoryBatch_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryBatch"
ADD CONSTRAINT "InventoryBatch_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "MasterProduct"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryBatch"
ADD CONSTRAINT "InventoryBatch_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement"
ADD CONSTRAINT "InventoryMovement_distributorOrganisationId_fkey"
FOREIGN KEY ("distributorOrganisationId") REFERENCES "Organisation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement"
ADD CONSTRAINT "InventoryMovement_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement"
ADD CONSTRAINT "InventoryMovement_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement"
ADD CONSTRAINT "InventoryMovement_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "MasterProduct"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement"
ADD CONSTRAINT "InventoryMovement_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement"
ADD CONSTRAINT "InventoryMovement_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
