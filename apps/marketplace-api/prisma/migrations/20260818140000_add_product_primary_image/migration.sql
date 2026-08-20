-- The pack shot a farmer sees. Nullable because a product can be approved and
-- sellable before its photography exists; clients fall back to a labelled
-- placeholder rather than a broken image.
ALTER TABLE "MasterProduct" ADD COLUMN "primaryImageStoredFileId" UUID;

-- SET NULL rather than RESTRICT: removing an image should not be blocked by, or
-- cascade into, the product record itself.
ALTER TABLE "MasterProduct" ADD CONSTRAINT "MasterProduct_primaryImageStoredFileId_fkey"
  FOREIGN KEY ("primaryImageStoredFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MasterProduct_primaryImageStoredFileId_idx" ON "MasterProduct"("primaryImageStoredFileId");
