import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, badRequest } from "@/lib/api-auth";
import { applyRedline } from "@/lib/redline/docx-renderer";
import type { ArbitratedEdit, EditProposal } from "@/lib/redline/types";
import { persistRunAgentVersions } from "@/lib/run-history-server";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const url = req.nextUrl;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  // Visibility scope. Defaults:
  //   - super_admin sees everything ('all')
  //   - users in a group see own + group runs ('group')
  //   - groupless users see only their own ('mine')
  // Explicit ?scope=mine|group|all overrides; super_admin is the only
  // role allowed to widen to 'all'.
  const requestedScope = url.searchParams.get("scope");
  let scope: "mine" | "group" | "all";
  if (requestedScope === "all" && user.role === "super_admin") {
    scope = "all";
  } else if (requestedScope === "mine") {
    scope = "mine";
  } else if (requestedScope === "group") {
    scope = "group";
  } else {
    scope = user.role === "super_admin" ? "all" : user.groupId ? "group" : "mine";
  }

  const where: import("@prisma/client").Prisma.BoardRunWhereInput = {
    deletedAt: null,
  };
  if (scope === "mine") {
    where.userId = user.id;
  } else if (scope === "group") {
    if (user.groupId) {
      where.OR = [{ userId: user.id }, { groupId: user.groupId }];
    } else {
      where.userId = user.id;
    }
  }
  // scope === "all": no userId/groupId filter (super_admin only)

  const [runs, total] = await Promise.all([
    prisma.boardRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: offset,
      take: limit,
      include: {
        agentSnapshots: { include: { agentVersion: true } },
        debateMoments: { orderBy: { timestamp: "asc" } },
        verdict: true,
        document: true,
        user: { select: { name: true, email: true } },
        group: { select: { name: true } },
      },
    }),
    prisma.boardRun.count({ where }),
  ]);

  const snapshots: import("@/lib/run-history").RunListItem[] = runs.map((r) => ({
    ...runToSnapshot(r),
    ownerId: r.userId,
    ownerName: r.user?.name ?? null,
    ownerEmail: r.user?.email ?? "",
    groupId: r.groupId,
    groupName: r.group?.name ?? null,
    folderId: r.folderId ?? null,
    isOwn: r.userId === user.id,
  }));

  return NextResponse.json({ runs: snapshots, total, scope });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  if (!body.id || !body.documentName) {
    return badRequest("Missing required fields");
  }

  const snapshot = body as unknown as import("@/lib/run-history").BoardroomRunSnapshot;

  const originalDocxBuffer = snapshot.originalDocxBase64
    ? Buffer.from(snapshot.originalDocxBase64, "base64")
    : null;
  const editProposals: EditProposal[] = snapshot.editProposals ?? [];
  const arbitratedEdits: ArbitratedEdit[] = snapshot.arbitratedEdits ?? [];

  try {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.boardRun.findUnique({ where: { id: snapshot.id } });
    if (existing) return;

    const run = await tx.boardRun.create({
      data: {
        id: snapshot.id,
        userId: user.id,
        // Freeze the user's current group at run create time. Same-group
        // members get read-only visibility via the GET filter above.
        groupId: user.groupId ?? null,
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

    // Faz 4: DocumentArtifact + originalDocxBuffer
    if (originalDocxBuffer) {
      await tx.documentArtifact.create({
        data: {
          runId: run.id,
          fileName: snapshot.documentName,
          fileType: snapshot.documentType,
          fileSize: snapshot.documentSize,
          sections: [] as unknown as import("@prisma/client").Prisma.InputJsonValue,
          metadata: {} as unknown as import("@prisma/client").Prisma.InputJsonValue,
          originalDocxBuffer,
        },
      });
    }

    // Faz 4: persist raw proposals for audit trail
    if (editProposals.length > 0) {
      await tx.editProposal.createMany({
        data: editProposals.map((p) => ({
          runId: run.id,
          agentKey: p.agentId,
          clauseRef: p.clauseRef,
          editType: p.editType,
          originalText: p.originalText ?? null,
          proposedText: p.proposedText,
          rationale: p.rationale,
          severity: p.severity,
        })),
      });
    }

    // Faz 4: persist chief's canonical edits
    if (arbitratedEdits.length > 0) {
      await tx.arbitratedEdit.createMany({
        data: arbitratedEdits.map((e) => ({
          runId: run.id,
          clauseRef: e.clauseRef,
          editType: e.editType,
          originalText: e.originalText ?? null,
          finalText: e.finalText,
          sourceProposals: e.sourceProposals,
          arbitrationNote: e.arbitrationNote,
          resolution: e.resolution,
          finalSeverity: e.finalSeverity,
        })),
      });
    }

    if (snapshot.verdictSeed) {
      await tx.finalVerdict.create({
        data: {
          runId: run.id,
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
          runId: run.id,
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
              runId: run.id,
              agentVersionId,
              agentKey: s.id,
              isChief: s.isChief,
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null),
      });
    }

    await tx.auditLog.create({
      data: {
        action: "run_created",
        targetType: "run",
        targetId: run.id,
        summary: `"${snapshot.documentName}" kurul tartışması kaydedildi`,
        module: "boardroom",
        severity: "info",
        metadata: {
          analysisMode: snapshot.analysisMode ?? "ai",
          modelInfo: snapshot.modelInfo ?? null,
          agentCount: snapshot.agentSnapshots.length,
          debateMomentCount: snapshot.debateTimeline.length,
          riskLevel: snapshot.verdictSeed.riskLevel,
        },
        actorId: user.id,
      },
    });
  });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    // eslint-disable-next-line no-console
    console.error("[POST /api/runs] transaction failed:", message, stack);
    return NextResponse.json(
      { error: `runs_persist_failed: ${message}` },
      { status: 500 },
    );
  }

  // Faz 4: generate redline DOCX outside the transaction (jszip I/O
  // shouldn't hold row locks). Skip silently if prerequisites missing.
  if (originalDocxBuffer && arbitratedEdits.length > 0) {
    try {
      const { buffer, appliedCount, orphanCount } = await applyRedline(
        originalDocxBuffer,
        arbitratedEdits,
      );
      await prisma.redlineArtifact.create({
        data: {
          runId: snapshot.id,
          generation: 1,
          isLatest: true,
          // Prisma wants Uint8Array<ArrayBuffer>; Buffer's backing
          // ArrayBufferLike type doesn't cast cleanly, so copy.
          docxBuffer: new Uint8Array(buffer),
          editCount: appliedCount,
          orphanCount,
        },
      });
    } catch (err) {
      console.error("Redline generation failed:", err);
      // Non-fatal: run saved, redline skipped. UI gates download
      // behind RedlineArtifact existence.
    }
  }

  return NextResponse.json({ id: snapshot.id }, { status: 201 });
}

// ─── Helpers ──────────────────────────────────────────

type RunWithRelations = Awaited<ReturnType<typeof prisma.boardRun.findMany>>[number] & {
  agentSnapshots: Array<{ agentKey: string; isChief: boolean; agentVersion: {
    cvSnapshot: unknown; systemPrompt: string | null; rolePrompt: string | null;
    outputRules: string | null; guardrails: string | null; version: number;
    publishedAt: Date;
  } }>;
  debateMoments: Array<{ agentKey: string; agentName: string; type: string;
    topic: string; message: string; timestamp: bigint; id: string }>;
  verdict: { summary: string; riskLevel: string; confidenceLevel: string | null;
    decisions: unknown; actionItems: unknown; agentPerspectives: unknown;
    disagreements: unknown; resolvedDisagreements: unknown;
    unresolvedDisagreements: unknown; positionChanges: unknown } | null;
};

function runToSnapshot(run: RunWithRelations): import("@/lib/run-history").BoardroomRunSnapshot {
  return {
    id: run.id,
    createdAt: run.startedAt.toISOString(),
    documentName: run.documentName,
    documentType: run.documentType,
    documentSize: run.documentSize,
    selectedAgentIds: run.agentSnapshots
      .filter((s) => !s.isChief)
      .map((s) => s.agentKey),
    agentSnapshots: run.agentSnapshots.map((s) => {
      const cv = s.agentVersion.cvSnapshot as Record<string, string> | null;
      return {
        id: s.agentKey,
        name: cv?.name ?? s.agentKey,
        shortName: cv?.shortName ?? cv?.name?.split(" ")[0] ?? s.agentKey,
        title: cv?.title ?? "",
        avatar: cv?.avatar ?? "",
        expertise: cv?.expertise ? cv.expertise.split(",").map((e: string) => e.trim()) : [],
        characterLine: cv?.riskFocus ?? "",
        thinkingStyle: cv?.principles ?? "",
        tone: cv?.tone ?? "Profesyonel ve net",
        riskFocus: cv?.riskFocus ?? "",
        isChief: s.isChief,
        promptSnapshot: s.agentVersion.systemPrompt
          ? {
              promptVersion: s.agentVersion.version,
              publishedAt: s.agentVersion.publishedAt.toISOString(),
              systemPrompt: s.agentVersion.systemPrompt,
              rolePrompt: s.agentVersion.rolePrompt ?? "",
              outputRules: s.agentVersion.outputRules ?? "",
              guardrails: s.agentVersion.guardrails ?? "",
            }
          : null,
      };
    }),
    contextNotes: run.contextNotes ?? "",
    clientParty: run.clientParty ?? "",
    stance: (run.stance as import("@/lib/run-history").BoardroomRunSnapshot["stance"]) ?? "objective",
    debateTimeline: run.debateMoments.map((m) => ({
      id: m.id,
      agentId: m.agentKey,
      agentName: m.agentName,
      agentAvatar: "",
      type: m.type as import("@/lib/boardroom-flow-store").DebateEventType,
      message: m.message,
      topic: m.topic,
      // Prisma returns BigInt; JSON.stringify throws on BigInt. Epoch
      // ms (~1.78T) is well below 2^53, so Number() is lossless.
      timestamp: Number(m.timestamp),
    })),
    verdictSeed: run.verdict
      ? {
          summary: run.verdict.summary,
          riskLevel: run.verdict.riskLevel as "high" | "medium" | "low",
          confidenceLevel: run.verdict.confidenceLevel as "high" | "medium" | "low" | undefined,
          decisions: run.verdict.decisions as string[],
          actionItems: run.verdict.actionItems as string[],
          agentPerspectives: run.verdict.agentPerspectives as Array<{ agentId: string; agentName: string; avatar: string; position: string }>,
          disagreements: run.verdict.disagreements as Array<{ topic: string; agentA: string; agentB: string; resolution: string }>,
          resolvedDisagreements: run.verdict.resolvedDisagreements as Array<{ topic: string; agentA: string; agentB: string; resolution: string }> | undefined,
          unresolvedDisagreements: run.verdict.unresolvedDisagreements as Array<{ topic: string; agentA: string; agentB: string; reason: string }> | undefined,
          positionChanges: run.verdict.positionChanges as Array<{ agentId: string; agentName: string; topic: string; previousStance: string; updatedStance: string }> | undefined,
        }
      : { summary: "", riskLevel: "medium" as const, decisions: [], actionItems: [], agentPerspectives: [], disagreements: [] },
    analysisMode: run.analysisMode as "ai" | "ai-partial" | "fallback",
    modelInfo: run.modelInfo ?? undefined,
    pipelineStages: run.pipelineMetadata as Array<{ stage: string; status: string; durationMs: number; agentId?: string; error?: string }> | undefined,
  };
}
