// Scan orchestrator: fan out to every registered source adapter,
// classify each candidate, drop Param-irrelevant ones (no topic
// match), upsert the survivors via Prisma. Returns a structured
// ScanResult that the API route serializes for both the response
// body and the audit log.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { classifyText } from "./classifier";
import { detectCompanies } from "./companies";
import { fetchGoogleNewsCandidates } from "./sources/google-news";
import { fetchResmiGazeteCandidates } from "./sources/resmi-gazete";
import { fetchYargiMcpCandidates } from "./sources/yargi-mcp";
import type {
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

export async function runRegulationsScan(): Promise<ScanResult> {
  const startedAt = new Date();
  const perSource: ScanSourceResult[] = [];
  let added = 0;
  let updated = 0;
  let skipped = 0;

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
        // Belt-and-suspenders: bir source adapter hata yanıtını
        // candidate olarak emit ederse classifier'a hiç sokmadan at.
        if (
          /error calling tool/i.test(haystack) ||
          /validation error/i.test(haystack) ||
          /unexpected keyword argument/i.test(haystack) ||
          /pydantic\.dev/i.test(haystack)
        ) {
          skipped++;
          continue;
        }
        const classification = classifyText(haystack);
        const detectedCompanies = detectCompanies(haystack);
        // Adapter şirket etiketi koymuş olabilir (Google News query
        // başlangıcı); metin eşleşmesini birleştir.
        const companies = Array.from(
          new Set([...(candidate.companies ?? []), ...detectedCompanies]),
        );
        // Bir item topic eşleşirse VEYA grup şirketi eşleşirse Param
        // bağlamında alakalı sayılır. Sadece company match'iyle gelen
        // item'lar için topic listesi boş kalır; UI bunu zaten "Haberler"
        // sekmesinde gösterir.
        if (classification.topics.length === 0 && companies.length === 0) {
          skipped++;
          continue;
        }
        classified++;
        const priority = classification.priority;

        const data = {
          source: candidate.source,
          externalId: candidate.externalId,
          title: candidate.title,
          summary: candidate.summary,
          bodyExcerpt: candidate.bodyExcerpt ?? null,
          url: candidate.url ?? null,
          publishedAt: candidate.publishedAt,
          topics: classification.topics,
          priority,
          status: candidate.status ?? null,
          sourceTool: candidate.sourceTool ?? null,
          rawPayload: trimRawPayload(candidate.rawPayload),
          companies,
        };

        const existing = await prisma.regulationItem.findUnique({
          where: {
            source_externalId: {
              source: candidate.source,
              externalId: candidate.externalId,
            },
          },
          select: { id: true },
        });

        if (existing) {
          await prisma.regulationItem.update({
            where: { id: existing.id },
            data: {
              fetchedAt: new Date(),
              topics: classification.topics,
              priority,
              status: candidate.status ?? null,
              sourceTool: candidate.sourceTool ?? null,
              companies,
            },
          });
          updated++;
        } else {
          await prisma.regulationItem.create({ data });
          added++;
        }
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
    pruned,
  };
}
