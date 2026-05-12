// ============================================================
// POST /api/draft/prompt
// ============================================================
//
// Prompt-driven taslak oluşturma / iyileştirme endpoint'i.
// Stateless: tüm konuşma geçmişi + mevcut taslak client'tan
// gelir, server sadece AI'a iletip JSON döndürür. Persistence
// client tarafındaki Zustand store'da (consulera_draft_prompt
// namespace, localStorage).
//
// Body:
//   {
//     messages: PromptChatMessage[],   // son eleman kullanıcının yeni isteği
//     currentDraft: PromptDraftDocument | null
//   }
//
// Response:
//   { assistantMessage: string, draft: PromptDraftDocument }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { badRequest, getAuthUser, unauthorized } from "@/lib/api-auth";
import {
  PromptGenerateError,
  generateOrRefineDraft,
} from "@/lib/draft-prompt/ai-generate";
import type {
  PromptChatMessage,
  PromptDraftDocument,
} from "@/lib/draft-prompt/types";
import { createRequestId, logAuditEvent } from "@/lib/server-audit";

export const runtime = "nodejs";
export const maxDuration = 60;

interface PromptPayload {
  messages?: unknown;
  currentDraft?: unknown;
}

function isChatMessage(v: unknown): v is PromptChatMessage {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    (r.role === "user" || r.role === "assistant") &&
    typeof r.content === "string" &&
    typeof r.createdAt === "string"
  );
}

function isDraftDocument(v: unknown): v is PromptDraftDocument {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.title === "string" &&
    typeof r.preamble === "string" &&
    typeof r.closing === "string" &&
    Array.isArray(r.clauses)
  );
}

export async function POST(req: NextRequest) {
  const requestId = createRequestId("draft-prompt");
  const user = await getAuthUser();
  if (!user) return unauthorized();

  let payload: PromptPayload;
  try {
    payload = (await req.json()) as PromptPayload;
  } catch {
    return badRequest("Geçersiz JSON gövdesi.");
  }

  const messagesRaw = payload.messages;
  if (!Array.isArray(messagesRaw) || messagesRaw.length === 0) {
    return badRequest("Eksik alan: messages (en az bir kullanıcı mesajı).");
  }
  const messages = messagesRaw.filter(isChatMessage);
  if (messages.length === 0) {
    return badRequest("messages içinde geçerli mesaj yok.");
  }
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== "user") {
    return badRequest("Son mesaj kullanıcıya ait olmalı.");
  }

  const currentDraft = isDraftDocument(payload.currentDraft)
    ? payload.currentDraft
    : null;

  try {
    const result = await generateOrRefineDraft({ messages, currentDraft });
    await logAuditEvent({
      action: "draft_started",
      targetType: "document",
      targetId: null,
      summary: currentDraft
        ? `Prompt taslağı güncellendi: ${result.draft.title}`
        : `Prompt taslağı oluşturuldu: ${result.draft.title}`,
      module: "draft",
      severity: "info",
      metadata: {
        clauseCount: result.draft.clauses.length,
        messageCount: messages.length,
        hadExistingDraft: Boolean(currentDraft),
      },
      requestId,
      actorId: user.id,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof PromptGenerateError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Bilinmeyen hata";
    await logAuditEvent({
      action: "draft_started",
      targetType: "document",
      targetId: null,
      summary: `Prompt taslağı üretilemedi: ${message}`,
      module: "draft",
      severity: "error",
      metadata: {
        messageCount: messages.length,
        hadExistingDraft: Boolean(currentDraft),
        error: message,
      },
      requestId,
      actorId: user.id,
    });
    return NextResponse.json(
      { error: "ai_failed", message },
      { status: 502 },
    );
  }
}
