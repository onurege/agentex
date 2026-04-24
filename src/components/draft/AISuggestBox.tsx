"use client";

// ============================================================
// AISuggestBox — Madde başına AI önerisi paneli
// ============================================================
//
// aiEditable maddelerin yanında Sparkles butonu gösterir.
// Tıklandığında /api/draft/suggest'i çağırır, dönen öneriyi
// paragraf halinde gösterir ve "Kabul et" → store.acceptAISuggestion
// ile override yazılır; renderer bu override'ı doğrudan kullanır.
// Kabul edilmiş bir clause için "AI önerisi geri al" seçeneği
// aiAccepted haritasından siler.
// ============================================================

import { useCallback, useState } from "react";
import { Check, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import type { DraftSession, TemplateId } from "@/lib/draft/types";
import { useDraftStore } from "@/lib/draft/store";

interface AISuggestBoxProps {
  templateId: TemplateId;
  clauseId: string;
  clauseTitle: string;
  session: DraftSession;
}

interface Suggestion {
  text: string;
  rationale: string;
}

export function AISuggestBox({
  templateId,
  clauseId,
  clauseTitle,
  session,
}: AISuggestBoxProps) {
  const acceptAISuggestion = useDraftStore((s) => s.acceptAISuggestion);
  const overridden = Boolean(session.aiAccepted[clauseId]);

  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestSuggestion = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setSuggestion(null);
    try {
      const res = await fetch("/api/draft/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          clauseId,
          answers: session.answers,
          aiAccepted: session.aiAccepted,
          disabledClauses: session.disabledClauses,
        }),
      });
      if (!res.ok) {
        let msg = `Sunucu hatası (${res.status})`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) msg = body.error;
        } catch {
          // non-JSON — fall through
        }
        throw new Error(msg);
      }
      const data = (await res.json()) as {
        suggestedText: string;
        rationale: string;
      };
      setSuggestion({ text: data.suggestedText, rationale: data.rationale });
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Öneri üretilemedi.");
      setStatus("error");
    }
  }, [
    templateId,
    clauseId,
    session.answers,
    session.aiAccepted,
    session.disabledClauses,
  ]);

  const handleAccept = useCallback(() => {
    if (!suggestion) return;
    acceptAISuggestion(session.id, clauseId, suggestion.text);
    setStatus("idle");
    setSuggestion(null);
  }, [acceptAISuggestion, session.id, clauseId, suggestion]);

  const handleReject = useCallback(() => {
    setStatus("idle");
    setSuggestion(null);
    setError(null);
  }, []);

  const handleRevert = useCallback(() => {
    // acceptAISuggestion yerine doğrudan store state'ine eriş — silme.
    useDraftStore.setState((s) => {
      const current = s.sessions[session.id];
      if (!current) return s;
      const next = { ...current.aiAccepted };
      delete next[clauseId];
      return {
        ...s,
        sessions: {
          ...s.sessions,
          [session.id]: {
            ...current,
            aiAccepted: next,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  }, [session.id, clauseId]);

  if (status === "idle" && !overridden) {
    return (
      <button
        type="button"
        onClick={requestSuggestion}
        aria-label={`${clauseTitle} için AI önerisi al`}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-accent-primary hover:bg-accent-primary/10 transition-colors"
      >
        <Sparkles size={11} />
        AI önerisi
      </button>
    );
  }

  if (status === "idle" && overridden) {
    return (
      <button
        type="button"
        onClick={handleRevert}
        aria-label="AI önerisini geri al"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-accent-info hover:bg-accent-info/10 transition-colors"
      >
        <RotateCcw size={11} />
        AI önerisini kaldır
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-accent-primary/25 bg-accent-primary/[0.04] p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-widest text-accent-primary mb-2">
        <Sparkles size={12} />
        AI Önerisi
      </div>

      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 size={14} className="animate-spin" />
          Hukuki bağlamla yeniden yazılıyor…
        </div>
      )}

      {status === "error" && (
        <div className="space-y-2">
          <p className="text-sm text-accent-danger">{error}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={requestSuggestion}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-workspace-surface border border-workspace-border hover:border-accent-primary/30 text-text-secondary hover:text-text-primary transition-colors"
            >
              Tekrar dene
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-text-tertiary hover:text-text-primary transition-colors"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {status === "ready" && suggestion && (
        <div className="space-y-2">
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
            {suggestion.text}
          </p>
          <p className="text-xs text-text-tertiary italic">
            {suggestion.rationale}
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleAccept}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-accent-primary text-workspace-surface hover:bg-accent-secondary transition-colors"
            >
              <Check size={12} />
              Kabul et
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-workspace-surface border border-workspace-border text-text-secondary hover:text-text-primary transition-colors"
            >
              <X size={12} />
              Reddet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
