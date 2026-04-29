"use client";

// ============================================================
// PrecheckResultCard
// ============================================================
//
// Sirkü + dilekçe karşılaştırması sonuç kartı. Kart her durumda
// görünür ve imza karşılaştırma akışını engellemez — sadece
// uyumsuzlukları belirgin şekilde işaretler. failed/warned/passed
// status'una göre üst banner rengi değişir; her bir check satırı
// kendi severity ikonuyla gelir.
// ============================================================

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import type {
  PrecheckCheck,
  PrecheckResult,
  PrecheckSeverity,
} from "@/lib/signatures/precheck/types";

interface Props {
  result: PrecheckResult;
}

const STATUS_PRESET = {
  passed: {
    icon: ShieldCheck,
    iconColor: "text-accent-success",
    border: "border-accent-success/30",
    bg: "bg-accent-success/[0.06]",
    title: "Şirket bilgileri tutuyor",
    subtitle:
      "Sirkü ile dilekçe arasında kritik uyumsuzluk yok; imza karşılaştırmasına geçebilirsiniz.",
  },
  warned: {
    icon: AlertTriangle,
    iconColor: "text-accent-warning",
    border: "border-accent-warning/30",
    bg: "bg-accent-warning/[0.06]",
    title: "Bazı uyarılar var",
    subtitle:
      "İmza karşılaştırmasına devam edebilirsiniz; aşağıdaki uyarıları gözden geçirin.",
  },
  failed: {
    icon: ShieldAlert,
    iconColor: "text-accent-danger",
    border: "border-accent-danger/30",
    bg: "bg-accent-danger/[0.08]",
    title: "Önemli uyumsuzluklar tespit edildi",
    subtitle:
      "İmza karşılaştırması açık tutuldu ama bu uyumsuzluklar dilekçenin geçerliliğini tartışmalı hale getirebilir.",
  },
} as const;

const SEVERITY_ICON: Record<
  PrecheckSeverity,
  { icon: typeof CheckCircle2; color: string }
> = {
  ok: { icon: CheckCircle2, color: "text-accent-success" },
  warning: { icon: AlertTriangle, color: "text-accent-warning" },
  critical: { icon: XCircle, color: "text-accent-danger" },
};

export function PrecheckResultCard({ result }: Props) {
  const preset = STATUS_PRESET[result.status];
  const StatusIcon = preset.icon;
  const [expanded, setExpanded] = useState(result.status !== "passed");

  return (
    <section
      className={`rounded-xl border ${preset.border} ${preset.bg} p-5 mb-6`}
      aria-live="polite"
    >
      <header className="flex items-start gap-3">
        <StatusIcon
          size={22}
          className={`${preset.iconColor} shrink-0 mt-0.5`}
        />
        <div className="flex-1">
          <h2 className="font-display text-base font-semibold text-text-primary">
            {preset.title}
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed mt-0.5">
            {preset.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wide text-text-tertiary hover:text-text-secondary transition-colors"
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? "Gizle" : "Detay"}
        </button>
      </header>

      {expanded && (
        <ul className="mt-4 divide-y divide-workspace-border/60">
          {result.checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </ul>
      )}

      <footer className="mt-4 pt-3 border-t border-workspace-border/60 flex items-center justify-between gap-3 text-xs text-text-tertiary">
        <span className="inline-flex items-center gap-1.5">
          <Info size={12} />
          {result.extractionMode === "regex"
            ? "Metin tabanlı çıkarım"
            : result.extractionMode === "regex+vision"
              ? "Metin + görsel çıkarım"
              : "Görsel çıkarım"}
        </span>
        <time dateTime={result.generatedAt}>
          {formatTime(result.generatedAt)}
        </time>
      </footer>
    </section>
  );
}

function CheckRow({ check }: { check: PrecheckCheck }) {
  const { icon: Icon, color } = SEVERITY_ICON[check.severity];
  return (
    <li className="py-3 flex items-start gap-3">
      <Icon size={16} className={`${color} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary">
          {check.label}
        </div>
        <p className="text-xs text-text-secondary leading-relaxed mt-0.5">
          {check.message}
        </p>
        {(check.expected || check.observed) && (
          <dl className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            {check.expected && (
              <div className="min-w-0">
                <dt className="font-mono uppercase tracking-wide text-text-tertiary text-[10px]">
                  Sirkü
                </dt>
                <dd className="text-text-secondary truncate" title={check.expected}>
                  {check.expected}
                </dd>
              </div>
            )}
            {check.observed && (
              <div className="min-w-0">
                <dt className="font-mono uppercase tracking-wide text-text-tertiary text-[10px]">
                  Dilekçe
                </dt>
                <dd className="text-text-secondary truncate" title={check.observed}>
                  {check.observed}
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </li>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
