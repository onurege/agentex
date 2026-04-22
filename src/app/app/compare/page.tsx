"use client";

// ============================================================
// /app/compare — Compare Module Landing
// ============================================================
//
// Entry point for the compare module. Hero + primary CTA to start
// a new comparison, then a history grid of past runs. Empty state
// invites the user to the new flow.
// ============================================================

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  FileDiff,
  Clock,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { CompareLayout } from "@/components/compare/CompareLayout";
import { useCompareStore } from "@/lib/compare/store";

function formatDate(iso: string): string {
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

export default function CompareModuleLanding() {
  const runs = useCompareStore((s) => s.listRuns());
  const deleteRun = useCompareStore((s) => s.deleteRun);

  const hasRuns = runs.length > 0;

  const totalFindings = useMemo(
    () => runs.reduce((sum, r) => sum + r.stats.total, 0),
    [runs],
  );

  return (
    <CompareLayout>
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero */}
        <section className="relative rounded-2xl border border-workspace-border bg-workspace-surface p-10 mb-12 overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-accent-primary/[0.05] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-accent-warning/[0.05] blur-3xl" />

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 text-xs font-mono font-semibold tracking-wider uppercase text-accent-primary bg-accent-primary/10 border border-accent-primary/20 rounded-full">
                <FileDiff size={12} />
                Sözleşme Karşılaştırma
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-text-primary mb-3 leading-tight">
                İki versiyonu yan yana koyun, değişiklikleri anlayın
              </h1>
              <p className="text-base text-text-secondary leading-relaxed">
                Sözleşmenin eski ve yeni versiyonunu yükleyin; ajan eklenen,
                silinen ve değiştirilen her maddeyi risk düzeyiyle birlikte
                size raporlar.
              </p>
            </div>

            <Link
              href="/app/compare/new"
              className="group inline-flex items-center gap-2.5 px-6 py-3.5 text-base font-semibold rounded-xl bg-accent-primary text-workspace-surface hover:bg-accent-secondary transition-all shadow-medium hover:shadow-glow-blue self-start md:self-auto"
            >
              Yeni Karşılaştırma
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </section>

        {/* History */}
        <section>
          <header className="flex items-baseline justify-between mb-5">
            <h2 className="font-display text-xl font-semibold text-text-primary">
              Geçmiş Karşılaştırmalar
            </h2>
            {hasRuns && (
              <span className="text-sm text-text-tertiary font-mono">
                {runs.length} karşılaştırma · {totalFindings} fark
              </span>
            )}
          </header>

          {!hasRuns && (
            <div className="rounded-xl border border-dashed border-workspace-border bg-workspace-elevated p-12 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-workspace-surface border border-workspace-border flex items-center justify-center">
                <FileDiff size={22} className="text-text-muted" />
              </div>
              <p className="font-display text-lg font-semibold text-text-primary mb-1.5">
                Henüz karşılaştırma yok
              </p>
              <p className="text-sm text-text-secondary mb-6 max-w-md mx-auto">
                İlk karşılaştırmanızı başlatın. İki sözleşme yükleyin,
                farkları otomatik rapor alın.
              </p>
              <Link
                href="/app/compare/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent-primary text-workspace-surface hover:bg-accent-secondary transition-colors"
              >
                Başla
                <ArrowRight size={15} />
              </Link>
            </div>
          )}

          {hasRuns && (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {runs.map((run) => (
                <li key={run.id}>
                  <div className="group relative rounded-xl border border-workspace-border bg-workspace-surface p-5 hover:border-accent-primary/30 hover:shadow-medium transition-all">
                    <Link
                      href={`/app/compare/${run.id}`}
                      className="absolute inset-0 z-0 rounded-xl"
                      aria-label={`${run.v1.fileName} → ${run.v2.fileName} karşılaştırmasını aç`}
                    />
                    <header className="relative z-10 flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 text-xs font-mono text-text-tertiary">
                        <Clock size={12} />
                        {formatDate(run.createdAt)}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirm("Bu karşılaştırma silinsin mi?")) {
                            deleteRun(run.id);
                          }
                        }}
                        className="relative z-10 p-1.5 rounded-md text-text-muted hover:text-accent-danger hover:bg-accent-danger/10 transition-colors"
                        aria-label="Karşılaştırmayı sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </header>
                    <div className="relative z-[-1] mb-4">
                      <p className="text-sm text-text-secondary truncate">
                        <span className="text-accent-info font-mono text-xs">
                          v1
                        </span>{" "}
                        {run.v1.fileName}
                      </p>
                      <p className="text-sm text-text-primary truncate mt-0.5 font-medium">
                        <span className="text-accent-primary font-mono text-xs">
                          v2
                        </span>{" "}
                        {run.v2.fileName}
                      </p>
                    </div>
                    <footer className="relative z-[-1] flex items-center gap-3 text-xs">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-workspace-elevated text-text-secondary border border-workspace-border font-mono">
                        {run.stats.total} fark
                      </span>
                      {run.stats.high > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent-danger/10 text-accent-danger border border-accent-danger/25 font-mono">
                          <AlertTriangle size={11} />
                          {run.stats.high} yüksek
                        </span>
                      )}
                      {run.stats.medium > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent-warning/10 text-accent-warning border border-accent-warning/25 font-mono">
                          {run.stats.medium} orta
                        </span>
                      )}
                    </footer>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </CompareLayout>
  );
}
