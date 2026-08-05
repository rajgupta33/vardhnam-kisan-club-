-- CreateEnum
CREATE TYPE "TallySyncRecordType" AS ENUM ('PARTY_MASTER', 'ITEM_MASTER', 'VOUCHER', 'INVOICE', 'CREDIT_NOTE', 'RECEIPT', 'SETTLEMENT', 'COMMISSION_INVOICE');

-- CreateEnum
CREATE TYPE "TallySyncStatus" AS ENUM ('PENDING', 'SYNCING', 'SYNCED', 'FAILED');

-- CreateTable
CREATE TABLE "TallySyncRecord" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recordType" "TallySyncRecordType" NOT NULL,
    "sourceEntityId" UUID,
    "referenceLabelSnapshot" TEXT NOT NULL,
    "referenceNumberSnapshot" TEXT,
    "amountPaise" INTEGER,
    "payloadSnapshot" JSONB NOT NULL,
    "status" "TallySyncStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMPTZ(6),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "tallyReferenceId" TEXT,
    "enqueuedByUserId" UUID,
    "enqueuedByRole" "PlatformRole",
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "TallySyncRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TallySyncAttempt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tallySyncRecordId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "outcome" "TallySyncStatus" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "performedByUserId" UUID,
    "performedByRole" "PlatformRole",
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TallySyncAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TallySyncRecord_recordType_status_idx" ON "TallySyncRecord"("recordType", "status");

-- CreateIndex
CREATE INDEX "TallySyncRecord_status_createdAt_idx" ON "TallySyncRecord"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TallySyncRecord_sourceEntityId_idx" ON "TallySyncRecord"("sourceEntityId");

-- CreateIndex
CREATE INDEX "TallySyncAttempt_tallySyncRecordId_idx" ON "TallySyncAttempt"("tallySyncRecordId");

-- AddForeignKey
ALTER TABLE "TallySyncRecord" ADD CONSTRAINT "TallySyncRecord_enqueuedByUserId_fkey" FOREIGN KEY ("enqueuedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TallySyncAttempt" ADD CONSTRAINT "TallySyncAttempt_tallySyncRecordId_fkey" FOREIGN KEY ("tallySyncRecordId") REFERENCES "TallySyncRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TallySyncAttempt" ADD CONSTRAINT "TallySyncAttempt_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
