-- CreateTable
CREATE TABLE "SignaturePrecheck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT,
    "sirkuFileName" TEXT NOT NULL,
    "petitionFileName" TEXT NOT NULL,
    "precheckResult" JSONB NOT NULL,
    "externalStatus" TEXT,
    "externalNote" TEXT,
    "userDecision" TEXT NOT NULL,
    "userDecisionNote" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "managerReviewRequested" BOOLEAN NOT NULL DEFAULT false,
    "managerReviewedBy" TEXT,
    "managerReviewedAt" TIMESTAMP(3),
    "managerDecision" TEXT,
    "managerDecisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignaturePrecheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignaturePrecheck_userId_idx" ON "SignaturePrecheck"("userId");

-- CreateIndex
CREATE INDEX "SignaturePrecheck_groupId_idx" ON "SignaturePrecheck"("groupId");

-- CreateIndex
CREATE INDEX "SignaturePrecheck_userDecision_idx" ON "SignaturePrecheck"("userDecision");

-- CreateIndex
CREATE INDEX "SignaturePrecheck_managerReviewRequested_managerDecision_idx" ON "SignaturePrecheck"("managerReviewRequested", "managerDecision");

-- AddForeignKey
ALTER TABLE "SignaturePrecheck" ADD CONSTRAINT "SignaturePrecheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignaturePrecheck" ADD CONSTRAINT "SignaturePrecheck_managerReviewedBy_fkey" FOREIGN KEY ("managerReviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
