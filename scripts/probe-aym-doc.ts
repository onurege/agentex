import { YargiMCPClient } from "@/lib/legal-research/yargi-mcp-client";

(async () => {
  const c = new YargiMCPClient();
  const r = await c.callTool("get_anayasa_document_unified", {
    document_url:
      "https://normkararlarbilgibankasi.anayasa.gov.tr/ND/2025/182?KelimeAra%5B%5D=vuk",
  });
  const content = (r as { content?: Array<{ text?: string }> }).content ?? [];
  console.log("chunks:", content.length);
  for (const c of content) {
    const t = c.text ?? "";
    console.log("--- chunk len", t.length, "---");
    console.log(t.slice(0, 200));
    try {
      const p = JSON.parse(t);
      console.log("keys:", Object.keys(p));
      const dd = (p as Record<string, unknown>).document_data;
      if (dd && typeof dd === "object") {
        console.log("document_data keys:", Object.keys(dd as Record<string, unknown>));
        const mc = (dd as Record<string, unknown>).markdown_chunk;
        console.log("markdown_chunk type:", typeof mc, "len:", typeof mc === "string" ? mc.length : 0);
      }
    } catch (e) {
      console.log("not json");
    }
  }
})();
