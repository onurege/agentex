"use client";

import { useBoardroomFlowStore } from "@/lib/boardroom-flow-store";

export function ContextNotesInput() {
  const contextNotes = useBoardroomFlowStore((s) => s.contextNotes);
  const setContextNotes = useBoardroomFlowStore((s) => s.setContextNotes);

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold text-text-primary mb-3">
        Bağlam Notu
        <span className="text-text-muted font-normal text-sm ml-2">
          opsiyonel
        </span>
      </h2>
      <textarea
        value={contextNotes}
        onChange={(e) => setContextNotes(e.target.value)}
        placeholder="Örnek: Bu sözleşme tedarikçi ile yenilenecek..."
        className="w-full flex-1 rounded-xl bg-workspace-surface border border-workspace-border
                   text-text-primary placeholder:text-text-muted
                   text-base p-3 min-h-[120px] resize-none leading-relaxed
                   focus:outline-none focus:border-accent-primary/40 focus:ring-1 focus:ring-accent-primary/20
                   transition-colors duration-150"
      />
      {contextNotes.length > 0 && (
        <p className="text-[13px] text-text-muted mt-2 text-right">
          {contextNotes.length} karakter
        </p>
      )}
    </div>
  );
}
