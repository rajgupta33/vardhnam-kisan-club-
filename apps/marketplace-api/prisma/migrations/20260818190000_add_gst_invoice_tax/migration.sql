ALTER TABLE "FarmerAddress" ADD COLUMN "stateCode" TEXT;

ALTER TABLE "Organisation"
  ADD COLUMN "registeredStateCode" TEXT,
  ADD COLUMN "gstinVerifiedAt" TIMESTAMPTZ(6);

ALTER TABLE "ProductVariant"
  ADD COLUMN "hsnCode" TEXT,
  ADD COLUMN "gstRateBps" INTEGER;

ALTER TABLE "ProductOrderItem"
  ADD COLUMN "hsnCodeSnapshot" TEXT,
  ADD COLUMN "gstRateBpsSnapshot" INTEGER;

ALTER TABLE "ProductInvoice"
  ADD COLUMN "taxableAmountPaise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cgstPaise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sgstPaise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "igstPaise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "sellerStateCodeSnapshot" TEXT,
  ADD COLUMN "placeOfSupplyStateCode" TEXT,
  ADD COLUMN "financialYear" TEXT,
  ADD COLUMN "sequenceNumber" INTEGER;

UPDATE "Organisation"
SET
  "registeredStateCode" = SUBSTRING("gstin" FROM 1 FOR 2),
  "gstinVerifiedAt" = CASE
    WHEN "status" = 'ACTIVE' THEN COALESCE("reviewedAt", "updatedAt")
    ELSE NULL
  END
WHERE "gstin" ~ '^[0-9]{2}[A-Z0-9]{13}$';

UPDATE "FarmerAddress"
SET "stateCode" = CASE LOWER(TRIM("state"))
  WHEN 'jammu and kashmir' THEN '01'
  WHEN 'himachal pradesh' THEN '02'
  WHEN 'punjab' THEN '03'
  WHEN 'chandigarh' THEN '04'
  WHEN 'uttarakhand' THEN '05'
  WHEN 'haryana' THEN '06'
  WHEN 'delhi' THEN '07'
  WHEN 'rajasthan' THEN '08'
  WHEN 'uttar pradesh' THEN '09'
  WHEN 'bihar' THEN '10'
  WHEN 'sikkim' THEN '11'
  WHEN 'arunachal pradesh' THEN '12'
  WHEN 'nagaland' THEN '13'
  WHEN 'manipur' THEN '14'
  WHEN 'mizoram' THEN '15'
  WHEN 'tripura' THEN '16'
  WHEN 'meghalaya' THEN '17'
  WHEN 'assam' THEN '18'
  WHEN 'west bengal' THEN '19'
  WHEN 'jharkhand' THEN '20'
  WHEN 'odisha' THEN '21'
  WHEN 'chhattisgarh' THEN '22'
  WHEN 'madhya pradesh' THEN '23'
  WHEN 'gujarat' THEN '24'
  WHEN 'dadra and nagar haveli and daman and diu' THEN '26'
  WHEN 'maharashtra' THEN '27'
  WHEN 'andhra pradesh' THEN '37'
  WHEN 'karnataka' THEN '29'
  WHEN 'goa' THEN '30'
  WHEN 'lakshadweep' THEN '31'
  WHEN 'kerala' THEN '32'
  WHEN 'tamil nadu' THEN '33'
  WHEN 'puducherry' THEN '34'
  WHEN 'andaman and nicobar islands' THEN '35'
  WHEN 'telangana' THEN '36'
  WHEN 'ladakh' THEN '38'
  ELSE NULL
END;

UPDATE "ProductInvoice"
SET
  "taxableAmountPaise" = "subtotalPaise",
  "financialYear" = CASE
    WHEN EXTRACT(MONTH FROM "generatedAt") >= 4
      THEN EXTRACT(YEAR FROM "generatedAt")::TEXT || '-' || RIGHT((EXTRACT(YEAR FROM "generatedAt")::INTEGER + 1)::TEXT, 2)
    ELSE (EXTRACT(YEAR FROM "generatedAt")::INTEGER - 1)::TEXT || '-' || RIGHT(EXTRACT(YEAR FROM "generatedAt")::INTEGER::TEXT, 2)
  END;

CREATE TABLE "InvoiceSequence" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sellerOrganisationId" UUID NOT NULL,
  "financialYear" TEXT NOT NULL,
  "lastNumber" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvoiceSequence_sellerOrganisationId_fkey"
    FOREIGN KEY ("sellerOrganisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InvoiceSequence_sellerOrganisationId_financialYear_key"
  ON "InvoiceSequence"("sellerOrganisationId", "financialYear");
CREATE INDEX "InvoiceSequence_financialYear_idx" ON "InvoiceSequence"("financialYear");
CREATE INDEX "ProductInvoice_sellerOrganisationId_financialYear_sequenceNumber_idx"
  ON "ProductInvoice"("sellerOrganisationId", "financialYear", "sequenceNumber");

ALTER TABLE "FarmerAddress" ADD CONSTRAINT "FarmerAddress_stateCode_check"
  CHECK ("stateCode" IS NULL OR "stateCode" ~ '^[0-9]{2}$');
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_registeredStateCode_check"
  CHECK ("registeredStateCode" IS NULL OR "registeredStateCode" ~ '^[0-9]{2}$');
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_hsnCode_check"
  CHECK ("hsnCode" IS NULL OR "hsnCode" ~ '^[0-9]{4,8}$');
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_gstRateBps_check"
  CHECK ("gstRateBps" IS NULL OR ("gstRateBps" >= 0 AND "gstRateBps" <= 10000));
ALTER TABLE "ProductOrderItem" ADD CONSTRAINT "ProductOrderItem_hsnCodeSnapshot_check"
  CHECK ("hsnCodeSnapshot" IS NULL OR "hsnCodeSnapshot" ~ '^[0-9]{4,8}$');
ALTER TABLE "ProductOrderItem" ADD CONSTRAINT "ProductOrderItem_gstRateBpsSnapshot_check"
  CHECK ("gstRateBpsSnapshot" IS NULL OR ("gstRateBpsSnapshot" >= 0 AND "gstRateBpsSnapshot" <= 10000));
ALTER TABLE "ProductInvoice" ADD CONSTRAINT "ProductInvoice_tax_breakup_check"
  CHECK (
    "taxableAmountPaise" >= 0
    AND "taxPaise" >= 0
    AND "cgstPaise" >= 0
    AND "sgstPaise" >= 0
    AND "igstPaise" >= 0
    AND "taxPaise" = "cgstPaise" + "sgstPaise" + "igstPaise"
    AND "subtotalPaise" = "taxableAmountPaise" + "taxPaise"
    AND "totalPaise" = "subtotalPaise"
  );
