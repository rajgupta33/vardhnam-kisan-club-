CREATE TYPE "StoredFilePurpose" AS ENUM ('KYC_DOCUMENT', 'PRODUCT_IMAGE', 'PRODUCT_DOCUMENT', 'DELIVERY_PROOF', 'RETURN_EVIDENCE', 'SUPPORT_EVIDENCE', 'VISIT_EVIDENCE', 'INVOICE_PDF', 'SERVICE_EVIDENCE');
CREATE TYPE "StoredFileStatus" AS ENUM ('PENDING_UPLOAD', 'PENDING_SCAN', 'AVAILABLE', 'INFECTED', 'REJECTED', 'DELETED');
CREATE TYPE "StoredFileScanResult" AS ENUM ('CLEAN', 'INFECTED', 'SCAN_FAILED');

CREATE TABLE "StoredFile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerUserId" UUID NOT NULL,
    "organisationId" UUID,
    "purpose" "StoredFilePurpose" NOT NULL,
    "status" "StoredFileStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "objectKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "declaredSizeBytes" INTEGER NOT NULL,
    "sizeBytes" INTEGER,
    "checksumSha256" TEXT,
    "scanResult" "StoredFileScanResult",
    "scanCompletedAt" TIMESTAMPTZ(6),
    "rejectionReason" TEXT,
    "uploadedAt" TIMESTAMPTZ(6),
    "uploadUrlExpiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StoredFile_declaredSizeBytes_positive_check" CHECK ("declaredSizeBytes" > 0),
    CONSTRAINT "StoredFile_sizeBytes_positive_check" CHECK ("sizeBytes" IS NULL OR "sizeBytes" > 0),
    -- A file is only downloadable once a scan has actually cleared it. Encoding
    -- that here means no application bug can produce an AVAILABLE row that was
    -- never scanned.
    CONSTRAINT "StoredFile_available_requires_clean_scan_check" CHECK (
      "status" <> 'AVAILABLE'
      OR ("scanResult" = 'CLEAN' AND "scanCompletedAt" IS NOT NULL AND "uploadedAt" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "StoredFile_objectKey_key" ON "StoredFile"("objectKey");
CREATE INDEX "StoredFile_ownerUserId_purpose_idx" ON "StoredFile"("ownerUserId", "purpose");
CREATE INDEX "StoredFile_organisationId_purpose_idx" ON "StoredFile"("organisationId", "purpose");
CREATE INDEX "StoredFile_status_createdAt_idx" ON "StoredFile"("status", "createdAt");

ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing metadata-only rows keep their legacy `storageKey`; new uploads link
-- to a StoredFile instead. Both columns coexist until the legacy rows are
-- migrated, which needs the pilot data decision in WP-16.
ALTER TABLE "KycDocument" ADD COLUMN "storedFileId" UUID;
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_storedFileId_fkey" FOREIGN KEY ("storedFileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "KycDocument_storedFileId_idx" ON "KycDocument"("storedFileId");

ALTER TABLE "SupportTicketEvidence" ADD COLUMN "storedFileId" UUID;
ALTER TABLE "SupportTicketEvidence" ADD CONSTRAINT "SupportTicketEvidence_storedFileId_fkey" FOREIGN KEY ("storedFileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "SupportTicketEvidence_storedFileId_idx" ON "SupportTicketEvidence"("storedFileId");
