"use client";

// ============================================================
// /app/draft — Draft Module Landing
// ============================================================
//
// Hero + CTA + taslak geçmiş listesi. Şablon seçimi /new
// altında — landing sadece giriş noktası ve önceden başlatılan
// taslakları listeler.
// ============================================================

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  Briefcase,
  Clock,
  FilePlus2,
  Handshake,
  Lock,
  Trash2,
} from "lucide-react";
import { DraftLayout } from "@/components/draft/DraftLayout";
import { useDraftStore } from "@/lib/draft/store";
import { useHydrated } from "@/lib/draft/use-hydrated";
import {
  TEMPLATE_META,
  type TemplateMeta,
} from "@/lib/draft/templates/registry";

const ICON_MAP = {
  lock: Lock,
  handshake: Handshake,
  briefcase: Briefcase,
} as const;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function DraftModuleLanding() {
  const hydrated = useHydrated();
  const rawSessions = useDraftStore((s) => s.listSessions());
  const deleteSession = useDraftStore((s) => s.deleteSession);

  // Persist rehydrate olmadan sessions dizisini render etme — SSR ve ilk
  // client render aynı (boş) durumu görmeli, ardından effect tetiklenince
  // gerçek taslaklar gösterilir. Aksi halde hydration mismatch hatası çıkar.
  const sessions = hydrated ? rawSessions : [];

  const hasSessions = sessions.length > 0;
  const counts = useMemo(() => {
    const complete = sessions.filter((s) => s.status === "complete").length;
    return { total: sessions.length, complete, draft: sessions.length - complete };
  }, [sessions]);

  return (
    <DraftLayout>
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero */}
        <section className="relative rounded-2xl border border-workspace-border bg-workspace-surface p-10 mb-12 overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-accent-primary/[0.05] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-accent-warning/[0.05] blur-3xl" />

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 text-xs font-mono font-semibold tracking-wider uppercase text-accent-primary bg-accent-primary/10 border border-accent-primary/20 rounded-full">
                <FilePlus2 size={12} />
                Sıfırdan Sözleşme
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-text-primary mb-3 leading-tight">
                Şablondan başlayın, soruları yanıtlayın, DOCX alın
              </h1>
              <p className="text-base text-text-secondary leading-relaxed">
                Gizlilik, bayilik ve hizmet alım sözleşmeleri için hazır
                şablonlar. Adım adım sorular sizi doldurmanız gereken her
                alanda yönlendirir, sözleşme anlık olarak yanınızda şekillenir.
              </p>
            </div>

            <Link
              href="/app/draft/new"
              className="group inline-flex items-center gap-2.5 px-6 py-3.5 text-base font-semibold rounded-xl bg-accent-primary text-workspace-surface hover:bg-accent-secondary transition-all shadow-medium self-start md:self-auto"
            >
              Yeni Sözleşme
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>

        {/* History */}
        <section>
          <header className="flex items-baseline justify-between mb-5">
            <h2 className="font-display text-xl font-semibold text-text-primary">
              Taslaklarım
            </h2>
            {hasSessions && (
              <span className="text-sm text-text-tertiary font-mono">
                {counts.total} taslak · {counts.complete} tamamlandı
              </span>
            )}
          </header>

          {!hasSessions && (
            <div className="rounded-xl border border-dashed border-workspace-border bg-workspace-elevated p-12 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-workspace-surface border border-workspace-border flex items-center justify-center">
                <FilePlus2 size={22} className="text-text-muted" />
              </div>
              <p className="font-display text-lg font-semibold text-text-primary mb-1.5">
                Henüz taslak yok
              </p>
              <p className="text-sm text-text-secondary mb-6 max-w-md mx-auto">
                İlk sözleşmenizi başlatın. Bir şablon seçin, soruları
                yanıtlayın, DOCX olarak indirin.
              </p>
              <Link
                href="/app/draft/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent-primary text-workspace-surface hover:bg-accent-secondary transition-colors"
              >
                Başla
                <ArrowRight size={15} />
              </Link>
            </div>
          )}

          {hasSessions && (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map((session) => {
                const meta: TemplateMeta | undefined =
                  TEMPLATE_META[session.templateId];
                const Icon = meta ? ICON_MAP[meta.iconKey] : FilePlus2;
                return (
                  <li key={session.id}>
                    <div className="group relative rounded-xl border border-workspace-border bg-workspace-surface p-5 hover:border-accent-primary/30 hover:shadow-medium transition-all">
                      <Link
                        href={`/app/draft/${session.id}`}
                        className="absolute inset-0 z-0 rounded-xl"
                        aria-label={`${meta?.label ?? session.templateId} taslağını aç`}
                      />
                      <header className="relative z-10 flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs font-mono text-text-tertiary">
                          <Clock size={12} />
                          {formatDate(session.updatedAt)}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (confirm("Bu taslak silinsin mi?")) {
                              deleteSession(session.id);
                            }
                          }}
                          className="relative z-10 p-1.5 rounded-md text-text-muted hover:text-accent-danger hover:bg-accent-danger/10 transition-colors"
                          aria-label="Taslağı sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      </header>
                      <div className="relative z-[-1] flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 shrink-0 rounded-lg bg-accent-primary/10 border border-accent-primary/20 text-accent-primary flex items-center justify-center">
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-mono font-semibold tracking-widest uppercase text-accent-primary mb-0.5">
                            {meta?.category ?? "Şablon"}
                          </div>
                          <p className="font-display text-base font-semibold text-text-primary leading-tight truncate">
                            {meta?.label ?? session.templateId}
                          </p>
                        </div>
                      </div>
                      <footer className="relative z-[-1] flex items-center gap-2 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono border ${
                            session.status === "complete"
                              ? "bg-accent-success/10 text-accent-success border-accent-success/25"
                              : "bg-workspace-elevated text-text-secondary border-workspace-border"
                          }`}
                        >
                          {session.status === "complete"
                            ? "Tamamlandı"
                            : "Taslak"}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-workspace-elevated text-text-tertiary border border-workspace-border font-mono">
                          {Object.keys(session.answers).length} cevap
                        </span>
                      </footer>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </DraftLayout>
  );
}
