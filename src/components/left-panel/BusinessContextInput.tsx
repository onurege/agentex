"use client";

import { useState } from "react";
import { useWorkspaceStore } from "@/lib/store";
import { X } from "lucide-react";

export function BusinessContextInput() {
  const businessContext = useWorkspaceStore((s) => s.job.businessContext);
  const setBusinessContext = useWorkspaceStore((s) => s.setBusinessContext);
  const status = useWorkspaceStore((s) => s.job.status);
  const isDisabled = status === "running" || status === "complete";
  const [inputValue, setInputValue] = useState("");

  const addNote = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setBusinessContext({
      ...businessContext,
      notes: [...businessContext.notes, trimmed],
    });
    setInputValue("");
  };

  const removeNote = (index: number) => {
    setBusinessContext({
      ...businessContext,
      notes: businessContext.notes.filter((_, i) => i !== index),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addNote();
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-2xs font-mono text-text-tertiary uppercase tracking-wider">
        💬 İŞ BAĞLAMI
      </label>

      {/* Notlar — sticky note görünümü */}
      {businessContext.notes.length > 0 && (
        <div className="space-y-1">
          {businessContext.notes.map((note, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 px-2 py-1.5 bg-accent-primary/8 border border-accent-primary/20 rounded-md group"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
            >
              <span className="text-2xs text-accent-primary/50 font-mono flex-shrink-0 mt-0.5">
                {String(i + 1).padStart(2, '0')}.
              </span>
              <span className="flex-1 text-xs font-mono text-text-secondary leading-relaxed">
                {note}
              </span>
              {!isDisabled && (
                <button
                  onClick={() => removeNote(i)}
                  className="p-0.5 text-text-muted hover:text-accent-danger opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 mt-0.5"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Giriş alanı — terminal tarzı */}
      {!isDisabled && (
        <div
          className="flex items-center gap-1.5 bg-workspace-elevated border border-workspace-border rounded-md focus-within:border-accent-primary/40 transition-colors"
        >
          <span className="pl-2 text-accent-primary/50 font-mono text-xs flex-shrink-0">›</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="not ekle..."
            className="flex-1 px-1.5 py-1.5 bg-transparent text-xs font-mono text-text-primary placeholder-text-muted focus:outline-none"
          />
          <button
            onClick={addNote}
            disabled={!inputValue.trim()}
            className="px-2 py-1.5 text-2xs font-mono text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 border-l border-workspace-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            EKLE
          </button>
        </div>
      )}
    </div>
  );
}
