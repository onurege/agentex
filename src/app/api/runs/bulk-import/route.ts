import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, badRequest } from "@/lib/api-auth";
import type { BoardroomRunSnapshot } from "@/lib/run-history";
import { persistRunAgentVersions } from "@/lib/run-history-server";

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let body: { runs?: BoardroomRunSnapshot[] };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  if (!Array.isArray(body.runs)) {
    return badRequest("Expected { runs: [...] }");
  }

  let imported = 0;
  let skipped = 0;

  for (const snapshot of body.runs) {
    const existing = await prisma.boardRun.findUnique({
      where: { id: snapshot.id },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.boardRun.create({
        data: {
          id: snapshot.id,
          userId: user.id,
          documentName: snapshot.documentName,
          documentType: snapshot.documentType,
          documentSize: snapshot.documentSize,
          contextNotes: snapshot.contextNotes || null,
          clientParty: snapshot.clientParty ?? "",
          stance: snapshot.stance ?? "objective",
          analysisMode: snapshot.analysisMode ?? "ai",
          modelInfo: snapshot.modelInfo ?? null,
          pipelineMetadata: snapshot.pipelineStages
            ? JSON.parse(JSON.stringify(snapshot.pipelineStages))
            : undefined,
          status: "complete",
          startedAt: new Date(snapshot.createdAt),
          completedAt: new Date(snapshot.createdAt),
        },
      });

      if (snapshot.verdictSeed) {
        await tx.finalVerdict.create({
          data: {
            runId: snapshot.id,
            summary: snapshot.verdictSeed.summary,
            riskLevel: snapshot.verdictSeed.riskLevel,
            confidenceLevel: snapshot.verdictSeed.confidenceLevel ?? null,
            decisions: snapshot.verdictSeed.decisions,
            actionItems: snapshot.verdictSeed.actionItems,
            agentPerspectives: snapshot.verdictSeed.agentPerspectives as unknown as import("@prisma/client").Prisma.InputJsonValue,
            disagreements: snapshot.verdictSeed.disagreements as unknown as import("@prisma/client").Prisma.InputJsonValue,
            resolvedDisagreements: snapshot.verdictSeed.resolvedDisagreements as unknown as import("@prisma/client").Prisma.InputJsonValue ?? undefined,
            unresolvedDisagreements: snapshot.verdictSeed.unresolvedDisagreements as unknown as import("@prisma/client").Prisma.InputJsonValue ?? undefined,
            positionChanges: snapshot.verdictSeed.positionChanges as unknown as import("@prisma/client").Prisma.InputJsonValue ?? undefined,
          },
        });
      }

      if (snapshot.debateTimeline?.length) {
        await tx.debateMoment.createMany({
          data: snapshot.debateTimeline.map((e) => ({
            runId: snapshot.id,
            agentKey: e.agentId,
            agentName: e.agentName,
            type: e.type,
            topic: e.topic,
            message: e.message,
            timestamp: e.timestamp,
          })),
        });
      }

      if (snapshot.agentSnapshots?.length) {
        const versionByKey = await persistRunAgentVersions(
          tx,
          user.id,
          snapshot.agentSnapshots,
        );
        await tx.runAgentSnapshot.createMany({
          data: snapshot.agentSnapshots
            .map((s) => {
              const agentVersionId = versionByKey.get(s.id);
              if (!agentVersionId) return null;
              return {
                runId: snapshot.id,
                agentVersionId,
                agentKey: s.id,
                isChief: s.isChief,
              };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null),
        });
      }
    });

    imported++;
  }

  return NextResponse.json({ imported, skipped });
}
