import type { AgentCVData, AgentPromptData } from "../control-room-store";
import type { BoardroomRunSnapshot } from "../run-history";
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

// ─── HTTP helpers ─────────────────────────────────────

async function api<T>(
  path: string,
  opts?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API error ${res.status}`);
  }
  return res.json();
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    (e): e is [string, string | number] => e[1] !== undefined,
  );
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]),
  ).toString();
}

// ─── Run Store (HTTP → /api/runs) ─────────────────────

class HttpRunStore implements RunStore {
  async listRuns(
    _userId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<{ runs: BoardroomRunSnapshot[]; total: number }> {
    return api(`/api/runs${qs({ limit: opts?.limit, offset: opts?.offset })}`);
  }

  async getRunById(id: string): Promise<BoardroomRunSnapshot | null> {
    try {
      return await api(`/api/runs/${id}`);
    } catch {
      return null;
    }
  }

  async createRun(
    _userId: string,
    snapshot: BoardroomRunSnapshot,
  ): Promise<void> {
    await api("/api/runs", {
      method: "POST",
      body: JSON.stringify(snapshot),
    });
  }

  async deleteRun(id: string): Promise<void> {
    await api(`/api/runs/${id}`, { method: "DELETE" });
  }

  async bulkImport(
    _userId: string,
    runs: BoardroomRunSnapshot[],
  ): Promise<{ imported: number; skipped: number }> {
    return api("/api/runs/bulk-import", {
      method: "POST",
      body: JSON.stringify({ runs }),
    });
  }
}

// ─── Agent Store (HTTP → /api/agents) ─────────────────

class HttpAgentStore implements AgentStore {
  async getProfile(agentKey: string): Promise<AgentProfileDTO | null> {
    try {
      return await api(`/api/agents/${agentKey}`);
    } catch {
      return null;
    }
  }

  async listProfiles(): Promise<AgentProfileDTO[]> {
    return api("/api/agents");
  }

  async saveCVDraft(agentKey: string, cv: AgentCVData): Promise<void> {
    await api(`/api/agents/${agentKey}/cv`, {
      method: "PUT",
      body: JSON.stringify(cv),
    });
  }

  async publishCV(agentKey: string): Promise<AgentVersionDTO> {
    return api(`/api/agents/${agentKey}/cv/publish`, { method: "POST" });
  }

  async savePromptDraft(
    agentKey: string,
    prompt: AgentPromptData,
  ): Promise<void> {
    await api(`/api/agents/${agentKey}/prompt`, {
      method: "PUT",
      body: JSON.stringify(prompt),
    });
  }

  async publishPrompt(agentKey: string): Promise<AgentVersionDTO> {
    return api(`/api/agents/${agentKey}/prompt/publish`, { method: "POST" });
  }

  async rollbackPrompt(agentKey: string): Promise<void> {
    await api(`/api/agents/${agentKey}/prompt/rollback`, { method: "POST" });
  }

  async getVersionHistory(agentKey: string): Promise<AgentVersionDTO[]> {
    return api(`/api/agents/${agentKey}/versions`);
  }

  // ── Custom agents ─────────────────────────────────────

  async createCustom(
    input: import("./types").CreateCustomAgentDTO,
  ): Promise<AgentProfileDTO> {
    return api("/api/agents", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async archiveCustom(agentKey: string): Promise<void> {
    await api(`/api/agents/${agentKey}/archive`, { method: "POST" });
  }

  async restoreCustom(agentKey: string): Promise<void> {
    await api(`/api/agents/${agentKey}/restore`, { method: "POST" });
  }
}

// ─── Audit Store (HTTP → /api/audit) ──────────────────

class HttpAuditStore implements AuditStore {
  async log(
    event: Omit<AuditEventDTO, "id" | "timestamp">,
  ): Promise<void> {
    await api("/api/audit", {
      method: "POST",
      body: JSON.stringify(event),
    });
  }

  async list(filters?: {
    action?: string;
    targetType?: string;
    actorId?: string;
    limit?: number;
  }): Promise<AuditEventDTO[]> {
    return api(`/api/audit${qs({
      action: filters?.action,
      targetType: filters?.targetType,
      actorId: filters?.actorId,
      limit: filters?.limit,
    })}`);
  }

  async bulkImport(
    events: AuditEventDTO[],
  ): Promise<{ imported: number; skipped: number }> {
    return api("/api/audit/bulk-import", {
      method: "POST",
      body: JSON.stringify({ events }),
    });
  }
}

// ─── Template Store (HTTP → /api/templates) ───────────

class HttpTemplateStore implements TemplateStore {
  async list(): Promise<BoardTemplateDTO[]> {
    return api("/api/templates");
  }

  async create(
    template: Omit<BoardTemplateDTO, "id">,
  ): Promise<BoardTemplateDTO> {
    return api("/api/templates", {
      method: "POST",
      body: JSON.stringify(template),
    });
  }

  async delete(id: string): Promise<void> {
    await api(`/api/templates/${id}`, { method: "DELETE" });
  }
}

// ─── Adapter ──────────────────────────────────────────

export class PostgresAdapter implements PersistenceAdapter {
  runs = new HttpRunStore();
  agents = new HttpAgentStore();
  audit = new HttpAuditStore();
  templates = new HttpTemplateStore();
}
