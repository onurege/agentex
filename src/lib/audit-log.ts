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

export function getCurrentActor(): string | null {
  return currentActorId;
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
  | "template_created"
  | "template_deleted"
  | "role_changed"
  | "user_created"
  | "user_updated"
  | "user_deleted"
  | "agent_created"
  | "agent_archived"
  | "agent_restored"
  | "boardroom_started"
  | "boardroom_completed"
  | "boardroom_failed"
  | "pipeline_stage_completed"
  | "legal_research_started"
  | "legal_research_completed"
  | "legal_research_failed"
  | "document_uploaded"
  | "document_parsed"
  | "document_parse_failed"
  | "draft_started"
  | "draft_ai_suggested"
  | "draft_ai_explained"
  | "draft_exported"
  | "compare_started"
  | "compare_completed"
  | "compare_redline_exported"
  | "signature_started"
  | "signature_source_uploaded"
  | "signature_crop_selected"
  | "signature_compared"
  | "signature_failed"
  | "signature_precheck_passed"
  | "signature_precheck_warned"
  | "signature_precheck_failed"
  | "signature_external_verification"
  | "signature_user_decision"
  | "signature_review_requested"
  | "signature_manager_approved"
  | "signature_manager_rejected"
  | "regulations_scan_started"
  | "regulations_scan_completed"
  | "regulations_scan_failed"
  | "regulation_pinned"
  | "api_error";

export type AuditTargetType =
  | "agent"
  | "run"
  | "template"
  | "user"
  | "document"
  | "draft"
  | "compare"
  | "signature"
  | "regulation"
  | "pipeline"
  | "mcp"
  | "system";

export type AuditModule =
  | "control_room"
  | "boardroom"
  | "draft"
  | "compare"
  | "signatures"
  | "regulations"
  | "admin"
  | "system";

export type AuditSeverity = "debug" | "info" | "warning" | "error" | "critical";

export interface AuditEvent {
  id: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  summary: string;
  module?: AuditModule;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
  requestId?: string;
  actor: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
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
  module?: AuditModule;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
  requestId?: string;
  actor?: string;
  forceLocal?: boolean;
}): void {
  // Server writes audit in db mode; client call is a no-op to avoid duplicates.
  if (getPersistenceMode() === "db" && !params.forceLocal) return;

  const event: AuditEvent = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    summary: params.summary,
    module: params.module,
    severity: params.severity ?? "info",
    metadata: params.metadata,
    requestId: params.requestId,
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
  template_created: "Şablon Oluşturuldu",
  template_deleted: "Şablon Silindi",
  role_changed: "Rol Değiştirildi",
  user_created: "Kullanıcı Oluşturuldu",
  user_updated: "Kullanıcı Güncellendi",
  user_deleted: "Kullanıcı Silindi",
  agent_created: "Ajan Oluşturuldu",
  agent_archived: "Ajan Arşivlendi",
  agent_restored: "Ajan Geri Getirildi",
  boardroom_started: "Kurul Başlatıldı",
  boardroom_completed: "Kurul Tamamlandı",
  boardroom_failed: "Kurul Hatası",
  pipeline_stage_completed: "Pipeline Aşaması Kaydedildi",
  legal_research_started: "Yargı Araştırması Başladı",
  legal_research_completed: "Yargı Araştırması Tamamlandı",
  legal_research_failed: "Yargı Araştırması Hatası",
  document_uploaded: "Belge Yüklendi",
  document_parsed: "Belge Ayrıştırıldı",
  document_parse_failed: "Belge Ayrıştırma Hatası",
  draft_started: "Taslak Başlatıldı",
  draft_ai_suggested: "Taslak AI Önerisi",
  draft_ai_explained: "Taslak AI Açıklaması",
  draft_exported: "Taslak Dışa Aktarıldı",
  compare_started: "Karşılaştırma Başlatıldı",
  compare_completed: "Karşılaştırma Tamamlandı",
  compare_redline_exported: "Karşılaştırma Redline Dışa Aktarıldı",
  signature_started: "İmza Kontrolü Başlatıldı",
  signature_source_uploaded: "İmza Kaynağı Yüklendi",
  signature_crop_selected: "İmza Alanı Seçildi",
  signature_compared: "İmza Karşılaştırıldı",
  signature_failed: "İmza Kontrolü Hatası",
  signature_precheck_passed: "İmza Ön Kontrolü Tutarlı",
  signature_precheck_warned: "İmza Ön Kontrolünde Uyarı",
  signature_external_verification: "Sicil Doğrulama (Manuel)",
  signature_user_decision: "İmza Ön-Kontrol Kullanıcı Kararı",
  signature_review_requested: "İmza Ön-Kontrol Yönetici Onayı İstendi",
  signature_manager_approved: "İmza Ön-Kontrol Yönetici Onayladı",
  signature_manager_rejected: "İmza Ön-Kontrol Yönetici Reddetti",
  signature_precheck_failed: "İmza Ön Kontrolünde Kritik Uyumsuzluk",
  regulations_scan_started: "Mevzuat Taraması Başladı",
  regulations_scan_completed: "Mevzuat Taraması Tamamlandı",
  regulations_scan_failed: "Mevzuat Taraması Hatası",
  regulation_pinned: "Mevzuat İşaretlendi",
  api_error: "API Hatası",
};

export const TARGET_TYPE_LABELS: Record<AuditTargetType, string> = {
  agent: "Ajan",
  run: "Çalıştırma",
  template: "Şablon",
  user: "Kullanıcı",
  document: "Belge",
  draft: "Taslak",
  compare: "Karşılaştırma",
  signature: "İmza",
  regulation: "Mevzuat",
  pipeline: "Pipeline",
  mcp: "MCP",
  system: "Sistem",
};

export const MODULE_LABELS: Record<AuditModule, string> = {
  control_room: "Control Room",
  boardroom: "Agent Kurulu",
  draft: "Sözleşme Taslağı",
  compare: "Döküman Karşılaştırma",
  signatures: "İmza Kontrolü",
  regulations: "Mevzuat Takibi",
  admin: "Admin",
  system: "Sistem",
};
