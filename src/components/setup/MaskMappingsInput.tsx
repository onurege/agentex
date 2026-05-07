"use client";

import { useState } from "react";
import { useBoardroomFlowStore } from "@/lib/boardroom-flow-store";

export function MaskMappingsInput() {
  const maskMappings = useBoardroomFlowStore((s) => s.maskMappings);
  const addMaskMapping = useBoardroomFlowStore((s) => s.addMaskMapping);
  const removeMaskMapping = useBoardroomFlowStore((s) => s.removeMaskMapping);
  const [draft, setDraft] = useState("");

  const submitDraft = () => {
    const v = draft.trim();
    if (v.length === 0) return;
    addMaskMapping(v);
    setDraft("");
  };

  return (
    <div>
      <h2 className="text-base font-semibold text-text-primary mb-1">
        Hassas Alan Maskeleme
        <span className="text-text-muted font-normal text-xs ml-2">
          opsiyonel
        </span>
      </h2>
      <p className="text-sm text-text-secondary mb-2">
        Şirket adı/VKN gibi hassas metinleri AI&apos;ya gönderilmeden önce maskele.
      </p>

      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitDraft();
            }
          }}
          placeholder="Örnek: Univera Bilgi Tek. A.Ş."
          className="flex-1 rounded-lg bg-workspace-surface border border-workspace-border
                     text-text-primary placeholder:text-text-muted
                     text-sm px-3 py-2
                     focus:outline-none focus:border-accent-primary/40 focus:ring-1 focus:ring-accent-primary/20
                     transition-colors duration-150"
        />
        <button
          type="button"
          onClick={submitDraft}
          disabled={draft.trim().length === 0}
          className="px-4 rounded-lg bg-accent-primary/10 text-accent-primary border border-accent-primary/30
                     font-medium text-sm hover:bg-accent-primary/20
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors duration-150"
        >
          Ekle
        </button>
      </div>

      {maskMappings.length > 0 && (
        <ul className="space-y-2">
          {maskMappings.map((m) => (
            <li
              key={m.alias}
              className="flex items-center gap-3 rounded-lg bg-workspace-surface border border-workspace-border px-3 py-2"
            >
              <span className="text-[13px] font-mono text-accent-primary shrink-0">
                {m.alias}
              </span>
              <span className="text-text-muted">←</span>
              <span className="text-[14px] text-text-primary truncate flex-1">
                {m.original}
              </span>
              <button
                type="button"
                onClick={() => removeMaskMapping(m.alias)}
                className="text-[13px] text-text-muted hover:text-accent-danger px-2 py-1 rounded transition-colors"
                aria-label={`${m.original} maskelemesini kaldır`}
              >
                Kaldır
              </button>
            </li>
          ))}
        </ul>
      )}

      {maskMappings.length > 0 && (
        <p className="text-[13px] text-text-muted mt-3">
          {maskMappings.length} alan maskelenecek. AI tüm bu değerleri
          aliasla görecek; verdict ekranında orijinal değerler geri gelir.
        </p>
      )}
    </div>
  );
}
