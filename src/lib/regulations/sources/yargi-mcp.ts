// Yargı MCP source adapter for the regulations feed.
//
// Reuses the boardroom-side YargiMCPClient (module-level tools/list
// cache, Streamable HTTP transport) without holding a long-lived
// session — each scan opens a fresh client. For each topic we pick a
// shared search query from its first keyword and call the most
// general available tool. Results are extracted into raw candidates;
// the orchestrator handles dedup + classification.
//
// Failure mode is intentionally lenient: if Yargı MCP is unreachable
// or a specific tool rejects our payload, the adapter skips that
// query and records the error string. We never persist MCP error
// envelopes as candidates — the classifier would otherwise pick up
// keyword tokens inside a stack trace and misroute them as relevant
// mevzuat.

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
  inputSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

// Param names commonly used by Yargı MCP search tools for the free-text
// query. We only set a value on the tool's *declared* properties so the
// server-side pydantic model never rejects us with "unexpected keyword".
const TEXT_PARAM_CANDIDATES = [
  "phrase",
  "keyword",
  "keywords",
  "query",
  "icerik",
  "karar_tamami",
  "search",
  "term",
];

const PAGINATION_HINTS = [
  ["page", 1],
  ["pageNumber", 1],
  ["page_number", 1],
  ["pageSize", ITEMS_PER_QUERY],
  ["page_size", ITEMS_PER_QUERY],
  ["limit", ITEMS_PER_QUERY],
  ["max_results", ITEMS_PER_QUERY],
] as const;

function pickPreferredTool(tools: MCPToolDescriptor[]): MCPToolDescriptor | null {
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
  const props = tool.inputSchema?.properties;
  if (!props || Object.keys(props).length === 0) {
    // Schema yok — sadece "phrase" dene; yine reddedilirse adapter
    // sessizce skip eder.
    return { phrase: query };
  }
  const propNames = new Set(Object.keys(props));
  const args: Record<string, unknown> = {};

  // Tek bir text param'a ata; ilk eşleşeni alır.
  const textParam = TEXT_PARAM_CANDIDATES.find((p) => propNames.has(p));
  if (!textParam) return null;
  args[textParam] = query;

  // Pagination ipuçlarını sadece tool destekliyorsa ekle.
  for (const [key, value] of PAGINATION_HINTS) {
    if (propNames.has(key)) args[key] = value;
  }

  // Diğer required field'ları doldurabileceğimiz makul default yoksa
  // bu tool'la bu sorguyu atmıyoruz.
  const required = tool.inputSchema?.required ?? [];
  for (const r of required) {
    if (r in args) continue;
    return null;
  }

  return args;
}

function externalIdFor(toolName: string, query: string, fragment: string): string {
  const h = createHash("sha256");
  h.update(`yargi-mcp::${toolName}::${query}::${fragment}`);
  return h.digest("hex").slice(0, 32);
}

function isErrorResult(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const r = result as {
    isError?: unknown;
    content?: Array<{ text?: unknown }>;
  };
  if (r.isError === true) return true;
  // Heuristic: tool içerik akışında "Error calling tool" / "validation
  // error" / "Unexpected keyword argument" gibi pydantic / wrapper
  // hata mesajları geçiyorsa bunu içerik olarak değil hata olarak gör.
  if (Array.isArray(r.content)) {
    for (const item of r.content) {
      if (typeof item.text !== "string") continue;
      if (
        /error calling tool/i.test(item.text) ||
        /validation error/i.test(item.text) ||
        /unexpected keyword argument/i.test(item.text) ||
        /pydantic\.dev/i.test(item.text)
      ) {
        return true;
      }
    }
  }
  return false;
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
      if (!args) {
        errors.push(`${tool.name} / "${query}": tool şeması ile uyumlu argüman üretilemedi`);
        continue;
      }
      try {
        const result = await client.callTool(tool.name, args);
        if (isErrorResult(result)) {
          errors.push(
            `${tool.name} / "${query}": tool hata yanıtı döndürdü (skip)`,
          );
          continue;
        }
        const fragments = extractFragments(result);
        for (const fragment of fragments) {
          candidates.push({
            source: "yargi-mcp",
            externalId: externalIdFor(tool.name, query, fragment),
            title: makeTitle(fragment, query),
            summary: fragment.slice(0, 700),
            bodyExcerpt: fragment.slice(0, 2000),
            url: undefined,
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
