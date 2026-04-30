import { YargiMCPClient } from "@/lib/legal-research/yargi-mcp-client";

(async () => {
  const c = new YargiMCPClient();
  for (const dt of ["all", "norm_denetimi", "bireysel_basvuru"]) {
    try {
      const r = await c.callTool("search_anayasa_unified", {
        decision_type: dt,
        keywords: ["kvkk"],
        page_to_fetch: 1,
      });
      const isErr = (r as { isError?: boolean }).isError;
      const head = JSON.stringify(r).slice(0, 280);
      console.log(`[${dt}] ${isErr ? "ERR" : "OK"}`, head);
    } catch (e) {
      console.log(`[${dt}] THROW`, e instanceof Error ? e.message.slice(0, 200) : e);
    }
  }
})();
