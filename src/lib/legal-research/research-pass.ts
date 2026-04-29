// ============================================================
// Legal Research Pass — Yargı MCP
// ============================================================
//
// Runs only when the Yargı Araştırma Uzmanı is seated. It asks the
// public Yargı MCP server for legal-source search results and turns
// those results into compact context for the boardroom pipeline.
// ============================================================

import type { BoardroomAnalysisInput } from "@/lib/boardroom-engine/types";
import type { LegalResearchResult, LegalResearchSource } from "./types";
import { YargiMCPClient } from "./yargi-mcp-client";

interface ToolLike {
  name: string;
  inputSchema?: {
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

const RESEARCH_AGENT_ID = "case-law-researcher";

const PREFERRED_TOOLS = [
  "search_bedesten_unified",
  "search_emsal_detailed_decisions",
  "search_kvkk_decisions",
  "search_rekabet_kurumu_decisions",
  "search_bddk_decisions",
];

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildQueries(input: BoardroomAnalysisInput): string[] {
  const seeds = [
    input.contextNotes,
    ...input.document.sections.slice(0, 5).map((s) => `${s.title} ${s.content.slice(0, 180)}`),
    input.document.fullText?.slice(0, 800) ?? "",
  ]
    .map(cleanText)
    .filter(Boolean);

  const joined = seeds.join(" ");
  const legalHints = [
    "sorumluluk",
    "cezai şart",
    "fesih",
    "gizlilik",
    "tazminat",
    "rekabet yasağı",
    "kişisel veri",
    "vergi",
    "KDV",
    "hizmet sözleşmesi",
    "distribütörlük",
    "Türk Borçlar Kanunu",
    "Türk Ticaret Kanunu",
    "KVKK",
  ];

  const matches = legalHints.filter((hint) =>
    joined.toLocaleLowerCase("tr-TR").includes(hint.toLocaleLowerCase("tr-TR")),
  );

  const sectionTitles = input.document.sections
    .map((s) => s.title)
    .filter((title) => title && title.length > 3)
    .slice(0, 3);

  const queries = [
    ...matches.map((hint) => `${hint} emsal karar madde`),
    ...sectionTitles.map((title) => `${title} emsal karar madde`),
  ];

  return Array.from(new Set(queries.map(cleanText).filter(Boolean))).slice(0, 3);
}

function propertyNames(tool: ToolLike): Set<string> {
  return new Set(Object.keys(tool.inputSchema?.properties ?? {}));
}

function canFillRequired(tool: ToolLike, args: Record<string, unknown>): boolean {
  const required = tool.inputSchema?.required ?? [];
  return required.every((key) => args[key] !== undefined && args[key] !== "");
}

function buildArgs(tool: ToolLike, query: string): Record<string, unknown> | null {
  const props = propertyNames(tool);
  const args: Record<string, unknown> = {};

  for (const key of ["phrase", "keyword", "keywords", "query", "icerik", "karar_tamami"]) {
    if (props.has(key)) args[key] = query;
  }

  if (props.has("page")) args.page = 1;
  if (props.has("pageNumber")) args.pageNumber = 1;
  if (props.has("page_number")) args.page_number = 1;
  if (props.has("pageSize")) args.pageSize = 3;
  if (props.has("page_size")) args.page_size = 3;
  if (props.has("max_results")) args.max_results = 3;
  if (props.has("limit")) args.limit = 3;

  return canFillRequired(tool, args) ? args : null;
}

function resultToText(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const content = (result as { content?: Array<{ text?: string }> }).content;
  if (Array.isArray(content)) {
    return content.map((item) => item.text ?? "").join("\n\n");
  }
  return JSON.stringify(result);
}

function toSource(toolName: string, query: string, raw: string): LegalResearchSource {
  const text = cleanText(raw).slice(0, 3500);
  const title =
    text.match(/(?:title|başlık|karar|esas|document|name)["':\s-]+([^"|\\n]{8,120})/i)?.[1]?.trim() ??
    `${toolName} sonucu`;

  return {
    toolName,
    query,
    title: cleanText(title).slice(0, 140),
    excerpt: text.slice(0, 700),
    rawText: text,
  };
}

export function shouldRunLegalResearch(input: BoardroomAnalysisInput): boolean {
  return input.agents.some((agent) => agent.id === RESEARCH_AGENT_ID);
}

export async function runLegalResearchPass(
  input: BoardroomAnalysisInput,
): Promise<LegalResearchResult> {
  const client = new YargiMCPClient();
  const queries = buildQueries(input);
  const warnings: string[] = [];
  const sources: LegalResearchSource[] = [];

  if (queries.length === 0) {
    return {
      enabled: true,
      provider: "yargi-mcp",
      endpoint: client.endpoint,
      queries: [],
      sources: [],
      warnings: ["Belgeden anlamlı bir hukuki araştırma sorgusu üretilemedi."],
    };
  }

  const tools = await client.listTools();
  const selectedTools = PREFERRED_TOOLS
    .map((name) => tools.find((tool) => tool.name === name))
    .filter((tool): tool is ToolLike => Boolean(tool))
    .slice(0, 2);

  if (selectedTools.length === 0) {
    return {
      enabled: true,
      provider: "yargi-mcp",
      endpoint: client.endpoint,
      queries,
      sources: [],
      warnings: ["Yargı MCP üzerinde desteklenen arama araçları bulunamadı."],
    };
  }

  for (const query of queries) {
    for (const tool of selectedTools) {
      const args = buildArgs(tool, query);
      if (!args) {
        warnings.push(`${tool.name} için zorunlu parametreler eşleştirilemedi.`);
        continue;
      }

      try {
        const result = await client.callTool(tool.name, args);
        const text = resultToText(result);
        if (text) sources.push(toSource(tool.name, query, text));
      } catch (error) {
        warnings.push(
          `${tool.name} / "${query}" çağrısı başarısız: ${
            error instanceof Error ? error.message : "Bilinmeyen hata"
          }`,
        );
      }
    }
  }

  return {
    enabled: true,
    provider: "yargi-mcp",
    endpoint: client.endpoint,
    queries,
    sources: sources.slice(0, 6),
    warnings,
  };
}

export function formatLegalResearchForPrompt(result: LegalResearchResult | null): string {
  if (!result) return "";
  const sourceLines = result.sources.length
    ? result.sources
        .map(
          (source, index) =>
            `${index + 1}. [${source.toolName}] Sorgu: "${source.query}"\nBaşlık: ${source.title}\nÖzet: ${source.excerpt}`,
        )
        .join("\n\n")
    : "Canlı Yargı MCP bağlantısı çalıştı ancak kullanılabilir kaynak sonucu üretilemedi.";

  const warningLines = result.warnings.length
    ? `\n\nUyarılar:\n${result.warnings.map((warning) => `- ${warning}`).join("\n")}`
    : "";

  return `## CANLI YARGI MCP KAYNAK LİSTESİ

Kaynak: ${result.endpoint}
Sorgular: ${result.queries.join(", ") || "Yok"}

${sourceLines}${warningLines}

Kurallar:
- Sadece bulunan emsal karar, kurul kararı, özelge ve madde referanslarını listele.
- Hukuki yorum, risk değerlendirmesi, öneri, taraf lehine/alyhine kanaat veya sonuç çıkarımı yapma.
- Kaynak sonucu açık değilse karar numarası, tarih, esas/karar no veya madde varmış gibi yazma.
- Canlı araştırmanın sınırlı/başarısız kaldığı yerleri sadece "bulunamadı" veya "araştırma başarısız" diye belirt.`;
}
