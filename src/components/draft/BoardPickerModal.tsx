"use client";

// ============================================================
// BoardPickerModal — Taslağı kurula gönderirken ajan seç
// ============================================================
//
// Draft wizard'ın son adımından açılır. Hazır ajan listesi +
// control-room'da oluşturulmuş custom ajanlar gösterilir; min 2
// seçim zorunlu. Confirm callback'i parent tarafına geçer ve
// seçilen id listesini döner.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { BOARDROOM_AGENTS } from "@/lib/boardroom-agents";
import { useControlRoomStore } from "@/lib/control-room-store";

interface BoardPickerModalProps {
  open: boolean;
  onClose(): void;
  onConfirm(agentIds: string[]): void;
  working?: boolean;
  error?: string | null;
}

export function BoardPickerModal({
  open,
  onClose,
  onConfirm,
  working = false,
  error = null,
}: BoardPickerModalProps) {
  const customAgents = useControlRoomStore((s) => s.customAgents);
  const [selected, setSelected] = useState<string[]>([]);

  // Modal açıldığında seçimi sıfırla.
  useEffect(() => {
    if (open) setSelected([]);
  }, [open]);

  // Esc kapatma.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !working) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, working, onClose]);

  const agents = useMemo(() => {
    const custom = Object.values(customAgents).map((a) => ({
      id: a.id,
      name: a.name,
      title: a.title,
      avatar: a.avatar,
      description: a.description,
      isCustom: true,
    }));
    const builtIns = BOARDROOM_AGENTS.map((a) => ({
      id: a.id,
      name: a.name,
      title: a.title,
      avatar: a.avatar,
      description: a.description,
      isCustom: false,
    }));
    return [...builtIns, ...custom];
  }, [customAgents]);

  if (!open) return null;

  const canConfirm = selected.length >= 2 && !working;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="board-picker-title"
      onClick={() => !working && onClose()}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-workspace-border bg-workspace-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-4 p-6 border-b border-workspace-border">
          <div>
            <h2
              id="board-picker-title"
              className="font-display text-xl font-bold text-text-primary"
            >
              Kurulu Seç
            </h2>
            <p className="text-sm text-text-secondary mt-1 leading-relaxed">
              Taslağı incelemek için en az 2 ajan seçin. Chief Agent tahkim
              için otomatik eklenir.
            </p>
          </div>
          <button
            type="button"
            disabled={working}
            onClick={onClose}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-workspace-elevated transition-colors disabled:opacity-40"
            aria-label="Kapat"
          >
            <X size={18} />
          </button>
        </header>

        {/* Agent list */}
        <ul className="flex-1 overflow-y-auto p-4 space-y-2">
          {agents.map((a) => {
            const checked = selected.includes(a.id);
            return (
              <li key={a.id}>
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    checked
                      ? "border-accent-primary bg-accent-primary/5"
                      : "border-workspace-border bg-workspace-elevated hover:border-accent-primary/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={working}
                    onChange={(e) => {
                      setSelected((prev) =>
                        e.target.checked
                          ? [...prev, a.id]
                          : prev.filter((id) => id !== a.id),
                      );
                    }}
                    className="mt-1 accent-accent-primary h-4 w-4 shrink-0"
                  />
                  <span className="text-2xl leading-none mt-0.5">{a.avatar}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-text-primary">
                        {a.name}
                      </span>
                      {a.isCustom && (
                        <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-info/10 text-accent-info border border-accent-info/20">
                          Özel
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-tertiary mt-0.5">
                      {a.title}
                    </div>
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed line-clamp-2">
                      {a.description}
                    </p>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-4 p-4 border-t border-workspace-border">
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-text-tertiary font-mono">
              {selected.length < 2
                ? `${2 - selected.length} ajan daha seçin`
                : `${selected.length} ajan seçildi`}
            </span>
            {error && (
              <span className="text-xs text-accent-danger mt-1 truncate max-w-[320px]">
                {error}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={working}
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-workspace-elevated transition-colors disabled:opacity-40"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => onConfirm(selected)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent-primary text-workspace-surface hover:bg-accent-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {working ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Gönderiliyor…
                </>
              ) : (
                "Kurula Gönder"
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
