import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  badRequest,
  forbidden,
  getAuthUser,
  notFound,
  unauthorized,
  type SessionUser,
} from "@/lib/api-auth";
import { logAuditEvent, createRequestId } from "@/lib/server-audit";

// PATCH /api/signatures/precheck-records/[id]
//
// Three operation modes (mutually exclusive):
//
// 1. action: "escalate" — owner asks for manager review.
//    Sets managerReviewRequested=true. Cannot be undone.
//    Allowed: owner only (and only if no manager decision yet).
//
// 2. action: "manager_decide" — manager (authorized_user / super_admin)
//    sets the final decision.
//    authorized_user: must not have decided already (locked).
//    super_admin: can override at any time.
//    Both: rejection requires a non-empty managerDecisionNote.
//
// User-decision (stage 1) is FROZEN at create time and never patchable
// here — that's the whole point of the locking rule.

function canRead(
  viewer: SessionUser,
  rec: { userId: string; groupId: string | null },
): boolean {
  if (viewer.role === "super_admin") return true;
  if (rec.userId === viewer.id) return true;
  if (rec.groupId !== null && rec.groupId === viewer.groupId) return true;
  return false;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const requestId = createRequestId("sigprecheck-patch");

  let body: {
    action?: unknown;
    decision?: unknown;
    note?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid_json");
  }

  const record = await prisma.signaturePrecheck.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      userId: true,
      groupId: true,
      sirkuFileName: true,
      managerReviewRequested: true,
      managerDecision: true,
      managerReviewedBy: true,
    },
  });
  if (!record) return notFound("record_not_found");
  if (!canRead(user, record)) return forbidden();

  if (body.action === "escalate") {
    if (record.userId !== user.id) return forbidden();
    if (record.managerReviewRequested) {
      return badRequest("already_escalated");
    }
    if (record.managerDecision !== null) {
      return badRequest("already_decided");
    }
    await prisma.$transaction([
      prisma.signaturePrecheck.update({
        where: { id: params.id },
        data: { managerReviewRequested: true },
      }),
      prisma.auditLog.create({
        data: {
          action: "signature_review_requested",
          targetType: "signature",
          targetId: params.id,
          summary: `İmza ön-kontrol "${record.sirkuFileName}" yönetici onayına gönderildi`,
          module: "signatures",
          severity: "info",
          metadata: { recordId: params.id },
          actorId: user.id,
          requestId,
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "manager_decide") {
    // Reviewer permission: authorized_user or super_admin.
    if (user.role !== "super_admin" && user.role !== "authorized_user") {
      return forbidden();
    }
    if (body.decision !== "approved" && body.decision !== "rejected") {
      return badRequest("invalid_decision");
    }
    const note =
      typeof body.note === "string" && body.note.trim().length > 0
        ? body.note.trim()
        : null;
    if (body.decision === "rejected" && !note) {
      return badRequest("rejection_reason_required");
    }
    if (!record.managerReviewRequested) {
      return badRequest("not_escalated");
    }
    // Lock for authorized_user: once they (or any non-super reviewer)
    // decide, only super_admin can change it. super_admin can always
    // override regardless of who decided last.
    if (record.managerDecision !== null && user.role !== "super_admin") {
      return badRequest("decision_locked");
    }

    await prisma.$transaction([
      prisma.signaturePrecheck.update({
        where: { id: params.id },
        data: {
          managerDecision: body.decision,
          managerDecisionNote: note,
          managerReviewedBy: user.id,
          managerReviewedAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          action:
            body.decision === "approved"
              ? "signature_manager_approved"
              : "signature_manager_rejected",
          targetType: "signature",
          targetId: params.id,
          summary:
            body.decision === "approved"
              ? `İmza ön-kontrol "${record.sirkuFileName}" yönetici tarafından ONAYLANDI`
              : `İmza ön-kontrol "${record.sirkuFileName}" yönetici tarafından REDDEDİLDİ`,
          module: "signatures",
          severity: body.decision === "rejected" ? "warning" : "info",
          metadata: {
            recordId: params.id,
            decision: body.decision,
            note,
            reviewerRole: user.role,
            override: record.managerDecision !== null,
          },
          actorId: user.id,
          requestId,
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  return badRequest("invalid_action");
}
