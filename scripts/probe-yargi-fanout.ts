import { fetchYargiMcpCandidates } from "@/lib/regulations/sources/yargi-mcp";

(async () => {
  const r = await fetchYargiMcpCandidates();
  console.log("count:", r.candidates.length);
  const byTool = new Map<string, number>();
  for (const c of r.candidates) {
    const tid = (c.rawPayload as { toolId?: string } | undefined)?.toolId ?? "?";
    byTool.set(tid, (byTool.get(tid) ?? 0) + 1);
  }
  byTool.forEach((v, k) => console.log(`  ${k}: ${v}`));
  console.log("\nfirst 5:");
  for (const c of r.candidates.slice(0, 5)) {
    console.log(`- [${(c.rawPayload as { toolId?: string }).toolId}] ${c.title}`);
    console.log(`    url: ${c.url ?? "—"}`);
    console.log(`    publishedAt: ${c.publishedAt.toISOString().slice(0, 10)}`);
  }
  console.log("\nerror:", r.error?.slice(0, 1000));
})();
