"use client";

// ============================================================
// /app/draft/[id] — Wizard + Canlı Preview (Faz 1 commit 4)
// ============================================================
//
// Split layout: solda WizardShell (soru-cevap), sağda
// ClausePreview (canlı sözleşme metni + opsiyonel madde
// toggle'ları). Mobilde paneller dikey stacke düşer.
// ============================================================

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { DraftLayout } from "@/components/draft/DraftLayout";
import { WizardShell } from "@/components/draft/WizardShell";
import { ClausePreview } from "@/components/draft/ClausePreview";
import { useDraftStore } from "@/lib/draft/store";
import { useHydrated } from "@/lib/draft/use-hydrated";
import {
  getTemplate,
  isTemplateImplemented,
  TEMPLATE_META,
} from "@/lib/draft/templates/registry";

export default function DraftWizardPage() {
  const params = useParams<{ id: string }>();
  const hydrated = useHydrated();
  const session = useDraftStore((s) => s.getSession(params.id));

  if (!hydrated) {
    return (
      <DraftLayout>
        <div className="max-w-7xl mx-auto px-6 py-16 flex items-center justify-center gap-2 text-text-tertiary">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Yükleniyor…</span>
        </div>
      </DraftLayout>
    );
  }

  if (!session) {
    notFound();
  }

  const template = getTemplate(session.templateId);
  const meta = TEMPLATE_META[session.templateId];

  return (
    <DraftLayout pageTitle={meta.label}>
      <div className="w-full px-5 py-8">
        <Link
          href="/app/draft"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-5 transition-colors"
        >
          <ArrowLeft size={14} />
          Sıfırdan Sözleşmeye dön
        </Link>

        <header className="mb-6">
          <div className="text-[10px] font-mono font-semibold tracking-widest uppercase text-accent-primary mb-1.5">
            {meta.category}
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
            {meta.label}
          </h1>
        </header>

        {!isTemplateImplemented(session.templateId) || !template ? (
          <div className="rounded-xl border border-dashed border-workspace-border bg-workspace-elevated p-10 text-center">
            <p className="font-display text-lg font-semibold text-text-primary mb-2">
              Bu şablon henüz hazır değil
            </p>
            <p className="text-sm text-text-secondary max-w-md mx-auto">
              {meta.label} şablonu Faz 2&apos;de eklenecek. Şu an yalnızca NDA
              şablonu soru-cevap akışıyla kullanılabilir.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[440px_minmax(0,1fr)] gap-6">
            {/* Left — wizard */}
            <section className="rounded-xl border border-workspace-border bg-workspace-surface p-6 md:p-8 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
              <WizardShell template={template} sessionId={session.id} />
            </section>

            {/* Right — preview */}
            <section className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
              <ClausePreview template={template} session={session} />
            </section>
          </div>
        )}
      </div>
    </DraftLayout>
  );
}
