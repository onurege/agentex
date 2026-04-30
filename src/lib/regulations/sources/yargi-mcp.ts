// Yargı MCP source adapter for the regulations feed.
//
// Multi-tool fan-out: per topic biz birden fazla MCP arama tool'unu
// (Bedesten, Anayasa Mahkemesi, KVKK, BDDK, Rekabet, GİB) topic
// affinity'sine göre çağırıyoruz. Tool şemaları farklı olduğu için
// her tool'un argümanları sabit kalıbı bilen tool spec içinde
// üretiliyor. Sonuç JSON-as-string olarak gelir; chunk'ları parse edip
// generic decision normalizer ile candidate'e dönüştürüyoruz.
//
// Failure mode: tool başına bağımsız try/catch + isErrorResult(); bir
// tool reddederse sadece o çağrı skip edilir, diğer tool'lar etkilenmez.
// MCP error envelope'ları asla candidate olarak persist edilmez —
// classifier aksi halde hata mesajındaki keyword'leri yakalar.

import { createHash } from "crypto";
import { YargiMCPClient } from "@/lib/legal-research/yargi-mcp-client";
import { REGULATION_TOPICS } from "../topics";
import type {
  RegulationSourceTool,
  RegulationStatus,
  ScannedRegulationCandidate,
} from "../types";

const QUERIES_PER_TOPIC = 1;

export interface YargiSourceResult {
  candidates: ScannedRegulationCandidate[];
  error: string | null;
}

interface YargiToolSpec {
  /** Logical id used in error logs and externalId namespace. */
  id: string;
  /** MCP tool name on the server. */
  name: string;
  /** UI-friendly source label (Detayı kartında topic etiketi gibi). */
  label: string;
  argsFor(query: string): Record<string, unknown>;
}

const TOOL_SPECS: Record<string, YargiToolSpec> = {
  bedesten: {
    id: "bedesten",
    name: "search_bedesten_unified",
    label: "Bedesten",
    argsFor: (q) => ({ phrase: q, pageNumber: 1 }),
  },
  "anayasa-norm": {
    id: "anayasa-norm",
    name: "search_anayasa_unified",
    label: "Anayasa Mahkemesi (Norm)",
    argsFor: (q) => ({
      decision_type: "norm_denetimi",
      keywords: [q],
      page_to_fetch: 1,
    }),
  },
  "anayasa-bireysel": {
    id: "anayasa-bireysel",
    name: "search_anayasa_unified",
    label: "Anayasa Mahkemesi (Bireysel)",
    argsFor: (q) => ({
      decision_type: "bireysel_basvuru",
      keywords: [q],
      page_to_fetch: 1,
    }),
  },
  kvkk: {
    id: "kvkk",
    name: "search_kvkk_decisions",
    label: "KVKK",
    argsFor: (q) => ({ keywords: q, page: 1 }),
  },
  bddk: {
    id: "bddk",
    name: "search_bddk_decisions",
    label: "BDDK",
    argsFor: (q) => ({ keywords: q, page: 1 }),
  },
  rekabet: {
    id: "rekabet",
    name: "search_rekabet_kurumu_decisions",
    label: "Rekabet Kurumu",
    argsFor: (q) => ({ PdfText: q, page: 1 }),
  },
  gib: {
    id: "gib",
    name: "search_gib_ozelge",
    label: "GİB Özelge",
    argsFor: (q) => ({ keywords: q, page: 1, pageSize: 5 }),
  },
};

// Topic → çalıştırılacak tool id'leri. Her topic'te bedesten +
// anayasa-bireysel default çağrılır (genel mahkeme ve bireysel başvuru
// kapsayışı geniş); diğerleri konuya özgü.
const TOPIC_TOOLS: Record<string, string[]> = {
  "e-para-odeme": [
    "bedesten",
    "anayasa-norm",
    "anayasa-bireysel",
    "bddk",
    "rekabet",
  ],
  "masak-aml": ["bedesten", "anayasa-bireysel", "bddk"],
  kvkk: ["bedesten", "anayasa-bireysel", "kvkk"],
  vergi: ["bedesten", "anayasa-norm", "gib"],
  "bddk-bankacilik": ["bedesten", "anayasa-norm", "bddk"],
  "ticari-tuketici": ["bedesten", "anayasa-bireysel", "rekabet"],
  "kurumsal-istihdam": ["bedesten", "anayasa-bireysel"],
};

function normalizeStatus(durum: unknown): RegulationStatus | null {
  if (typeof durum !== "string") return null;
  const lower = durum.toLocaleLowerCase("tr-TR").replace(/i̇/g, "i").trim();
  if (lower.includes("kesinleşmedi") || lower.includes("kesinlesmedi")) {
    return "kesinlesmedi";
  }
  if (lower.includes("kesinleşti") || lower.includes("kesinlesti")) {
    return "kesinlesti";
  }
  return null;
}

function externalIdFor(toolId: string, query: string, key: string): string {
  const h = createHash("sha256");
  h.update(`yargi-mcp::${toolId}::${query}::${key}`);
  return h.digest("hex").slice(0, 32);
}

function isErrorResult(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const r = result as {
    isError?: unknown;
    content?: Array<{ text?: unknown }>;
  };
  if (r.isError === true) return true;
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

function extractTextChunks(result: unknown): string[] {
  if (!result || typeof result !== "object") return [];
  const content = (result as { content?: Array<{ text?: string }> }).content;
  if (!Array.isArray(content)) return [];
  return content
    .map((c) => (typeof c.text === "string" ? c.text.trim() : ""))
    .filter((t) => t.length > 0);
}

function pickListFromJson(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    for (const key of [
      "decisions",
      "results",
      "items",
      "data",
      "kararlar",
      "ozelgeler",
      "rows",
    ]) {
      const v = (parsed as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v;
    }
  }
  return null;
}

function pickStr(d: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = d[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

function parseAnyDate(s: string | null): Date | undefined {
  if (!s) return undefined;
  // dd.mm.yyyy
  const dotMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    const d = new Date(
      `${dotMatch[3]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[1].padStart(2, "0")}T00:00:00Z`,
    );
    if (!isNaN(d.getTime())) return d;
  }
  // ISO veya yyyy-mm-dd
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;
  return undefined;
}

function buildTitle(
  spec: YargiToolSpec,
  d: Record<string, unknown>,
  query: string,
): string {
  const explicit = pickStr(d, [
    "title",
    "baslik",
    "decision_reference_no",
    "kararSayisi",
    "esasKararNo",
    "ozelgeNo",
  ]);
  const daire = pickStr(d, ["daire", "birimAdi", "court_name", "mahkeme"]);
  const subject = pickStr(d, ["subject", "konu", "web_karar_konusu"]);
  const head = explicit ?? subject ?? daire ?? `${spec.label} kararı`;
  const tag = ` (${query})`;
  const out = `${head}${tag}`;
  return out.length > 220 ? `${out.slice(0, 217)}…` : out;
}

function buildSummary(spec: YargiToolSpec, d: Record<string, unknown>): string {
  const parts: string[] = [`Kaynak: ${spec.label}`];
  const ref = pickStr(d, [
    "decision_reference_no",
    "kararSayisi",
    "kararNo",
    "ozelgeNo",
    "ilam_no",
  ]);
  if (ref) parts.push(`Ref ${ref}`);
  const date = pickStr(d, [
    "kararTarihi",
    "decision_date",
    "karar_tarihi",
    "tarih",
    "KararTarihi",
    "ozelgeDate",
    "YayinlanmaTarihi",
  ]);
  if (date) parts.push(`Tarih ${date}`);
  const daire = pickStr(d, ["daire", "birimAdi", "mahkeme"]);
  if (daire) parts.push(daire);
  const durum = pickStr(d, ["durum", "kararDurum"]);
  if (durum) parts.push(durum);
  return parts.join(" • ");
}

function decisionToCandidate(
  spec: YargiToolSpec,
  d: Record<string, unknown>,
  query: string,
): ScannedRegulationCandidate | null {
  const idKey = pickStr(d, [
    "id",
    "document_id",
    "decision_id",
    "kararId",
    "gundemMaddesiId",
    "ozelge_id",
    "decision_reference_no",
    "kararSayisi",
    "ilam_no",
  ]);
  const url = pickStr(d, [
    "document_url",
    "decision_page_url",
    "url",
    "kararUrl",
    "link",
  ]);
  const title = buildTitle(spec, d, query);
  if (!title || title === `${spec.label} kararı (${query})`) {
    // Hiç anlamlı field çıkmadı — atla, klasifier hata mesajı yakalamasın.
    return null;
  }
  const summary = buildSummary(spec, d);
  const dateStr = pickStr(d, [
    "kararTarihi",
    "decision_date",
    "karar_tarihi",
    "tarih",
    "KararTarihi",
    "ozelgeDate",
    "YayinlanmaTarihi",
  ]);
  const externalKey = idKey ?? `${title}::${dateStr ?? ""}`;
  return {
    source: "yargi-mcp",
    externalId: externalIdFor(spec.id, query, externalKey),
    title,
    summary,
    bodyExcerpt: undefined,
    url: url ?? undefined,
    publishedAt: parseAnyDate(dateStr) ?? new Date(),
    status: normalizeStatus(
      d.durum ?? d.kararDurum ?? d.kesinlesmeDurumu ?? d.kesinlesme_durumu,
    ),
    sourceTool: spec.id as RegulationSourceTool,
    rawPayload: { tool: spec.name, toolId: spec.id, query, decision: d },
  };
}

function extractCandidatesFromResult(
  spec: YargiToolSpec,
  result: unknown,
  query: string,
): ScannedRegulationCandidate[] {
  const out: ScannedRegulationCandidate[] = [];
  const chunks = extractTextChunks(result);
  for (const chunk of chunks) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(chunk);
    } catch {
      continue;
    }
    const list = pickListFromJson(parsed);
    if (!list) continue;
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const c = decisionToCandidate(spec, item as Record<string, unknown>, query);
      if (c) out.push(c);
    }
  }
  return out;
}

export async function fetchYargiMcpCandidates(): Promise<YargiSourceResult> {
  const candidates: ScannedRegulationCandidate[] = [];
  let client: YargiMCPClient;
  try {
    client = new YargiMCPClient();
  } catch (err) {
    return {
      candidates,
      error:
        err instanceof Error ? err.message : "Yargı MCP istemcisi başlatılamadı.",
    };
  }

  const errors: string[] = [];

  for (const topic of REGULATION_TOPICS) {
    const toolIds = TOPIC_TOOLS[topic.id] ?? ["bedesten"];
    const queries = topic.keywords.slice(0, QUERIES_PER_TOPIC);

    // Topic içindeki tool çağrılarını paralel yap; topic'ler arası
    // sequential — MCP server'ı 7×N çağrıyla birden bombalamayalım.
    const calls = queries.flatMap((query) =>
      toolIds.map((toolId) => {
        const spec = TOOL_SPECS[toolId];
        if (!spec) return null;
        return { spec, query };
      }),
    );

    const settled = await Promise.allSettled(
      calls.map(async (c) => {
        if (!c) return [] as ScannedRegulationCandidate[];
        const { spec, query } = c;
        try {
          const result = await client.callTool(spec.name, spec.argsFor(query));
          if (isErrorResult(result)) {
            errors.push(`${spec.id} / "${query}": tool hata yanıtı (skip)`);
            return [] as ScannedRegulationCandidate[];
          }
          return extractCandidatesFromResult(spec, result, query);
        } catch (err) {
          errors.push(
            `${spec.id} / "${query}": ${
              err instanceof Error ? err.message : "bilinmeyen hata"
            }`,
          );
          return [] as ScannedRegulationCandidate[];
        }
      }),
    );

    for (const r of settled) {
      if (r.status === "fulfilled") candidates.push(...r.value);
    }
  }

  return {
    candidates,
    error: errors.length > 0 ? errors.join(" | ") : null,
  };
}
