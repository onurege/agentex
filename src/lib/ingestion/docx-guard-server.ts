// ============================================================
// DOCX Buffer Guards — server-only (TTL cleanup)
// ============================================================
//
// trimOrphanDocxBuffers:
//   Admin/scheduled cleanup. Nulls originalDocxBuffer on
//   DocumentArtifact rows whose BoardRun finished more than the
//   retention window ago. The redline itself stays in RedlineArtifact
//   — we just drop the raw source so the DB doesn't grow unbounded.
//   V1 wires the util; scheduling lives in Faz 5.
//
// Kept out of docx-guard.ts so the client bundle doesn't pick up
// Prisma / pg via this util.
// ============================================================

import { prisma } from "@/lib/prisma";
import { DOCX_RETENTION_DAYS } from "./docx-guard";

/**
 * Nulls out originalDocxBuffer on DocumentArtifact rows whose BoardRun
 * completed more than DOCX_RETENTION_DAYS days ago. Leaves RedlineArtifact
 * rows intact. Returns the count of rows trimmed.
 */
export async function trimOrphanDocxBuffers(
  options?: { retentionDays?: number },
): Promise<{ trimmed: number }> {
  const retentionDays = options?.retentionDays ?? DOCX_RETENTION_DAYS;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await prisma.documentArtifact.updateMany({
    where: {
      originalDocxBuffer: { not: null },
      run: {
        OR: [
          { completedAt: { lt: cutoff } },
          { deletedAt: { lt: cutoff } },
        ],
      },
    },
    data: { originalDocxBuffer: null },
  });

  return { trimmed: result.count };
}
