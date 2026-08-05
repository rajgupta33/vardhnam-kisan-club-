-- CreateEnum
CREATE TYPE "PayoutAccountStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- AlterEnum
ALTER TYPE "CommissionEntryType" ADD VALUE 'DELIVERY_FEE';

-- AlterEnum
ALTER TYPE "FinancialLedgerEntryType" ADD VALUE 'DELIVERY_FEE';

-- AlterTable
ALTER TABLE "CommissionEntry" ADD COLUMN     "recipientUserId" UUID;

-- AlterTable
ALTER TABLE "CommissionRule" ADD COLUMN     "deliveryFeePaise" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PayoutAccount" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "upiId" TEXT,
    "status" "PayoutAccountStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verifiedAt" TIMESTAMPTZ(6),
    "verifiedByUserId" UUID,
    "verifiedByRole" "PlatformRole",
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PayoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutAccount_userId_key" ON "PayoutAccount"("userId");

-- CreateIndex
CREATE INDEX "PayoutAccount_status_idx" ON "PayoutAccount"("status");

-- CreateIndex
CREATE INDEX "CommissionEntry_recipientUserId_status_idx" ON "CommissionEntry"("recipientUserId", "status");

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
