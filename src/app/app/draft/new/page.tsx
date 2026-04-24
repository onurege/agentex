"use client";

// ============================================================
// /app/draft/new — Template Picker
// ============================================================
//
// 3 şablon kartı + createSession akışı. Seçilen şablonla yeni
// oturum açılır ve /app/draft/[id] wizard'ına yönlendirilir.
// Wizard'ın kendisi Faz 1'de dolacak — bu commit picker'ı
// tamamlar.
// ============================================================

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Clock,
  Handshake,
  Lock,
} from "lucide-react";
import { DraftLayout } from "@/components/draft/DraftLayout";
import { useDraftStore } from "@/lib/draft/store";
import {
  TEMPLATE_META,
  TEMPLATE_ORDER,
  type TemplateMeta,
} from "@/lib/draft/templates/registry";
import type { TemplateId } from "@/lib/draft/types";

const ICON_MAP = {
  lock: Lock,
  handshake: Handshake,
  briefcase: Briefcase,
} as const;

export default function DraftTemplatePickerPage() {
  const router = useRouter();
  const createSession = useDraftStore((s) => s.createSession);

  const handlePick = useCallback(
    (templateId: TemplateId) => {
      const id = createSession(templateId);
      router.push(`/app/draft/${id}`);
    },
    [createSession, router],
  );

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

        <ul className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TEMPLATE_ORDER.map((id) => (
            <li key={id}>
              <TemplateCard
                meta={TEMPLATE_META[id]}
                onPick={() => handlePick(id)}
              />
            </li>
          ))}
        </ul>
      </div>
    </DraftLayout>
  );
}

function TemplateCard({
  meta,
  onPick,
}: {
  meta: TemplateMeta;
  onPick(): void;
}) {
  const Icon = ICON_MAP[meta.iconKey];
  return (
    <button
      type="button"
      onClick={onPick}
      className="group text-left w-full h-full rounded-xl border border-workspace-border bg-workspace-surface p-6 hover:border-accent-primary/40 hover:shadow-medium transition-all flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-lg bg-accent-primary/10 border border-accent-primary/20 text-accent-primary flex items-center justify-center">
          <Icon size={22} />
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-mono text-text-tertiary">
          <Clock size={11} />
          ~{meta.estimatedMinutes} dk
        </span>
      </div>

      <div className="text-[10px] font-mono font-semibold tracking-widest uppercase text-accent-primary mb-1.5">
        {meta.category}
      </div>
      <h3 className="font-display text-lg font-semibold text-text-primary mb-2 leading-tight">
        {meta.label}
      </h3>
      <p className="text-sm text-text-secondary leading-relaxed mb-5 flex-1">
        {meta.description}
      </p>

      <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-primary group-hover:translate-x-0.5 transition-transform">
        Şablonla başla
        <ArrowRight size={15} />
      </div>
    </button>
  );
}
