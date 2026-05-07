// GET /api/regulations/[id]
//
// Returns the regulation item DTO plus, for Yargı MCP records, the
// parsed UYAP getDokuman payload so /app/regulations/[id] can render
// a structured decision view instead of dumping the raw XML/HTML
// served by emsal.uyap.gov.tr.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/lib/api-auth";
import { YargiMCPClient } from "@/lib/legal-research/yargi-mcp-client";
import {
  parseUyapDocument,
  type ParsedUyapDocument,
} from "@/lib/regulations/document-parser";
import type {
  RegulationItemDTO,
  RegulationPriority,
  RegulationSourceTool,
  RegulationStatus,
} from "@/lib/regulations/types";

const FETCH_TIMEOUT_MS = 15_000;

interface DetailResponse {
  item: RegulationItemDTO;
  document: ParsedUyapDocument | null;
  /** Some Yargı MCP tools expose a get_*_document_markdown companion;
   *  when used, we surface clean markdown instead of HTML scrape. */
  markdown: string | null;
  documentError: string | null;
}

function extractMarkdown(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as { isError?: boolean; content?: Array<{ text?: string }> };
  if (r.isError === true) return null;
  if (!Array.isArray(r.content)) return null;
  const parts: string[] = [];
  for (const c of r.content) {
    const text = typeof c.text === "string" ? c.text : "";
    if (!text) continue;
    // Yargı MCP get_*_document_markdown tool'ları çoğu zaman markdown'ı
    // bir JSON envelope içinde döndürür:
    //   { source_url, document_data: { markdown_chunk: "<gerçek md>" } }
    // Düz string formatı da olabilir. Önce JSON parse dene; markdown
    // alanını ayıkla, başaramazsan ham string'i kullan.
    let chunk: string | null = null;
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const md = pickMarkdownField(parsed);
      if (md) chunk = md;
    } catch {
      // not JSON
    }
    if (!chunk) chunk = text;
    parts.push(chunk);
  }
  if (parts.length === 0) return null;
  return parts.join("\n\n");
}

// Yargı MCP get_*_document_markdown tool'ları paginated markdown döner.
// İlk çağrıdan total_pages'i öğreniyoruz, sonra 2..N için ek istekler.
// 10 sayfa cap — uzun kararlarda truncate olur ama akış güvende kalır.
const MARKDOWN_PAGE_CAP = 10;

async function fetchPaginatedMarkdown(
  client: YargiMCPClient,
  toolName: string,
  baseArgs: Record<string, unknown>,
  pageParam: "page_number" | "page" = "page_number",
): Promise<string | null> {
  const collected: string[] = [];
  let totalPages = 1;
  for (let page = 1; page <= totalPages && page <= MARKDOWN_PAGE_CAP; page++) {
    const result = await client.callTool(toolName, {
      ...baseArgs,
      [pageParam]: page,
    });
    const r = result as {
      isError?: boolean;
      content?: Array<{ text?: string }>;
    };
    if (r.isError === true) break;
    const text = r.content?.[0]?.text;
    if (typeof text !== "string" || !text) break;
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      collected.push(text);
      break;
    }
    const md = pickMarkdownField(parsed);
    if (md) collected.push(md);
    const tp = parsed["total_pages"];
    if (typeof tp === "number" && tp > totalPages) totalPages = tp;
  }
  if (collected.length === 0) return null;
  return collected.join("\n\n");
}

// rawPayload üzerinden tool için gerekli id alanını ayıkla. Field
// isimleri her tool'a özel — en yaygın varyantları tarıyoruz.
function pickIdField(
  rawPayload: unknown,
  keys: string[],
): string | number | null {
  if (!rawPayload || typeof rawPayload !== "object") return null;
  const decision = (rawPayload as { decision?: unknown }).decision;
  const src =
    decision && typeof decision === "object"
      ? (decision as Record<string, unknown>)
      : (rawPayload as Record<string, unknown>);
  for (const k of keys) {
    const v = src[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return v;
  }
  return null;
}

interface MarkdownDispatchResult {
  markdown: string | null;
  error: string | null;
}

async function dispatchYargiMarkdown(item: {
  source: string;
  url: string | null;
  sourceTool: string | null;
  rawPayload: unknown;
}): Promise<MarkdownDispatchResult | null> {
  if (item.source !== "yargi-mcp" || !item.sourceTool) return null;

  let toolName: string | null = null;
  let baseArgs: Record<string, unknown> | null = null;
  let pageParam: "page_number" | "page" = "page_number";

  switch (item.sourceTool) {
    case "anayasa-norm":
    case "anayasa-bireysel":
      if (!item.url) return null;
      toolName = "get_anayasa_document_unified";
      baseArgs = { document_url: item.url };
      break;
    case "kvkk":
      if (!item.url) return null;
      toolName = "get_kvkk_document_markdown";
      baseArgs = { decision_url: item.url };
      break;
    case "bddk": {
      const id = pickIdField(item.rawPayload, ["document_id", "id"]);
      if (!id) return null;
      toolName = "get_bddk_document_markdown";
      baseArgs = { document_id: String(id) };
      break;
    }
    case "gib": {
      const id = pickIdField(item.rawPayload, ["ozelge_id", "id", "ozelgeNo"]);
      if (!id) return null;
      toolName = "get_gib_ozelge_document_markdown";
      baseArgs = { ozelge_id: typeof id === "number" ? id : Number(id) };
      if (typeof baseArgs.ozelge_id !== "number" || isNaN(baseArgs.ozelge_id as number)) {
        return null;
      }
      break;
    }
    case "rekabet": {
      const id = pickIdField(item.rawPayload, ["karar_id", "kararId", "id"]);
      if (!id) return null;
      toolName = "get_rekabet_kurumu_document";
      baseArgs = { karar_id: String(id) };
      break;
    }
    case "bedesten": {
      const id = pickIdField(item.rawPayload, ["documentId", "document_id", "id"]);
      if (!id) return null;
      toolName = "get_bedesten_document_markdown";
      baseArgs = { documentId: String(id) };
      // Bedesten get tool şeması page_number kabul etmiyor; pagination
      // dene yine de — desteklemezse parsed'da total_pages yok, tek
      // sayfada biter.
      break;
    }
    default:
      return null;
  }

  if (!toolName || !baseArgs) return null;

  try {
    const client = new YargiMCPClient();
    const md = await fetchPaginatedMarkdown(
      client,
      toolName,
      baseArgs,
      pageParam,
    );
    return {
      markdown: md,
      error: md ? null : `${toolName} boş yanıt döndürdü.`,
    };
  } catch (err) {
    return {
      markdown: null,
      error: err instanceof Error ? err.message : "MCP belge çağrısı başarısız.",
    };
  }
}

function pickMarkdownField(obj: Record<string, unknown>): string | null {
  const direct = ["markdown_chunk", "markdown", "content", "body"];
  for (const k of direct) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  const nested = obj.document_data;
  if (nested && typeof nested === "object") {
    return pickMarkdownField(nested as Record<string, unknown>);
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { id } = await ctx.params;
  const item = await prisma.regulationItem.findUnique({
    where: { id },
    include: {
      reads: {
        where: { userId: user.id },
        select: { readAt: true, pinned: true },
      },
    },
  });
  if (!item) {
    return NextResponse.json({ message: "Kayıt bulunamadı." }, { status: 404 });
  }

  const read = item.reads[0];
  const dto: RegulationItemDTO = {
    id: item.id,
    source: item.source,
    externalId: item.externalId,
    title: item.title,
    summary: item.summary,
    bodyExcerpt: item.bodyExcerpt,
    url: item.url,
    publishedAt: item.publishedAt.toISOString(),
    fetchedAt: item.fetchedAt.toISOString(),
    topics: item.topics,
    priority: item.priority as RegulationPriority,
    status: (item.status as RegulationStatus | null) ?? null,
    sourceTool:
      (item.sourceTool as RegulationSourceTool | null) ?? null,
    companies: item.companies ?? [],
    readAt: read?.readAt ? read.readAt.toISOString() : null,
    pinned: Boolean(read?.pinned),
  };

  let document: ParsedUyapDocument | null = null;
  let markdown: string | null = null;
  let documentError: string | null = null;

  // Yargı MCP get_*_document_markdown tool'ları temiz markdown döner;
  // HTML scrape (kvkk.gov.tr, bedesten, vs.) tüm site navigasyonunu
  // sızdırır — bu yüzden her sourceTool için tool-specific markdown
  // çağrısını tercih ediyoruz. Tool/id alanları MCP şemalarına göre
  // sabit; rawPayload'da id yoksa fallback HTML scrape kalır.
  const mcpDispatch = await dispatchYargiMarkdown(item);
  if (mcpDispatch) {
    if (mcpDispatch.markdown) markdown = mcpDispatch.markdown;
    if (mcpDispatch.error) documentError = mcpDispatch.error;
  } else if (item.source === "yargi-mcp" && item.url) {
    try {
      const res = await fetch(item.url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent": "consulera-regulations/0.1",
          Accept: "application/json,text/html,*/*",
        },
      });
      if (!res.ok) {
        documentError = `Kaynak HTTP ${res.status} döndü.`;
      } else {
        const text = await res.text();
        let html = "";
        try {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed.data === "string") {
            html = parsed.data;
          } else {
            html = text;
          }
        } catch {
          html = text;
        }
        document = parseUyapDocument(html);
        if (
          document.header.length === 0 &&
          document.fields.length === 0 &&
          document.paragraphs.length === 0
        ) {
          document = null;
          documentError = "Belge içeriği parse edilemedi.";
        }
      }
    } catch (err) {
      documentError =
        err instanceof Error ? err.message : "Belge alınırken hata oluştu.";
    }
  }

  const body: DetailResponse = {
    item: dto,
    document,
    markdown,
    documentError,
  };
  return NextResponse.json(body);
}
