// ============================================================
// Audit Log — Local persistence for Control Room events
// ============================================================
//
// Tracks panel actions: CV/prompt edits, publishes, run events.
// Persisted to localStorage. Separate from run history.
//
// In db mode, audit events are written server-side by the API route
// handlers (e.g. /api/runs, /api/agents/*/publish). Client-side calls
// to saveAuditEvent become no-ops there to avoid double-counting.
// ============================================================

import { getPersistenceMode } from "./persistence/factory";

// Module-level actor, populated by SessionActorBridge when the user's
// NextAuth session changes. Falls back to "system" when no session is
// known (SSR, logged-out state, or when the bridge hasn't mounted yet).
let currentActorId: string | null = null;
export function setCurrentActor(id: string | null): void {
  currentActorId = id;
}

export type AuditAction =
  | "cv_draft_saved"
  | "cv_published"
  | "prompt_draft_saved"
  | "prompt_published"
  | "prompt_rollback"
  | "run_created"
  | "run_deleted"
  | "template_applied"
  | "role_changed"
  | "agent_created"
  | "agent_archived"
  | "agent_restored";

export type AuditTargetType = "agent" | "run" | "template" | "user";

export interface AuditEvent {
  id: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  summary: string;
  actor: string;
  timestamp: string;
}

// --- localStorage ---

const LS_KEY = "ai-boardroom-audit-log";
const MAX_EVENTS = 200;

function readEvents(): AuditEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeEvents(events: AuditEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)));
  } catch {
    // Storage full
  }
}

// --- Public API ---

export function saveAuditEvent(params: {
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  summary: string;
  actor?: string;
}): void {
  // Server writes audit in db mode; client call is a no-op to avoid duplicates.
  if (getPersistenceMode() === "db") return;

  const event: AuditEvent = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    summary: params.summary,
    actor: params.actor ?? currentActorId ?? "system",
    timestamp: new Date().toISOString(),
  };
  const events = readEvents();
  writeEvents([event, ...events]);
}

export function getAuditEvents(filters?: {
  action?: AuditAction;
  targetType?: AuditTargetType;
}): AuditEvent[] {
  let events = readEvents();
  if (filters?.action) {
    events = events.filter((e) => e.action === filters.action);
  }
  if (filters?.targetType) {
    events = events.filter((e) => e.targetType === filters.targetType);
  }
  return events;
}

export function getRecentAuditEvents(limit: number = 10): AuditEvent[] {
  return readEvents().slice(0, limit);
}

// --- Action labels for UI ---

export const ACTION_LABELS: Record<AuditAction, string> = {
  cv_draft_saved: "CV Taslağı Kaydedildi",
  cv_published: "CV Yayınlandı",
  prompt_draft_saved: "Prompt Taslağı Kaydedildi",
  prompt_published: "Prompt Yayınlandı",
  prompt_rollback: "Prompt Geri Alındı",
  run_created: "Çalıştırma Oluşturuldu",
  run_deleted: "Çalıştırma Silindi",
  template_applied: "Şablon Uygulandı",
  role_changed: "Rol Değiştirildi",
  agent_created: "Ajan Oluşturuldu",
  agent_archived: "Ajan Arşivlendi",
  agent_restored: "Ajan Geri Getirildi",
};

export const TARGET_TYPE_LABELS: Record<AuditTargetType, string> = {
  agent: "Ajan",
  run: "Çalıştırma",
  template: "Şablon",
  user: "Kullanıcı",
};
