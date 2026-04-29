ALTER TABLE "AuditLog"
ADD COLUMN "module" TEXT,
ADD COLUMN "severity" TEXT NOT NULL DEFAULT 'info',
ADD COLUMN "metadata" JSONB,
ADD COLUMN "requestId" TEXT;

CREATE INDEX "AuditLog_module_idx" ON "AuditLog"("module");
CREATE INDEX "AuditLog_severity_idx" ON "AuditLog"("severity");
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");
