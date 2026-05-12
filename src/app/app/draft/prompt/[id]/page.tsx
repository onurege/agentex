"use client";

// /app/draft/prompt/[id] — chat (sol ~%18) + editable preview (sağ).
// AppShell header'ı altında full-height iki-pane layout.

import { useCallback, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Save, SquarePlus } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { PromptChatPanel } from "@/components/draft-prompt/PromptChatPanel";
import { PromptDraftPreview } from "@/components/draft-prompt/PromptDraftPreview";
import { useDraftPromptStore } from "@/lib/draft-prompt/store";
import { useHydrated } from "@/lib/draft/use-hydrated";
import type {
  PromptChatMessage,
  PromptDraftAIResult,
} from "@/lib/draft-prompt/types";

function newMessageId(): string {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function PromptDraftDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useDraftPromptStore((s) => s.getSession(params.id));
  const appendMessage = useDraftPromptStore((s) => s.appendMessage);
  const setStatus = useDraftPromptStore((s) => s.setStatus);
  const applyAIResult = useDraftPromptStore((s) => s.applyAIResult);
  const markSaved = useDraftPromptStore((s) => s.markSaved);
  const createSession = useDraftPromptStore((s) => s.createSession);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveToServer = useCallback(async () => {
    if (!session?.draft) {
      throw new Error("Kayıt edilecek taslak yok.");
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      const res = await fetch("/api/draft/prompt/saved", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: session.serverId ?? undefined,
          document: session.draft,
          messages: session.messages,
        }),
      });
      if (!res.ok) {
        let msg = `Kayıt başarısız (HTTP ${res.status})`;
        try {
          const body = (await res.json()) as { message?: string };
          if (body?.message) msg = body.message;
        } catch {
          // non-json
        }
        throw new Error(msg);
      }
      const data = (await res.json()) as { id: string; updatedAt: string };
      markSaved(session.id, data.id, data.updatedAt);
      setSaveState("idle");
      return data.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kayıt başarısız.";
      setSaveState("error");
      setSaveError(message);
      throw err;
    }
  }, [session, markSaved]);

  const handleSaveAndReturn = useCallback(async () => {
    try {
      await saveToServer();
      router.push("/app/draft");
    } catch {
      // saveToServer already set error state
    }
  }, [saveToServer, router]);

  const handleSaveAndNew = useCallback(async () => {
    try {
      await saveToServer();
      const newId = createSession();
      router.replace(`/app/draft/prompt/${newId}`);
    } catch {
      // already shown
    }
  }, [saveToServer, createSession, router]);

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!session) return;
      const userMessage: PromptChatMessage = {
        id: newMessageId(),
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      appendMessage(session.id, userMessage);
      setStatus(session.id, "generating");

      try {
        const res = await fetch("/api/draft/prompt", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...session.messages, userMessage],
            currentDraft: session.draft,
          }),
        });
        if (!res.ok) {
          let msg = `Sunucu hatası (${res.status})`;
          try {
            const body = (await res.json()) as { message?: string };
            if (body?.message) msg = body.message;
          } catch {
            // non-json
          }
          throw new Error(msg);
        }
        const data = (await res.json()) as PromptDraftAIResult;
        const assistantMessage: PromptChatMessage = {
          id: newMessageId(),
          role: "assistant",
          content: data.assistantMessage,
          createdAt: new Date().toISOString(),
        };
        applyAIResult(session.id, assistantMessage, data.draft);
      } catch (err) {
        const message = err instanceof Error ? err.message : "AI'ya ulaşılamadı.";
        setStatus(session.id, "error", message);
      }
    },
    [session, appendMessage, setStatus, applyAIResult],
  );

  if (!hydrated) {
    return (
      <AppShell activePath="/app/draft">
        <div className="px-12 py-16 flex items-center justify-center gap-2 text-text-tertiary">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Yükleniyor…</span>
        </div>
      </AppShell>
    );
  }

  if (!session) {
    notFound();
  }

  const isBusy = session.status === "generating";

  return (
    <AppShell activePath="/app/draft">
      <div className="lg:h-[calc(100vh-5rem)] lg:flex lg:overflow-hidden">
        <aside className="lg:w-[18%] lg:min-w-[280px] lg:max-w-[360px] w-full h-[40vh] lg:h-full">
          <div className="h-full flex flex-col">
            <div className="px-3 pt-3">
              <Link
                href="/app/draft"
                className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary transition-colors"
              >
                <ArrowLeft size={12} />
                Sıfırdan Sözleşmeye dön
              </Link>
            </div>
            <div className="flex-1 mt-2 min-h-0">
              <PromptChatPanel
                session={session}
                onSubmit={handleSubmit}
                disabled={isBusy}
              />
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 h-[calc(100vh-5rem-40vh)] lg:h-full bg-workspace-bg">
          <PromptDraftPreview
            session={session}
            toolbarExtras={
              session.draft ? (
                <SaveButtons
                  saveState={saveState}
                  saveError={saveError}
                  hasDraft={!!session.draft}
                  isDirtyAfterSave={
                    Boolean(session.savedAt) &&
                    session.updatedAt > (session.savedAt ?? "")
                  }
                  savedAt={session.savedAt}
                  onSaveAndReturn={handleSaveAndReturn}
                  onSaveAndNew={handleSaveAndNew}
                />
              ) : null
            }
          />
        </main>
      </div>
    </AppShell>
  );
}

interface SaveButtonsProps {
  saveState: "idle" | "saving" | "error";
  saveError: string | null;
  hasDraft: boolean;
  isDirtyAfterSave: boolean;
  savedAt: string | null;
  onSaveAndReturn: () => void | Promise<void>;
  onSaveAndNew: () => void | Promise<void>;
}

function SaveButtons({
  saveState,
  saveError,
  hasDraft,
  isDirtyAfterSave,
  savedAt,
  onSaveAndReturn,
  onSaveAndNew,
}: SaveButtonsProps) {
  if (!hasDraft) return null;
  const busy = saveState === "saving";
  return (
    <div className="flex items-center gap-2">
      {saveState === "error" && saveError && (
        <span className="text-xs text-accent-danger truncate max-w-[180px]" title={saveError}>
          {saveError}
        </span>
      )}
      {savedAt && !isDirtyAfterSave && saveState !== "saving" && (
        <span className="inline-flex items-center gap-1 text-[11px] text-text-tertiary">
          <Check size={11} className="text-accent-success" />
          Kaydedildi
        </span>
      )}
      <button
        type="button"
        onClick={() => void onSaveAndReturn()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-workspace-surface border border-workspace-border text-text-primary hover:border-accent-primary/40 hover:bg-accent-primary/[0.04] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Kaydet ve Dön
      </button>
      <button
        type="button"
        onClick={() => void onSaveAndNew()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-workspace-surface border border-workspace-border text-text-primary hover:border-accent-primary/40 hover:bg-accent-primary/[0.04] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <SquarePlus size={14} />}
        Kaydet ve Yeni
      </button>
    </div>
  );
}
