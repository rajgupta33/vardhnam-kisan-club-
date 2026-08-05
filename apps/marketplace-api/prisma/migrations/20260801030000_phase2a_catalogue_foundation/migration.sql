CREATE TYPE "CatalogueStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'ARCHIVED'
);

CREATE TYPE "ProductDocumentType" AS ENUM (
  'LABEL',
  'REGISTRATION_CERTIFICATE',
  'SAFETY_DATA_SHEET',
  'PRODUCT_IMAGE',
  'TEST_REPORT',
  'OTHER'
);

CREATE TABLE "Brand" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyOrganisationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "website" TEXT,
  "status" "CatalogueStatus" NOT NULL DEFAULT 'DRAFT',
  "reviewedAt" TIMESTAMPTZ(6),
  "reviewedByUserId" UUID,
  "reviewReason" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MasterProduct" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyOrganisationId" UUID NOT NULL,
  "brandId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "cropTargets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "CatalogueStatus" NOT NULL DEFAULT 'DRAFT',
  "reviewedAt" TIMESTAMPTZ(6),
  "reviewedByUserId" UUID,
  "reviewReason" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MasterProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productId" UUID NOT NULL,
  "sku" TEXT,
  "variantName" TEXT NOT NULL,
  "packSize" DECIMAL(12,3) NOT NULL,
  "packUnit" TEXT NOT NULL,
  "mrpPaise" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductDocument" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productId" UUID NOT NULL,
  "documentType" "ProductDocumentType" NOT NULL,
  "title" TEXT NOT NULL,
  "documentNumber" TEXT,
  "fileName" TEXT,
  "storageKey" TEXT,
  "issuedAt" TIMESTAMPTZ(6),
  "expiresAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Brand_companyOrganisationId_slug_key" ON "Brand"("companyOrganisationId", "slug");
CREATE INDEX "Brand_companyOrganisationId_status_idx" ON "Brand"("companyOrganisationId", "status");
CREATE INDEX "Brand_status_createdAt_idx" ON "Brand"("status", "createdAt");

CREATE UNIQUE INDEX "MasterProduct_companyOrganisationId_slug_key" ON "MasterProduct"("companyOrganisationId", "slug");
CREATE INDEX "MasterProduct_brandId_status_idx" ON "MasterProduct"("brandId", "status");
CREATE INDEX "MasterProduct_companyOrganisationId_status_idx" ON "MasterProduct"("companyOrganisationId", "status");
CREATE INDEX "MasterProduct_status_createdAt_idx" ON "MasterProduct"("status", "createdAt");

CREATE UNIQUE INDEX "ProductVariant_productId_sku_key" ON "ProductVariant"("productId", "sku");
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");

CREATE INDEX "ProductDocument_productId_documentType_idx" ON "ProductDocument"("productId", "documentType");

ALTER TABLE "Brand"
ADD CONSTRAINT "Brand_companyOrganisationId_fkey"
FOREIGN KEY ("companyOrganisationId") REFERENCES "Organisation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Brand"
ADD CONSTRAINT "Brand_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MasterProduct"
ADD CONSTRAINT "MasterProduct_companyOrganisationId_fkey"
FOREIGN KEY ("companyOrganisationId") REFERENCES "Organisation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MasterProduct"
ADD CONSTRAINT "MasterProduct_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "Brand"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MasterProduct"
ADD CONSTRAINT "MasterProduct_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductVariant"
ADD CONSTRAINT "ProductVariant_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "MasterProduct"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductDocument"
ADD CONSTRAINT "ProductDocument_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "MasterProduct"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
