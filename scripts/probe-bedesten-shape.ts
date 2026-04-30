import { YargiMCPClient } from "@/lib/legal-research/yargi-mcp-client";

(async () => {
  const c = new YargiMCPClient();
  const r = await c.callTool("search_bedesten_unified", {
    phrase: "ttk",
    pageNumber: 1,
  });
  const t = (r as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? "";
  try {
    const p = JSON.parse(t);
    const list = p?.decisions ?? p?.results ?? p?.items ?? [];
    console.log("count:", list.length);
    if (list.length > 0) {
      console.log("first item keys:", Object.keys(list[0]));
      console.log(JSON.stringify(list[0], null, 2));
    }
  } catch (e) {
    console.log("not json", t.slice(0, 200));
  }
})();
