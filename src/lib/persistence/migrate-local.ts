// ============================================================
// Local → Server Migration
// ============================================================
//
// One-shot migration that copies the user's localStorage data to the
// DB-backed server. Runs when mode=db and the user has leftover data
// from an earlier local-mode session.
//
// - Runs: POST /api/runs/bulk-import (id-based upsert, server skips
//   existing rows — re-running is idempotent).
// - Audit events: POST /api/audit/bulk-import (id-based upsert).
// - Agent profiles: saveCVDraft/savePromptDraft for each edited profile,
//   then publish if the user had published locally. Server versions
//   start at 1; legacy local versions are not preserved.
//
// On success (all batches resolved), the flag MIGRATED_KEY is set in
// localStorage and the source keys are cleared. Banner stays hidden on
// subsequent visits.
// ============================================================

import { getBoardroomRuns } from "../run-history";
import { getAuditEvents } from "../audit-log";
import { useControlRoomStore } from "../control-room-store";
import { getPersistenceAdapter, getPersistenceMode } from "./factory";
import type { AuditEventDTO } from "./types";

const RUN_KEY = "ai-boardroom-run-history";
const AUDIT_KEY = "ai-boardroom-audit-log";
const CONTROL_ROOM_KEY = "ai-boardroom-control-room";
const MIGRATED_KEY = "ai-boardroom-migrated";

export interface MigrationSummary {
  runs: { imported: number; skipped: number };
  audit: { imported: number; skipped: number };
  agents: { synced: number };
}

export function hasMigratedLocalData(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(MIGRATED_KEY) === "true";
}

export function hasLocalDataToMigrate(): boolean {
  if (typeof window === "undefined") return false;
  if (hasMigratedLocalData()) return false;

  const runs = getBoardroomRuns();
  if (runs.length > 0) return true;

  const audit = getAuditEvents();
  if (audit.length > 0) return true;

  const profiles = useControlRoomStore.getState().profiles;
  if (Object.keys(profiles).length > 0) return true;

  return false;
}

export async function migrateLocalToServer(): Promise<MigrationSummary> {
  if (getPersistenceMode() !== "db") {
    throw new Error("Migration is only available in db mode.");
  }

  const adapter = await getPersistenceAdapter();

  // ── Runs ─────────────────────────────────────────────
  const runs = getBoardroomRuns();
  const runsResult =
    runs.length > 0
      ? await adapter.runs.bulkImport("", runs)
      : { imported: 0, skipped: 0 };

  // ── Audit events ─────────────────────────────────────
  const auditEvents = getAuditEvents();
  const auditDTOs: AuditEventDTO[] = auditEvents.map((e) => ({
    id: e.id,
    action: e.action,
    targetType: e.targetType,
    targetId: e.targetId,
    summary: e.summary,
    actor: e.actor,
    timestamp: e.timestamp,
  }));
  const auditResult =
    auditDTOs.length > 0
      ? await adapter.audit.bulkImport(auditDTOs)
      : { imported: 0, skipped: 0 };

  // ── Agent profiles (per-agent, drafts first, then publish) ───
  const profiles = useControlRoomStore.getState().profiles;
  let agentsSynced = 0;
  for (const [agentKey, profile] of Object.entries(profiles)) {
    if (profile.cvDraft) {
      await adapter.agents.saveCVDraft(agentKey, profile.cvDraft);
    }
    if (profile.promptDraft) {
      await adapter.agents.savePromptDraft(agentKey, profile.promptDraft);
    }
    if (profile.cvPublished) {
      await adapter.agents.publishCV(agentKey);
    }
    if (profile.promptPublished) {
      await adapter.agents.publishPrompt(agentKey);
    }
    agentsSynced++;
  }

  // ── Mark complete + clear local copies ───────────────
  localStorage.setItem(MIGRATED_KEY, "true");
  localStorage.removeItem(RUN_KEY);
  localStorage.removeItem(AUDIT_KEY);
  localStorage.removeItem(CONTROL_ROOM_KEY);

  return {
    runs: runsResult,
    audit: auditResult,
    agents: { synced: agentsSynced },
  };
}

export function markMigrationDismissed(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MIGRATED_KEY, "true");
}
