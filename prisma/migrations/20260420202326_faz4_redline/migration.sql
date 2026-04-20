-- AlterTable
ALTER TABLE "DocumentArtifact" ADD COLUMN     "originalDocxBuffer" BYTEA;

-- CreateTable
CREATE TABLE "EditProposal" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "clauseRef" TEXT NOT NULL,
    "editType" TEXT NOT NULL,
    "originalText" TEXT,
    "proposedText" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArbitratedEdit" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "clauseRef" TEXT NOT NULL,
    "editType" TEXT NOT NULL,
    "originalText" TEXT,
    "finalText" TEXT NOT NULL,
    "sourceProposals" TEXT[],
    "arbitrationNote" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "finalSeverity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArbitratedEdit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedlineArtifact" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "docxBuffer" BYTEA NOT NULL,
    "editCount" INTEGER NOT NULL,
    "orphanCount" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedlineArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EditProposal_runId_idx" ON "EditProposal"("runId");

-- CreateIndex
CREATE INDEX "EditProposal_runId_clauseRef_idx" ON "EditProposal"("runId", "clauseRef");

-- CreateIndex
CREATE INDEX "ArbitratedEdit_runId_idx" ON "ArbitratedEdit"("runId");

-- CreateIndex
CREATE INDEX "ArbitratedEdit_runId_resolution_idx" ON "ArbitratedEdit"("runId", "resolution");

-- CreateIndex
CREATE INDEX "RedlineArtifact_runId_idx" ON "RedlineArtifact"("runId");

-- CreateIndex
CREATE INDEX "RedlineArtifact_runId_isLatest_idx" ON "RedlineArtifact"("runId", "isLatest");

-- CreateIndex
CREATE UNIQUE INDEX "RedlineArtifact_runId_generation_key" ON "RedlineArtifact"("runId", "generation");

-- AddForeignKey
ALTER TABLE "EditProposal" ADD CONSTRAINT "EditProposal_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BoardRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArbitratedEdit" ADD CONSTRAINT "ArbitratedEdit_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BoardRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedlineArtifact" ADD CONSTRAINT "RedlineArtifact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BoardRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
