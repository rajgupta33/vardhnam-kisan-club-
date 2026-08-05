ALTER TYPE "InventoryMovementType"
ADD VALUE 'RESERVED_FOR_ORDER';

CREATE TYPE "OrderType" AS ENUM (
  'PRODUCT_ORDER',
  'SERVICE_ORDER'
);

CREATE TYPE "ProductCheckoutStatus" AS ENUM (
  'PENDING_PAYMENT',
  'CANCELLED'
);

CREATE TYPE "ProductOrderStatus" AS ENUM (
  'DRAFT',
  'PENDING_PAYMENT',
  'PAYMENT_PROCESSING',
  'PAYMENT_FAILED',
  'CONFIRMED',
  'DISTRIBUTOR_ACCEPTED',
  'DISTRIBUTOR_REJECTED',
  'INVENTORY_RESERVED',
  'READY_TO_PACK',
  'PACKED',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_FAILED',
  'CANCELLATION_REQUESTED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURN_APPROVED',
  'RETURN_REJECTED',
  'RETURN_IN_TRANSIT',
  'RETURNED',
  'REFUND_PENDING',
  'REFUNDED',
  'DISPUTED',
  'CLOSED'
);

CREATE TABLE "ProductCheckout" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "farmerProfileId" UUID NOT NULL,
  "sourceCartId" UUID,
  "deliveryAddressId" UUID,
  "serviceablePincode" TEXT NOT NULL,
  "status" "ProductCheckoutStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "subtotalPaise" INTEGER NOT NULL,
  "itemCount" INTEGER NOT NULL,
  "childOrderCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductCheckout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductOrder" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "checkoutId" UUID NOT NULL,
  "orderType" "OrderType" NOT NULL DEFAULT 'PRODUCT_ORDER',
  "farmerProfileId" UUID NOT NULL,
  "deliveryAddressId" UUID,
  "sellerOrganisationId" UUID NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "status" "ProductOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "serviceablePincode" TEXT NOT NULL,
  "sellerNameSnapshot" TEXT NOT NULL,
  "sellerGstinSnapshot" TEXT,
  "deliveryAddressSnapshot" JSONB NOT NULL,
  "subtotalPaise" INTEGER NOT NULL,
  "itemCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductOrderItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productOrderId" UUID NOT NULL,
  "sourceCartItemId" UUID,
  "offerId" UUID NOT NULL,
  "distributorOrganisationId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "variantId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPricePaise" INTEGER NOT NULL,
  "lineTotalPaise" INTEGER NOT NULL,
  "productNameSnapshot" TEXT NOT NULL,
  "variantNameSnapshot" TEXT NOT NULL,
  "sellerNameSnapshot" TEXT NOT NULL,
  "warehouseNameSnapshot" TEXT NOT NULL,
  "fulfilmentModeSnapshot" "FulfilmentMode" NOT NULL,
  "deliverySlaDaysSnapshot" INTEGER,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductOrderItemReservation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productOrderItemId" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "inventoryMovementId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductOrderItemReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductOrderStatusHistory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productOrderId" UUID NOT NULL,
  "fromStatus" "ProductOrderStatus",
  "toStatus" "ProductOrderStatus" NOT NULL,
  "actorUserId" UUID,
  "actorRole" "PlatformRole",
  "reason" TEXT,
  "requestId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductOrder_orderNumber_key" ON "ProductOrder"("orderNumber");
CREATE UNIQUE INDEX "ProductOrderItemReservation_inventoryMovementId_key" ON "ProductOrderItemReservation"("inventoryMovementId");

CREATE INDEX "ProductCheckout_farmerProfileId_status_idx" ON "ProductCheckout"("farmerProfileId", "status");
CREATE INDEX "ProductCheckout_sourceCartId_idx" ON "ProductCheckout"("sourceCartId");
CREATE INDEX "ProductCheckout_deliveryAddressId_idx" ON "ProductCheckout"("deliveryAddressId");

CREATE INDEX "ProductOrder_checkoutId_idx" ON "ProductOrder"("checkoutId");
CREATE INDEX "ProductOrder_farmerProfileId_createdAt_idx" ON "ProductOrder"("farmerProfileId", "createdAt");
CREATE INDEX "ProductOrder_sellerOrganisationId_status_idx" ON "ProductOrder"("sellerOrganisationId", "status");
CREATE INDEX "ProductOrder_status_createdAt_idx" ON "ProductOrder"("status", "createdAt");

CREATE INDEX "ProductOrderItem_productOrderId_idx" ON "ProductOrderItem"("productOrderId");
CREATE INDEX "ProductOrderItem_sourceCartItemId_idx" ON "ProductOrderItem"("sourceCartItemId");
CREATE INDEX "ProductOrderItem_offerId_idx" ON "ProductOrderItem"("offerId");
CREATE INDEX "ProductOrderItem_distributorOrganisationId_idx" ON "ProductOrderItem"("distributorOrganisationId");
CREATE INDEX "ProductOrderItem_productId_variantId_idx" ON "ProductOrderItem"("productId", "variantId");
CREATE INDEX "ProductOrderItem_warehouseId_idx" ON "ProductOrderItem"("warehouseId");

CREATE INDEX "ProductOrderItemReservation_productOrderItemId_idx" ON "ProductOrderItemReservation"("productOrderItemId");
CREATE INDEX "ProductOrderItemReservation_batchId_idx" ON "ProductOrderItemReservation"("batchId");

CREATE INDEX "ProductOrderStatusHistory_productOrderId_createdAt_idx" ON "ProductOrderStatusHistory"("productOrderId", "createdAt");
CREATE INDEX "ProductOrderStatusHistory_toStatus_createdAt_idx" ON "ProductOrderStatusHistory"("toStatus", "createdAt");
CREATE INDEX "ProductOrderStatusHistory_actorUserId_createdAt_idx" ON "ProductOrderStatusHistory"("actorUserId", "createdAt");

ALTER TABLE "ProductCheckout"
ADD CONSTRAINT "ProductCheckout_farmerProfileId_fkey"
FOREIGN KEY ("farmerProfileId") REFERENCES "FarmerProfile"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductCheckout"
ADD CONSTRAINT "ProductCheckout_sourceCartId_fkey"
FOREIGN KEY ("sourceCartId") REFERENCES "Cart"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductCheckout"
ADD CONSTRAINT "ProductCheckout_deliveryAddressId_fkey"
FOREIGN KEY ("deliveryAddressId") REFERENCES "FarmerAddress"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductOrder"
ADD CONSTRAINT "ProductOrder_checkoutId_fkey"
FOREIGN KEY ("checkoutId") REFERENCES "ProductCheckout"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductOrder"
ADD CONSTRAINT "ProductOrder_farmerProfileId_fkey"
FOREIGN KEY ("farmerProfileId") REFERENCES "FarmerProfile"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductOrder"
ADD CONSTRAINT "ProductOrder_deliveryAddressId_fkey"
FOREIGN KEY ("deliveryAddressId") REFERENCES "FarmerAddress"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductOrder"
ADD CONSTRAINT "ProductOrder_sellerOrganisationId_fkey"
FOREIGN KEY ("sellerOrganisationId") REFERENCES "Organisation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductOrderItem"
ADD CONSTRAINT "ProductOrderItem_productOrderId_fkey"
FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductOrderItem"
ADD CONSTRAINT "ProductOrderItem_offerId_fkey"
FOREIGN KEY ("offerId") REFERENCES "DistributorOffer"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductOrderItem"
ADD CONSTRAINT "ProductOrderItem_distributorOrganisationId_fkey"
FOREIGN KEY ("distributorOrganisationId") REFERENCES "Organisation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductOrderItem"
ADD CONSTRAINT "ProductOrderItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "MasterProduct"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductOrderItem"
ADD CONSTRAINT "ProductOrderItem_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductOrderItem"
ADD CONSTRAINT "ProductOrderItem_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductOrderItemReservation"
ADD CONSTRAINT "ProductOrderItemReservation_productOrderItemId_fkey"
FOREIGN KEY ("productOrderItemId") REFERENCES "ProductOrderItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductOrderItemReservation"
ADD CONSTRAINT "ProductOrderItemReservation_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductOrderItemReservation"
ADD CONSTRAINT "ProductOrderItemReservation_inventoryMovementId_fkey"
FOREIGN KEY ("inventoryMovementId") REFERENCES "InventoryMovement"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductOrderStatusHistory"
ADD CONSTRAINT "ProductOrderStatusHistory_productOrderId_fkey"
FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductOrderStatusHistory"
ADD CONSTRAINT "ProductOrderStatusHistory_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
