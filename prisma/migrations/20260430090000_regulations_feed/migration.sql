CREATE TABLE "RegulationItem" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "bodyExcerpt" TEXT,
    "url" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "topics" TEXT[],
    "priority" TEXT NOT NULL,
    "rawPayload" JSONB,

    CONSTRAINT "RegulationItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegulationItem_source_externalId_key" ON "RegulationItem"("source", "externalId");
CREATE INDEX "RegulationItem_publishedAt_idx" ON "RegulationItem"("publishedAt");
CREATE INDEX "RegulationItem_priority_idx" ON "RegulationItem"("priority");
CREATE INDEX "RegulationItem_source_idx" ON "RegulationItem"("source");

CREATE TABLE "RegulationRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "regulationId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pinned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RegulationRead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegulationRead_userId_regulationId_key" ON "RegulationRead"("userId", "regulationId");
CREATE INDEX "RegulationRead_userId_idx" ON "RegulationRead"("userId");

ALTER TABLE "RegulationRead" ADD CONSTRAINT "RegulationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegulationRead" ADD CONSTRAINT "RegulationRead_regulationId_fkey" FOREIGN KEY ("regulationId") REFERENCES "RegulationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
