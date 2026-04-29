import { NextResponse } from "next/server";
import { BOARDROOM_AGENTS } from "@/lib/boardroom-agents";
import { prisma } from "@/lib/prisma";
import {
  badRequest,
  forbidden,
  getAuthUser,
  unauthorized,
} from "@/lib/api-auth";
import type { AgentProfileDTO } from "@/lib/persistence/types";
import { profileToDTO } from "./mapping";

// Slugs the user can't claim — collides with built-in system agents
// or the chief coordinator. Custom-agent create rejects these.
const RESERVED_IDS = new Set<string>([
  "chief-agent",
  ...BOARDROOM_AGENTS.map((a) => a.id),
]);

const VALID_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_EXPERTISE = 8;

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  // Return profiles that are either globally owned (system tweaks)
  // or owned by the requesting user. Filter lets the client see
  // their custom agents + baseline tweaks without leaking others'.
  const profiles = await prisma.agentProfile.findMany({
    where: {
      deletedAt: null,
      OR: [{ ownerId: null }, { ownerId: user.id }],
    },
    include: { currentVersion: true },
    orderBy: { agentKey: "asc" },
  });

  const result: AgentProfileDTO[] = profiles.map(profileToDTO);
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const agentKey =
    typeof body.agentKey === "string" ? body.agentKey.trim() : "";
  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const avatar = typeof body.avatar === "string" ? body.avatar.trim() : "";
  const tone =
    typeof body.tone === "string" && body.tone.trim().length > 0
      ? body.tone.trim()
      : null;
  const expertise = Array.isArray(body.expertise)
    ? (body.expertise as unknown[])
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter((x) => x.length > 0)
        .slice(0, MAX_EXPERTISE)
    : [];

  if (!displayName || !title || !avatar || expertise.length === 0) {
    return badRequest("missing_fields");
  }
  if (!VALID_ID_RE.test(agentKey)) {
    return badRequest("invalid_id");
  }
  if (RESERVED_IDS.has(agentKey)) {
    return badRequest("id_taken");
  }

  // Collision against either a global tweak row (null owner) or
  // another user's custom agent with the same key is allowed by the
  // schema's composite unique — but we reject against the caller's
  // own rows + any user-created duplicate to keep the panel honest.
  const clash = await prisma.agentProfile.findFirst({
    where: {
      agentKey,
      OR: [{ ownerId: user.id }, { isUserCreated: true }],
    },
    select: { id: true },
  });
  if (clash) return badRequest("id_taken");

  const profile = await prisma.agentProfile.create({
    data: {
      agentKey,
      ownerId: user.id,
      displayName,
      title,
      avatar,
      expertise,
      tone,
      isUserCreated: true,
    },
    include: { currentVersion: true },
  });

  // Audit trail mirrors the client-side saveAuditEvent calls for
  // other panel mutations.
  await prisma.auditLog.create({
    data: {
      action: "agent_created",
      targetType: "agent",
      targetId: agentKey,
      summary: `Özel ajan "${displayName}" oluşturuldu`,
      module: "control_room",
      severity: "info",
      metadata: { title, expertise, tone },
      actorId: user.id,
    },
  });

  // Ownership of the created row is already scoped to this user.
  if (profile.ownerId !== user.id) return forbidden();

  return NextResponse.json(profileToDTO(profile), { status: 201 });
}
