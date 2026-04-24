"use client";

// ============================================================
// WarningBanner — Şablon uyarıları
// ============================================================
//
// evaluateWarnings çıktısını ciddiyet renklerine göre listeler.
// "warn" → amber, "info" → mavi. Her uyarı mesaj satırı + opsiyonel
// id font'lu ufak etiket içerir.
// ============================================================

import { AlertTriangle, Info } from "lucide-react";
import type { TemplateWarning } from "@/lib/draft/types";

interface WarningBannerProps {
  warnings: TemplateWarning[];
}

export function WarningBanner({ warnings }: WarningBannerProps) {
  if (warnings.length === 0) return null;

  return (
    <ul className="space-y-2">
      {warnings.map((w) => {
        const isWarn = w.severity === "warn";
        const Icon = isWarn ? AlertTriangle : Info;
        const styles = isWarn
          ? "border-accent-warning/30 bg-accent-warning/[0.06] text-text-secondary"
          : "border-accent-info/25 bg-accent-info/[0.05] text-text-secondary";
        const iconColor = isWarn ? "text-accent-warning" : "text-accent-info";
        return (
          <li
            key={w.id}
            className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm ${styles}`}
          >
            <Icon size={15} className={`mt-0.5 shrink-0 ${iconColor}`} />
            <p className="leading-relaxed">{w.message}</p>
          </li>
        );
      })}
    </ul>
  );
}
