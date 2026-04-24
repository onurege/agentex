"use client";

// ============================================================
// /app/signatures — İmza Karşılaştırma Landing (Faz 0 stub)
// ============================================================
//
// MVP: tek-sayfa akış. Sözleşme + sirküsü yüklenir, imza bölgeleri
// kırpılır, karşılaştırma sonucu gösterilir. Bu commit sadece
// iskelet + "yeni oturum başlat" butonu. Upload + crop + compare
// akışları sonraki commit'lerde eklenecek.
// ============================================================

import { useEffect } from "react";
import { AlertCircle, Sparkles } from "lucide-react";
import { SignatureLayout } from "@/components/signatures/SignatureLayout";
import { useSignaturesStore } from "@/lib/signatures/store";
import { useHydrated } from "@/lib/draft/use-hydrated";

export default function SignaturesPage() {
  const hydrated = useHydrated();
  const currentId = useSignaturesStore((s) => s.currentSessionId);
  const createSession = useSignaturesStore((s) => s.createSession);
  const session = useSignaturesStore((s) =>
    currentId ? s.sessions[currentId] : undefined,
  );

  useEffect(() => {
    if (!hydrated) return;
    if (!currentId || !session) {
      createSession();
    }
  }, [hydrated, currentId, session, createSession]);

  if (!hydrated || !session) {
    return (
      <SignatureLayout>
        <div className="max-w-4xl mx-auto px-6 py-16 text-center text-text-tertiary">
          Yükleniyor…
        </div>
      </SignatureLayout>
    );
  }

  return (
    <SignatureLayout>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 text-xs font-mono font-semibold tracking-wider uppercase text-accent-primary bg-accent-primary/10 border border-accent-primary/20 rounded-full">
            <Sparkles size={12} />
            İmza Karşılaştırma
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-3 tracking-tight">
            Sözleşmedeki imzayı sirküsüyle karşılaştırın
          </h1>
          <p className="text-base text-text-secondary max-w-2xl leading-relaxed">
            İki belgedeki imza bölgelerini kırpın; sistem SSIM ve perceptual
            hash sinyalleriyle görsel benzerliği ölçer ve bir ilk-filtre
            değerlendirmesi sunar.
          </p>
        </header>

        <div className="rounded-xl border border-accent-warning/30 bg-accent-warning/[0.06] p-4 mb-8 flex items-start gap-3">
          <AlertCircle size={18} className="text-accent-warning shrink-0 mt-0.5" />
          <div className="text-sm text-text-secondary leading-relaxed">
            <span className="font-semibold text-accent-warning">Bu bir
            adli delil değildir.</span>{" "}
            Sonuç, bariz uyuşmazlıkları yakalamaya yönelik hızlı bir görsel
            karşılaştırmadır. Sahtelik şüphesinde mutlaka grafoloji uzmanına
            başvurulmalıdır.
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-workspace-border bg-workspace-elevated p-10 text-center">
          <p className="font-display text-lg font-semibold text-text-primary mb-1">
            Yükleme ve kırpma akışı bir sonraki commit'te
          </p>
          <p className="text-sm text-text-secondary">
            Oturum hazır: <span className="font-mono text-xs">{session.id}</span>
          </p>
        </div>
      </div>
    </SignatureLayout>
  );
}
