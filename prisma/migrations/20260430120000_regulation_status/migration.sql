-- Yargı MCP karar durumu (KESİNLEŞTİ / KESİNLEŞMEDİ). Diğer
-- kaynaklarda NULL kalır; UI ve API filtresi opsiyonel.
ALTER TABLE "RegulationItem" ADD COLUMN "status" TEXT;
CREATE INDEX "RegulationItem_status_idx" ON "RegulationItem"("status");
