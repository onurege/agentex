// One-shot backfill: gateOne() ile DB'deki RegulationItem'ları
// gate'le. aiVerdict=null olanları işler (varsayılan).
//
// Çalıştırma:
//   npx --yes tsx scripts/backfill-regulations-ai.ts            # uygula
//   npx --yes tsx scripts/backfill-regulations-ai.ts --dry-run  # sadece raporla

import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set; check .env.local.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL),
});

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const rerunAll = process.argv.includes("--rerun-all");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) || undefined : undefined;

  // ai-gate.ts'in env'sini lazy import yapalım — dotenv yüklendi.
  const { gateOne } = await import("../src/lib/regulations/ai-gate");

  const where = rerunAll ? {} : { aiVerdict: { equals: Prisma.AnyNull } };
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

  console.log(
    `[backfill] ${rows.length} kayıt değerlendirilecek (dryRun=${dryRun}, rerunAll=${rerunAll}).`,
  );

  let kept = 0;
  let dropped = 0;
  let aiFailed = 0;
  let i = 0;

  for (const row of rows) {
    i++;
    const candidate = {
      source: row.source,
      externalId: row.externalId,
      title: row.title,
      summary: row.summary,
      bodyExcerpt: row.bodyExcerpt ?? undefined,
      url: row.url ?? undefined,
      publishedAt: row.publishedAt,
      status: row.status,
      sourceTool: row.sourceTool,
      companies: row.companies,
    } as Parameters<typeof gateOne>[0];

    try {
      const decision = await gateOne(candidate);
      const tag = `[${i}/${rows.length}]`;

      if (!decision.passed) {
        dropped++;
        console.log(
          `${tag} DROP — ${row.title.slice(0, 90)} (${decision.reason})`,
        );
        if (!dryRun) {
          await prisma.regulationItem.delete({ where: { id: row.id } });
        }
        continue;
      }

      if (decision.reason === "ai_failed") aiFailed++;
      kept++;
      const conf = decision.verdict
        ? `%${Math.round(decision.verdict.confidence * 100)}`
        : "fail-open";
      console.log(
        `${tag} KEEP (${conf}) — ${row.title.slice(0, 90)}`,
      );
      if (!dryRun && decision.verdict) {
        await prisma.regulationItem.update({
          where: { id: row.id },
          data: {
            aiVerdict: decision.verdict as unknown as Prisma.InputJsonValue,
          },
        });
      }
    } catch (err) {
      console.error(`[${i}/${rows.length}] ERROR — ${row.title.slice(0, 80)}:`, err);
      aiFailed++;
    }
  }

  console.log(
    `\n[backfill] tamam — kept=${kept}, dropped=${dropped}, ai_failed=${aiFailed}, dryRun=${dryRun}`,
  );
}

main()
  .catch((err) => {
    console.error("[backfill] fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
