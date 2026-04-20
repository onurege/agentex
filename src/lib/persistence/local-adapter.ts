import type {
  PersistenceAdapter,
  RunStore,
  AgentStore,
  AuditStore,
  TemplateStore,
  AgentProfileDTO,
  AgentVersionDTO,
  AuditEventDTO,
  BoardTemplateDTO,
} from "./types";

// Placeholder — full implementation in commit 5
export class LocalStorageAdapter implements PersistenceAdapter {
  runs: RunStore = null!;
  agents: AgentStore = null!;
  audit: AuditStore = null!;
  templates: TemplateStore = null!;
}
