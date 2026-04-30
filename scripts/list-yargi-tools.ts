import { YargiMCPClient } from "@/lib/legal-research/yargi-mcp-client";

(async () => {
  const c = new YargiMCPClient();
  const tools = (await c.listTools()) as Array<{
    name: string;
    description?: string;
    inputSchema?: { properties?: Record<string, unknown>; required?: string[] };
  }>;
  for (const t of tools) {
    const props = Object.keys(t.inputSchema?.properties ?? {});
    const req = t.inputSchema?.required ?? [];
    console.log(`- ${t.name}`);
    console.log(`    desc: ${(t.description ?? "").slice(0, 140)}`);
    console.log(`    props: ${props.join(", ")}`);
    console.log(`    required: ${req.join(", ")}`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
