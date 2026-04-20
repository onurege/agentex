import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized, badRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const url = req.nextUrl;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const [runs, total] = await Promise.all([
    prisma.boardRun.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { startedAt: "desc" },
      skip: offset,
      take: limit,
      include: {
        agentSnapshots: { include: { agentVersion: true } },
        debateMoments: { orderBy: { timestamp: "asc" } },
        verdict: true,
        document: true,
      },
    }),
    prisma.boardRun.count({
      where: { userId: user.id, deletedAt: null },
    }),
  ]);

  const snapshots = runs.map(runToSnapshot);

  return NextResponse.json({ runs: snapshots, total });
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

  await prisma.$transaction(async (tx) => {
    const existing = await tx.boardRun.findUnique({ where: { id: snapshot.id } });
    if (existing) return;

    const run = await tx.boardRun.create({
      data: {
        id: snapshot.id,
        userId: user.id,
        documentName: snapshot.documentName,
        documentType: snapshot.documentType,
        documentSize: snapshot.documentSize,
        contextNotes: snapshot.contextNotes || null,
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

    await tx.auditLog.create({
      data: {
        action: "run_created",
        targetType: "run",
        targetId: run.id,
        summary: `"${snapshot.documentName}" kurul tartışması kaydedildi`,
        actorId: user.id,
      },
    });
  });

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
    topic: string; message: string; timestamp: number; id: string }>;
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
    selectedAgentIds: run.agentSnapshots.map((s) => s.agentKey),
    agentSnapshots: run.agentSnapshots.map((s) => {
      const cv = s.agentVersion.cvSnapshot as Record<string, string> | null;
      return {
        id: s.agentKey,
        name: cv?.name ?? s.agentKey,
        shortName: cv?.name?.split(" ")[0] ?? s.agentKey,
        title: cv?.title ?? "",
        avatar: "",
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
    debateTimeline: run.debateMoments.map((m) => ({
      id: m.id,
      agentId: m.agentKey,
      agentName: m.agentName,
      agentAvatar: "",
      type: m.type as import("@/lib/boardroom-flow-store").DebateEventType,
      message: m.message,
      topic: m.topic,
      timestamp: m.timestamp,
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
