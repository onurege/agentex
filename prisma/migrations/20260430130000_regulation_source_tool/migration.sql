-- Yargı MCP fan-out tool kategorisi (bedesten, anayasa-norm,
-- anayasa-bireysel, kvkk, bddk, gib, rekabet) ya da resmi-gazete gibi
-- üst kaynaklar. UI'da kaynak filtresi için.
ALTER TABLE "RegulationItem" ADD COLUMN "sourceTool" TEXT;
CREATE INDEX "RegulationItem_sourceTool_idx" ON "RegulationItem"("sourceTool");
