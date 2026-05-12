"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import type { PromptDraftSession } from "@/lib/draft-prompt/types";

interface Props {
  session: PromptDraftSession;
  onSubmit: (text: string) => Promise<void>;
  disabled: boolean;
}

const EXAMPLE_PROMPTS = [
  "Bir yazılım geliştirme hizmeti için freelancer ile sözleşme. Bedel 50.000 TL, 3 ay süreli, fikri mülkiyet bende kalsın.",
  "Bir iş ortaklığı için karşılıklı gizlilik sözleşmesi (NDA), 2 yıl süreli, ihlal halinde 100.000 TL cezai şart.",
  "Tek satıcılı bayilik sözleşmesi, İstanbul bölgesi, 1 yıl, rekabet yasağı ile.",
];

export function PromptChatPanel({ session, onSubmit, disabled }: Props) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [session.messages.length, session.status]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    setText("");
    await onSubmit(trimmed);
    inputRef.current?.focus();
  }, [text, disabled, onSubmit]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const isEmpty = session.messages.length === 0;

  return (
    <div className="flex flex-col h-full bg-workspace-surface border-r border-workspace-border">
      <div className="px-4 py-3 border-b border-workspace-border/60">
        <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-accent-primary">
          <Sparkles size={12} />
          Prompt ile sözleşme
        </div>
        <div className="text-xs text-text-tertiary mt-0.5 truncate" title={session.label}>
          {session.label}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-sm"
      >
        {isEmpty && (
          <div className="text-xs text-text-tertiary leading-relaxed">
            <p className="mb-2">
              Sözleşmenizi doğal dilde tarif edin — taraflar, konu, süre, bedel,
              özel istekler. AI taslağı sağda canlı oluşturur.
            </p>
            <div className="space-y-1.5 mt-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                Örnek başlangıçlar
              </div>
              {EXAMPLE_PROMPTS.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setText(ex)}
                  className="block w-full text-left text-[12px] leading-snug px-2.5 py-2 rounded-md bg-workspace-elevated/60 border border-workspace-border hover:border-accent-primary/40 hover:bg-accent-primary/[0.04] transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {session.messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-auto max-w-[92%] px-3 py-2 rounded-lg bg-accent-primary text-white text-[13px] leading-snug whitespace-pre-wrap break-words"
                : "max-w-[95%] px-3 py-2 rounded-lg bg-workspace-elevated border border-workspace-border text-[13px] leading-snug whitespace-pre-wrap break-words text-text-primary"
            }
          >
            {m.content}
          </div>
        ))}

        {session.status === "generating" && (
          <div className="inline-flex items-center gap-2 text-xs text-text-tertiary">
            <Loader2 size={12} className="animate-spin" />
            Taslak hazırlanıyor…
          </div>
        )}

        {session.status === "error" && session.errorMessage && (
          <div className="text-xs text-accent-danger bg-accent-danger/10 border border-accent-danger/25 rounded-md px-3 py-2">
            {session.errorMessage}
          </div>
        )}
      </div>

      <div className="border-t border-workspace-border/60 p-3">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            placeholder={
              isEmpty ? "Sözleşmenizi tarif edin…" : "Değişiklik isteğinizi yazın…"
            }
            disabled={disabled}
            className="w-full resize-none rounded-lg border border-workspace-border bg-workspace-bg px-3 py-2 pr-10 text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={disabled || !text.trim()}
            className="absolute right-2 bottom-2 inline-flex items-center justify-center w-8 h-8 rounded-md bg-accent-primary text-white hover:bg-accent-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Gönder"
          >
            {disabled ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        <p className="text-[10px] text-text-tertiary mt-1.5">
          Enter ile gönder · Shift+Enter ile yeni satır
        </p>
      </div>
    </div>
  );
}
