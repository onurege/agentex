-- AlterTable
ALTER TABLE "AgentProfile" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "expertise" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isUserCreated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "tone" TEXT;

-- CreateIndex
CREATE INDEX "AgentProfile_isUserCreated_idx" ON "AgentProfile"("isUserCreated");
