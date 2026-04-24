"use client";

// ============================================================
// ClauseToggle — Opsiyonel madde aç/kapa
// ============================================================
//
// Kullanıcı KVKK / tersine mühendislik gibi defaultEnabled=true
// opsiyonel maddeleri kapatmak isterse bu kontrol devreye girer.
// Gate'li opsiyonel maddeler (hasPenalty, hasNonCompete) wizard
// cevaplarından türediği için burada gösterilmez; bunun yerine
// wizard adımında toggle edilir.
// ============================================================

import type { ClauseTemplate } from "@/lib/draft/types";

interface ClauseToggleProps {
  clause: ClauseTemplate;
  enabled: boolean;
  onChange(enabled: boolean): void;
}

export function ClauseToggle({ clause, enabled, onChange }: ClauseToggleProps) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        enabled
          ? "border-accent-primary/30 bg-accent-primary/[0.04]"
          : "border-workspace-border bg-workspace-elevated"
      }`}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-accent-primary h-4 w-4 shrink-0"
      />
      <div className="min-w-0">
        <div
          className={`text-sm font-medium ${
            enabled ? "text-text-primary" : "text-text-secondary"
          }`}
        >
          {clause.title}
        </div>
        <div className="text-xs text-text-tertiary mt-0.5 font-mono">
          {clause.number}
        </div>
      </div>
    </label>
  );
}
