CREATE TABLE "NotificationPreference" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPreference_userId_category_channel_key" ON "NotificationPreference"("userId", "category", "channel");
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
