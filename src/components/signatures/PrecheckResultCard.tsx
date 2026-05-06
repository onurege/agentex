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

// Card chrome stays neutral — yeşil/kırmızı ayrımı sadece başlık ikonu +
// satır ikonlarıyla taşınır. Renkli arka plan / kenarlık yok.
const STATUS_PRESET = {
  passed: {
    icon: ShieldCheck,
    iconColor: "text-semantic-positive",
    title: "Şirket bilgileri tutuyor",
    subtitle:
      "Sirkü ile dilekçe arasında kritik uyumsuzluk yok; imza karşılaştırmasına geçebilirsiniz.",
  },
  warned: {
    icon: ShieldAlert,
    iconColor: "text-semantic-negative",
    title: "Bazı uyarılar var",
    subtitle:
      "İmza karşılaştırmasına devam edebilirsiniz; aşağıdaki uyarıları gözden geçirin.",
  },
  failed: {
    icon: ShieldAlert,
    iconColor: "text-semantic-negative",
    title: "Önemli uyumsuzluklar tespit edildi",
    subtitle:
      "İmza karşılaştırması açık tutuldu ama bu uyumsuzluklar dilekçenin geçerliliğini tartışmalı hale getirebilir.",
  },
} as const;

const SEVERITY_ICON: Record<
  PrecheckSeverity,
  { icon: typeof CheckCircle2; color: string }
> = {
  ok: { icon: CheckCircle2, color: "text-semantic-positive" },
  warning: { icon: AlertTriangle, color: "text-semantic-negative" },
  critical: { icon: XCircle, color: "text-semantic-negative" },
};

export function PrecheckResultCard({ result }: Props) {
  const preset = STATUS_PRESET[result.status];
  const StatusIcon = preset.icon;
  const [expanded, setExpanded] = useState(result.status !== "passed");

  return (
    <section
      className="rounded-xl border border-workspace-border bg-workspace-surface p-6 mb-6"
      aria-live="polite"
    >
      <header className="flex items-start gap-4">
        <StatusIcon
          size={28}
          className={`${preset.iconColor} shrink-0 mt-0.5`}
        />
        <div className="flex-1">
          <h2 className="font-display text-xl font-semibold text-text-primary">
            {preset.title}
          </h2>
          <p className="text-base text-text-secondary leading-relaxed mt-1">
            {preset.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-mono uppercase tracking-wide text-text-tertiary hover:text-text-secondary transition-colors"
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {expanded ? "Gizle" : "Detay"}
        </button>
      </header>

      {expanded && (
        <ul className="mt-5 divide-y divide-workspace-border/60">
          {result.checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </ul>
      )}

      <footer className="mt-5 pt-4 border-t border-workspace-border/60 flex items-center justify-between gap-3 text-sm text-text-tertiary">
        <span className="inline-flex items-center gap-2">
          <Info size={14} />
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
    <li className="py-4 flex items-start gap-3">
      <Icon size={20} className={`${color} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div className="text-base font-semibold text-text-primary">
          {check.label}
        </div>
        <p className="text-sm text-text-secondary leading-relaxed mt-1">
          {check.message}
        </p>
        {(check.expected || check.observed) && (
          <dl className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {check.expected && (
              <div className="min-w-0">
                <dt className="font-mono uppercase tracking-wide text-text-tertiary text-xs">
                  Sirkü
                </dt>
                <dd className="text-text-secondary truncate mt-0.5" title={check.expected}>
                  {check.expected}
                </dd>
              </div>
            )}
            {check.observed && (
              <div className="min-w-0">
                <dt className="font-mono uppercase tracking-wide text-text-tertiary text-xs">
                  Dilekçe
                </dt>
                <dd className="text-text-secondary truncate mt-0.5" title={check.observed}>
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
