import { YargiMCPClient } from "@/lib/legal-research/yargi-mcp-client";
(async () => {
  const c = new YargiMCPClient();
  const r = await c.callTool("search_bedesten_unified", { phrase: "6493", pageNumber: 1 });
  const text = (r as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? "";
  const parsed = JSON.parse(text);
  const list = parsed?.decisions ?? parsed?.results ?? parsed?.items ?? [];
  console.log(JSON.stringify(list[0], null, 2));
})();
