CREATE TYPE "KycDocumentType" AS ENUM (
  'GST_CERTIFICATE',
  'PAN',
  'BUSINESS_REGISTRATION',
  'DISTRIBUTOR_AUTHORISATION',
  'BANK_PROOF',
  'ADDRESS_PROOF',
  'LICENCE',
  'OTHER'
);

CREATE TYPE "KycDocumentStatus" AS ENUM (
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'EXPIRED'
);

CREATE TABLE "CompanyProfile" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organisationId" UUID NOT NULL,
  "brandName" TEXT,
  "registrationNumber" TEXT,
  "pan" TEXT,
  "primaryContactName" TEXT NOT NULL,
  "primaryContactPhone" TEXT NOT NULL,
  "primaryContactEmail" TEXT,
  "website" TEXT,
  "registeredAddress" TEXT,
  "city" TEXT,
  "state" TEXT,
  "pincode" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DistributorProfile" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organisationId" UUID NOT NULL,
  "distributorCode" TEXT,
  "pan" TEXT,
  "primaryContactName" TEXT NOT NULL,
  "primaryContactPhone" TEXT NOT NULL,
  "primaryContactEmail" TEXT,
  "operatingAddress" TEXT,
  "city" TEXT,
  "state" TEXT,
  "pincode" TEXT,
  "serviceablePincodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "fulfilmentCapability" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DistributorProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KycDocument" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organisationId" UUID NOT NULL,
  "documentType" "KycDocumentType" NOT NULL,
  "status" "KycDocumentStatus" NOT NULL DEFAULT 'SUBMITTED',
  "documentNumber" TEXT,
  "fileName" TEXT,
  "storageKey" TEXT,
  "issuedAt" TIMESTAMPTZ(6),
  "expiresAt" TIMESTAMPTZ(6),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KycDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyProfile_organisationId_key" ON "CompanyProfile"("organisationId");
CREATE INDEX "CompanyProfile_brandName_idx" ON "CompanyProfile"("brandName");
CREATE INDEX "CompanyProfile_state_city_idx" ON "CompanyProfile"("state", "city");

CREATE UNIQUE INDEX "DistributorProfile_organisationId_key" ON "DistributorProfile"("organisationId");
CREATE UNIQUE INDEX "DistributorProfile_distributorCode_key" ON "DistributorProfile"("distributorCode");
CREATE INDEX "DistributorProfile_state_city_idx" ON "DistributorProfile"("state", "city");

CREATE INDEX "KycDocument_organisationId_status_idx" ON "KycDocument"("organisationId", "status");
CREATE INDEX "KycDocument_documentType_status_idx" ON "KycDocument"("documentType", "status");

ALTER TABLE "CompanyProfile"
ADD CONSTRAINT "CompanyProfile_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DistributorProfile"
ADD CONSTRAINT "DistributorProfile_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KycDocument"
ADD CONSTRAINT "KycDocument_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
