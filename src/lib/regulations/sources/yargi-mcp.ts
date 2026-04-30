// Yargı MCP source adapter for the regulations feed.
//
// Reuses the boardroom-side YargiMCPClient (module-level tools/list
// cache, Streamable HTTP transport) without holding a long-lived
// session — each scan opens a fresh client. For each topic we pick a
// shared search query from its first two keywords and call the most
// general available tool. Results are extracted into raw candidates;
// the orchestrator handles dedup + classification.
//
// Failure mode is intentionally lenient: if Yargı MCP is unreachable,
// the adapter returns an empty list and a non-fatal error string —
// the orchestrator records it per-source but keeps other adapters
// running.

import { createHash } from "crypto";
import { YargiMCPClient } from "@/lib/legal-research/yargi-mcp-client";
import { REGULATION_TOPICS } from "../topics";
import type { ScannedRegulationCandidate } from "../types";

const QUERIES_PER_TOPIC = 1;
const ITEMS_PER_QUERY = 3;

export interface YargiSourceResult {
  candidates: ScannedRegulationCandidate[];
  error: string | null;
}

interface MCPToolDescriptor {
  name: string;
  description?: string;
}

function pickPreferredTool(tools: MCPToolDescriptor[]): MCPToolDescriptor | null {
  // Prefer a tool whose name suggests text search across mevzuat.
  // Fall back to the first available; null only when the list is empty.
  if (tools.length === 0) return null;
  const PRIORITY_HINTS = [
    "mevzuat",
    "search",
    "bedesten",
    "yargi",
    "karar",
  ];
  for (const hint of PRIORITY_HINTS) {
    const match = tools.find((t) => t.name.toLowerCase().includes(hint));
    if (match) return match;
  }
  return tools[0];
}

function buildArgsFor(
  tool: MCPToolDescriptor,
  query: string,
): Record<string, unknown> | null {
  // Pluck the first reasonable text-input parameter the tool exposes.
  // Without poking at the schema we accept several common names.
  const candidates = ["phrase", "keyword", "keywords", "query", "icerik", "karar_tamami"];
  // We don't have the parameter schema here; YargiMCPClient.callTool
  // returns content regardless of unrecognized fields. Pass all common
  // names so at least one matches.
  const args: Record<string, unknown> = {};
  for (const key of candidates) args[key] = query;
  args.page = 1;
  args.pageSize = ITEMS_PER_QUERY;
  return args;
}

function externalIdFor(toolName: string, query: string, fragment: string): string {
  const h = createHash("sha256");
  h.update(`yargi-mcp::${toolName}::${query}::${fragment}`);
  return h.digest("hex").slice(0, 32);
}

function extractFragments(result: unknown): string[] {
  if (!result || typeof result !== "object") return [];
  const content = (result as { content?: Array<{ text?: string }> }).content;
  if (!Array.isArray(content)) return [];
  return content
    .map((c) => (typeof c.text === "string" ? c.text.trim() : ""))
    .filter((t) => t.length > 30);
}

function makeTitle(fragment: string, query: string): string {
  // Take first sentence-ish chunk; keep it readable for list rows.
  const trimmed = fragment.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 140) return trimmed;
  const cut = trimmed.slice(0, 140);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : 140)}… (${query})`;
}

export async function fetchYargiMcpCandidates(): Promise<YargiSourceResult> {
  const candidates: ScannedRegulationCandidate[] = [];
  let client: YargiMCPClient;
  try {
    client = new YargiMCPClient();
  } catch (err) {
    return {
      candidates,
      error: err instanceof Error ? err.message : "Yargı MCP istemcisi başlatılamadı.",
    };
  }

  let tools: MCPToolDescriptor[];
  try {
    tools = (await client.listTools()) as MCPToolDescriptor[];
  } catch (err) {
    return {
      candidates,
      error: err instanceof Error ? err.message : "Yargı MCP araç listesi alınamadı.",
    };
  }

  const tool = pickPreferredTool(tools);
  if (!tool) {
    return { candidates, error: "Yargı MCP üzerinde uygun arama aracı bulunamadı." };
  }

  const errors: string[] = [];

  for (const topic of REGULATION_TOPICS) {
    const queries = topic.keywords.slice(0, QUERIES_PER_TOPIC);
    for (const query of queries) {
      const args = buildArgsFor(tool, query);
      if (!args) continue;
      try {
        const result = await client.callTool(tool.name, args);
        const fragments = extractFragments(result);
        for (const fragment of fragments) {
          candidates.push({
            source: "yargi-mcp",
            externalId: externalIdFor(tool.name, query, fragment),
            title: makeTitle(fragment, query),
            summary: fragment.slice(0, 700),
            bodyExcerpt: fragment.slice(0, 2000),
            url: undefined,
            // Yargı MCP returns historical content; we can't trust the
            // tool to expose a publication date, so we mark fetch time.
            publishedAt: new Date(),
            rawPayload: { tool: tool.name, query, fragment: fragment.slice(0, 4000) },
          });
        }
      } catch (err) {
        errors.push(
          `${tool.name} / "${query}": ${
            err instanceof Error ? err.message : "bilinmeyen hata"
          }`,
        );
      }
    }
  }

  return {
    candidates,
    error: errors.length > 0 ? errors.join(" | ") : null,
  };
}
