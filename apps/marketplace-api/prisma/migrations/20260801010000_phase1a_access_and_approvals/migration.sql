ALTER TABLE "Organisation"
ADD COLUMN "reviewedAt" TIMESTAMPTZ(6),
ADD COLUMN "reviewedByUserId" UUID,
ADD COLUMN "reviewReason" TEXT;

CREATE INDEX "Organisation_reviewedByUserId_reviewedAt_idx" ON "Organisation"("reviewedByUserId", "reviewedAt");

ALTER TABLE "Organisation"
ADD CONSTRAINT "Organisation_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

