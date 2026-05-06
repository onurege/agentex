"use client";

// ============================================================
// SignatureDecisionCard (T-6)
// ============================================================
//
// Replaces the previous ExternalVerificationCard. Combines TTSG
// manual verification + user's stage-1 decision in a single submit.
// On save, creates a SignaturePrecheck row in the database. After
// that:
//   - decision is locked for the user
//   - 'Yönetici onayına gönder' button appears
//   - once escalated, panel reviewers (authorized_user / super_admin)
//     pick it up
// ============================================================

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  XCircle,
} from "lucide-react";
import type { PrecheckResult } from "@/lib/signatures/precheck/types";

interface Props {
  result: PrecheckResult;
  sirkuFileName: string;
  petitionFileName: string;
  // True when the user manually overrode a critical precheck finding
  // to reach the comparison step. Persisted on submit so the panel
  // review can flag this decision.
  criticalOverride?: boolean;
}

type ExternalStatus = "matched" | "mismatch" | "unknown";
type UserDecision = "approved" | "rejected";

const TTSG_URL =
  "https://www.ticaretsicil.gov.tr/view/hizlierisim/unvansorgulama.php";

const EXTERNAL_OPTIONS: Array<{
  value: ExternalStatus;
  label: string;
  description: string;
  iconColor: string;
}> = [
  {
    value: "matched",
    label: "Eşleşiyor",
    description: "TTSG kaydı imza sirküsüyle aynı.",
    iconColor: "text-semantic-positive",
  },
  {
    value: "mismatch",
    label: "Eşleşmiyor",
    description: "TTSG kaydı imza sirküsüyle uyuşmuyor.",
    iconColor: "text-semantic-negative",
  },
  {
    value: "unknown",
    label: "Belirsiz",
    description: "TTSG kaydı bulunamadı veya yetersiz.",
    iconColor: "text-accent-warning",
  },
];

export function SignatureDecisionCard({
  result,
  sirkuFileName,
  petitionFileName,
  criticalOverride = false,
}: Props) {
  const companyName = result.sirku.companyName ?? "";
  const taxNumber = result.sirku.taxNumber ?? "";

  const [externalStatus, setExternalStatus] = useState<ExternalStatus | null>(null);
  const [externalNote, setExternalNote] = useState("");
  const [userDecision, setUserDecision] = useState<UserDecision | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [escalated, setEscalated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copyHints = useMemo(() => {
    const items: string[] = [];
    if (companyName) items.push(`Ünvan: ${companyName}`);
    if (taxNumber) items.push(`VKN: ${taxNumber}`);
    return items;
  }, [companyName, taxNumber]);

  const requireDecisionNote = userDecision === "rejected";
  const canSubmit =
    !recordId &&
    userDecision !== null &&
    (!requireDecisionNote || decisionNote.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit || !userDecision) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/signatures/precheck-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          sirkuFileName,
          petitionFileName,
          precheckResult: result,
          externalStatus,
          externalNote: externalNote.trim() || undefined,
          userDecision,
          userDecisionNote: decisionNote.trim() || undefined,
          criticalOverride,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!res.ok || !body.id) {
        setError(body.error ?? "kayit_basarisiz");
        return;
      }
      setRecordId(body.id);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEscalate() {
    if (!recordId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/signatures/precheck-records/${recordId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ action: "escalate" }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "eskalasyon_basarisiz");
        return;
      }
      setEscalated(true);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Saved state — locked, shows summary + escalation control ──
  if (recordId) {
    return (
      <section className="rounded-2xl border border-accent-primary/30 bg-accent-primary/[0.04] p-6">
        <header className="flex items-start gap-3 mb-3">
          <CheckCircle2 className="text-semantic-positive shrink-0" size={24} />
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-text-primary">
              Karar Kaydedildi
            </h2>
            <p className="text-base text-text-secondary mt-1">
              {userDecision === "approved"
                ? "Bu imza sirküsü ve belge çiftini onayladın. Karar kilitli — değiştiremezsin."
                : "Bu imza sirküsü ve belge çiftini reddettin. Karar kilitli — değiştiremezsin."}
            </p>
          </div>
        </header>
        <div className="rounded-xl bg-workspace-surface border border-workspace-border p-4 mb-4 space-y-2 text-[14px]">
          <div className="flex items-center gap-2">
            <span className="text-text-muted w-32 shrink-0">Şirket:</span>
            <span className="font-medium text-text-primary">{companyName || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted w-32 shrink-0">VKN:</span>
            <span className="font-mono text-text-primary">{taxNumber || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted w-32 shrink-0">TTSG sonucu:</span>
            <span className="text-text-primary">
              {externalStatus === "matched"
                ? "Eşleşiyor"
                : externalStatus === "mismatch"
                  ? "Eşleşmiyor"
                  : externalStatus === "unknown"
                    ? "Belirsiz"
                    : "Doğrulama yapılmadı"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted w-32 shrink-0">Karar:</span>
            <span
              className={`font-semibold ${
                userDecision === "approved"
                  ? "text-semantic-positive"
                  : "text-semantic-negative"
              }`}
            >
              {userDecision === "approved" ? "Onaylandı" : "Reddedildi"}
            </span>
          </div>
          {decisionNote && (
            <div className="flex gap-2">
              <span className="text-text-muted w-32 shrink-0">Not:</span>
              <span className="text-text-secondary">{decisionNote}</span>
            </div>
          )}
        </div>

        {escalated ? (
          <div className="rounded-xl border border-accent-warning/30 bg-accent-warning/[0.06] px-4 py-3 text-[14px] text-text-secondary">
            <span className="font-semibold text-accent-warning">
              Yönetici onayına gönderildi.
            </span>{" "}
            Yetkililer Panel → İmza Onayları&apos;nda bu kaydı görüyor; sonuç
            bildirilecek.
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void handleEscalate()}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl text-[14px] font-semibold bg-accent-warning/10 text-accent-warning border border-accent-warning/30 hover:bg-accent-warning/20 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Gönderiliyor..." : "Yönetici onayına gönder"}
          </button>
        )}
        {error && (
          <p className="text-[13px] text-semantic-negative mt-3">Hata: {error}</p>
        )}
      </section>
    );
  }

  // ── Unsaved state — fill in TTSG + decision, submit ──
  return (
    <section className="rounded-2xl border border-workspace-border bg-workspace-surface p-6">
      <header className="mb-4 flex items-start gap-3">
        <ShieldQuestion className="text-text-muted shrink-0" size={28} />
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-text-primary">
            Sicil Doğrulama ve Karar
          </h2>
          <p className="text-base text-text-secondary mt-1">
            Şirket bilgilerini TTSG&apos;de doğrula, ardından bu imza sirküsü ve belge
            çifti için kendi kararını ver. Karar bir kez kaydedilir ve
            kilitlenir; istersen yöneticiye gönderebilirsin.
          </p>
        </div>
      </header>

      {copyHints.length > 0 && (
        <div className="mb-4 rounded-xl bg-workspace-bg border border-workspace-border/60 p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-muted mb-2">
            İmza sirküsünde tespit edilen
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
                >
                  Kopyala
                </button>
              </li>
            )}
          </ul>
        </div>
      )}

      <a
        href={TTSG_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[14px] font-semibold bg-accent-primary/10 text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/20 transition-colors mb-5"
      >
        <ExternalLink size={16} />
        TTSG&apos;de aç
      </a>

      <div className="mb-5">
        <p className="text-[13px] font-semibold text-text-secondary mb-2">
          TTSG sonucu (opsiyonel):
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {EXTERNAL_OPTIONS.map((opt) => {
            const selected = externalStatus === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setExternalStatus(selected ? null : opt.value)
                }
                className={`text-left rounded-xl border p-3 transition-all ${
                  selected
                    ? "border-accent-primary bg-accent-primary/10 ring-1 ring-accent-primary/40"
                    : "border-workspace-border bg-workspace-bg hover:border-workspace-border/80"
                }`}
              >
                <span className="text-[14px] font-semibold text-text-primary">
                  {opt.label}
                </span>
                <p className="text-[12px] text-text-secondary leading-relaxed mt-0.5">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
        <textarea
          value={externalNote}
          onChange={(e) => setExternalNote(e.target.value)}
          placeholder="TTSG ile ilgili not (opsiyonel)"
          className="w-full mt-2 rounded-xl bg-workspace-bg border border-workspace-border px-3 py-2 text-[13px] text-text-primary placeholder:text-text-muted min-h-[56px] resize-none focus:outline-none focus:border-accent-primary/40"
        />
      </div>

      <div className="border-t border-workspace-border/40 pt-5">
        <p className="text-[14px] font-semibold text-text-primary mb-1">
          Bu imza sirküsü ve belge çifti için kararın:
        </p>
        <p className="text-[12px] text-text-muted mb-3">
          Karar kaydedildikten sonra değiştirilemez. Reddedersen sebep
          zorunludur.
        </p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => setUserDecision("approved")}
            className={`rounded-xl border p-3 transition-all flex items-center gap-2 ${
              userDecision === "approved"
                ? "border-semantic-positive bg-semantic-positive/10 ring-1 ring-semantic-positive/40"
                : "border-workspace-border bg-workspace-bg hover:border-workspace-border/80"
            }`}
          >
            <ShieldCheck size={18} className="text-semantic-positive" />
            <span className="text-[14px] font-semibold text-text-primary">
              Onayla
            </span>
          </button>
          <button
            type="button"
            onClick={() => setUserDecision("rejected")}
            className={`rounded-xl border p-3 transition-all flex items-center gap-2 ${
              userDecision === "rejected"
                ? "border-semantic-negative bg-semantic-negative/10 ring-1 ring-semantic-negative/40"
                : "border-workspace-border bg-workspace-bg hover:border-workspace-border/80"
            }`}
          >
            <XCircle size={18} className="text-semantic-negative" />
            <span className="text-[14px] font-semibold text-text-primary">
              Reddet
            </span>
          </button>
        </div>

        <textarea
          value={decisionNote}
          onChange={(e) => setDecisionNote(e.target.value)}
          placeholder={
            requireDecisionNote
              ? "Red sebebi (zorunlu)"
              : "Karar notu (opsiyonel)"
          }
          className={`w-full rounded-xl bg-workspace-bg border px-4 py-3 text-[14px] text-text-primary placeholder:text-text-muted min-h-[72px] resize-none focus:outline-none transition-colors ${
            requireDecisionNote && decisionNote.trim().length === 0
              ? "border-semantic-negative/40 focus:border-semantic-negative/60"
              : "border-workspace-border focus:border-accent-primary/40"
          }`}
        />

        <div className="flex items-center gap-3 mt-4">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || submitting}
            className="px-5 py-2.5 rounded-xl text-[14px] font-semibold bg-accent-primary text-white hover:bg-accent-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Kaydediliyor..." : "Kararı kaydet"}
          </button>
          {error && (
            <span className="text-[13px] text-semantic-negative">Hata: {error}</span>
          )}
        </div>

        {!userDecision && (
          <p className="text-[12px] text-text-muted mt-2">
            Önce karar seç (Onayla / Reddet).
          </p>
        )}
      </div>
    </section>
  );
}

// Tree-shake helpers — ShieldAlert + ShieldCheck imported above for
// later sub-status indicators; keep ESLint quiet about unused imports
// in case the lint rule flips on this file.
void ShieldAlert;
