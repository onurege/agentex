-- AlterTable
ALTER TABLE "BoardRun" ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "RunFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RunFolder_ownerId_idx" ON "RunFolder"("ownerId");

-- CreateIndex
CREATE INDEX "RunFolder_groupId_idx" ON "RunFolder"("groupId");

-- CreateIndex
CREATE INDEX "BoardRun_folderId_idx" ON "BoardRun"("folderId");

-- AddForeignKey
ALTER TABLE "BoardRun" ADD CONSTRAINT "BoardRun_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "RunFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
