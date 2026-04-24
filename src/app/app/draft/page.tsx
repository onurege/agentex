"use client";

// ============================================================
// /app/draft — Draft Module Landing (Faz 0 stub)
// ============================================================
//
// Şablon grid ve geçmiş taslak listesi Faz 0 commit 2'de
// doldurulur. Şimdilik boş iskelet ve "Yeni Sözleşme" CTA.
// ============================================================

import Link from "next/link";
import { ArrowRight, FilePlus2 } from "lucide-react";
import { DraftLayout } from "@/components/draft/DraftLayout";

export default function DraftModuleLanding() {
  return (
    <DraftLayout>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <section className="rounded-2xl border border-workspace-border bg-workspace-surface p-10">
          <div className="flex items-center gap-2 px-3 py-1 mb-4 w-fit text-xs font-mono font-semibold tracking-wider uppercase text-accent-primary bg-accent-primary/10 border border-accent-primary/20 rounded-full">
            <FilePlus2 size={12} />
            Sıfırdan Sözleşme
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-text-primary mb-3 leading-tight">
            Şablondan başlayın, soruları yanıtlayın, DOCX alın
          </h1>
          <p className="text-base text-text-secondary max-w-2xl leading-relaxed mb-6">
            Gizlilik, bayilik ve hizmet alım sözleşmeleri için hazır şablonlar.
            Adım adım sorular sizi doldurmanız gereken her alanda yönlendirir,
            sözleşme anlık olarak yanınızda şekillenir.
          </p>
          <Link
            href="/app/draft/new"
            className="group inline-flex items-center gap-2.5 px-6 py-3.5 text-base font-semibold rounded-xl bg-accent-primary text-workspace-surface hover:bg-accent-secondary transition-all shadow-medium"
          >
            Yeni Sözleşme
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </section>
      </div>
    </DraftLayout>
  );
}
