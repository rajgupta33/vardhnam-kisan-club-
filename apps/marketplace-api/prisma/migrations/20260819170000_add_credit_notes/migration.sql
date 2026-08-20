CREATE TYPE "CreditNoteDocumentStatus" AS ENUM ('QUEUED', 'PROCESSING', 'AVAILABLE', 'FAILED');

ALTER TYPE "StoredFilePurpose" ADD VALUE 'CREDIT_NOTE_PDF';

CREATE TABLE "CreditNoteSequence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sellerOrganisationId" UUID NOT NULL,
    "financialYear" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "CreditNoteSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditNote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "refundId" UUID NOT NULL,
    "productInvoiceId" UUID NOT NULL,
    "productOrderId" UUID NOT NULL,
    "returnRequestId" UUID,
    "sellerOrganisationId" UUID NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "grossCreditPaise" INTEGER NOT NULL,
    "farmerRefundPaise" INTEGER NOT NULL,
    "subsidyReversalPaise" INTEGER NOT NULL DEFAULT 0,
    "taxableAmountPaise" INTEGER NOT NULL,
    "taxPaise" INTEGER NOT NULL,
    "cgstPaise" INTEGER NOT NULL,
    "sgstPaise" INTEGER NOT NULL,
    "igstPaise" INTEGER NOT NULL,
    "originalInvoiceNumber" TEXT NOT NULL,
    "originalInvoiceDate" TIMESTAMPTZ(6) NOT NULL,
    "reasonSnapshot" TEXT NOT NULL,
    "sellerLegalNameSnapshot" TEXT NOT NULL,
    "sellerGstinSnapshot" TEXT NOT NULL,
    "sellerStateCodeSnapshot" TEXT NOT NULL,
    "sellerAddressSnapshot" TEXT NOT NULL,
    "farmerNameSnapshot" TEXT NOT NULL,
    "deliveryAddressSnapshot" JSONB NOT NULL,
    "placeOfSupplyStateCode" TEXT NOT NULL,
    "lineItemsSnapshot" JSONB NOT NULL,
    "issuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CreditNote_amounts_check" CHECK (
      "grossCreditPaise" > 0 AND "farmerRefundPaise" > 0 AND
      "subsidyReversalPaise" >= 0 AND
      "farmerRefundPaise" + "subsidyReversalPaise" = "grossCreditPaise" AND
      "taxableAmountPaise" + "taxPaise" = "grossCreditPaise" AND
      "cgstPaise" + "sgstPaise" + "igstPaise" = "taxPaise"
    )
);

CREATE TABLE "CreditNoteDocument" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creditNoteId" UUID NOT NULL,
    "storedFileId" UUID,
    "status" "CreditNoteDocumentStatus" NOT NULL DEFAULT 'QUEUED',
    "requestId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "generatedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "CreditNoteDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditNoteSequence_sellerOrganisationId_financialYear_key" ON "CreditNoteSequence"("sellerOrganisationId", "financialYear");
CREATE INDEX "CreditNoteSequence_financialYear_idx" ON "CreditNoteSequence"("financialYear");
CREATE UNIQUE INDEX "CreditNote_refundId_key" ON "CreditNote"("refundId");
CREATE UNIQUE INDEX "CreditNote_sellerOrganisationId_financialYear_sequenceNumber_key" ON "CreditNote"("sellerOrganisationId", "financialYear", "sequenceNumber");
CREATE UNIQUE INDEX "CreditNote_sellerOrganisationId_creditNoteNumber_key" ON "CreditNote"("sellerOrganisationId", "creditNoteNumber");
CREATE INDEX "CreditNote_productOrderId_issuedAt_idx" ON "CreditNote"("productOrderId", "issuedAt");
CREATE INDEX "CreditNote_returnRequestId_idx" ON "CreditNote"("returnRequestId");
CREATE UNIQUE INDEX "CreditNoteDocument_creditNoteId_key" ON "CreditNoteDocument"("creditNoteId");
CREATE UNIQUE INDEX "CreditNoteDocument_storedFileId_key" ON "CreditNoteDocument"("storedFileId");
CREATE INDEX "CreditNoteDocument_status_updatedAt_idx" ON "CreditNoteDocument"("status", "updatedAt");

ALTER TABLE "CreditNoteSequence" ADD CONSTRAINT "CreditNoteSequence_sellerOrganisationId_fkey" FOREIGN KEY ("sellerOrganisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_productInvoiceId_fkey" FOREIGN KEY ("productInvoiceId") REFERENCES "ProductInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_sellerOrganisationId_fkey" FOREIGN KEY ("sellerOrganisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNoteDocument" ADD CONSTRAINT "CreditNoteDocument_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNoteDocument" ADD CONSTRAINT "CreditNoteDocument_storedFileId_fkey" FOREIGN KEY ("storedFileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
