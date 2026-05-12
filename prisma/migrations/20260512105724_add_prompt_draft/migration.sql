-- CreateTable
CREATE TABLE "PromptDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT,
    "title" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromptDraft_userId_idx" ON "PromptDraft"("userId");

-- CreateIndex
CREATE INDEX "PromptDraft_groupId_idx" ON "PromptDraft"("groupId");

-- CreateIndex
CREATE INDEX "PromptDraft_updatedAt_idx" ON "PromptDraft"("updatedAt");

-- AddForeignKey
ALTER TABLE "PromptDraft" ADD CONSTRAINT "PromptDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptDraft" ADD CONSTRAINT "PromptDraft_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
