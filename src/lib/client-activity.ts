"use client";

import type {
  AuditAction,
  AuditModule,
  AuditSeverity,
  AuditTargetType,
} from "@/lib/audit-log";
import { getCurrentActor, saveAuditEvent } from "@/lib/audit-log";

export async function logClientActivity(params: {
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  summary: string;
  module: AuditModule;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const response = await fetch("/api/audit", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (response.ok) return;
    console.warn("Client audit log could not be persisted", response.status);
  } catch (err) {
    console.warn("Client audit log request failed", err);
  }

  saveAuditEvent({
    ...params,
    actor: getCurrentActor() ?? undefined,
    forceLocal: true,
  });
}
