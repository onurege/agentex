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

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import { SignatureLayout } from "@/components/signatures/SignatureLayout";
import { SignatureSourceCard } from "@/components/signatures/SignatureSourceCard";
import { SignatureCropper } from "@/components/signatures/SignatureCropper";
import { ReferenceSpecimensPanel } from "@/components/signatures/ReferenceSpecimensPanel";
import { ComparisonResultCard } from "@/components/signatures/ComparisonResultCard";
import { PrecheckResultCard } from "@/components/signatures/PrecheckResultCard";
import { SignatureDecisionCard } from "@/components/signatures/SignatureDecisionCard";
import { useSignaturesStore } from "@/lib/signatures/store";
import { useHydrated } from "@/lib/draft/use-hydrated";
import {
  compareAgainstSpecimens,
  type SpecimenInput,
} from "@/lib/signatures/compare";
import type {
  PreprocessResult,
  SignatureMaskAnalysis,
} from "@/lib/signatures/preprocess";
import type { CropRegion } from "@/lib/signatures/types";
import type { PrecheckResult } from "@/lib/signatures/precheck/types";
import { logClientActivity } from "@/lib/client-activity";

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
  const setResult = useSignaturesStore((s) => s.setResult);
  const setPrecheckResult = useSignaturesStore((s) => s.setPrecheckResult);
  const addReferenceSpecimen = useSignaturesStore(
    (s) => s.addReferenceSpecimen,
  );
  const removeReferenceSpecimen = useSignaturesStore(
    (s) => s.removeReferenceSpecimen,
  );

  const [computing, setComputing] = useState(false);
  const [computeError, setComputeError] = useState<string | null>(null);
  const [computeNotice, setComputeNotice] = useState<string | null>(null);
  const [precheckRunning, setPrecheckRunning] = useState(false);
  const [precheckError, setPrecheckError] = useState<string | null>(null);
  const precheckInflightRef = useRef(false);

  const sessionId = session?.id;
  const contractText = session?.contract.rawText ?? null;
  const referenceText = session?.reference.rawText ?? null;
  const contractFileName = session?.contract.fileName ?? "";
  const referenceFileName = session?.reference.fileName ?? "";
  const precheckResult = session?.precheckResult ?? null;

  // Reset transient precheck error whenever a new source is uploaded so
  // the auto-trigger can attempt again on fresh inputs without looping
  // on the previous failure.
  useEffect(() => {
    setPrecheckError(null);
  }, [contractText, referenceText]);

  // Precheck auto-trigger: when both PDFs have produced a text layer and
  // we don't yet have a result, POST to /api/signatures/precheck. Image
  // uploads (PNG/JPG) carry no text; precheck silently stays absent in
  // that case. Source change clears precheckResult in the store and
  // resets precheckError above, so a new upload re-runs this effect
  // exactly once per source pair.
  //
  // We gate in-flight requests via a ref (precheckInflightRef) instead
  // of putting the running flag in deps. The naive approach — depending
  // on a precheckRunning state — would cancel the in-flight effect the
  // moment we set the spinner on, leaving the spinner stuck forever
  // because the cancellation flag prevented the finally block from
  // clearing it.
  useEffect(() => {
    if (!sessionId) return;
    if (!contractText || !referenceText) return;
    if (precheckResult) return;
    if (precheckError) return;
    if (precheckInflightRef.current) return;

    precheckInflightRef.current = true;
    setPrecheckRunning(true);

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/signatures/precheck", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sirkuText: referenceText,
            petitionText: contractText,
            sirkuFileName: referenceFileName,
            petitionFileName: contractFileName,
          }),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => response.statusText);
          throw new Error(text || `HTTP ${response.status}`);
        }
        const data = (await response.json()) as { result: PrecheckResult };
        if (!cancelled) {
          setPrecheckResult(sessionId, data.result);
        }
      } catch (err) {
        if (!cancelled) {
          setPrecheckError(
            err instanceof Error ? err.message : "Ön kontrol başarısız.",
          );
        }
      } finally {
        precheckInflightRef.current = false;
        // Always clear the spinner, even on cancellation. The cancelled
        // flag only protects against writing stale results into store
        // state; the spinner should always reflect the most recent
        // attempt's lifecycle.
        setPrecheckRunning(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    sessionId,
    contractText,
    referenceText,
    contractFileName,
    referenceFileName,
    precheckResult,
    precheckError,
    setPrecheckResult,
  ]);

  const runComparison = useCallback(async () => {
    if (!session) return;
    if (
      !session.contract.signatureDataUrl ||
      !session.reference.signatureDataUrl ||
      !session.contract.crop ||
      !session.reference.crop
    ) {
      setComputeError("Karşılaştırma için iki belgeden de imza alanı seçilmelidir.");
      setComputeNotice(null);
      return;
    }
    setComputing(true);
    setComputeError(null);
    setComputeNotice(null);
    try {
      const contractAspect =
        session.contract.processedAspectRatio ??
        session.contract.crop.width / Math.max(session.contract.crop.height, 1);
      const contractInkDensity = session.contract.inkDensity ?? 0;

      // Primary + additional örnekleri tek listeye topla.
      const specimens: SpecimenInput[] = [
        {
          id: "primary",
          label: "Örnek 1 (birincil)",
          dataUrl: session.reference.signatureDataUrl,
          aspect:
            session.reference.processedAspectRatio ??
            session.reference.crop.width / Math.max(session.reference.crop.height, 1),
          inkDensity: session.reference.inkDensity ?? 0,
        },
        ...session.referenceSpecimens.map((sp, idx) => ({
          id: sp.id,
          label: `Örnek ${idx + 2}`,
          dataUrl: sp.signatureDataUrl,
          aspect: sp.processedAspectRatio,
          inkDensity: sp.inkDensity,
        })),
      ];

      const result = await compareAgainstSpecimens({
        contractDataUrl: session.contract.signatureDataUrl,
        contractAspect,
        contractInkDensity,
        specimens,
      });
      setResult(session.id, result);
      setComputeNotice(
        `Hesaplama tamamlandı: ${new Date(result.computedAt).toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}`,
      );
      await logClientActivity({
        action: "signature_compared",
        targetType: "signature",
        targetId: session.id,
        summary: "İmza karşılaştırma sinyalleri hesaplandı",
        module: "signatures",
        severity: result.verdict === "no_match" ? "warning" : "info",
        metadata: {
          verdict: result.verdict,
          confidence: result.confidence,
          specimenCount: specimens.length,
          signals: result.signals,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Karşılaştırma başarısız.";
      setComputeError(message);
      setComputeNotice(null);
      void logClientActivity({
        action: "signature_failed",
        targetType: "signature",
        targetId: session.id,
        summary: `İmza karşılaştırma başarısız: ${message}`,
        module: "signatures",
        severity: "error",
        metadata: { error: message },
      });
    } finally {
      setComputing(false);
    }
  }, [session, setResult]);

  // İki kırpım da hazırsa ve kayıtlı bir sonuç yoksa otomatik hesapla.
  // referenceSpecimens değişimi de tetikleyicidir (store result'ı zaten
  // null'a çekiyor; effect burada yeniden çalışır).
  useEffect(() => {
    if (!session) return;
    if (
      session.contract.signatureDataUrl &&
      session.reference.signatureDataUrl &&
      !session.result &&
      !computing
    ) {
      void runComparison();
    }
  }, [
    session,
    session?.contract.signatureDataUrl,
    session?.reference.signatureDataUrl,
    session?.referenceSpecimens.length,
    session?.result,
    computing,
    runComparison,
  ]);

  const handleCropComplete = (
    side: "contract" | "reference",
    region: CropRegion,
    result: PreprocessResult,
  ) => {
    if (!session) return;
    setComputeError(null);
    setComputeNotice(null);
    setCrop(session.id, side, region);
    setSignatureImage(session.id, side, result.dataUrl, {
      rawCropDataUrl: result.rawDataUrl,
      processedAspectRatio: result.aspectRatio,
      inkDensity: result.inkDensity,
    });
    void logClientActivity({
      action: "signature_crop_selected",
      targetType: "signature",
      targetId: session.id,
      summary: `${side === "contract" ? "Dökümandaki" : "Sirküdeki"} imza alanı seçildi`,
      module: "signatures",
      metadata: {
        side,
        crop: region,
        aspectRatio: result.aspectRatio,
        inkDensity: result.inkDensity,
      },
    });
  };

  const handleCropReset = (side: "contract" | "reference") => {
    if (!session) return;
    setComputeError(null);
    setComputeNotice(null);
    setCrop(session.id, side, null);
    setSignatureImage(session.id, side, null);
  };

  const handleMaskUpdate = (
    side: "contract" | "reference",
    dataUrl: string,
    analysis: SignatureMaskAnalysis,
  ) => {
    if (!session) return;
    setComputeError(null);
    setComputeNotice(null);
    setSignatureImage(session.id, side, dataUrl, {
      rawCropDataUrl: session[side].rawCropDataUrl,
      processedAspectRatio: analysis.aspectRatio,
      inkDensity: analysis.inkDensity,
    });
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
            Dökümandaki imzayı imza sirküleri ile karşılaştırın
          </h1>
          <p className="text-base text-text-secondary max-w-2xl leading-relaxed">
            İki belgedeki imza bölgelerini kırpın; sistem ham görüntüyü değil,
            kaşe ve yazı gürültüsü azaltılmış imza maskesini karşılaştırır.
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
            onLoad={(src) => {
              setSource(session.id, "contract", src);
              void logClientActivity({
                action: "signature_source_uploaded",
                targetType: "signature",
                targetId: session.id,
                summary: "Dökümandaki imza kaynağı yüklendi",
                module: "signatures",
                metadata: {
                  side: "contract",
                  fileName: src.fileName,
                  fileType: src.fileType,
                },
              });
            }}
            onClear={() => clearSource(session.id, "contract")}
          />
          <SignatureSourceCard
            label="İmza Sirküsü"
            description="Referans olarak kullanılacak imza örneği."
            tone="reference"
            source={session.reference}
            onLoad={(src) => {
              setSource(session.id, "reference", src);
              void logClientActivity({
                action: "signature_source_uploaded",
                targetType: "signature",
                targetId: session.id,
                summary: "İmza sirküsü kaynağı yüklendi",
                module: "signatures",
                metadata: {
                  side: "reference",
                  fileName: src.fileName,
                  fileType: src.fileType,
                },
              });
            }}
            onClear={() => clearSource(session.id, "reference")}
          />
        </div>

        {bothLoaded ? (
          <>
            {precheckResult ? (
              <>
                <PrecheckResultCard result={precheckResult} />
                <div className="mt-4">
                  <SignatureDecisionCard
                    result={precheckResult}
                    sirkuFileName={referenceFileName}
                    petitionFileName={contractFileName}
                  />
                </div>
              </>
            ) : precheckRunning ? (
              <div className="rounded-xl border border-workspace-border bg-workspace-elevated p-4 mb-6 flex items-center gap-3 text-sm text-text-secondary">
                <Loader2
                  size={16}
                  className="animate-spin text-accent-primary"
                />
                Şirket bilgileri kontrol ediliyor…
              </div>
            ) : precheckError ? (
              <div className="rounded-xl border border-accent-warning/30 bg-accent-warning/[0.06] p-4 mb-6 text-sm text-text-secondary">
                <span className="font-semibold text-accent-warning">
                  Ön kontrol yapılamadı:
                </span>{" "}
                {precheckError}. İmza karşılaştırmasına devam edebilirsiniz.
              </div>
            ) : !contractText || !referenceText ? (
              <div className="rounded-xl border border-dashed border-workspace-border bg-workspace-elevated p-4 mb-6 text-xs text-text-tertiary">
                Görüntü dosyalarında metin katmanı bulunmadığı için şirket
                bilgileri ön kontrolü atlandı. PDF yüklerseniz otomatik
                tetiklenir.
              </div>
            ) : null}

            <section className="mb-6">
              <header className="mb-3">
                <h2 className="font-display text-lg font-semibold text-text-primary">
                  İmza bölgesini seçin
                </h2>
                <p className="text-sm text-text-secondary">
                  Her sayfada imzayı çevreleyen bir dikdörtgen çizin.
                  Kırpım kaydedildikçe ham seçim ve sistemin karşılaştıracağı
                  imza maskesi altta görünür.
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
                  onMaskUpdate={(dataUrl, analysis) =>
                    handleMaskUpdate("contract", dataUrl, analysis)
                  }
                  onReset={() => handleCropReset("contract")}
                />
                <div className="flex flex-col gap-4">
                  <SignatureCropper
                    label="İmza Sirküsü"
                    tone="reference"
                    source={session.reference}
                    onCropComplete={(r, d) =>
                      handleCropComplete("reference", r, d)
                    }
                    onMaskUpdate={(dataUrl, analysis) =>
                      handleMaskUpdate("reference", dataUrl, analysis)
                    }
                    onReset={() => handleCropReset("reference")}
                  />
                  {session.reference.crop && (
                    <ReferenceSpecimensPanel
                      referenceSource={session.reference}
                      specimens={session.referenceSpecimens}
                      onAdd={(crop, result) =>
                        addReferenceSpecimen(session.id, {
                          crop,
                          rawCropDataUrl: result.rawDataUrl,
                          signatureDataUrl: result.dataUrl,
                          processedAspectRatio: result.aspectRatio,
                          inkDensity: result.inkDensity,
                        })
                      }
                      onRemove={(id) =>
                        removeReferenceSpecimen(session.id, id)
                      }
                    />
                  )}
                </div>
              </div>
            </section>

            {session.result ? (
              <ComparisonResultCard
                result={session.result}
                contract={session.contract}
                reference={session.reference}
                onRecompute={() => void runComparison()}
                computing={computing}
                statusMessage={computeNotice}
                errorMessage={computeError}
              />
            ) : computing ? (
              <div className="rounded-xl border border-workspace-border bg-workspace-surface p-8 text-center flex flex-col items-center gap-2">
                <Loader2 size={20} className="animate-spin text-accent-primary" />
                <p className="text-sm text-text-secondary">
                  Sinyaller hesaplanıyor…
                </p>
              </div>
            ) : computeError ? (
              <div className="rounded-xl border border-semantic-negative/30 bg-semantic-negative/[0.05] p-6 text-center">
                <p className="text-sm text-semantic-negative font-semibold mb-2">
                  Karşılaştırma başarısız
                </p>
                <p className="text-xs text-text-tertiary mb-3">{computeError}</p>
                <button
                  type="button"
                  onClick={() => void runComparison()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-workspace-surface border border-workspace-border hover:border-accent-primary/30 text-text-secondary hover:text-text-primary transition-colors"
                >
                  Tekrar dene
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-workspace-border bg-workspace-elevated p-8 text-center">
                <p className="font-display text-lg font-semibold text-text-primary mb-1">
                  İki bölgeyi de kırpın
                </p>
                <p className="text-sm text-text-secondary">
                  Her iki belgede imza bölgesi seçildiğinde sinyaller
                  otomatik hesaplanır.
                </p>
              </div>
            )}
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
