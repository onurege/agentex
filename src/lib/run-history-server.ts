// Server-only helpers for persisting BoardroomRunSnapshot → DB.
// Shared between /api/runs (POST) and /api/runs/bulk-import.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BOARDROOM_AGENTS } from "@/lib/boardroom-agents";
import type { FrozenAgentSnapshot } from "@/lib/run-history";

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const SYSTEM_AGENT_KEYS = new Set(["chief-agent", ...BOARDROOM_AGENTS.map((a) => a.id)]);

function buildCvSnapshot(s: FrozenAgentSnapshot): Prisma.InputJsonValue {
  return {
    name: s.name,
    shortName: s.shortName,
    title: s.title,
    avatar: s.avatar,
    seniority: "Kıdemli",
    expertise: s.expertise.join(", "),
    industryExperience: "",
    riskFocus: s.riskFocus,
    principles: s.thinkingStyle,
    tone: s.tone,
  } as Prisma.InputJsonValue;
}

// Persists every agent snapshot in `snapshots` under `userId`'s profiles,
// creating any missing profiles and a fresh AgentVersion row per snapshot.
// Returns versionId mapped by agentKey so callers can wire RunAgentSnapshot.
//
// Profile lookups are batched (single findMany + single createMany for
// missing ones) to avoid N round-trips per run.
export async function persistRunAgentVersions(
  tx: TransactionClient,
  userId: string,
  snapshots: readonly FrozenAgentSnapshot[],
): Promise<Map<string, string>> {
  const versionByKey = new Map<string, string>();
  if (snapshots.length === 0) return versionByKey;

  const agentKeys = snapshots.map((s) => s.id);
  const existing = await tx.agentProfile.findMany({
    where: { agentKey: { in: agentKeys }, ownerId: userId },
    select: { id: true, agentKey: true },
  });
  const profileByKey = new Map(existing.map((p) => [p.agentKey, p.id]));

  const missing = snapshots.filter((s) => !profileByKey.has(s.id));
  for (const s of missing) {
    const created = await tx.agentProfile.create({
      data: {
        agentKey: s.id,
        ownerId: userId,
        displayName: s.name,
        title: s.title,
        avatar: s.avatar,
        expertise: s.expertise,
        tone: s.tone,
        isUserCreated: !SYSTEM_AGENT_KEYS.has(s.id),
      },
      select: { id: true, agentKey: true },
    });
    profileByKey.set(created.agentKey, created.id);
  }

  const profileIds = Array.from(profileByKey.values());
  const maxVersions = await tx.agentVersion.groupBy({
    by: ["profileId"],
    where: { profileId: { in: profileIds } },
    _max: { version: true },
  });
  const maxByProfile = new Map<string, number>(
    maxVersions.map((row) => [row.profileId, row._max.version ?? 0]),
  );

  for (const s of snapshots) {
    const profileId = profileByKey.get(s.id);
    if (!profileId) continue;
    const nextVersion = (maxByProfile.get(profileId) ?? 0) + 1;
    maxByProfile.set(profileId, nextVersion);

    const version = await tx.agentVersion.create({
      data: {
        profileId,
        version: nextVersion,
        cvSnapshot: buildCvSnapshot(s),
        systemPrompt: s.promptSnapshot?.systemPrompt ?? null,
        rolePrompt: s.promptSnapshot?.rolePrompt ?? null,
        outputRules: s.promptSnapshot?.outputRules ?? null,
        guardrails: s.promptSnapshot?.guardrails ?? null,
      },
      select: { id: true },
    });
    versionByKey.set(s.id, version.id);
  }

  return versionByKey;
}
