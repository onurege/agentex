"use client";

// ============================================================
// /app/draft/[id] — Wizard + Canlı Preview (Faz 0 stub)
// ============================================================
//
// Split wizard layout Faz 1'de doldurulur. Şimdilik session
// varlığı kontrolü + boş iskelet.
// ============================================================

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DraftLayout } from "@/components/draft/DraftLayout";
import { useDraftStore } from "@/lib/draft/store";

export default function DraftWizardPage() {
  const params = useParams<{ id: string }>();
  const session = useDraftStore((s) => s.getSession(params.id));

  if (!session) {
    if (typeof window !== "undefined") notFound();
    return null;
  }

  return (
    <DraftLayout pageTitle={session.templateId.toUpperCase()}>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link
          href="/app/draft"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          Sıfırdan Sözleşmeye dön
        </Link>

        <header className="mb-6">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
            Taslak · {session.templateId}
          </h1>
          <p className="text-sm text-text-tertiary mt-1 font-mono">
            {session.id}
          </p>
        </header>

        <div className="rounded-xl border border-dashed border-workspace-border bg-workspace-elevated p-10 text-center">
          <p className="text-text-secondary">
            Wizard + canlı önizleme Faz 1'de eklenecek.
          </p>
        </div>
      </div>
    </DraftLayout>
  );
}
