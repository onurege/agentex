"use client";

// ============================================================
// /app/signatures — İmza Karşılaştırma (Faz 0 commit 2)
// ============================================================
//
// Tek sayfa akış: iki belge yüklenir, her birinden imza bölgesi
// kırpılır (commit 3), sonra sinyaller hesaplanır (commit 4).
// Bu commit upload + page preview kısmını ekler. Kırpma ve
// karşılaştırma kartları placeholder olarak kalır.
// ============================================================

import { useEffect } from "react";
import { AlertCircle, Sparkles } from "lucide-react";
import { SignatureLayout } from "@/components/signatures/SignatureLayout";
import { SignatureSourceCard } from "@/components/signatures/SignatureSourceCard";
import { SignatureCropper } from "@/components/signatures/SignatureCropper";
import { useSignaturesStore } from "@/lib/signatures/store";
import { useHydrated } from "@/lib/draft/use-hydrated";
import type { CropRegion } from "@/lib/signatures/types";

export default function SignaturesPage() {
  const hydrated = useHydrated();
  const currentId = useSignaturesStore((s) => s.currentSessionId);
  const createSession = useSignaturesStore((s) => s.createSession);
  const session = useSignaturesStore((s) =>
    currentId ? s.sessions[currentId] : undefined,
  );
  const setSource = useSignaturesStore((s) => s.setSource);
  const clearSource = useSignaturesStore((s) => s.clearSource);
  const setCrop = useSignaturesStore((s) => s.setCrop);
  const setSignatureImage = useSignaturesStore((s) => s.setSignatureImage);

  const handleCropComplete = (
    side: "contract" | "reference",
    region: CropRegion,
    signatureDataUrl: string,
  ) => {
    if (!session) return;
    setCrop(session.id, side, region);
    setSignatureImage(session.id, side, signatureDataUrl);
  };

  const handleCropReset = (side: "contract" | "reference") => {
    if (!session) return;
    setCrop(session.id, side, null);
    setSignatureImage(session.id, side, null);
  };

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

  const bothLoaded = Boolean(
    session.contract.pageDataUrl && session.reference.pageDataUrl,
  );

  return (
    <SignatureLayout>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <header className="mb-6">
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
            karşılaştırmadır. Sahtelik şüphesinde grafoloji uzmanına
            başvurulmalıdır.
          </div>
        </div>

        {/* Upload grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <SignatureSourceCard
            label="Sözleşme"
            description="Üzerinde imza bulunan sözleşme sayfası."
            tone="contract"
            source={session.contract}
            onLoad={(src) => setSource(session.id, "contract", src)}
            onClear={() => clearSource(session.id, "contract")}
          />
          <SignatureSourceCard
            label="İmza Sirküsü"
            description="Referans olarak kullanılacak imza örneği."
            tone="reference"
            source={session.reference}
            onLoad={(src) => setSource(session.id, "reference", src)}
            onClear={() => clearSource(session.id, "reference")}
          />
        </div>

        {bothLoaded ? (
          <>
            <section className="mb-6">
              <header className="mb-3">
                <h2 className="font-display text-lg font-semibold text-text-primary">
                  İmza bölgesini seçin
                </h2>
                <p className="text-sm text-text-secondary">
                  Her sayfada imzayı çevreleyen bir dikdörtgen çizin.
                  Kırpım kaydedildikçe alt köşede normalize edilmiş
                  önizleme belirir.
                </p>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <SignatureCropper
                  label="Sözleşme"
                  tone="contract"
                  source={session.contract}
                  onCropComplete={(r, d) =>
                    handleCropComplete("contract", r, d)
                  }
                  onReset={() => handleCropReset("contract")}
                />
                <SignatureCropper
                  label="İmza Sirküsü"
                  tone="reference"
                  source={session.reference}
                  onCropComplete={(r, d) =>
                    handleCropComplete("reference", r, d)
                  }
                  onReset={() => handleCropReset("reference")}
                />
              </div>
            </section>

            <div className="rounded-xl border border-dashed border-workspace-border bg-workspace-elevated p-8 text-center">
              <p className="font-display text-lg font-semibold text-text-primary mb-1">
                Karşılaştırma akışı bir sonraki commit'te
              </p>
              <p className="text-sm text-text-secondary">
                İki bölge de kırpıldığında SSIM + pHash skorları ve
                güven yüzdesi burada görünecek.
              </p>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-workspace-border bg-workspace-elevated p-8 text-center">
            <p className="font-display text-lg font-semibold text-text-primary mb-1">
              Her iki belgeyi yükleyin
            </p>
            <p className="text-sm text-text-secondary">
              Devam etmek için hem sözleşme hem imza sirküsü yüklü olmalı.
            </p>
          </div>
        )}
      </div>
    </SignatureLayout>
  );
}
