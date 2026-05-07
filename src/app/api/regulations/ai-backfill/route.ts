// POST /api/regulations/ai-backfill
//
// Geriye dönük AI gate uygular: aiVerdict alanı NULL olan
// (veya ?rerunAll=1 ile tüm) RegulationItem'ları sırayla
// gateOne()'dan geçirir. Reddedilenleri DB'den siler, kabul
// edilenlere verdict yazar. Süper admin gerektirir; uzun sürer
// (her item ~2-3 saniye), dolayısıyla istemcide buton spinner'ı
// veya CLI'dan curl ile tetiklenmeli.
//
// Query:
//   ?dryRun=1   → sadece raporla, DB'ye yazma
//   ?rerunAll=1 → mevcut verdict'leri de yeniden hesapla
//   ?limit=N    → en fazla N kayıt değerlendir (test için)

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  forbidden,
  getAuthUser,
  unauthorized,
} from "@/lib/api-auth";
import { createRequestId, logAuditEvent } from "@/lib/server-audit";
import { gateOne } from "@/lib/regulations/ai-gate";
import type { ScannedRegulationCandidate } from "@/lib/regulations/types";

export const runtime = "nodejs";
// Backfill 100+ kayıt için saniyeler/dakikalar sürebilir.
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  const requestId = createRequestId("regulations-backfill");
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const url = req.nextUrl;
  const dryRun = url.searchParams.get("dryRun") === "1";
  const rerunAll = url.searchParams.get("rerunAll") === "1";
  const limitParam = Number(url.searchParams.get("limit") ?? "0");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

  const where: import("@prisma/client").Prisma.RegulationItemWhereInput =
    rerunAll ? {} : { aiVerdict: { equals: Prisma.AnyNull } };
  const rows = await prisma.regulationItem.findMany({
    where,
    select: {
      id: true,
      source: true,
      externalId: true,
      title: true,
      summary: true,
      bodyExcerpt: true,
      url: true,
      publishedAt: true,
      status: true,
      sourceTool: true,
      companies: true,
    },
    orderBy: { publishedAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });

  let kept = 0;
  let dropped = 0;
  let aiFailed = 0;
  const droppedSamples: { title: string; reason: string }[] = [];

  for (const row of rows) {
    const candidate: ScannedRegulationCandidate = {
      source: row.source as ScannedRegulationCandidate["source"],
      externalId: row.externalId,
      title: row.title,
      summary: row.summary,
      bodyExcerpt: row.bodyExcerpt ?? undefined,
      url: row.url ?? undefined,
      publishedAt: row.publishedAt,
      status:
        (row.status as ScannedRegulationCandidate["status"]) ?? null,
      sourceTool:
        (row.sourceTool as ScannedRegulationCandidate["sourceTool"]) ?? null,
      companies: row.companies,
    };
    const decision = await gateOne(candidate);

    if (!decision.passed) {
      dropped++;
      if (droppedSamples.length < 20) {
        droppedSamples.push({
          title: row.title.slice(0, 120),
          reason: decision.reason,
        });
      }
      if (!dryRun) {
        await prisma.regulationItem.delete({ where: { id: row.id } });
      }
      continue;
    }

    if (decision.reason === "ai_failed") aiFailed++;
    kept++;

    if (!dryRun && decision.verdict) {
      await prisma.regulationItem.update({
        where: { id: row.id },
        data: {
          aiVerdict: decision.verdict as unknown as object,
        },
      });
    }
  }

  await logAuditEvent({
    action: "regulations_scan_completed",
    targetType: "regulation",
    targetId: null,
    summary: `AI backfill: ${kept} korundu, ${dropped} elendi${dryRun ? " (dry-run)" : ""}.`,
    module: "regulations",
    severity: "info",
    metadata: {
      processed: rows.length,
      kept,
      dropped,
      aiFailed,
      dryRun,
      rerunAll,
      droppedSamples,
    },
    requestId,
    actorId: user.id,
  });

  return NextResponse.json({
    processed: rows.length,
    kept,
    dropped,
    aiFailed,
    dryRun,
    rerunAll,
    droppedSamples,
    requestId,
  });
}
