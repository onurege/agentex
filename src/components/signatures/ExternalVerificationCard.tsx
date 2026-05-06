"use client";

// ============================================================
// ExternalVerificationCard
// ============================================================
//
// Sirkü'den çıkan şirket bilgilerini Türkiye Ticaret Sicil Gazetesi'nde
// (TTSG) manuel olarak doğrulama akışı. Kullanıcı yeni sekmede sicil
// arar, eşleşme durumunu işaretler. Seçim sunucu tarafına audit event
// olarak yazılır; persistence yok.
//
// External programatik VKN doğrulama (GİB SOAP, MERSIS scrape) bilinçli
// olarak skip edildi: sicil sorgu sayfaları captcha + ToS gri alan;
// MCP server da yok. Manuel teyit + audit hattı, "transparency"
// prensibiyle uyumlu en temiz MVP.
// ============================================================

import { useMemo, useState } from "react";
import { ExternalLink, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { logClientActivity } from "@/lib/client-activity";
import type { PrecheckResult } from "@/lib/signatures/precheck/types";

interface Props {
  result: PrecheckResult;
}

type VerificationStatus = "matched" | "mismatch" | "unknown";

const STATUS_OPTIONS: Array<{
  value: VerificationStatus;
  label: string;
  description: string;
  icon: typeof ShieldCheck;
  iconColor: string;
}> = [
  {
    value: "matched",
    label: "Eşleşiyor",
    description:
      "TTSG'de bulunan ünvan, vergi no ve yetkili bilgileri sirkü ile aynı.",
    icon: ShieldCheck,
    iconColor: "text-accent-success",
  },
  {
    value: "mismatch",
    label: "Eşleşmiyor",
    description:
      "TTSG kaydı sirküdeki bilgilerle uyuşmuyor — kritik bulgu.",
    icon: ShieldAlert,
    iconColor: "text-accent-danger",
  },
  {
    value: "unknown",
    label: "Belirsiz",
    description:
      "TTSG'de kayıt bulunamadı veya yetersiz bilgi var.",
    icon: ShieldQuestion,
    iconColor: "text-accent-warning",
  },
];

export function ExternalVerificationCard({ result }: Props) {
  const companyName = result.sirku.companyName ?? "";
  const taxNumber = result.sirku.taxNumber ?? "";
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [note, setNote] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  // TTSG arama URL'i — sayfa query string ile önceden doldurmayı kabul
  // etmiyor. Kullanıcı yeni sekmede açıp ünvanı kendi yapıştırıyor.
  const ttsgUrl = "https://www.ticaretsicil.gov.tr/";

  const canSave = status !== null;

  const copyHints = useMemo(() => {
    const items: string[] = [];
    if (companyName) items.push(`Ünvan: ${companyName}`);
    if (taxNumber) items.push(`VKN: ${taxNumber}`);
    return items;
  }, [companyName, taxNumber]);

  async function handleSave() {
    if (!status) return;
    setSaving(true);
    try {
      await logClientActivity({
        action: "signature_external_verification",
        targetType: "signature",
        targetId: companyName || taxNumber || "external_verification",
        summary:
          status === "matched"
            ? `TTSG sicil teyidi: "${companyName || "(ünvan yok)"}" eşleşiyor`
            : status === "mismatch"
              ? `TTSG sicil teyidi: "${companyName || "(ünvan yok)"}" UYUŞMUYOR`
              : `TTSG sicil teyidi: "${companyName || "(ünvan yok)"}" belirsiz`,
        module: "signatures",
        severity: status === "mismatch" ? "warning" : "info",
        metadata: {
          status,
          companyName,
          taxNumber,
          note: note.trim() || undefined,
          source: "ttsg",
          sourceUrl: ttsgUrl,
        },
      });
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  }

  const StatusIcon = status
    ? STATUS_OPTIONS.find((o) => o.value === status)?.icon ?? ShieldQuestion
    : ShieldQuestion;

  return (
    <section className="rounded-2xl border border-workspace-border bg-workspace-surface p-6">
      <header className="mb-4 flex items-start gap-3">
        <StatusIcon
          className={`shrink-0 ${
            status === "matched"
              ? "text-accent-success"
              : status === "mismatch"
                ? "text-accent-danger"
                : "text-text-muted"
          }`}
          size={28}
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-text-primary">
            Sicil Doğrulama
          </h2>
          <p className="text-base text-text-secondary mt-1">
            Sirküdeki şirket bilgilerini Türkiye Ticaret Sicil Gazetesi'nde
            doğrula. Kayıt manuel olarak yapılır; sonuç audit log'a düşer.
          </p>
        </div>
      </header>

      {/* Detected company info */}
      {copyHints.length > 0 ? (
        <div className="mb-4 rounded-xl bg-workspace-bg border border-workspace-border/60 p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-muted mb-2">
            Sirküde tespit edilen
          </p>
          <ul className="space-y-1">
            {companyName && (
              <li className="flex items-center gap-2">
                <span className="text-[13px] text-text-muted shrink-0 w-20">Ünvan:</span>
                <span className="text-[15px] font-medium text-text-primary truncate">
                  {companyName}
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(companyName)}
                  className="text-[12px] text-accent-primary hover:underline ml-auto shrink-0"
                  title="Panoya kopyala"
                >
                  Kopyala
                </button>
              </li>
            )}
            {taxNumber && (
              <li className="flex items-center gap-2">
                <span className="text-[13px] text-text-muted shrink-0 w-20">VKN:</span>
                <span className="text-[15px] font-medium text-text-primary font-mono">
                  {taxNumber}
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(taxNumber)}
                  className="text-[12px] text-accent-primary hover:underline ml-auto shrink-0"
                  title="Panoya kopyala"
                >
                  Kopyala
                </button>
              </li>
            )}
          </ul>
        </div>
      ) : (
        <div className="mb-4 rounded-xl bg-accent-warning/[0.06] border border-accent-warning/30 p-3 text-[14px] text-text-secondary">
          Sirküden ünvan veya vergi no çıkarılamadı. TTSG sorgusu için bilgileri
          dilekçeden veya elle kopyalaman gerekecek.
        </div>
      )}

      {/* TTSG link */}
      <a
        href={ttsgUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[14px] font-semibold bg-accent-primary/10 text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/20 transition-colors mb-5"
      >
        <ExternalLink size={16} />
        TTSG'de aç
      </a>

      {/* Status selection */}
      <div className="mb-4">
        <p className="text-[13px] font-semibold text-text-secondary mb-2">
          TTSG'de doğruladıktan sonra sonucu işaretle:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {STATUS_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className={`text-left rounded-xl border p-3 transition-all ${
                  selected
                    ? "border-accent-primary bg-accent-primary/10 ring-1 ring-accent-primary/40"
                    : "border-workspace-border bg-workspace-bg hover:border-workspace-border/80"
                }`}
                aria-pressed={selected}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={16} className={opt.iconColor} />
                  <span className="text-[14px] font-semibold text-text-primary">
                    {opt.label}
                  </span>
                </div>
                <p className="text-[12px] text-text-secondary leading-relaxed">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional note */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Not (opsiyonel) — örn: 'TTSG kaydı 2024/567, ünvan tam eşleşiyor'"
        className="w-full rounded-xl bg-workspace-bg border border-workspace-border px-4 py-3 text-[14px] text-text-primary placeholder:text-text-muted min-h-[72px] resize-none focus:outline-none focus:border-accent-primary/40 mb-4"
      />

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave || saving}
          className="px-5 py-2.5 rounded-xl text-[14px] font-semibold bg-accent-primary text-white hover:bg-accent-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Kaydediliyor..." : savedAt ? "Yeniden kaydet" : "Doğrulamayı kaydet"}
        </button>
        {savedAt && (
          <span className="text-[13px] text-text-muted">
            Son kayıt: {savedAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </section>
  );
}
