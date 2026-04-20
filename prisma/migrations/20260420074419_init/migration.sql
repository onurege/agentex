-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProfile" (
    "id" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "ownerId" TEXT,
    "cvDraft" JSONB,
    "promptDraft" JSONB,
    "cvLastSaved" TIMESTAMP(3),
    "promptLastSaved" TIMESTAMP(3),
    "currentVersionId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentVersion" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "cvSnapshot" JSONB,
    "systemPrompt" TEXT,
    "rolePrompt" TEXT,
    "outputRules" TEXT,
    "guardrails" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT,
    "agentKeys" TEXT[],
    "ownerId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentSize" INTEGER NOT NULL,
    "contextNotes" TEXT,
    "analysisMode" TEXT NOT NULL,
    "modelInfo" TEXT,
    "pipelineMetadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BoardRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunAgentSnapshot" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "agentVersionId" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "isChief" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RunAgentSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentArtifact" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fullText" TEXT,
    "sections" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentOpinion" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "timestamp" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentOpinion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebateMoment" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebateMoment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalVerdict" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "confidenceLevel" TEXT,
    "decisions" JSONB NOT NULL,
    "actionItems" JSONB NOT NULL,
    "agentPerspectives" JSONB NOT NULL,
    "disagreements" JSONB NOT NULL,
    "resolvedDisagreements" JSONB,
    "unresolvedDisagreements" JSONB,
    "positionChanges" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinalVerdict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "summary" TEXT NOT NULL,
    "actorId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "AgentProfile_agentKey_idx" ON "AgentProfile"("agentKey");

-- CreateIndex
CREATE INDEX "AgentProfile_ownerId_idx" ON "AgentProfile"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_agentKey_ownerId_key" ON "AgentProfile"("agentKey", "ownerId");

-- CreateIndex
CREATE INDEX "AgentVersion_profileId_idx" ON "AgentVersion"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentVersion_profileId_version_key" ON "AgentVersion"("profileId", "version");

-- CreateIndex
CREATE INDEX "BoardTemplate_ownerId_idx" ON "BoardTemplate"("ownerId");

-- CreateIndex
CREATE INDEX "BoardRun_userId_idx" ON "BoardRun"("userId");

-- CreateIndex
CREATE INDEX "BoardRun_userId_deletedAt_idx" ON "BoardRun"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "BoardRun_startedAt_idx" ON "BoardRun"("startedAt");

-- CreateIndex
CREATE INDEX "RunAgentSnapshot_runId_idx" ON "RunAgentSnapshot"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "RunAgentSnapshot_runId_agentKey_key" ON "RunAgentSnapshot"("runId", "agentKey");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentArtifact_runId_key" ON "DocumentArtifact"("runId");

-- CreateIndex
CREATE INDEX "AgentOpinion_runId_idx" ON "AgentOpinion"("runId");

-- CreateIndex
CREATE INDEX "AgentOpinion_runId_agentKey_idx" ON "AgentOpinion"("runId", "agentKey");

-- CreateIndex
CREATE INDEX "DebateMoment_runId_idx" ON "DebateMoment"("runId");

-- CreateIndex
CREATE INDEX "DebateMoment_runId_type_idx" ON "DebateMoment"("runId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "FinalVerdict_runId_key" ON "FinalVerdict"("runId");

-- CreateIndex
CREATE INDEX "FinalVerdict_runId_idx" ON "FinalVerdict"("runId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "AgentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentVersion" ADD CONSTRAINT "AgentVersion_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AgentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardTemplate" ADD CONSTRAINT "BoardTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardRun" ADD CONSTRAINT "BoardRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunAgentSnapshot" ADD CONSTRAINT "RunAgentSnapshot_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BoardRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunAgentSnapshot" ADD CONSTRAINT "RunAgentSnapshot_agentVersionId_fkey" FOREIGN KEY ("agentVersionId") REFERENCES "AgentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentArtifact" ADD CONSTRAINT "DocumentArtifact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BoardRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentOpinion" ADD CONSTRAINT "AgentOpinion_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BoardRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebateMoment" ADD CONSTRAINT "DebateMoment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BoardRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalVerdict" ADD CONSTRAINT "FinalVerdict_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BoardRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
