// ============================================================
// Agent profile → DTO mapping
// ============================================================
//
// Shared by the agents list, detail, create, archive, and restore
// routes so they agree on exactly which columns the client sees.
// ============================================================

import type { AgentProfile, AgentVersion } from "@prisma/client";
import type { AgentProfileDTO } from "@/lib/persistence/types";

type ProfileWithVersion = AgentProfile & {
  currentVersion: AgentVersion | null;
};

export function profileToDTO(p: ProfileWithVersion): AgentProfileDTO {
  return {
    agentKey: p.agentKey,
    cvDraft: p.cvDraft as AgentProfileDTO["cvDraft"],
    promptDraft: p.promptDraft as AgentProfileDTO["promptDraft"],
    cvLastSaved: p.cvLastSaved?.toISOString() ?? null,
    promptLastSaved: p.promptLastSaved?.toISOString() ?? null,
    currentVersion: p.currentVersion
      ? {
          id: p.currentVersion.id,
          version: p.currentVersion.version,
          cvSnapshot: p.currentVersion
            .cvSnapshot as AgentProfileDTO["cvDraft"],
          systemPrompt: p.currentVersion.systemPrompt,
          rolePrompt: p.currentVersion.rolePrompt,
          outputRules: p.currentVersion.outputRules,
          guardrails: p.currentVersion.guardrails,
          publishedAt: p.currentVersion.publishedAt.toISOString(),
        }
      : null,
    displayName: p.displayName,
    title: p.title,
    avatar: p.avatar,
    expertise: p.expertise,
    tone: p.tone,
    isUserCreated: p.isUserCreated,
    archivedAt: p.archivedAt?.toISOString() ?? null,
    ownerId: p.ownerId,
  };
}
