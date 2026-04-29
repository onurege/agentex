ALTER TABLE "User"
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
