// Scan orchestrator: fan out to every registered source adapter,
// classify each candidate, drop Param-irrelevant ones (no topic
// match), upsert the survivors via Prisma. Returns a structured
// ScanResult that the API route serializes for both the response
// body and the audit log.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { classifyText } from "./classifier";
import { detectCompanies } from "./companies";
import { gateAll } from "./ai-gate";
import { fetchGoogleNewsCandidates } from "./sources/google-news";
import { fetchResmiGazeteCandidates } from "./sources/resmi-gazete";
import { fetchYargiMcpCandidates } from "./sources/yargi-mcp";
import type {
  RegulationPriority,
  RegulationSourceId,
  ScanResult,
  ScanSourceResult,
  ScannedRegulationCandidate,
} from "./types";

interface SourceRunner {
  id: RegulationSourceId;
  run: () => Promise<{
    candidates: ScannedRegulationCandidate[];
    error: string | null;
  }>;
}

const SOURCES: SourceRunner[] = [
  { id: "yargi-mcp", run: fetchYargiMcpCandidates },
  {
    id: "resmi-gazete",
    run: () => fetchResmiGazeteCandidates({ days: 7 }),
  },
  { id: "google-news", run: fetchGoogleNewsCandidates },
];

const RAW_PAYLOAD_BYTES_CAP = 50_000;

// Bir kayıt RETENTION_DAYS gün boyunca hiçbir scan tarafından
// "yenilenmediyse" (fetchedAt güncellenmediyse) ve hiç kimse
// pin'lemediyse silinir. Bu sayede:
//   1) DB sınırsız büyümez,
//   2) Canlı kaynaklar bir kaydı artık döndürmediğinde feed'den
//      otomatik düşer.
// Pin'li kayıtlar her zaman korunur — kullanıcı bilinçli olarak
// işaretlemiş demektir.
const RETENTION_DAYS = 30;

async function pruneStaleItems(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.regulationItem.deleteMany({
    where: {
      fetchedAt: { lt: cutoff },
      reads: { none: { pinned: true } },
    },
  });
  return result.count;
}

function trimRawPayload(raw: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (raw === undefined || raw === null) return Prisma.JsonNull;
  try {
    const json = JSON.stringify(raw);
    if (json.length <= RAW_PAYLOAD_BYTES_CAP) return raw as Prisma.InputJsonValue;
    return { _truncated: true, head: json.slice(0, RAW_PAYLOAD_BYTES_CAP) };
  } catch {
    return Prisma.JsonNull;
  }
}

interface PreparedCandidate {
  candidate: ScannedRegulationCandidate;
  topics: string[];
  priority: RegulationPriority;
  companies: string[];
  sourceId: RegulationSourceId;
}

const ADAPTER_ERROR_PATTERNS = [
  /error calling tool/i,
  /validation error/i,
  /unexpected keyword argument/i,
  /pydantic\.dev/i,
];

function looksLikeAdapterError(haystack: string): boolean {
  return ADAPTER_ERROR_PATTERNS.some((re) => re.test(haystack));
}

export async function runRegulationsScan(): Promise<ScanResult> {
  const startedAt = new Date();
  const perSource: ScanSourceResult[] = [];
  let added = 0;
  let updated = 0;
  let skipped = 0;
  let aiRejected = 0;
  let aiFailed = 0;

  // 1) Tüm kaynaklardan adayları topla, classifier ön süzgecinden
  //    geçmiş olanları AI gate'e göndermek için biriktir.
  const survivors: PreparedCandidate[] = [];

  for (const source of SOURCES) {
    const sourceStarted = Date.now();
    let fetched = 0;
    let classified = 0;
    let error: string | null = null;
    try {
      const result = await source.run();
      fetched = result.candidates.length;
      error = result.error;

      for (const candidate of result.candidates) {
        const haystack = [
          candidate.title,
          candidate.summary,
          candidate.bodyExcerpt ?? "",
        ].join("\n");
        if (looksLikeAdapterError(haystack)) {
          skipped++;
          continue;
        }
        const classification = classifyText(haystack);
        const detectedCompanies = detectCompanies(haystack);
        const companies = Array.from(
          new Set([...(candidate.companies ?? []), ...detectedCompanies]),
        );
        // Topic veya company eşleşmesi yoksa AI'ya bile gitmeyelim —
        // sıfır iş etkisi bariz.
        if (classification.topics.length === 0 && companies.length === 0) {
          skipped++;
          continue;
        }
        classified++;
        survivors.push({
          candidate,
          topics: classification.topics,
          priority: classification.priority,
          companies,
          sourceId: source.id,
        });
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Bilinmeyen hata";
    }

    perSource.push({
      source: source.id,
      fetched,
      classified,
      durationMs: Date.now() - sourceStarted,
      error,
    });
  }

  // 2) AI relevance gate — concurrency-limited paralel.
  const decisions = await gateAll(survivors.map((s) => s.candidate));

  // 3) Karara göre upsert / drop.
  for (let i = 0; i < survivors.length; i++) {
    const prepared = survivors[i];
    const decision = decisions[i];
    if (!decision.passed) {
      aiRejected++;
      continue;
    }
    if (decision.reason === "ai_failed") aiFailed++;

    // AI verdict'i upsert verisinin parçası olarak ekle (null olabilir).
    const verdictJson: Prisma.InputJsonValue | typeof Prisma.JsonNull = decision
      .verdict
      ? (decision.verdict as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull;

    // AI doğruladığı şirket listesi varsa adapter+classifier birleşimi
    // yerine onu kullan — false-positive'leri AI elemiş olur.
    const finalCompanies =
      decision.verdict?.paramRelation.impactedCompanies?.length
        ? Array.from(
            new Set([
              ...prepared.companies.filter((id) =>
                decision.verdict!.paramRelation.impactedCompanies.includes(id),
              ),
              ...decision.verdict.paramRelation.impactedCompanies,
            ]),
          )
        : prepared.companies;

    const data = {
      source: prepared.candidate.source,
      externalId: prepared.candidate.externalId,
      title: prepared.candidate.title,
      summary: prepared.candidate.summary,
      bodyExcerpt: prepared.candidate.bodyExcerpt ?? null,
      url: prepared.candidate.url ?? null,
      publishedAt: prepared.candidate.publishedAt,
      topics: prepared.topics,
      priority: prepared.priority,
      status: prepared.candidate.status ?? null,
      sourceTool: prepared.candidate.sourceTool ?? null,
      rawPayload: trimRawPayload(prepared.candidate.rawPayload),
      companies: finalCompanies,
      aiVerdict: verdictJson,
    };

    const existing = await prisma.regulationItem.findUnique({
      where: {
        source_externalId: {
          source: prepared.candidate.source,
          externalId: prepared.candidate.externalId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.regulationItem.update({
        where: { id: existing.id },
        data: {
          fetchedAt: new Date(),
          topics: prepared.topics,
          priority: prepared.priority,
          status: prepared.candidate.status ?? null,
          sourceTool: prepared.candidate.sourceTool ?? null,
          companies: finalCompanies,
          aiVerdict: verdictJson,
        },
      });
      updated++;
    } else {
      await prisma.regulationItem.create({ data });
      added++;
    }
  }

  // Sadece en az bir kaynak başarıyla candidate döndürdüyse prune et.
  // Tam outage durumunda (tüm kaynaklar hata) DB'yi yanlışlıkla
  // boşaltmamak için bilerek atılıyor.
  let pruned = 0;
  const anySuccess = perSource.some((s) => s.fetched > 0);
  if (anySuccess) {
    try {
      pruned = await pruneStaleItems();
    } catch {
      // Prune başarısız olursa scan akışını kesme; sadece sıfır say.
      pruned = 0;
    }
  }

  const completedAt = new Date();
  return {
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    perSource,
    added,
    updated,
    skipped,
    aiRejected,
    aiFailed,
    pruned,
  };
}
