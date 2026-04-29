import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, getAuthUser, unauthorized } from "@/lib/api-auth";
import { createRequestId, logAuditEvent } from "@/lib/server-audit";
import type { AuditAction, AuditModule, AuditSeverity, AuditTargetType } from "@/lib/audit-log";

// Actions any logged-in user may emit from the browser. Anything that
// represents a server-authoritative operation (user_*, role_changed,
// run_created, *_published, boardroom_*, pipeline_*, legal_research_*,
// document_parsed/_failed, compare_completed/_redline_exported,
// draft_exported/_ai_*, agent_*) must be written by the route handler
// that performs the operation — never accepted from a client POST,
// otherwise the audit log can be forged to mimic real admin actions.
const CLIENT_ALLOWED_ACTIONS: ReadonlySet<AuditAction> = new Set<AuditAction>([
  "document_uploaded",
  "draft_started",
  "compare_started",
  "signature_started",
  "signature_source_uploaded",
  "signature_crop_selected",
  "signature_compared",
  "signature_failed",
  "template_applied",
  "cv_draft_saved",
  "prompt_draft_saved",
  "api_error",
]);

const CLIENT_ALLOWED_SEVERITIES: ReadonlySet<AuditSeverity> = new Set<AuditSeverity>([
  "debug",
  "info",
  "warning",
]);

const VALID_MODULES: ReadonlySet<AuditModule> = new Set<AuditModule>([
  "control_room",
  "boardroom",
  "draft",
  "compare",
  "signatures",
  "admin",
  "system",
]);

const VALID_SEVERITIES: ReadonlySet<AuditSeverity> = new Set<AuditSeverity>([
  "debug",
  "info",
  "warning",
  "error",
  "critical",
]);

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const url = req.nextUrl;
  const action = url.searchParams.get("action") ?? undefined;
  const targetType = url.searchParams.get("targetType") ?? undefined;
  const moduleParam = url.searchParams.get("module");
  const severityParam = url.searchParams.get("severity");
  const moduleFilter =
    moduleParam && VALID_MODULES.has(moduleParam as AuditModule) ? moduleParam : undefined;
  const severity =
    severityParam && VALID_SEVERITIES.has(severityParam as AuditSeverity)
      ? severityParam
      : undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);

  const events = await prisma.auditLog.findMany({
    where: {
      ...(action && { action }),
      ...(targetType && { targetType }),
      ...(moduleFilter && { module: moduleFilter }),
      ...(severity && { severity }),
    },
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  return NextResponse.json(
    events.map((e) => ({
      id: e.id,
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId ?? "",
      summary: e.summary,
      module: e.module ?? undefined,
      severity: e.severity,
      metadata: e.metadata ?? undefined,
      requestId: e.requestId ?? undefined,
      actor: e.actor?.name ?? e.actor?.email ?? e.actorId ?? "system",
      actorId: e.actorId,
      actorEmail: e.actor?.email ?? null,
      actorName: e.actor?.name ?? null,
      timestamp: e.timestamp.toISOString(),
    })),
  );
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let body: {
    action?: AuditAction | string;
    targetType?: AuditTargetType | string;
    targetId?: string;
    summary?: string;
    module?: AuditModule | string;
    severity?: AuditSeverity;
    metadata?: Record<string, unknown>;
    requestId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  if (!body.action || !body.targetType || !body.summary) {
    return badRequest("Missing action, targetType or summary");
  }

  if (!CLIENT_ALLOWED_ACTIONS.has(body.action as AuditAction)) {
    return forbidden();
  }

  const severity: AuditSeverity = (body.severity ?? "info") as AuditSeverity;
  if (!CLIENT_ALLOWED_SEVERITIES.has(severity)) {
    return badRequest("invalid_severity");
  }

  const requestId = body.requestId ?? createRequestId("audit");
  const written = await logAuditEvent({
    action: body.action,
    targetType: body.targetType,
    targetId: body.targetId ?? null,
    summary: body.summary,
    module: body.module ?? "system",
    severity,
    metadata: body.metadata,
    requestId,
    actorId: user.id,
  });

  if (!written) {
    return NextResponse.json(
      { error: "Audit log could not be persisted", requestId },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, requestId });
}
