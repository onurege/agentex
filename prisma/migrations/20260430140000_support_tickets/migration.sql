-- Destek talepleri: kullanıcı /app/support sayfasından gönderir,
-- super_admin /app/panel/support inbox'ında görür.
CREATE TABLE "SupportTicket" (
  "id"          TEXT PRIMARY KEY,
  "userId"      TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "content"     TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'open',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt"  TIMESTAMP(3),
  "resolvedBy"  TEXT,
  CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket"("userId");
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");
CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");
