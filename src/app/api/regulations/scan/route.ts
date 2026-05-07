// POST /api/regulations/scan
//
// Manually triggers a fan-out scan over every registered source
// adapter. Authorized for super_admin and authorized_user roles only.
// 60-second per-user throttle prevents accidental rapid-fire on the
// public Yargı MCP endpoint and Resmî Gazete site.

import { NextResponse } from "next/server";
import {
  forbidden,
  getAuthUser,
  unauthorized,
} from "@/lib/api-auth";
import { createRequestId, logAuditEvent } from "@/lib/server-audit";
import { runRegulationsScan } from "@/lib/regulations/scan";

export const runtime = "nodejs";

const THROTTLE_WINDOW_MS = 60_000;
const lastScanByUser = new Map<string, number>();

export async function POST() {
  const requestId = createRequestId("regulations");
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (user.role !== "super_admin" && user.role !== "authorized_user") {
    return forbidden();
  }

  const lastScanAt = lastScanByUser.get(user.id) ?? 0;
  if (Date.now() - lastScanAt < THROTTLE_WINDOW_MS) {
    return NextResponse.json(
      {
        error: "throttled",
        message: "Yeni tarama için en az 60 saniye bekleyin.",
        retryAfterMs: THROTTLE_WINDOW_MS - (Date.now() - lastScanAt),
      },
      { status: 429 },
    );
  }
  lastScanByUser.set(user.id, Date.now());

  await logAuditEvent({
    action: "regulations_scan_started",
    targetType: "regulation",
    targetId: null,
    summary: "Mevzuat taraması başlatıldı",
    module: "regulations",
    severity: "info",
    metadata: { trigger: "manual" },
    requestId,
    actorId: user.id,
  });

  const result = await runRegulationsScan();

  const sourceErrors = result.perSource.filter((s) => s.error);
  if (sourceErrors.length === result.perSource.length) {
    await logAuditEvent({
      action: "regulations_scan_failed",
      targetType: "regulation",
      targetId: null,
      summary: "Mevzuat taramasında tüm kaynaklar başarısız",
      module: "regulations",
      severity: "error",
      metadata: {
        added: result.added,
        updated: result.updated,
        skipped: result.skipped,
        durationMs: result.durationMs,
        perSource: result.perSource,
      },
      requestId,
      actorId: user.id,
    });
  } else {
    await logAuditEvent({
      action: "regulations_scan_completed",
      targetType: "regulation",
      targetId: null,
      summary: `Mevzuat taraması: ${result.added} yeni, ${result.updated} güncel, ${result.skipped} ilgisiz, ${result.aiRejected} AI elendi.`,
      module: "regulations",
      severity: sourceErrors.length > 0 ? "warning" : "info",
      metadata: {
        added: result.added,
        updated: result.updated,
        skipped: result.skipped,
        aiRejected: result.aiRejected,
        aiFailed: result.aiFailed,
        durationMs: result.durationMs,
        perSource: result.perSource,
      },
      requestId,
      actorId: user.id,
    });
  }

  return NextResponse.json({ result, requestId });
}
