import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  badRequest,
  getAuthUser,
  unauthorized,
} from "@/lib/api-auth";
import { logAuditEvent, createRequestId } from "@/lib/server-audit";

// ============================================================
// /api/signatures/precheck-records  (T-6)
// ============================================================
//
// POST: persist a stage-1 signature precheck submission. Body carries
// the regex precheck result + filenames + the user's own decision
// (approved/rejected) + optional TTSG verification fields. Returns
// the persisted record id.
//
// GET: list records visible to the viewer (own + same-group +
// super_admin sees all). Used by the signatures page and the panel
// review queue.
//
// Stage-2 manager review lives in the [id] route.

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const requestId = createRequestId("sigprecheck");

  let body: {
    sirkuFileName?: unknown;
    petitionFileName?: unknown;
    precheckResult?: unknown;
    externalStatus?: unknown;
    externalNote?: unknown;
    userDecision?: unknown;
    userDecisionNote?: unknown;
    criticalOverride?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid_json");
  }

  if (typeof body.sirkuFileName !== "string" || typeof body.petitionFileName !== "string") {
    return badRequest("missing_filenames");
  }
  if (!body.precheckResult || typeof body.precheckResult !== "object") {
    return badRequest("missing_precheckResult");
  }
  if (body.userDecision !== "approved" && body.userDecision !== "rejected") {
    return badRequest("invalid_userDecision");
  }
  if (body.userDecision === "rejected") {
    if (typeof body.userDecisionNote !== "string" || body.userDecisionNote.trim().length === 0) {
      return badRequest("rejection_reason_required");
    }
  }
  if (body.externalStatus !== undefined && body.externalStatus !== null) {
    if (
      body.externalStatus !== "matched" &&
      body.externalStatus !== "mismatch" &&
      body.externalStatus !== "unknown"
    ) {
      return badRequest("invalid_externalStatus");
    }
  }

  const record = await prisma.signaturePrecheck.create({
    data: {
      userId: user.id,
      groupId: user.groupId ?? null,
      sirkuFileName: body.sirkuFileName,
      petitionFileName: body.petitionFileName,
      precheckResult: body.precheckResult as import("@prisma/client").Prisma.InputJsonValue,
      externalStatus:
        typeof body.externalStatus === "string" ? body.externalStatus : null,
      externalNote:
        typeof body.externalNote === "string" && body.externalNote.trim().length > 0
          ? body.externalNote
          : null,
      userDecision: body.userDecision,
      userDecisionNote:
        typeof body.userDecisionNote === "string" && body.userDecisionNote.trim().length > 0
          ? body.userDecisionNote
          : null,
      criticalOverride: body.criticalOverride === true,
    },
  });

  await logAuditEvent({
    action: "signature_user_decision",
    targetType: "signature",
    targetId: record.id,
    summary:
      body.userDecision === "approved"
        ? `İmza ön-kontrol kullanıcı kararı: Onaylandı`
        : `İmza ön-kontrol kullanıcı kararı: Reddedildi`,
    module: "signatures",
    severity: body.userDecision === "rejected" ? "warning" : "info",
    metadata: {
      recordId: record.id,
      sirkuFileName: body.sirkuFileName,
      petitionFileName: body.petitionFileName,
      userDecision: body.userDecision,
      externalStatus: body.externalStatus ?? null,
      criticalOverride: body.criticalOverride === true,
    },
    requestId,
    actorId: user.id,
  });

  return NextResponse.json({ id: record.id });
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const url = req.nextUrl;
  const filter = url.searchParams.get("filter"); // "pending" | "decided" | undefined

  const where: import("@prisma/client").Prisma.SignaturePrecheckWhereInput = {};
  if (user.role !== "super_admin") {
    where.OR = user.groupId
      ? [{ userId: user.id }, { groupId: user.groupId }]
      : [{ userId: user.id }];
  }
  if (filter === "pending") {
    where.managerReviewRequested = true;
    where.managerDecision = null;
  } else if (filter === "decided") {
    where.managerDecision = { not: null };
  }

  const records = await prisma.signaturePrecheck.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { name: true, email: true } },
      managerReviewer: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json(
    records.map((r) => ({
      id: r.id,
      ownerId: r.userId,
      ownerName: r.user?.name ?? null,
      ownerEmail: r.user?.email ?? "",
      groupId: r.groupId,
      sirkuFileName: r.sirkuFileName,
      petitionFileName: r.petitionFileName,
      externalStatus: r.externalStatus,
      externalNote: r.externalNote,
      userDecision: r.userDecision,
      userDecisionNote: r.userDecisionNote,
      criticalOverride: r.criticalOverride,
      decidedAt: r.decidedAt.toISOString(),
      managerReviewRequested: r.managerReviewRequested,
      managerReviewedBy: r.managerReviewedBy,
      managerReviewerName: r.managerReviewer?.name ?? r.managerReviewer?.email ?? null,
      managerReviewedAt: r.managerReviewedAt?.toISOString() ?? null,
      managerDecision: r.managerDecision,
      managerDecisionNote: r.managerDecisionNote,
      createdAt: r.createdAt.toISOString(),
      isOwn: r.userId === user.id,
    })),
  );
}
