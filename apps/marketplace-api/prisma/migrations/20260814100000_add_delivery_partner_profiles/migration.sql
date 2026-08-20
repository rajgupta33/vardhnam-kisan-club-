CREATE TYPE "DeliveryPartnerAvailabilityStatus" AS ENUM ('OFFLINE', 'ONLINE');

CREATE TABLE "DeliveryPartnerProfile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "availabilityStatus" "DeliveryPartnerAvailabilityStatus" NOT NULL DEFAULT 'OFFLINE',
    "availabilityChangedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "DeliveryPartnerProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeliveryPartnerProfile_userId_organisationId_key"
ON "DeliveryPartnerProfile"("userId", "organisationId");

CREATE INDEX "DeliveryPartnerProfile_organisationId_availabilityStatus_idx"
ON "DeliveryPartnerProfile"("organisationId", "availabilityStatus");

ALTER TABLE "DeliveryPartnerProfile"
ADD CONSTRAINT "DeliveryPartnerProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeliveryPartnerProfile"
ADD CONSTRAINT "DeliveryPartnerProfile_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
