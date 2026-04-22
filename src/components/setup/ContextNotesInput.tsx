"use client";

import { useBoardroomFlowStore } from "@/lib/boardroom-flow-store";

export function ContextNotesInput() {
  const contextNotes = useBoardroomFlowStore((s) => s.contextNotes);
  const setContextNotes = useBoardroomFlowStore((s) => s.setContextNotes);

  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary mb-2">
        Bağlam Notu
      </h2>
      <p className="text-base text-text-secondary mb-4">
        Kurula bu belge hakkında bağlam verin. İsteğe bağlı, ama değerlendirme kalitesini artırır.
      </p>
      <textarea
        value={contextNotes}
        onChange={(e) => setContextNotes(e.target.value)}
        placeholder="Örnek: Bu sözleşme tedarikçi ile yenilenecek. Fiyat artışı maddesi ve sorumluluk sınırı özellikle önemli..."
        className="w-full rounded-xl bg-workspace-surface border border-workspace-border
                   text-text-primary placeholder:text-text-muted
                   text-base p-4 min-h-[140px] resize-none leading-relaxed
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
