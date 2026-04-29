import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  AuditAction,
  AuditModule,
  AuditSeverity,
  AuditTargetType,
} from "@/lib/audit-log";
import type { SessionUser } from "@/lib/api-auth";

export interface ServerAuditInput {
  action: AuditAction | string;
  targetType: AuditTargetType | string;
  targetId?: string | null;
  summary: string;
  module?: AuditModule | string;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown> | null;
  requestId?: string | null;
  actorId?: string | null;
}

export function createRequestId(prefix = "req"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function sanitizeAuditMetadata(
  metadata?: Record<string, unknown> | null,
): Prisma.InputJsonValue | undefined {
  if (!metadata) return undefined;
  return JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue;
}

export async function logAuditEvent(input: ServerAuditInput): Promise<boolean> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        summary: input.summary,
        module: input.module ?? null,
        severity: input.severity ?? "info",
        metadata: sanitizeAuditMetadata(input.metadata),
        requestId: input.requestId ?? null,
        actorId: input.actorId ?? null,
      },
    });
    return true;
  } catch (error) {
    // Logging must never break the product flow.
    console.error("[audit] write failed:", error);
    return false;
  }
}

export function actorId(user: SessionUser | null | undefined): string | null {
  return user?.id ?? null;
}
