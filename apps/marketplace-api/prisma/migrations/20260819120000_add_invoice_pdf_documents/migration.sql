CREATE TYPE "ProductInvoiceDocumentStatus" AS ENUM ('QUEUED', 'PROCESSING', 'AVAILABLE', 'FAILED');

CREATE TABLE "ProductInvoiceDocument" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "productInvoiceId" UUID NOT NULL,
    "storedFileId" UUID,
    "status" "ProductInvoiceDocumentStatus" NOT NULL DEFAULT 'QUEUED',
    "requestedByUserId" UUID NOT NULL,
    "requestedByRole" "PlatformRole" NOT NULL,
    "requestId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "generatedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ProductInvoiceDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductInvoiceDocument_productInvoiceId_key" ON "ProductInvoiceDocument"("productInvoiceId");
CREATE UNIQUE INDEX "ProductInvoiceDocument_storedFileId_key" ON "ProductInvoiceDocument"("storedFileId");
CREATE INDEX "ProductInvoiceDocument_status_updatedAt_idx" ON "ProductInvoiceDocument"("status", "updatedAt");
CREATE INDEX "ProductInvoiceDocument_requestedByUserId_createdAt_idx" ON "ProductInvoiceDocument"("requestedByUserId", "createdAt");

ALTER TABLE "ProductInvoiceDocument" ADD CONSTRAINT "ProductInvoiceDocument_productInvoiceId_fkey"
FOREIGN KEY ("productInvoiceId") REFERENCES "ProductInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductInvoiceDocument" ADD CONSTRAINT "ProductInvoiceDocument_storedFileId_fkey"
FOREIGN KEY ("storedFileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
