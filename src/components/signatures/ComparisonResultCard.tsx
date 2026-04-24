"use client";

// ============================================================
// ComparisonResultCard — Görsel karşılaştırma sonuç paneli
// ============================================================
//
// Üç sinyali ve birleşik güveni kullanıcıya şeffaf biçimde
// gösterir. Bilinçli olarak tek bir skorda gizlemez; sinyaller
// de görünür olsun ki kullanıcı "neden bu sonuç" diye kontrol
// edebilsin.
// ============================================================

import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import type { ComparisonResult, SignatureSource } from "@/lib/signatures/types";

interface ComparisonResultCardProps {
  result: ComparisonResult;
  contract: SignatureSource;
  reference: SignatureSource;
  onRecompute(): void;
  computing: boolean;
}

const VERDICT_MAP = {
  match: {
    label: "Eşleşiyor",
    description:
      "Görsel sinyaller güçlü uyum gösteriyor. Yine de adli delil değildir.",
    tone: "success" as const,
    Icon: CheckCircle2,
  },
  borderline: {
    label: "Sınırda",
    description:
      "Sinyaller karışık. Manuel inceleme veya grafoloji uzmanı önerilir.",
    tone: "warning" as const,
    Icon: AlertTriangle,
  },
  no_match: {
    label: "Eşleşmiyor",
    description:
      "Görsel sinyaller bariz farklılık gösteriyor. İmzalar muhtemelen aynı elden çıkmadı.",
    tone: "danger" as const,
    Icon: XCircle,
  },
};

const TONE_CLASSES = {
  success: {
    bg: "bg-accent-success/10",
    border: "border-accent-success/30",
    text: "text-accent-success",
  },
  warning: {
    bg: "bg-accent-warning/10",
    border: "border-accent-warning/30",
    text: "text-accent-warning",
  },
  danger: {
    bg: "bg-accent-danger/10",
    border: "border-accent-danger/30",
    text: "text-accent-danger",
  },
};

export function ComparisonResultCard({
  result,
  contract,
  reference,
  onRecompute,
  computing,
}: ComparisonResultCardProps) {
  const v = VERDICT_MAP[result.verdict];
  const t = TONE_CLASSES[v.tone];
  const confidencePct = Math.round(result.confidence * 100);

  return (
    <section className="rounded-xl border border-workspace-border bg-workspace-surface overflow-hidden">
      {/* Verdict banner */}
      <header className={`px-6 py-4 border-b border-workspace-border ${t.bg}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <v.Icon size={22} className={`${t.text} mt-0.5 shrink-0`} />
            <div>
              <h2 className={`font-display text-xl font-bold ${t.text}`}>
                {v.label}
              </h2>
              <p className="text-sm text-text-secondary mt-0.5 max-w-xl leading-relaxed">
                {v.description}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className={`font-display text-3xl font-bold ${t.text}`}>
              %{confidencePct}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-text-tertiary">
              Güven
            </div>
          </div>
        </div>
      </header>

      {/* Side-by-side signatures */}
      <div className="grid grid-cols-2 divide-x divide-workspace-border">
        <SignaturePanel
          label="Sözleşme"
          fileName={contract.fileName}
          dataUrl={contract.signatureDataUrl}
          toneClass="text-accent-info"
        />
        <SignaturePanel
          label="İmza Sirküsü"
          fileName={reference.fileName}
          dataUrl={reference.signatureDataUrl}
          toneClass="text-accent-primary"
        />
      </div>

      {/* Signals (en iyi eşleşen örneğin sinyalleri) */}
      <div className="px-6 py-5 border-t border-workspace-border">
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-widest text-text-tertiary mb-3">
          <ShieldAlert size={11} />
          En iyi eşleşmenin sinyalleri
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SignalTile
            label="SSIM (yapısal benzerlik)"
            value={`${Math.round(result.signals.ssim * 100)}%`}
            hint="0% = zıt · 100% = özdeş"
          />
          <SignalTile
            label="pHash Hamming"
            value={`${result.signals.phashHamming} / 64`}
            hint="0 = özdeş · 64 = tamamen farklı"
          />
          <SignalTile
            label="En-boy oranı farkı"
            value={`${Math.round(result.signals.aspectRatioDelta * 100)}%`}
            hint="Orijinal kırpım şekli farkı"
          />
        </div>
      </div>

      {/* Çoklu örnek kırılımı — birden fazla referans varsa */}
      {result.specimenMatches.length > 1 && (
        <div className="px-6 py-5 border-t border-workspace-border">
          <div className="text-[11px] font-mono font-semibold uppercase tracking-widest text-text-tertiary mb-3">
            Her referans örneğine karşı
          </div>
          <ul className="space-y-2">
            {result.specimenMatches.map((m) => {
              const isBest = m.specimenId === result.bestMatchSpecimenId;
              const verdictStyle = VERDICT_MAP[m.verdict];
              const verdictTone = TONE_CLASSES[verdictStyle.tone];
              return (
                <li
                  key={m.specimenId}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    isBest
                      ? "border-accent-primary/40 bg-accent-primary/[0.04]"
                      : "border-workspace-border bg-workspace-elevated"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-text-primary">
                        {m.label}
                      </span>
                      {isBest && (
                        <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-primary/15 text-accent-primary border border-accent-primary/30">
                          en iyi
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${verdictTone.bg} ${verdictTone.text} border ${verdictTone.border}`}
                      >
                        {verdictStyle.label}
                      </span>
                    </div>
                    <div className="text-xs text-text-tertiary font-mono mt-1">
                      SSIM %{Math.round(m.signals.ssim * 100)} · pHash{" "}
                      {m.signals.phashHamming}/64 · aspect %
                      {Math.round(m.signals.aspectRatioDelta * 100)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-lg font-bold text-text-primary">
                      %{Math.round(m.confidence * 100)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Footer action */}
      <footer className="px-6 py-4 border-t border-workspace-border bg-workspace-elevated flex items-center justify-between gap-4">
        <p className="text-xs text-text-tertiary leading-relaxed max-w-lg">
          Sonuç <span className="font-mono">{formatTime(result.computedAt)}</span> itibariyle
          hesaplandı. Kırpımlardan biri değiştirilirse sonuç otomatik sıfırlanır.
        </p>
        <button
          type="button"
          onClick={onRecompute}
          disabled={computing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-workspace-surface border border-workspace-border hover:border-accent-primary/30 text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw size={12} />
          Yeniden hesapla
        </button>
      </footer>
    </section>
  );
}

function SignaturePanel({
  label,
  fileName,
  dataUrl,
  toneClass,
}: {
  label: string;
  fileName: string;
  dataUrl: string | null;
  toneClass: string;
}) {
  return (
    <div className="p-5 flex flex-col">
      <div className={`text-[11px] font-mono font-semibold tracking-widest uppercase ${toneClass} mb-2`}>
        {label}
      </div>
      {dataUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={dataUrl}
          alt={`${label} normalize edilmiş imzası`}
          className="w-full h-auto rounded border border-workspace-border bg-white"
        />
      ) : (
        <div className="aspect-[2/1] rounded border border-dashed border-workspace-border bg-workspace-elevated flex items-center justify-center text-xs text-text-tertiary">
          Görüntü yok
        </div>
      )}
      <p className="mt-2 text-xs text-text-tertiary font-mono truncate">
        {fileName}
      </p>
    </div>
  );
}

function SignalTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-workspace-border bg-workspace-elevated p-3">
      <div className="text-[10px] font-mono font-semibold tracking-widest uppercase text-text-tertiary mb-1">
        {label}
      </div>
      <div className="font-display text-xl font-bold text-text-primary leading-tight">
        {value}
      </div>
      <div className="text-[10px] text-text-tertiary mt-1">{hint}</div>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
