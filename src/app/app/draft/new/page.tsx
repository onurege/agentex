"use client";

// ============================================================
// /app/draft/new — Template Picker (Faz 0 stub)
// ============================================================
//
// 3 şablon kartı Faz 0 commit 2'de doldurulur. Şimdilik
// boş iskelet.
// ============================================================

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DraftLayout } from "@/components/draft/DraftLayout";

export default function DraftTemplatePickerPage() {
  return (
    <DraftLayout pageTitle="Şablon Seç">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link
          href="/app/draft"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          Sıfırdan Sözleşmeye dön
        </Link>

        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2 tracking-tight">
            Şablon Seç
          </h1>
          <p className="text-base text-text-secondary max-w-2xl">
            Hangi tür sözleşmeyi hazırlayacaksınız? Şablonu seçip soruları
            yanıtladıktan sonra DOCX çıktı alacaksınız.
          </p>
        </header>

        <div className="rounded-xl border border-dashed border-workspace-border bg-workspace-elevated p-10 text-center">
          <p className="text-text-secondary">
            Şablon kartları Faz 0 commit 2'de eklenecek.
          </p>
        </div>
      </div>
    </DraftLayout>
  );
}
