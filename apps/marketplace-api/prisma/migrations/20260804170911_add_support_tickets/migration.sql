-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'ASSIGNED', 'WAITING_FOR_CUSTOMER', 'WAITING_FOR_SELLER', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM ('ORDER_ISSUE', 'PAYMENT_ISSUE', 'DELIVERY_ISSUE', 'PRODUCT_QUALITY', 'ACCOUNT_ISSUE', 'ONBOARDING_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "raisedByUserId" UUID NOT NULL,
    "raisedByRole" "PlatformRole" NOT NULL,
    "raiserOrganisationId" UUID,
    "productOrderId" UUID,
    "category" "SupportTicketCategory" NOT NULL,
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToUserId" UUID,
    "assignedAt" TIMESTAMPTZ(6),
    "slaDueAt" TIMESTAMPTZ(6) NOT NULL,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMPTZ(6),
    "closedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketEvidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supportTicketId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedByUserId" UUID NOT NULL,
    "uploadedByRole" "PlatformRole" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportTicket_raisedByUserId_status_idx" ON "SupportTicket"("raisedByUserId", "status");

-- CreateIndex
CREATE INDEX "SupportTicket_assignedToUserId_status_idx" ON "SupportTicket"("assignedToUserId", "status");

-- CreateIndex
CREATE INDEX "SupportTicket_status_priority_idx" ON "SupportTicket"("status", "priority");

-- CreateIndex
CREATE INDEX "SupportTicket_productOrderId_idx" ON "SupportTicket"("productOrderId");

-- CreateIndex
CREATE INDEX "SupportTicketEvidence_supportTicketId_idx" ON "SupportTicketEvidence"("supportTicketId");

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_raiserOrganisationId_fkey" FOREIGN KEY ("raiserOrganisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketEvidence" ADD CONSTRAINT "SupportTicketEvidence_supportTicketId_fkey" FOREIGN KEY ("supportTicketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketEvidence" ADD CONSTRAINT "SupportTicketEvidence_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
