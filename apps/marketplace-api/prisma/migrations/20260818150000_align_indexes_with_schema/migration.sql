-- Reconciles indexes created by earlier migrations with what `schema.prisma`
-- actually declares. The schema was edited during WP-08 without a matching
-- migration, so `prisma migrate diff` reported this drift against every
-- subsequent change. Nothing here is a WP-07 decision -- it is separated from
-- the payment webhook migration so that one reads as only its own work.

-- DropIndex
DROP INDEX "KycDocument_storedFileId_idx";

-- DropIndex
DROP INDEX "MasterProduct_primaryImageStoredFileId_idx";

-- DropIndex
DROP INDEX "ProductOrderItem_clubBenefitRuleId_idx";

-- DropIndex
DROP INDEX "SupportTicketEvidence_storedFileId_idx";

-- CreateIndex
CREATE INDEX "ReturnPickupAssignment_productOrderId_idx" ON "ReturnPickupAssignment"("productOrderId");

-- RenameIndex
ALTER INDEX "KisanClubPromoterProfile_territoryId_clubEnabled_acceptingNewFa" RENAME TO "KisanClubPromoterProfile_territoryId_clubEnabled_acceptingN_idx";

-- RenameIndex
ALTER INDEX "ProductDeliveryAssignment_pickupVerifiedByUserId_pickupVerified" RENAME TO "ProductDeliveryAssignment_pickupVerifiedByUserId_pickupVeri_idx";

-- RenameIndex
ALTER INDEX "ReturnInspectionDisposition_returnRequestId_returnRequestItemId" RENAME TO "ReturnInspectionDisposition_returnRequestId_returnRequestIt_key";
