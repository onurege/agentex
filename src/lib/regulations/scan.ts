// Scan orchestrator: fan out to every registered source adapter,
// classify each candidate, drop Param-irrelevant ones (no topic
// match), upsert the survivors via Prisma. Returns a structured
// ScanResult that the API route serializes for both the response
// body and the audit log.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { classifyText } from "./classifier";
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
];

const RAW_PAYLOAD_BYTES_CAP = 50_000;

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
        const { topics, priority } = classifyText(haystack);
        if (topics.length === 0) {
          skipped++;
          continue;
        }
        classified++;

        const data = {
          source: candidate.source,
          externalId: candidate.externalId,
          title: candidate.title,
          summary: candidate.summary,
          bodyExcerpt: candidate.bodyExcerpt ?? null,
          url: candidate.url ?? null,
          publishedAt: candidate.publishedAt,
          topics,
          priority,
          rawPayload: trimRawPayload(candidate.rawPayload),
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
              topics,
              priority,
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

  const completedAt = new Date();
  return {
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    perSource,
    added,
    updated,
    skipped,
  };
}
