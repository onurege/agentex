"use client";

// ============================================================
// AIExplainPopover — "Bu ne demek?" mini asistan
// ============================================================
//
// aiSuggestable=true soruların yanında Sparkles butonu.
// Tıklandığında Gemini'den 2-3 cümlelik hukuki bağlam
// açıklaması çeker ve inline kart olarak gösterir.
// ============================================================

import { useCallback, useState } from "react";
import { HelpCircle, Loader2, Sparkles, X } from "lucide-react";
import type { TemplateId } from "@/lib/draft/types";

interface AIExplainPopoverProps {
  templateId: TemplateId;
  questionId: string;
}

type Status = "idle" | "loading" | "ready" | "error";

export function AIExplainPopover({
  templateId,
  questionId,
}: AIExplainPopoverProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchExplanation = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setExplanation(null);
    try {
      const res = await fetch("/api/draft/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, questionId }),
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
      const data = (await res.json()) as { explanation: string };
      setExplanation(data.explanation);
      setStatus("ready");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Açıklama alınamadı.",
      );
      setStatus("error");
    }
  }, [templateId, questionId]);

  const handleClose = useCallback(() => {
    setStatus("idle");
    setExplanation(null);
    setError(null);
  }, []);

  if (status === "idle") {
    return (
      <button
        type="button"
        onClick={fetchExplanation}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-accent-info hover:bg-accent-info/10 transition-colors"
      >
        <HelpCircle size={11} />
        Bu ne demek?
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-accent-info/25 bg-accent-info/[0.05] p-3">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-widest text-accent-info">
          <Sparkles size={11} />
          AI Açıklaması
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Kapat"
          className="p-0.5 rounded text-text-muted hover:text-text-primary hover:bg-workspace-elevated transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 size={14} className="animate-spin" />
          Hukuki bağlam yükleniyor…
        </div>
      )}

      {status === "error" && (
        <div className="space-y-2">
          <p className="text-sm text-accent-danger">{error}</p>
          <button
            type="button"
            onClick={fetchExplanation}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-workspace-surface border border-workspace-border hover:border-accent-info/30 text-text-secondary hover:text-text-primary transition-colors"
          >
            Tekrar dene
          </button>
        </div>
      )}

      {status === "ready" && explanation && (
        <p className="text-sm text-text-secondary leading-relaxed">
          {explanation}
        </p>
      )}
    </div>
  );
}
