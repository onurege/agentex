"use client";

// ============================================================
// /app/compare/new — Two-document upload flow
// ============================================================
//
// Two side-by-side upload boxes (v1 + v2) and a single primary
// action: start the comparison. In Faz 1 this produces a mock
// run synchronously and navigates to the results page.
// ============================================================

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Zap } from "lucide-react";
import { CompareLayout } from "@/components/compare/CompareLayout";
import { CompareUploadBox } from "@/components/compare/CompareUploadBox";
import { useCompareStore } from "@/lib/compare/store";
import { logClientActivity } from "@/lib/client-activity";

export default function NewCompareRunPage() {
  const router = useRouter();

  const pendingV1 = useCompareStore((s) => s.pendingV1);
  const pendingV2 = useCompareStore((s) => s.pendingV2);
  const setV1 = useCompareStore((s) => s.setV1);
  const setV2 = useCompareStore((s) => s.setV2);
  const clearV1 = useCompareStore((s) => s.clearV1);
  const clearV2 = useCompareStore((s) => s.clearV2);
  const startCompareRun = useCompareStore((s) => s.startCompareRun);

  const canStart = Boolean(pendingV1 && pendingV2);

  const handleStart = useCallback(() => {
    const id = startCompareRun();
    if (id) {
      void logClientActivity({
        action: "compare_completed",
        targetType: "compare",
        targetId: id,
        summary: "Döküman karşılaştırma çalışması oluşturuldu",
        module: "compare",
        metadata: {
          v1FileName: pendingV1?.meta.fileName,
          v2FileName: pendingV2?.meta.fileName,
          v1SizeBytes: pendingV1?.meta.sizeBytes,
          v2SizeBytes: pendingV2?.meta.sizeBytes,
          v1SectionCount: pendingV1?.sections.length,
          v2SectionCount: pendingV2?.sections.length,
        },
      });
      router.push(`/app/compare/${id}`);
    }
  }, [startCompareRun, router, pendingV1, pendingV2]);

  return (
    <CompareLayout pageTitle="Yeni Karşılaştırma">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Breadcrumb-style back */}
        <Link
          href="/app/compare"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          Karşılaştırma modülüne dön
        </Link>

        {/* Header */}
        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2 tracking-tight">
            İki Versiyonu Yükleyin
          </h1>
          <p className="text-base text-text-secondary max-w-2xl">
            Önceki versiyon ile güncel versiyonu yüklediğinizde ajan, tüm
            maddeleri karşılaştırıp risk seviyeleriyle birlikte raporlayacak.
          </p>
        </header>

        {/* Upload grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <CompareUploadBox
            label="v1 · Önceki"
            tone="v1"
            payload={pendingV1}
            onPick={setV1}
            onClear={clearV1}
          />
          <CompareUploadBox
            label="v2 · Güncel"
            tone="v2"
            payload={pendingV2}
            onPick={setV2}
            onClear={clearV2}
          />
        </div>

        {/* Action */}
        <div className="flex items-center justify-between gap-4 p-5 rounded-xl border border-workspace-border bg-workspace-surface">
          <div className="text-sm text-text-secondary">
            {canStart ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-semantic-positive animate-pulse" />
                İki belge de hazır. Karşılaştırmayı başlatabilirsiniz.
              </span>
            ) : (
              <span className="text-text-tertiary">
                Devam etmek için iki dosyayı da yükleyin.
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={!canStart}
            onClick={handleStart}
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-base font-semibold bg-accent-primary text-workspace-surface hover:bg-accent-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-medium disabled:shadow-none"
          >
            <Zap size={16} />
            Karşılaştırmayı Başlat
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </CompareLayout>
  );
}
