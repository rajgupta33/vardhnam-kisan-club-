CREATE TYPE "ProductDispatchStatus" AS ENUM ('READY_FOR_PICKUP', 'CANCELLED');

CREATE TABLE "ProductDispatch" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productOrderId" UUID NOT NULL,
  "checkoutId" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "farmerProfileId" UUID NOT NULL,
  "sellerOrganisationId" UUID NOT NULL,
  "dispatchNumber" TEXT NOT NULL,
  "status" "ProductDispatchStatus" NOT NULL DEFAULT 'READY_FOR_PICKUP',
  "serviceablePincode" TEXT NOT NULL,
  "invoiceNumberSnapshot" TEXT NOT NULL,
  "sellerNameSnapshot" TEXT NOT NULL,
  "sellerGstinSnapshot" TEXT,
  "deliveryAddressSnapshot" JSONB NOT NULL,
  "warehouseSnapshot" JSONB NOT NULL,
  "itemsSnapshot" JSONB NOT NULL,
  "readyForPickupReason" TEXT,
  "readyByUserId" UUID,
  "readyByRole" "PlatformRole",
  "readyAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "ProductDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductDispatch_productOrderId_key" ON "ProductDispatch"("productOrderId");
CREATE UNIQUE INDEX "ProductDispatch_invoiceId_key" ON "ProductDispatch"("invoiceId");
CREATE UNIQUE INDEX "ProductDispatch_dispatchNumber_key" ON "ProductDispatch"("dispatchNumber");
CREATE INDEX "ProductDispatch_checkoutId_idx" ON "ProductDispatch"("checkoutId");
CREATE INDEX "ProductDispatch_farmerProfileId_readyAt_idx" ON "ProductDispatch"("farmerProfileId", "readyAt");
CREATE INDEX "ProductDispatch_sellerOrganisationId_status_idx" ON "ProductDispatch"("sellerOrganisationId", "status");
CREATE INDEX "ProductDispatch_readyByUserId_readyAt_idx" ON "ProductDispatch"("readyByUserId", "readyAt");
CREATE INDEX "ProductDispatch_status_readyAt_idx" ON "ProductDispatch"("status", "readyAt");

ALTER TABLE "ProductDispatch"
  ADD CONSTRAINT "ProductDispatch_productOrderId_fkey"
  FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductDispatch"
  ADD CONSTRAINT "ProductDispatch_checkoutId_fkey"
  FOREIGN KEY ("checkoutId") REFERENCES "ProductCheckout"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductDispatch"
  ADD CONSTRAINT "ProductDispatch_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "ProductInvoice"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductDispatch"
  ADD CONSTRAINT "ProductDispatch_farmerProfileId_fkey"
  FOREIGN KEY ("farmerProfileId") REFERENCES "FarmerProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductDispatch"
  ADD CONSTRAINT "ProductDispatch_sellerOrganisationId_fkey"
  FOREIGN KEY ("sellerOrganisationId") REFERENCES "Organisation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductDispatch"
  ADD CONSTRAINT "ProductDispatch_readyByUserId_fkey"
  FOREIGN KEY ("readyByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
