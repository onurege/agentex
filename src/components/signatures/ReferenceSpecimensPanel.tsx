"use client";

// ============================================================
// ReferenceSpecimensPanel — İmza sirküsünde çoklu örnek yönetimi
// ============================================================
//
// Primary kırpım (reference cropper) üstte duruyor; bu panel
// altında ek örnekleri (0-2 adet) thumbnail + sil aksiyonuyla
// listeler. "+ Başka örnek ekle" butonu inline cropper açar;
// kullanıcı aynı sayfadan farklı bir imzayı kırpar.
// ============================================================

import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { SignatureCropper } from "./SignatureCropper";
import type {
  CropRegion,
  ReferenceSpecimen,
  SignatureSource,
} from "@/lib/signatures/types";
import type { PreprocessResult } from "@/lib/signatures/preprocess";

const MAX_SPECIMENS = 2; // primary + 2 ek = toplam 3

interface ReferenceSpecimensPanelProps {
  referenceSource: SignatureSource;
  specimens: ReferenceSpecimen[];
  onAdd(crop: CropRegion, result: PreprocessResult): void;
  onRemove(specimenId: string): void;
}

export function ReferenceSpecimensPanel({
  referenceSource,
  specimens,
  onAdd,
  onRemove,
}: ReferenceSpecimensPanelProps) {
  const [adding, setAdding] = useState(false);

  // Adder için referans source'un kopyası — crop: null (primary'yi
  // vurgulama), signatureDataUrl: null (önizleme gösterme).
  const adderSource = useMemo<SignatureSource>(
    () => ({
      ...referenceSource,
      crop: null,
      rawCropDataUrl: null,
      signatureDataUrl: null,
      processedAspectRatio: null,
      inkDensity: null,
    }),
    [referenceSource],
  );

  const full = specimens.length >= MAX_SPECIMENS;

  if (!referenceSource.pageDataUrl) return null;

  return (
    <section className="rounded-xl border border-workspace-border bg-workspace-surface p-4">
      <header className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-text-primary">
            Ek referans imzaları
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            Sirküsünde birden fazla örnek varsa ekleyin — en iyi eşleşen
            skor kullanılır.
          </p>
        </div>
        {!adding && !full && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-accent-primary/10 text-accent-primary border border-accent-primary/25 hover:bg-accent-primary/15 transition-colors"
          >
            <Plus size={13} />
            Başka örnek ekle
          </button>
        )}
        {!adding && full && (
          <span className="text-xs text-text-tertiary font-mono">
            Max {MAX_SPECIMENS + 1} örnek
          </span>
        )}
      </header>

      {/* Mevcut örnek thumbnail'ları */}
      {specimens.length > 0 ? (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          {specimens.map((sp, idx) => (
            <li key={sp.id}>
              <div className="relative rounded-lg border border-workspace-border bg-workspace-elevated p-2">
                <div className="text-[10px] font-mono font-semibold uppercase tracking-widest text-text-tertiary mb-1">
                  Örnek {idx + 2}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sp.signatureDataUrl}
                  alt={`Ek imza örneği ${idx + 2}`}
                  className="w-full h-auto rounded border border-workspace-border bg-white"
                />
                <button
                  type="button"
                  onClick={() => onRemove(sp.id)}
                  className="absolute top-1 right-1 p-1 rounded-md bg-workspace-surface border border-workspace-border text-text-muted hover:text-semantic-negative hover:bg-semantic-negative/10 transition-colors"
                  aria-label={`Örnek ${idx + 2} sil`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-tertiary mb-3 italic">
          Henüz ek örnek yok. Primary kırpım zaten &quot;Örnek 1&quot; olarak
          kullanılıyor.
        </p>
      )}

      {/* Adder — inline cropper */}
      {adding && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-text-primary">
              Yeni örnek için dikdörtgen çizin
            </p>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-text-tertiary hover:text-text-primary hover:bg-workspace-elevated transition-colors"
            >
              <X size={12} />
              Vazgeç
            </button>
          </div>
          <SignatureCropper
            label="Ek örnek"
            tone="reference"
            source={adderSource}
            onCropComplete={(region, result) => {
              onAdd(region, result);
              setAdding(false);
            }}
            onReset={() => {
              /* adder kendisi transient — reset yok */
            }}
          />
        </div>
      )}
    </section>
  );
}
