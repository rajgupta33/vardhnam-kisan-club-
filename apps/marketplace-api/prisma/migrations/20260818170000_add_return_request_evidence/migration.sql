CREATE TABLE "ReturnRequestEvidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "returnRequestId" UUID NOT NULL,
    "storedFileId" UUID NOT NULL,
    "uploadedByUserId" UUID NOT NULL,
    "uploadedByRole" "PlatformRole" NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReturnRequestEvidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReturnRequestEvidence_caption_length_check" CHECK (
      "caption" IS NULL OR char_length("caption") BETWEEN 1 AND 300
    )
);

CREATE UNIQUE INDEX "ReturnRequestEvidence_storedFileId_key"
  ON "ReturnRequestEvidence"("storedFileId");
CREATE INDEX "ReturnRequestEvidence_returnRequestId_createdAt_idx"
  ON "ReturnRequestEvidence"("returnRequestId", "createdAt");
CREATE INDEX "ReturnRequestEvidence_uploadedByUserId_createdAt_idx"
  ON "ReturnRequestEvidence"("uploadedByUserId", "createdAt");

ALTER TABLE "ReturnRequestEvidence" ADD CONSTRAINT "ReturnRequestEvidence_returnRequestId_fkey"
  FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnRequestEvidence" ADD CONSTRAINT "ReturnRequestEvidence_storedFileId_fkey"
  FOREIGN KEY ("storedFileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnRequestEvidence" ADD CONSTRAINT "ReturnRequestEvidence_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
