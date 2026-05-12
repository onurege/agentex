"use client";

// Kayıtlı prompt taslağı görüntüleme — sahibi düzenleyip
// "Devam Et"e basarak local oturuma çekebilir, grup üyesi sadece
// okuyabilir. URL: /app/draft/prompt/saved/[id]

import { useCallback, useEffect, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, PenLine, Users } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { PromptDraftPreview } from "@/components/draft-prompt/PromptDraftPreview";
import { useDraftPromptStore } from "@/lib/draft-prompt/store";
import type {
  PromptChatMessage,
  PromptDraftDocument,
  PromptDraftSession,
} from "@/lib/draft-prompt/types";

interface SavedDetailResponse {
  id: string;
  title: string;
  document: PromptDraftDocument;
  messages: PromptChatMessage[];
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
  ownerName: string;
}

export default function SavedPromptDraftPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const hydrateFromServer = useDraftPromptStore((s) => s.hydrateFromServer);

  const [data, setData] = useState<SavedDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/draft/prompt/saved/${params.id}`, {
          credentials: "same-origin",
        });
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) setError("Kayıt bulunamadı.");
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const body = (await res.json()) as SavedDetailResponse;
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Yüklenemedi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  // Sahibi "Devam Et" derse → local store'a çek, /app/draft/prompt/[id]'e git.
  const handleContinueEditing = useCallback(() => {
    if (!data) return;
    const localId = `dpr_srv_${data.id}`;
    const session: PromptDraftSession = {
      id: localId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      label: data.title,
      messages: data.messages,
      draft: data.document,
      status: "ready",
      errorMessage: null,
      serverId: data.id,
      savedAt: data.updatedAt,
    };
    hydrateFromServer(session);
    router.push(`/app/draft/prompt/${localId}`);
  }, [data, hydrateFromServer, router]);

  if (loading) {
    return (
      <AppShell activePath="/app/draft">
        <div className="px-12 py-16 flex items-center justify-center gap-2 text-text-tertiary">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Yükleniyor…</span>
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    if (error === "Kayıt bulunamadı.") {
      notFound();
    }
    return (
      <AppShell activePath="/app/draft">
        <div className="px-12 py-16 text-center">
          <p className="text-sm text-accent-danger">{error}</p>
        </div>
      </AppShell>
    );
  }

  // Read-only preview için sentetik bir session objesi —
  // PromptDraftPreview store mutations çağırmayacak çünkü readOnly=true.
  const previewSession: PromptDraftSession = {
    id: `srv_${data.id}`,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    label: data.title,
    messages: data.messages,
    draft: data.document,
    status: "ready",
    errorMessage: null,
    serverId: data.id,
    savedAt: data.updatedAt,
  };

  return (
    <AppShell activePath="/app/draft">
      <div className="lg:h-[calc(100vh-5rem)] lg:flex lg:flex-col">
        <div className="flex items-center justify-between px-6 py-3 border-b border-workspace-border/60 bg-workspace-surface/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Link
              href="/app/draft"
              className="inline-flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-primary transition-colors"
            >
              <ArrowLeft size={14} />
              Sıfırdan Sözleşmeye dön
            </Link>
            <span className="h-4 w-px bg-workspace-border" />
            <span className="text-sm text-text-secondary truncate max-w-md" title={data.title}>
              {data.title}
            </span>
            {!data.isOwner && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border border-workspace-border bg-workspace-elevated text-text-secondary"
                title={`Sahibi: ${data.ownerName}`}
              >
                <Users size={11} />
                Grup · {data.ownerName}
              </span>
            )}
          </div>
          {data.isOwner && (
            <button
              type="button"
              onClick={handleContinueEditing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-workspace-surface border border-accent-primary/40 text-accent-primary hover:bg-accent-primary/[0.06] transition-colors"
            >
              <PenLine size={14} />
              Düzenlemeye Devam Et
            </button>
          )}
        </div>

        <main className="flex-1 min-w-0 bg-workspace-bg">
          <PromptDraftPreview session={previewSession} readOnly />
        </main>
      </div>
    </AppShell>
  );
}
