import type {
  PersistenceAdapter,
  RunStore,
  AgentStore,
  AuditStore,
  TemplateStore,
} from "./types";

// Placeholder — full implementation in commit 6
export class PostgresAdapter implements PersistenceAdapter {
  runs: RunStore = null!;
  agents: AgentStore = null!;
  audit: AuditStore = null!;
  templates: TemplateStore = null!;
}
