"use client";

// ============================================================
// /app/draft/[id] — Wizard (Faz 1 commit 3)
// ============================================================
//
// Session + template'i çeker, WizardShell render eder. Canlı
// önizleme paneli commit 4'te sağa eklenecek; şimdilik tek
// kolonlu akış. "Önizlemeye geç" butonu şu an konsola log atar
// ve aynı sayfada kalır — preview paneli devreye girince
// sağdaki panele odaklanır.
// ============================================================

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DraftLayout } from "@/components/draft/DraftLayout";
import { WizardShell } from "@/components/draft/WizardShell";
import { useDraftStore } from "@/lib/draft/store";
import {
  getTemplate,
  isTemplateImplemented,
  TEMPLATE_META,
} from "@/lib/draft/templates/registry";

export default function DraftWizardPage() {
  const params = useParams<{ id: string }>();
  const session = useDraftStore((s) => s.getSession(params.id));

  if (!session) {
    if (typeof window !== "undefined") notFound();
    return null;
  }

  const template = getTemplate(session.templateId);
  const meta = TEMPLATE_META[session.templateId];

  return (
    <DraftLayout pageTitle={meta.label}>
      <div className="max-w-4xl mx-auto px-6 py-10">
        <Link
          href="/app/draft"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          Sıfırdan Sözleşmeye dön
        </Link>

        <header className="mb-8">
          <div className="text-[10px] font-mono font-semibold tracking-widest uppercase text-accent-primary mb-1.5">
            {meta.category}
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
            {meta.label}
          </h1>
          <p className="text-sm text-text-tertiary mt-1 font-mono">
            {session.id}
          </p>
        </header>

        {!isTemplateImplemented(session.templateId) || !template ? (
          <div className="rounded-xl border border-dashed border-workspace-border bg-workspace-elevated p-10 text-center">
            <p className="font-display text-lg font-semibold text-text-primary mb-2">
              Bu şablon henüz hazır değil
            </p>
            <p className="text-sm text-text-secondary max-w-md mx-auto">
              {meta.label} şablonu Faz 2'de eklenecek. Şu an yalnızca NDA
              şablonu soru-cevap akışıyla kullanılabilir.
            </p>
          </div>
        ) : (
          <section className="rounded-xl border border-workspace-border bg-workspace-surface p-6 md:p-8">
            <WizardShell
              template={template}
              sessionId={session.id}
              onComplete={() => {
                // Preview paneli commit 4'te devreye girecek; şimdilik
                // son adım butonu sadece kullanıcıya geri bildirim verir.
                if (typeof window !== "undefined") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
            />
          </section>
        )}
      </div>
    </DraftLayout>
  );
}
