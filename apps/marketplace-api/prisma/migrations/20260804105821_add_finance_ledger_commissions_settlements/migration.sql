-- CreateEnum
CREATE TYPE "CommissionRuleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CommissionEntryType" AS ENUM ('MARKETPLACE_COMMISSION', 'DISTRIBUTOR_PAYABLE');

-- CreateEnum
CREATE TYPE "CommissionEntryStatus" AS ENUM ('PROVISIONAL', 'FINAL', 'REVERSED');

-- CreateEnum
CREATE TYPE "FinancialLedgerEntryType" AS ENUM ('FARMER_PAYMENT', 'MARKETPLACE_COMMISSION', 'DISTRIBUTOR_PAYABLE', 'REFUND', 'SETTLEMENT');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('ELIGIBLE');

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sellerOrganisationId" UUID,
    "marketplaceCommissionBps" INTEGER NOT NULL,
    "status" "CommissionRuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(6),
    "createdByUserId" UUID,
    "createdByRole" "PlatformRole",
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionEntry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "productOrderId" UUID NOT NULL,
    "sellerOrganisationId" UUID NOT NULL,
    "commissionRuleId" UUID NOT NULL,
    "entryType" "CommissionEntryType" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "status" "CommissionEntryStatus" NOT NULL DEFAULT 'PROVISIONAL',
    "eligibleAt" TIMESTAMPTZ(6) NOT NULL,
    "finalizedAt" TIMESTAMPTZ(6),
    "reversedAt" TIMESTAMPTZ(6),
    "reversalReason" TEXT,
    "settlementId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialLedgerEntry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entryType" "FinancialLedgerEntryType" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "organisationId" UUID,
    "productOrderId" UUID,
    "paymentIntentId" UUID,
    "commissionEntryId" UUID,
    "settlementId" UUID,
    "requestId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sellerOrganisationId" UUID NOT NULL,
    "settlementNumber" TEXT NOT NULL,
    "totalPayablePaise" INTEGER NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'ELIGIBLE',
    "createdByUserId" UUID,
    "createdByRole" "PlatformRole",
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionRule_sellerOrganisationId_status_effectiveFrom_idx" ON "CommissionRule"("sellerOrganisationId", "status", "effectiveFrom");

-- CreateIndex
CREATE INDEX "CommissionRule_status_effectiveFrom_idx" ON "CommissionRule"("status", "effectiveFrom");

-- CreateIndex
CREATE INDEX "CommissionEntry_productOrderId_entryType_idx" ON "CommissionEntry"("productOrderId", "entryType");

-- CreateIndex
CREATE INDEX "CommissionEntry_sellerOrganisationId_entryType_status_idx" ON "CommissionEntry"("sellerOrganisationId", "entryType", "status");

-- CreateIndex
CREATE INDEX "CommissionEntry_status_eligibleAt_idx" ON "CommissionEntry"("status", "eligibleAt");

-- CreateIndex
CREATE INDEX "CommissionEntry_settlementId_idx" ON "CommissionEntry"("settlementId");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_entryType_createdAt_idx" ON "FinancialLedgerEntry"("entryType", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_organisationId_createdAt_idx" ON "FinancialLedgerEntry"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_productOrderId_idx" ON "FinancialLedgerEntry"("productOrderId");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_paymentIntentId_idx" ON "FinancialLedgerEntry"("paymentIntentId");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_commissionEntryId_idx" ON "FinancialLedgerEntry"("commissionEntryId");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_settlementId_idx" ON "FinancialLedgerEntry"("settlementId");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_settlementNumber_key" ON "Settlement"("settlementNumber");

-- CreateIndex
CREATE INDEX "Settlement_sellerOrganisationId_status_idx" ON "Settlement"("sellerOrganisationId", "status");

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_sellerOrganisationId_fkey" FOREIGN KEY ("sellerOrganisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_sellerOrganisationId_fkey" FOREIGN KEY ("sellerOrganisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_commissionRuleId_fkey" FOREIGN KEY ("commissionRuleId") REFERENCES "CommissionRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_commissionEntryId_fkey" FOREIGN KEY ("commissionEntryId") REFERENCES "CommissionEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_sellerOrganisationId_fkey" FOREIGN KEY ("sellerOrganisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
