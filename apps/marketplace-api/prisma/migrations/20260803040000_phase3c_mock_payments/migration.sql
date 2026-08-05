ALTER TYPE "ProductCheckoutStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_PROCESSING';
ALTER TYPE "ProductCheckoutStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED';
ALTER TYPE "ProductCheckoutStatus" ADD VALUE IF NOT EXISTS 'PAID';

CREATE TYPE "PaymentProviderMode" AS ENUM ('MOCK');

CREATE TYPE "PaymentIntentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

CREATE TYPE "PaymentEventType" AS ENUM (
  'INTENT_CREATED',
  'CONFIRMATION_STARTED',
  'PAYMENT_SUCCEEDED',
  'PAYMENT_FAILED'
);

CREATE TABLE "PaymentIntent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "checkoutId" UUID NOT NULL,
  "farmerProfileId" UUID NOT NULL,
  "providerMode" "PaymentProviderMode" NOT NULL DEFAULT 'MOCK',
  "providerReference" TEXT NOT NULL,
  "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PENDING',
  "amountPaise" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "paymentIntentId" UUID NOT NULL,
  "eventType" "PaymentEventType" NOT NULL,
  "status" "PaymentIntentStatus" NOT NULL,
  "providerReference" TEXT NOT NULL,
  "payload" JSONB,
  "actorUserId" UUID,
  "actorRole" "PlatformRole",
  "requestId" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentIntent_providerReference_key" ON "PaymentIntent"("providerReference");
CREATE INDEX "PaymentIntent_checkoutId_status_idx" ON "PaymentIntent"("checkoutId", "status");
CREATE INDEX "PaymentIntent_farmerProfileId_createdAt_idx" ON "PaymentIntent"("farmerProfileId", "createdAt");
CREATE INDEX "PaymentIntent_providerMode_status_idx" ON "PaymentIntent"("providerMode", "status");
CREATE INDEX "PaymentEvent_paymentIntentId_createdAt_idx" ON "PaymentEvent"("paymentIntentId", "createdAt");
CREATE INDEX "PaymentEvent_eventType_createdAt_idx" ON "PaymentEvent"("eventType", "createdAt");
CREATE INDEX "PaymentEvent_actorUserId_createdAt_idx" ON "PaymentEvent"("actorUserId", "createdAt");
CREATE INDEX "PaymentEvent_providerReference_idx" ON "PaymentEvent"("providerReference");

ALTER TABLE "PaymentIntent"
  ADD CONSTRAINT "PaymentIntent_checkoutId_fkey"
  FOREIGN KEY ("checkoutId") REFERENCES "ProductCheckout"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentIntent"
  ADD CONSTRAINT "PaymentIntent_farmerProfileId_fkey"
  FOREIGN KEY ("farmerProfileId") REFERENCES "FarmerProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentEvent"
  ADD CONSTRAINT "PaymentEvent_paymentIntentId_fkey"
  FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentEvent"
  ADD CONSTRAINT "PaymentEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
