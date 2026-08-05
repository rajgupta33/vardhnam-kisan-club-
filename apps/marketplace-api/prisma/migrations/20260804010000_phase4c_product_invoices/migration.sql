CREATE TYPE "ProductInvoiceStatus" AS ENUM ('GENERATED', 'VOIDED');

CREATE TABLE "ProductInvoice" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productOrderId" UUID NOT NULL,
  "checkoutId" UUID NOT NULL,
  "farmerProfileId" UUID NOT NULL,
  "sellerOrganisationId" UUID NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "status" "ProductInvoiceStatus" NOT NULL DEFAULT 'GENERATED',
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "subtotalPaise" INTEGER NOT NULL,
  "taxPaise" INTEGER NOT NULL DEFAULT 0,
  "totalPaise" INTEGER NOT NULL,
  "itemCount" INTEGER NOT NULL,
  "sellerLegalNameSnapshot" TEXT NOT NULL,
  "sellerDisplayNameSnapshot" TEXT NOT NULL,
  "sellerGstinSnapshot" TEXT,
  "farmerNameSnapshot" TEXT NOT NULL,
  "deliveryAddressSnapshot" JSONB NOT NULL,
  "lineItemsSnapshot" JSONB NOT NULL,
  "generatedByUserId" UUID,
  "generatedByRole" "PlatformRole",
  "generatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "ProductInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductInvoice_productOrderId_key" ON "ProductInvoice"("productOrderId");
CREATE UNIQUE INDEX "ProductInvoice_invoiceNumber_key" ON "ProductInvoice"("invoiceNumber");
CREATE INDEX "ProductInvoice_checkoutId_idx" ON "ProductInvoice"("checkoutId");
CREATE INDEX "ProductInvoice_farmerProfileId_generatedAt_idx" ON "ProductInvoice"("farmerProfileId", "generatedAt");
CREATE INDEX "ProductInvoice_sellerOrganisationId_generatedAt_idx" ON "ProductInvoice"("sellerOrganisationId", "generatedAt");
CREATE INDEX "ProductInvoice_generatedByUserId_generatedAt_idx" ON "ProductInvoice"("generatedByUserId", "generatedAt");
CREATE INDEX "ProductInvoice_status_generatedAt_idx" ON "ProductInvoice"("status", "generatedAt");

ALTER TABLE "ProductInvoice"
  ADD CONSTRAINT "ProductInvoice_productOrderId_fkey"
  FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductInvoice"
  ADD CONSTRAINT "ProductInvoice_checkoutId_fkey"
  FOREIGN KEY ("checkoutId") REFERENCES "ProductCheckout"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductInvoice"
  ADD CONSTRAINT "ProductInvoice_farmerProfileId_fkey"
  FOREIGN KEY ("farmerProfileId") REFERENCES "FarmerProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductInvoice"
  ADD CONSTRAINT "ProductInvoice_sellerOrganisationId_fkey"
  FOREIGN KEY ("sellerOrganisationId") REFERENCES "Organisation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductInvoice"
  ADD CONSTRAINT "ProductInvoice_generatedByUserId_fkey"
  FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
