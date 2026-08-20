CREATE TYPE "PromoterVisitPurpose" AS ENUM ('LEAD_FOLLOW_UP', 'FARMER_SUPPORT', 'ORDER_ASSISTANCE', 'FARM_SURVEY', 'COMPLAINT_FOLLOW_UP', 'OTHER');
CREATE TYPE "PromoterVisitLocationStatus" AS ENUM ('NOT_REQUESTED', 'GRANTED', 'DENIED', 'UNAVAILABLE');

CREATE TABLE "PromoterVisit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "promoterUserId" UUID NOT NULL,
    "promoterOrganisationId" UUID NOT NULL,
    "farmerLeadId" UUID,
    "farmerProfileId" UUID,
    "purpose" "PromoterVisitPurpose" NOT NULL,
    "notes" TEXT,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "locationStatus" "PromoterVisitLocationStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "accuracyMetres" DECIMAL(8,2),
    "locationCapturedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "PromoterVisit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PromoterVisit_exactly_one_target_check" CHECK (num_nonnulls("farmerLeadId", "farmerProfileId") = 1),
    CONSTRAINT "PromoterVisit_location_payload_check" CHECK (
      ("locationStatus" = 'GRANTED' AND num_nonnulls("latitude", "longitude", "accuracyMetres", "locationCapturedAt") = 4)
      OR ("locationStatus" <> 'GRANTED' AND num_nonnulls("latitude", "longitude", "accuracyMetres", "locationCapturedAt") = 0)
    )
);

CREATE INDEX "PromoterVisit_promoterUserId_occurredAt_idx" ON "PromoterVisit"("promoterUserId", "occurredAt");
CREATE INDEX "PromoterVisit_promoterOrganisationId_occurredAt_idx" ON "PromoterVisit"("promoterOrganisationId", "occurredAt");
CREATE INDEX "PromoterVisit_farmerLeadId_occurredAt_idx" ON "PromoterVisit"("farmerLeadId", "occurredAt");
CREATE INDEX "PromoterVisit_farmerProfileId_occurredAt_idx" ON "PromoterVisit"("farmerProfileId", "occurredAt");

ALTER TABLE "PromoterVisit" ADD CONSTRAINT "PromoterVisit_promoterUserId_fkey" FOREIGN KEY ("promoterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterVisit" ADD CONSTRAINT "PromoterVisit_promoterOrganisationId_fkey" FOREIGN KEY ("promoterOrganisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterVisit" ADD CONSTRAINT "PromoterVisit_farmerLeadId_fkey" FOREIGN KEY ("farmerLeadId") REFERENCES "FarmerLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterVisit" ADD CONSTRAINT "PromoterVisit_farmerProfileId_fkey" FOREIGN KEY ("farmerProfileId") REFERENCES "FarmerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
